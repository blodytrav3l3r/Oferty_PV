import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getSharedIdsForUser } from '../../utils/ownership';
import { normalizedCreatedAtSql, toNum } from '../../utils/searchUtils';
import { logger } from '../../utils/logger';
import { mapPrismaError } from '../../utils/prismaErrors';

const router = express.Router();

interface StatsUser {
    id: string;
    role?: string;
    subUsers?: string[];
}

/**
 * Warunek przynależności oferty (alias o/s, bez WHERE) — owner + pro subUsers
 * + udostępnione (spójnie z search). Admin dostaje 1=1.
 */
export function buildOfferScopeCondition(
    user: StatsUser,
    alias: string,
    sharedIds: string[]
): Prisma.Sql {
    const a = Prisma.raw(alias);
    if (user.role === 'admin') return Prisma.sql`1=1`;
    const allowedIds = (
        user.role === 'pro' ? [user.id, ...(user.subUsers || [])] : [user.id]
    ).filter((v) => typeof v === 'string' && v !== '');
    const parts: Prisma.Sql[] = [];
    if (allowedIds.length > 0) {
        parts.push(Prisma.sql`${a}."userId" IN (${Prisma.join(allowedIds)})`);
    }
    if (sharedIds.length > 0) {
        parts.push(Prisma.sql`${a}."id" IN (${Prisma.join(sharedIds)})`);
    }
    if (parts.length === 0) return Prisma.sql`1=0`;
    if (parts.length === 1) return parts[0];
    return Prisma.sql`(${parts[0]} OR ${parts[1]})`;
}

/**
 * CTE latest (wspólne dla outcomes/reasons/competitors/values/perRep).
 * Niesie createdByUserId dla atrybucji wins (P5.2).
 */
export function buildLatestCte(fuScope: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`latest AS (
        SELECT f."offerKind", f."offerId", f."outcome", f."loseReason", f."competitor", f."competitorPrice", f."createdByUserId"
        FROM (
            SELECT f."offerKind", f."offerId", f."outcome", f."loseReason", f."competitor", f."competitorPrice", f."createdByUserId",
                ROW_NUMBER() OVER (PARTITION BY f."offerKind", f."offerId" ORDER BY f."contactedAt" DESC, f."createdAt" DESC, f."id" DESC) AS "rn"
            FROM offer_follow_ups f
            WHERE ${fuScope}
        ) f WHERE f."rn" = 1
    )`;
}

/** Filtr wierszy follow-up do ofert widocznych dla usera. */
function followUpScope(scopeRury: Prisma.Sql, scopeStudnie: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`(
        (f."offerKind" = 'rury' AND EXISTS (SELECT 1 FROM offers_rel o WHERE o."id" = f."offerId" AND ${scopeRury}))
        OR (f."offerKind" = 'studnie' AND EXISTS (SELECT 1 FROM offers_studnie_rel s WHERE s."id" = f."offerId" AND ${scopeStudnie}))
    )`;
}

/**
 * P5.2: wins = oferty z latest WON przypisane autorowi wpisu latest
 * (nie liczba wpisów WON). Join po (kind, id, autor) — wygraną dostaje
 * autor domykającego wpisu, nie każdy wcześniejszy WON.
 * CTE latest musi nieść createdByUserId (doklejane przez caller).
 */
export function buildPerRepSql(fuScope: Prisma.Sql, latestCte: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`WITH ${latestCte}
        SELECT f."createdByUserId" AS "u", COUNT(*) AS "contacts",
            COUNT(DISTINCT f."offerKind" || ':' || f."offerId") AS "offers",
            COUNT(DISTINCT CASE WHEN l."outcome" = 'WON'
                THEN l."offerKind" || ':' || l."offerId" END) AS "wins"
        FROM offer_follow_ups f
        LEFT JOIN latest l ON l."offerKind" = f."offerKind"
            AND l."offerId" = f."offerId"
            AND l."createdByUserId" = f."createdByUserId"
        WHERE ${fuScope} GROUP BY f."createdByUserId" ORDER BY "contacts" DESC`;
}

// P4.2: jeden kontrakt konwersji (toNum z searchUtils), brak lokalnych wariantów.
const num = (v: unknown): number => toNum(v as number | bigint | string | null | undefined) ?? 0;

