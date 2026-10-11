import express from 'express';
import { z } from 'zod';
import prisma, { Prisma } from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { READ_LIMITER } from '../../middleware/rateLimiters';
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
 * opts.allowedIds: jawny zakres (mine/team/all z query) — null = wszystko.
 * opts.narrowOwner: zawężenie do 1 handlowca (repId po walidacji w route),
 *   AND wewnątrz scope — nigdy zamiast scope.
 */
export function buildOfferScopeCondition(
    user: StatsUser,
    alias: string,
    sharedIds: string[],
    opts?: { allowedIds?: string[] | null; narrowOwner?: string | null }
): Prisma.Sql {
    const a = Prisma.raw(alias);
    const narrow = opts?.narrowOwner;
    if (opts && opts.allowedIds === null)
        return narrow ? Prisma.sql`${a}."userId" = ${narrow}` : Prisma.sql`1=1`;
    const allowedIds = (
        opts?.allowedIds ?? (user.role === 'pro' ? [user.id, ...(user.subUsers || [])] : [user.id])
    ).filter((v) => typeof v === 'string' && v !== '');
    if (user.role === 'admin' && opts?.allowedIds === undefined)
        return narrow ? Prisma.sql`${a}."userId" = ${narrow}` : Prisma.sql`1=1`;
    const parts: Prisma.Sql[] = [];
    if (allowedIds.length > 0) {
        parts.push(Prisma.sql`${a}."userId" IN (${Prisma.join(allowedIds)})`);
    }
    if (sharedIds.length > 0) {
        parts.push(Prisma.sql`${a}."id" IN (${Prisma.join(sharedIds)})`);
    }
    if (parts.length === 0) return Prisma.sql`1=0`;
    const base = parts.length === 1 ? parts[0] : Prisma.sql`(${parts[0]} OR ${parts[1]})`;
    if (narrow) return Prisma.sql`(${base} AND ${a}."userId" = ${narrow})`;
    return base;
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

const ISO_DATETIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-](\d{2}):?(\d{2}))$/;

function isStrictIsoDateTime(s: string): boolean {
    const m = ISO_DATETIME_RE.exec(s);
    if (!m) return false;
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59) return false;
    return Number.isFinite(Date.parse(s));
}

const MAX_RANGE_MS = 366 * 86400000;

const statsQuerySchema = z
    .object({
        scope: z.enum(['mine', 'team', 'all']).optional(),
        repId: z.string().min(1).max(50).optional(),
        from: z
            .string()
            .refine(isStrictIsoDateTime, { message: 'Nieprawidłowa data ISO-8601' })
            .optional(),
        to: z
            .string()
            .refine(isStrictIsoDateTime, { message: 'Nieprawidłowa data ISO-8601' })
            .optional()
    })
    .refine((d) => !d.from || !d.to || Date.parse(d.from) <= Date.parse(d.to), {
        message: 'Zakres dat: from musi być <= to'
    })
    .refine((d) => !d.from || !d.to || Date.parse(d.to) - Date.parse(d.from) <= MAX_RANGE_MS, {
        message: 'Zakres dat: maksymalnie 366 dni'
    });

/** Rury: tylko blob.totalBrutto (brak kolumny ceny — jak search). */
function ruryValueSql(alias: string): Prisma.Sql {
    const d = Prisma.raw(`${alias}."data"`);
    return Prisma.sql`CAST(json_extract(${d}, '$.totalBrutto') AS REAL)`;
}

/** Studnie: ten sam guard co kolejka opieki (kolumna > blob > wellsExport). */
function studnieValueSql(alias: string): Prisma.Sql {
    const t = Prisma.raw(`${alias}."totalPrice"`);
    const d = Prisma.raw(`${alias}."data"`);
    return Prisma.sql`CAST(COALESCE(NULLIF(${t}, 0), json_extract(${d}, '$.totalBrutto'), (SELECT CAST(ROUND(COALESCE(SUM(value->>'totalPrice'), 0), 2) AS REAL) FROM json_each(${d}, '$.wellsExport'))) AS REAL)`;
}

/** Zakres po dacie utworzenia oferty (born). Zawsze przez normalizedCreatedAtSql
 *  (istnieją wiersze epoch-ms) + parametryzacja Prisma.sql — nigdy raw >= . */
function buildBornRange(col: string, from?: string, to?: string): Prisma.Sql | null {
    if (!from && !to) return null;
    const norm = normalizedCreatedAtSql(col);
    const parts: Prisma.Sql[] = [];
    if (from) parts.push(Prisma.sql`${norm} >= ${from}`);
    if (to) parts.push(Prisma.sql`${norm} <= ${to}`);
    return parts.length === 2 ? Prisma.sql`(${parts[0]} AND ${parts[1]})` : parts[0];
}