/**
 * GET /followups/stats — analityka opieki nad ofertą (P3, read-only).
 * latest = ROW_NUMBER() OVER (PARTITION BY offerKind, offerId
 *   ORDER BY contactedAt DESC, createdAt DESC) — ta sama definicja co search.
 */
router.get('/followups/stats', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const user = authReq.user as StatsUser | undefined;
        if (!user?.id) {
            return res.status(401).json({ error: 'Nieautoryzowany' });
        }

        // Fail-closed: współdzielenie niedostępne = tylko własne (nigdy crash).
        const [sharedRury = [], sharedStudnie = []] =
            user.role === 'admin'
                ? [[], []]
                : ((await Promise.all([
                      getSharedIdsForUser(user.id, 'offer'),
                      getSharedIdsForUser(user.id, 'offer_studnie')
                  ]).catch(() => [[], []])) as string[][]);
        const scopeRury = buildOfferScopeCondition(user, 'o', sharedRury);
        const scopeStudnie = buildOfferScopeCondition(user, 's', sharedStudnie);
        const fuScope = followUpScope(scopeRury, scopeStudnie);

        const latestCte = buildLatestCte(fuScope);

        // P4.2: 9 niezależnych SELECTów współbieżnie (brak zależności
        // wynikowych, read-only). Kolejność wyników z destrukturyzacji.
        const [
            outcomeRows,
            totalsRury,
            totalsStudnie,
            reasonRows,
            abandonedReasonRows,
            competitorRows,
            valueRows,
            repRows,
            firstRows
        ] = (await Promise.all([
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte} SELECT "outcome", COUNT(*) AS "c" FROM latest GROUP BY "outcome"`
            ),
            prisma.$queryRaw(
                Prisma.sql`SELECT COUNT(*) AS "total",
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM offer_follow_ups f WHERE f."offerKind" = 'rury' AND f."offerId" = o."id") THEN 0 ELSE 1 END) AS "nocontact"
                    FROM offers_rel o WHERE ${scopeRury}`
            ),
            prisma.$queryRaw(
                Prisma.sql`SELECT COUNT(*) AS "total",
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM offer_follow_ups f WHERE f."offerKind" = 'studnie' AND f."offerId" = s."id") THEN 0 ELSE 1 END) AS "nocontact"
                    FROM offers_studnie_rel s WHERE ${scopeStudnie}`
            ),
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte} SELECT "loseReason" AS "r", COUNT(*) AS "c" FROM latest
                    WHERE "outcome" IN ('LOST_COMPETITION', 'LOST_OTHER') GROUP BY "loseReason" ORDER BY "c" DESC`
            ),
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte} SELECT "loseReason" AS "r", COUNT(*) AS "c" FROM latest
                    WHERE "outcome" = 'ABANDONED' GROUP BY "loseReason" ORDER BY "c" DESC`
            ),
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte} SELECT "competitor" AS "cp", COUNT(*) AS "c", AVG("competitorPrice") AS "avg"
                    FROM latest WHERE "outcome" = 'LOST_COMPETITION' GROUP BY "competitor" ORDER BY "c" DESC`
            ),
            // CTE latest już scoped — join nie dokleja scope drugi raz (P4.2).
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte}
                    SELECT 'won' AS "k", SUM(CAST(json_extract(o."data", '$.totalBrutto') AS REAL)) AS "v"
                    FROM offers_rel o JOIN latest l ON l."offerKind" = 'rury' AND l."offerId" = o."id"
                    WHERE l."outcome" = 'WON'
                    UNION ALL
                    SELECT 'won', SUM(CAST(json_extract(s."data", '$.totalBrutto') AS REAL))
                    FROM offers_studnie_rel s JOIN latest l ON l."offerKind" = 'studnie' AND l."offerId" = s."id"
                    WHERE l."outcome" = 'WON'
                    UNION ALL
                    SELECT 'lost', SUM(CAST(json_extract(o."data", '$.totalBrutto') AS REAL))
                    FROM offers_rel o JOIN latest l ON l."offerKind" = 'rury' AND l."offerId" = o."id"
                    WHERE l."outcome" IN ('LOST_COMPETITION', 'LOST_OTHER')
                    UNION ALL
                    SELECT 'lost', SUM(CAST(json_extract(s."data", '$.totalBrutto') AS REAL))
                    FROM offers_studnie_rel s JOIN latest l ON l."offerKind" = 'studnie' AND l."offerId" = s."id"
                    WHERE l."outcome" IN ('LOST_COMPETITION', 'LOST_OTHER')`
            ),
            prisma.$queryRaw(buildPerRepSql(fuScope, latestCte)),
            // Średni czas do pierwszego kontaktu (globalnie): pierwszy kontakt
            // oferty vs data utworzenia oferty (ISO lub epoch-ms — reuse normalizacji).
            prisma.$queryRaw(
                Prisma.sql`SELECT AVG((julianday("first_c") - julianday("oc")) * 24) AS "h" FROM (
                    SELECT (SELECT MIN(f2."contactedAt") FROM offer_follow_ups f2
                            WHERE f2."offerKind" = 'rury' AND f2."offerId" = o."id") AS "first_c",
                        ${normalizedCreatedAtSql('o."createdAt"')} AS "oc"
                    FROM offers_rel o WHERE ${scopeRury}
                    UNION ALL
                    SELECT (SELECT MIN(f2."contactedAt") FROM offer_follow_ups f2
                            WHERE f2."offerKind" = 'studnie' AND f2."offerId" = s."id"),
                        ${normalizedCreatedAtSql('s."createdAt"')}
                    FROM offers_studnie_rel s WHERE ${scopeStudnie}
                ) WHERE "first_c" IS NOT NULL AND "oc" IS NOT NULL`
            )
        ])) as [
            Array<{ outcome: string; c: number | bigint }>,
            Array<{ total: number | bigint; nocontact: number | bigint | null }>,
            Array<{ total: number | bigint; nocontact: number | bigint | null }>,
            Array<{ r: string | null; c: number | bigint }>,
            Array<{ r: string | null; c: number | bigint }>,
            Array<{ cp: string | null; c: number | bigint; avg: number | null }>,
            Array<{ k: string; v: number | null }>,
            Array<{
                u: string;
                contacts: number | bigint;
                offers: number | bigint;
                wins: number | bigint | null;
            }>,
            Array<{ h: number | null }>
        ];

        const outcomes: Record<string, number> = {};
        for (const r of outcomeRows) outcomes[r.outcome] = num(r.c);
        const offersTotal = num(totalsRury[0]?.total) + num(totalsStudnie[0]?.total);
        const noContact = num(totalsRury[0]?.nocontact) + num(totalsStudnie[0]?.nocontact);
        const won = outcomes['WON'] ?? 0;
        // Jedna definicja domknięć: lost = LOST_* (osobno), abandoned = ABANDONED
        // (osobno) — spójnie z careStatus (osobne statusy) i care summary.
        const lost = (outcomes['LOST_COMPETITION'] ?? 0) + (outcomes['LOST_OTHER'] ?? 0);
        const abandoned = outcomes['ABANDONED'] ?? 0;
        const closed = won + lost + abandoned;

        let wonValue = 0;
        let lostValue = 0;
        for (const r of valueRows) {
            if (r.k === 'won') wonValue += num(r.v);
            else lostValue += num(r.v);
        }

        return res.json({
            ok: true,
            stats: {
                outcomes,
                offersTotal,
                noContact,
                conversion: closed > 0 ? won / closed : 0,
                abandoned,
                wonValue,
                lostValue,
                lossReasons: reasonRows.map((r) => ({
                    reason: r.r ?? 'Nie podano',
                    count: num(r.c)
                })),
                abandonedReasons: abandonedReasonRows.map((r) => ({
                    reason: r.r ?? 'Nie podano',
                    count: num(r.c)
                })),
                competitors: competitorRows.map((r) => ({
                    competitor: r.cp ?? 'Nieznany',
                    count: num(r.c),
                    avgPrice: r.avg === null ? null : Number(r.avg)
                })),
                perRep: repRows.map((r) => ({
                    userId: r.u,
                    contacts: num(r.contacts),
                    offers: num(r.offers),
                    wins: num(r.wins)
                })),
                avgFirstContactH: firstRows[0]?.h === null ? null : Number(firstRows[0]?.h ?? null)
            }
        });
    } catch (e) {
        if (mapPrismaError(res, e)) return;
        logger.error('FollowUpStats', 'Błąd analityki opieki', {
            error: e instanceof Error ? e.message : String(e)
        });
        return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