/**
 * GET /followups/stats — analityka opieki nad ofertą (P3, read-only).
 * latest = ROW_NUMBER() OVER (PARTITION BY offerKind, offerId
 *   ORDER BY contactedAt DESC, createdAt DESC) — ta sama definicja co search.
 */
router.get('/followups/stats', requireAuth, READ_LIMITER, async (req, res) => {
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

        const parsed = statsQuerySchema.safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ error: 'Nieprawidłowy zakres dat' });
        const { from, to, scope, repId } = parsed.data;
        // Jawny scope jak w opiece (mine/team/all, fail-closed 403).
        // Brak scope = legacy: rola decyduje (user→własne, pro→+sub, admin→wszystko).
        let allowed: string[] | null | undefined;
        if (scope === 'all') {
            if (user.role !== 'admin')
                return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
            allowed = null;
        } else if (scope === 'team') {
            if (user.role !== 'pro' && user.role !== 'admin')
                return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
            allowed = [user.id, ...(user.subUsers || [])];
        } else if (scope === 'mine') {
            allowed = [user.id];
        }
        // repId po tej samej regule co opieka (resolveRepOwner): user tylko
        // siebie, pro siebie + subUsers, admin każdego. Fail-closed 403.
        let narrow: string | null = null;
        if (repId) {
            if (repId === user.id) narrow = user.id;
            else if (user.role === 'admin') narrow = repId;
            else if (user.role === 'pro' && (user.subUsers || []).includes(repId)) narrow = repId;
            else return res.status(403).json({ error: 'Brak uprawnień do zakresu' });
        }
        const condOpts =
            allowed === undefined && narrow === null
                ? undefined
                : { allowedIds: allowed, narrowOwner: narrow };
        const scopeRury = buildOfferScopeCondition(user, 'o', sharedRury, condOpts);
        const scopeStudnie = buildOfferScopeCondition(user, 's', sharedStudnie, condOpts);
        const fuScope = followUpScope(scopeRury, scopeStudnie);

        const latestCte = buildLatestCte(fuScope);

        const bornRury = buildBornRange('o."createdAt"', from, to);
        const bornStudnie = buildBornRange('s."createdAt"', from, to);
        const andBornRury = bornRury ? Prisma.sql` AND ${bornRury}` : Prisma.empty;
        const andBornStudnie = bornStudnie ? Prisma.sql` AND ${bornStudnie}` : Prisma.empty;
        // Zamówienia: scope tylko po userId (allowedIds jak oferty, bez shares
        // po ID ofert — osobny byt, osobny kafelek). SELECT-only, bez migracji.
        const orderScopeRury = buildOfferScopeCondition(user, 'o', [], condOpts);
        const orderScopeStudnie = buildOfferScopeCondition(user, 's', [], condOpts);
        // Konwersja robi się zakresowa (licznik i mianownik z ofert w zakresie),
        // nie globalna: latest jest scoped, born dokładamy JOINem do ofert.
        const outcomeSql =
            !bornRury || !bornStudnie
                ? Prisma.sql`WITH ${latestCte} SELECT "outcome", COUNT(*) AS "c" FROM latest GROUP BY "outcome"`
                : Prisma.sql`WITH ${latestCte} SELECT l."outcome", COUNT(*) AS "c" FROM latest l WHERE ((l."offerKind" = 'rury' AND EXISTS (SELECT 1 FROM offers_rel o WHERE o."id" = l."offerId" AND ${bornRury})) OR (l."offerKind" = 'studnie' AND EXISTS (SELECT 1 FROM offers_studnie_rel s WHERE s."id" = l."offerId" AND ${bornStudnie}))) GROUP BY l."outcome"`;

        // P4.2: 11 niezależnych SELECTów współbieżnie (brak zależności
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
            firstRows,
            ordersRury,
            ordersStudnie
        ] = (await Promise.all([
            prisma.$queryRaw(outcomeSql),
            prisma.$queryRaw(
                Prisma.sql`SELECT COUNT(*) AS "total",
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM offer_follow_ups f WHERE f."offerKind" = 'rury' AND f."offerId" = o."id") THEN 0 ELSE 1 END) AS "nocontact"
                    FROM offers_rel o WHERE ${scopeRury}${andBornRury}`
            ),
            prisma.$queryRaw(
                Prisma.sql`SELECT COUNT(*) AS "total",
                    SUM(CASE WHEN EXISTS (SELECT 1 FROM offer_follow_ups f WHERE f."offerKind" = 'studnie' AND f."offerId" = s."id") THEN 0 ELSE 1 END) AS "nocontact"
                    FROM offers_studnie_rel s WHERE ${scopeStudnie}${andBornStudnie}`
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
            // 'total' = wszystkie scoped oferty w zakresie; 'open' = brak latest
            // lub latest OPEN w zakresie (LEFT JOIN — oferty bez wpisu też otwarte).
            prisma.$queryRaw(
                Prisma.sql`WITH ${latestCte}
                    SELECT 'won' AS "k", SUM(${ruryValueSql('o')}) AS "v"
                    FROM offers_rel o JOIN latest l ON l."offerKind" = 'rury' AND l."offerId" = o."id"
                    WHERE l."outcome" = 'WON'${andBornRury}
                    UNION ALL
                    SELECT 'won', SUM(${studnieValueSql('s')})
                    FROM offers_studnie_rel s JOIN latest l ON l."offerKind" = 'studnie' AND l."offerId" = s."id"
                    WHERE l."outcome" = 'WON'${andBornStudnie}
                    UNION ALL
                    SELECT 'lost', SUM(${ruryValueSql('o')})
                    FROM offers_rel o JOIN latest l ON l."offerKind" = 'rury' AND l."offerId" = o."id"
                    WHERE l."outcome" IN ('LOST_COMPETITION', 'LOST_OTHER')${andBornRury}
                    UNION ALL
                    SELECT 'lost', SUM(${studnieValueSql('s')})
                    FROM offers_studnie_rel s JOIN latest l ON l."offerKind" = 'studnie' AND l."offerId" = s."id"
                    WHERE l."outcome" IN ('LOST_COMPETITION', 'LOST_OTHER')${andBornStudnie}
                    UNION ALL
                    SELECT 'total', SUM(${ruryValueSql('o')})
                    FROM offers_rel o WHERE ${scopeRury}${andBornRury}
                    UNION ALL
                    SELECT 'total', SUM(${studnieValueSql('s')})
                    FROM offers_studnie_rel s WHERE ${scopeStudnie}${andBornStudnie}
                    UNION ALL
                    SELECT 'open', SUM(${ruryValueSql('o')})
                    FROM offers_rel o LEFT JOIN latest l ON l."offerKind" = 'rury' AND l."offerId" = o."id"
                    WHERE (l."outcome" IS NULL OR l."outcome" = 'OPEN') AND ${scopeRury}${andBornRury}
                    UNION ALL
                    SELECT 'open', SUM(${studnieValueSql('s')})
                    FROM offers_studnie_rel s LEFT JOIN latest l ON l."offerKind" = 'studnie' AND l."offerId" = s."id"
                    WHERE (l."outcome" IS NULL OR l."outcome" = 'OPEN') AND ${scopeStudnie}${andBornStudnie}`
            ),
            prisma.$queryRaw(buildPerRepSql(fuScope, latestCte)),
            // Średni czas do pierwszego kontaktu (globalnie): pierwszy kontakt
            // oferty vs data utworzenia oferty (ISO lub epoch-ms — reuse normalizacji).
            prisma.$queryRaw(
                Prisma.sql`SELECT AVG((julianday("first_c") - julianday("oc")) * 24) AS "h" FROM (
                    SELECT (SELECT MIN(f2."contactedAt") FROM offer_follow_ups f2
                            WHERE f2."offerKind" = 'rury' AND f2."offerId" = o."id") AS "first_c",
                        ${normalizedCreatedAtSql('o."createdAt"')} AS "oc"
                    FROM offers_rel o WHERE ${scopeRury}${andBornRury}
                    UNION ALL
                    SELECT (SELECT MIN(f2."contactedAt") FROM offer_follow_ups f2
                            WHERE f2."offerKind" = 'studnie' AND f2."offerId" = s."id"),
                        ${normalizedCreatedAtSql('s."createdAt"')}
                    FROM offers_studnie_rel s WHERE ${scopeStudnie}${andBornStudnie}
                ) WHERE "first_c" IS NOT NULL AND "oc" IS NOT NULL`
            ),
            prisma.$queryRaw(
                Prisma.sql`SELECT SUM(CAST(COALESCE(json_extract(o."data", '$.totalBrutto'), json_extract(o."data", '$.summary.totalBrutto')) AS REAL)) AS "ovr" FROM orders_rury_rel o WHERE ${orderScopeRury}${andBornRury}`
            ),
            prisma.$queryRaw(
                Prisma.sql`SELECT SUM(CAST(COALESCE(json_extract(s."data", '$.totalBrutto'), json_extract(s."data", '$.summary.totalBrutto')) AS REAL)) AS "ovs" FROM orders_studnie_rel s WHERE ${orderScopeStudnie}${andBornStudnie}`
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
            Array<{ h: number | null }>,
            Array<{ ovr: number | null }>,
            Array<{ ovs: number | null }>
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
        let openValue = 0;
        let totalValue = 0;
        for (const r of valueRows) {
            if (r.k === 'won') wonValue += num(r.v);
            else if (r.k === 'open') openValue += num(r.v);
            else if (r.k === 'total') totalValue += num(r.v);
            else lostValue += num(r.v);
        }
        // Zamówienia osobno: nigdy nie sumowane z ofertami (osobny kafelek).
        const ordersValue = num(ordersRury[0]?.ovr) + num(ordersStudnie[0]?.ovs);

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
                openValue,
                totalValue,
                ordersValue,
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
