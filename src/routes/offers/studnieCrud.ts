import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { normalizeDate } from '../../helpers';
import { searchCache } from '../../utils/searchCache';
import { syncFts5, removeFts5 } from '../../utils/fts5Sync';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { buildRoleWhereConditionWithShares } from '../../utils/roleFilter';
import { canEditDoc, resolveEditUserId, canReadWithShare } from '../../utils/ownership';
import { versionedWrite, mapVersionConflict } from '../../utils/versionWrite';
import { assertDocLockForWrite, mapDocLockConflict } from '../../utils/docLocks';
import { mapPrismaError } from '../../utils/prismaErrors';
import { HOT_TX_OPTS } from '../../utils/hotTx';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../../utils/idempotency';
import { offersStudnieBatchSchema, paginationQuerySchema } from '../../validators/offerSchemas';
import { hasProductionOrdersForOffer } from '../../utils/productionOrderGuard';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const ORDERED_WELL_WHITELIST = new Set<string>([]);

// Pola lotne / techniczne — nie wyzwalają 403 (header oferty edytowalny, auto-recalc nie blokuje)
const IGNORED_WELL_FIELDS = new Set<string>([
    'name',
    'configSource',
    'autoSelect',
    'autoLocked',
    'configStatus',
    'configErrors',
    'price',
    'weight',
    'height',
    'totalPrice',
    'updatedAt'
]);

// Well-level lock: Konfiguracja + Parametry + config/przejscia. Header oferty (clientName itp.) poza guardem.
const LOCKED_WELL_FIELDS = new Set<string>([
    // Konfiguracja studni
    'numer',
    'dn',
    'rzednaWlazu',
    'rzednaDna',
    'doplata',
    'redukcjaDN1000',
    'redukcjaTargetDN',
    'redukcjaMinH',
    'redukcjaZakonczenie',
    'redukcjaZakonczenieByDn',
    'zakonczenie',
    'zakonczenieByDn',
    'stycznaNadbudowa1200',
    'psiaBuda',
    '_psiaBudaBackup',
    'uwagi',
    'config',
    'przejscia',
    // Parametry tej studni (WELL_PARAM_DEFS)
    'nadbudowa',
    'dennicaMaterial',
    'wkladkaDennica',
    'wkladkaNadbudowa',
    'wkladkaZwienczenie',
    'klasaBetonu',
    'agresjaChemiczna',
    'agresjaMrozowa',
    'klasaNosnosci_korpus',
    'klasaNosnosci_zwienczenie',
    'malowanieW',
    'malowanieZ',
    'powlokaNameW',
    'powlokaNameZ',
    'malowanieWewCena',
    'malowanieZewCena',
    'kineta',
    'precoFullHeight',
    'spocznik',
    'redukcjaKinety',
    'stopnie',
    'spocznikH',
    'usytuowanie',
    'uszczelka',
    'magazyn',
    'wkladkaOsadnikPreco',
    'wkladkaOsadnikH'
]);

function normalizeValue(v: unknown): unknown {
    if (v === undefined) return null;
    if (v === '') return null;
    return v;
}

function stableStringify(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
        );
    }
    return JSON.stringify(v);
}

function stripAutoConfig(config: unknown): unknown {
    if (!Array.isArray(config)) return config;
    return (config as Array<Record<string, unknown>>)
        .filter((item) => !item.autoAdded)
        .map((item) => {
            const copy: Record<string, unknown> = {};
            for (const k of Object.keys(item)) {
                if (['frozenPrice', 'frozenPriceBase', 'frozenName', '_osadnikCost'].includes(k))
                    continue;
                copy[k] = normalizeValue(item[k]);
            }
            return copy;
        })
        .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

function stripAutoPrzejscia(przejscia: unknown): unknown {
    if (!Array.isArray(przejscia)) return przejscia;
    return (przejscia as Array<Record<string, unknown>>).map((p) => {
        const copy: Record<string, unknown> = {};
        for (const k of Object.keys(p)) {
            if (
                [
                    'frozenPrice',
                    'frozenPriceBase',
                    'frozenName',
                    'frozenTransitionPrice',
                    'frozenDrillingPrice',
                    'frozenDrillingName',
                    'frozenDrillingDn'
                ].includes(k)
            )
                continue;
            copy[k] = normalizeValue(p[k]);
        }
        return copy;
    });
}

function canonicalWell(well: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(well)) {
        if (IGNORED_WELL_FIELDS.has(k)) continue;
        if (!LOCKED_WELL_FIELDS.has(k)) continue;
        let v = normalizeValue(well[k]);
        if (k === 'config') v = stripAutoConfig(v);
        else if (k === 'przejscia') v = stripAutoPrzejscia(v);
        out[k] = v;
    }
    // also normalize arrays order for determinism
    if (Array.isArray(out.config))
        out.config = (out.config as unknown[])
            .slice()
            .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
    if (Array.isArray(out.przejscia))
        out.przejscia = (out.przejscia as unknown[])
            .slice()
            .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
    return out;
}

function extractWellsFromOfferData(dataStr: string | null): Array<Record<string, unknown>> {
    if (!dataStr) return [];
    try {
        const parsed = JSON.parse(dataStr);
        const wells =
            (parsed.wells as Array<Record<string, unknown>>) ||
            ((parsed.data as Record<string, unknown>)?.wells as Array<Record<string, unknown>>) ||
            (((parsed.data as Record<string, unknown>)?.data as Record<string, unknown>)
                ?.wells as Array<Record<string, unknown>>) ||
            [];
        return Array.isArray(wells) ? wells : [];
    } catch {
        return [];
    }
}

function extractWellsFromIncoming(o: Record<string, unknown>): Array<Record<string, unknown>> {
    const fromTop = o.wells as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(fromTop)) return fromTop;
    const d = o.data as Record<string, unknown> | undefined;
    if (d) {
        if (Array.isArray(d.wells)) return d.wells as Array<Record<string, unknown>>;
        const nested = (d.data as Record<string, unknown>)?.wells;
        if (Array.isArray(nested)) return nested as Array<Record<string, unknown>>;
    }
    return [];
}

/**
 * Batch wariant guard ordered-well (P4-P0): jedno zapytanie zamiast
 * N× query+parse w pętlach batch POST/PUT. Semantyka potrójnego OR identyczna.
 */
async function getOrderedWellIdsForOffers(offerIds: string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    const ids = [...new Set(offerIds.filter(Boolean))];
    if (ids.length === 0) return out;
    for (const id of ids) out.set(id, new Set());
    const rows =
        (await prisma.$queryRaw<Array<{ offerStudnieId: string | null; data: string | null }>>`
        SELECT "offerStudnieId", data FROM orders_studnie_rel
        WHERE "offerStudnieId" IN (${Prisma.join(ids)})
           OR json_extract(data, '$.offerId') IN (${Prisma.join(ids)})
           OR json_extract(data, '$.offerStudnieId') IN (${Prisma.join(ids)})
    `) || [];
    for (const r of rows) {
        if (!r.data) continue;
        let d: Record<string, unknown>;
        try {
            d = JSON.parse(r.data) as Record<string, unknown>;
        } catch {
            continue;
        }
        // Których ofert dotyczy ten wiersz (jak w wersji pojedynczej).
        const matched = new Set<string>();
        if (r.offerStudnieId && out.has(r.offerStudnieId)) matched.add(r.offerStudnieId);
        const nested = d.data as Record<string, unknown> | undefined;
        for (const cand of [
            d.offerId,
            d.offerStudnieId,
            nested?.offerId,
            nested?.offerStudnieId,
            (nested?.data as Record<string, unknown> | undefined)?.offerStudnieId
        ]) {
            if (typeof cand === 'string' && out.has(cand)) matched.add(cand);
        }
        if (matched.size === 0) continue;
        const ids2 = new Set<string>();
        const wells =
            (d.wells as Array<{ id?: string }>) ||
            ((d.data as Record<string, unknown>)?.wells as Array<{ id?: string }>) ||
            (((d.data as Record<string, unknown>)?.data as Record<string, unknown>)
                ?.wells as Array<{
                id?: string;
            }>) ||
            [];
        for (const w of wells) if (w?.id) ids2.add(w.id);
        if (Array.isArray(d))
            for (const w of d)
                if ((w as Record<string, unknown>)?.id)
                    ids2.add((w as Record<string, unknown>).id as string);
        const altWells = extractWellsFromOfferData(r.data);
        for (const w of altWells)
            if ((w as Record<string, unknown>).id)
                ids2.add((w as Record<string, unknown>).id as string);
        for (const m of matched) {
            const s = out.get(m);
            if (s) for (const id of ids2) s.add(id);
        }
    }
    return out;
}

function isWellDiffWhitelisted(
    oldWell: Record<string, unknown>,
    newWell: Record<string, unknown>
): boolean {
    // ORDERED_WELL_WHITELIST empty → pełny lock, ale ignoruj lotne pola i znormalizuj
    const a = canonicalWell(oldWell);
    const b = canonicalWell(newWell);
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of allKeys) {
        if (ORDERED_WELL_WHITELIST.has(k)) continue;
        if (stableStringify(a[k]) !== stableStringify(b[k])) return false;
    }
    return true;
}

const writeOffersLimiter = WRITE_LIMITER;

router.get('/studnie', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const pq = paginationQuerySchema.parse(req.query);
        const whereCondition = authReq.user
            ? buildRoleWhereConditionWithShares(authReq.user, 'offer_studnie')
            : Prisma.empty;

        logger.debug('Offers', 'GET /studnie', {
            userId: authReq.user?.id,
            role: authReq.user?.role
        });

        const validSortMap: Record<string, string> = {
            createdAt: '"createdAt"',
            updatedAt: '"updatedAt"',
            offer_number: '"offer_number"'
        };
        const sortCol = validSortMap[pq.sort || 'createdAt'] || '"createdAt"';
        const sortDir = pq.order === 'asc' ? 'ASC' : 'DESC';

        // P1-2 cursor keyset: when cursor+cursorId present and sort=createdAt/updatedAt, use keyset seek (O(log N)) vs OFFSET scan
        const cursorVal = (pq as unknown as { cursor?: string; cursorId?: string }).cursor;
        const cursorId = (pq as unknown as { cursor?: string; cursorId?: string }).cursorId;
        const canKeyset =
            !!cursorVal &&
            !!cursorId &&
            (pq.sort === 'createdAt' || pq.sort === 'updatedAt' || !pq.sort);
        let cursorWhere = Prisma.empty;
        if (canKeyset) {
            const cursorCol = sortCol;
            const cmp = sortDir === 'DESC' ? Prisma.sql`<` : Prisma.sql`>`;
            const eqCmp = sortDir === 'DESC' ? Prisma.sql`<` : Prisma.sql`>`;
            // WHERE (col < cursor) OR (col = cursor AND id < cursorId) for DESC; opposite for ASC
            cursorWhere = Prisma.sql`AND (${Prisma.raw(cursorCol)} ${cmp} ${cursorVal} OR (${Prisma.raw(cursorCol)} = ${cursorVal} AND id ${eqCmp} ${cursorId}))`;
        }

        const offers = canKeyset
            ? await prisma.$queryRaw<
                  Array<{
                      id: string;
                      userId: string | null;
                      offer_number: string | null;
                      state: string | null;
                      wellCount: number | null;
                      totalPrice: number | null;
                      createdAt: string | null;
                      updatedAt: string | null;
                      version: number | null;
                  }>
              >`SELECT id, "userId", "offer_number", state, "wellCount", "totalPrice", version,
                CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "createdAt" END as "createdAt",
                CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "updatedAt" END as "updatedAt"
             FROM offers_studnie_rel ${whereCondition} ${cursorWhere}
                ORDER BY ${Prisma.raw(sortCol + ' ' + sortDir)}, id ${Prisma.raw(sortDir)}
                LIMIT ${pq.limit + 1}`
            : await prisma.$queryRaw<
                  Array<{
                      id: string;
                      userId: string | null;
                      offer_number: string | null;
                      state: string | null;
                      wellCount: number | null;
                      totalPrice: number | null;
                      createdAt: string | null;
                      updatedAt: string | null;
                      version: number | null;
                  }>
              >`SELECT id, "userId", "offer_number", state, "wellCount", "totalPrice", version,
                CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "createdAt" END as "createdAt",
                CASE WHEN "updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                    THEN datetime(CAST("updatedAt" AS INTEGER)/1000, 'unixepoch')
                    ELSE "updatedAt" END as "updatedAt"
             FROM offers_studnie_rel ${whereCondition}
                ORDER BY ${Prisma.raw(sortCol + ' ' + sortDir)}
                LIMIT ${pq.limit} OFFSET ${pq.skip}`;

        const countResult = canKeyset
            ? null
            : await prisma.$queryRaw<Array<{ cnt: number }>>`
            SELECT COUNT(*) as cnt FROM offers_studnie_rel ${whereCondition}`;
        const totalCount = canKeyset ? null : Number(countResult?.[0]?.cnt ?? 0);

        // keyset: hasMore + nextCursor from extra row
        let hasMore = false;
        let rawOffers = offers;
        let nextCursor: string | null = null;
        let nextCursorId: string | null = null;
        if (canKeyset && offers.length > pq.limit) {
            hasMore = true;
            rawOffers = offers.slice(0, pq.limit);
            const last = rawOffers[rawOffers.length - 1];
            // cursor field matches sortCol
            const cursorField = pq.sort === 'updatedAt' ? last.updatedAt : last.createdAt;
            nextCursor = cursorField || last.createdAt || null;
            nextCursorId = last.id || null;
        }

        const mapped = rawOffers.map((offer) => {
            return {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: typeof offer.totalPrice === 'number' ? offer.totalPrice : 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                wellCount: typeof offer.wellCount === 'number' ? offer.wellCount : 0,
                totalPrice: typeof offer.totalPrice === 'number' ? offer.totalPrice : 0,
                // P0-D2: baza optimistic lockingu (round-trip bez zmian frontu).
                version: offer.version ?? 1
            };
        });

        logger.debug('Offers', 'GET /studnie wynik', {
            count: mapped.length,
            ids: mapped.map((o) => o.id)
        });
        if (canKeyset) {
            res.json({
                data: mapped,
                totalCount,
                hasMore,
                nextCursor,
                nextCursorId,
                skip: pq.skip,
                limit: pq.limit
            });
        } else {
            res.json({ data: mapped, totalCount, skip: pq.skip, limit: pq.limit });
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd GET /studnie', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.get('/studnie/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id }
        });
        if (!offer) return res.status(404).json({ error: 'Oferta studni nie istnieje' });

        if (!(await canReadWithShare(authReq.user, offer.userId, 'offer_studnie', id))) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu tej oferty' });
        }

        let parsedData: Record<string, unknown> = {};
        try {
            if (offer.data) parsedData = JSON.parse(offer.data);
        } catch (_e) {}

        let studnieDetailHistory: unknown[] = [];
        try {
            studnieDetailHistory = JSON.parse(offer.history || '[]');
        } catch {
            studnieDetailHistory = [];
        }

        res.json({
            data: {
                id: offer.id,
                type: 'studnia_oferta',
                userId: offer.userId,
                title: `Oferta Studnia ${offer.offer_number || offer.id}`,
                price: (parsedData.totalPrice as number) || 0,
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || new Date().toISOString(),
                updatedAt: offer.updatedAt || offer.createdAt || new Date().toISOString(),
                lastEditedBy: offer.userId,
                data: parsedData,
                history: studnieDetailHistory
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post(
    '/studnie',
    requireAuth,
    writeOffersLimiter,
    validateData(offersStudnieBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        // P1-A: Idempotency-Key (opcjonalny) — retry nie tworzy duplikatu.
        const idemEndpoint = 'POST /api/offers-studnie';
        const idemKey = idempotencyKeyFrom(req);
        const idemUser = authReq.user?.id || '';
        try {
            if (idemKey) {
                const claim = await claimIdempotencyKey(idemUser, idemEndpoint, idemKey, req.body);
                if (claim.action === 'replay') return res.status(claim.status).json(claim.body);
                if (claim.action === 'reuse')
                    return res.status(409).json({
                        error: 'Klucz idempotencji użyty z innym payloadem',
                        code: 'IDEMPOTENCY_KEY_REUSE'
                    });
                if (claim.action === 'in-progress')
                    return res.status(409).json({
                        error: 'Żądanie w trakcie przetwarzania — spróbuj ponownie',
                        code: 'IDEMPOTENCY_IN_PROGRESS'
                    });
            }
            const incoming = req.body.data || [req.body];

            // P1.3: batch preload olds — 1 query zamiast N×findUnique
            const incomingIds = incoming
                .map((o: { id?: unknown }) => (typeof o.id === 'string' ? (o.id as string) : ''))
                .filter(Boolean) as string[];
            const oldsList: Array<{
                id: string;
                history: string | null;
                data: string | null;
                state: string | null;
                userId: string | null;
                version: number | null;
                totalPrice: number | null;
            }> =
                incomingIds.length > 0
                    ? (await prisma.offers_studnie_rel.findMany({
                          where: { id: { in: incomingIds } },
                          select: {
                              id: true,
                              history: true,
                              data: true,
                              state: true,
                              userId: true,
                              version: true,
                              totalPrice: true
                          }
                      })) || []
                    : [];
            const oldMap = new Map(oldsList.map((r) => [r.id, r]));
            // P4-P0: ordered-well guard jednym zapytaniem (nie per oferta w pętli).
            const orderedGuardMap = await getOrderedWellIdsForOffers(incomingIds);
            // P1.1: walidacja + kolekcja, potem atomowy zapis batch w jednej transakcji
            const pending: Array<{
                docId: string;
                create: Record<string, unknown>;
                update: Record<string, unknown>;
                // P0-D2: optimistic locking.
                exists: boolean;
                serverVersion: number | null;
                clientVersion: number | null;
                fts: {
                    id: string;
                    offer_number: string | null;
                    clientName: string | null;
                    investName: string | null;
                    clientNumber: string | null;
                };
            }> = [];
            for (const o of incoming) {
                let docId = o.id;
                if (!docId) {
                    // P1-A: deterministyczne id przy kluczu — retry trafia w ten sam rekord.
                    docId = idemKey
                        ? 'idem-' +
                          crypto
                              .createHash('sha256')
                              .update(
                                  `${idemUser}|${idemEndpoint}|${idemKey}|${incoming.indexOf(o)}`
                              )
                              .digest('hex')
                              .slice(0, 16)
                        : uuidv4();
                }

                let newHistory: unknown[] = [];
                let effectiveUserId: string;
                const old = oldMap.get(docId) || null;
                if (old) {
                    if (!canEditDoc(authReq.user)) {
                        return res
                            .status(403)
                            .json({ error: 'Brak uprawnień do modyfikacji tej oferty' });
                    }
                    // Model współpracy: update honoruje zmianę opiekuna
                    // (incoming.userId), fallback: stara kolumna, potem self.
                    const requestedUserId =
                        typeof o.userId === 'string' && o.userId ? o.userId : '';
                    effectiveUserId = requestedUserId || old.userId || authReq.user?.id || '';
                } else {
                    const resolved = resolveEditUserId(authReq.user, o.userId);
                    if (!resolved.allowed) {
                        return res.status(403).json({
                            error: 'Brak uprawnień do utworzenia oferty dla tego użytkownika'
                        });
                    }
                    effectiveUserId = resolved.effectiveUserId;
                }
                // Guard: pełna blokada studni na zamówieniu (tylko ordered, ignoruj lotne)
                if (old) {
                    try {
                        const orderedIds = orderedGuardMap.get(docId) || new Set<string>();
                        if (orderedIds.size > 0) {
                            const oldWells = extractWellsFromOfferData(old.data);
                            const newWells = extractWellsFromIncoming(o as Record<string, unknown>);
                            for (const oid of orderedIds) {
                                const oldWell = oldWells.find((w) => w.id === oid) as
                                    Record<string, unknown> | undefined;
                                const newWell = newWells.find((w) => w.id === oid) as
                                    Record<string, unknown> | undefined;
                                if (oldWell && !newWell) {
                                    return res.status(403).json({
                                        error: 'Nie można usunąć studni na zamówieniu — usuń najpierw zamówienie.'
                                    });
                                }
                                if (
                                    oldWell &&
                                    newWell &&
                                    !isWellDiffWhitelisted(oldWell, newWell)
                                ) {
                                    return res.status(403).json({
                                        error: 'Studnia na zamówieniu — Konfiguracja i Parametry zablokowane. Edytuj przez zamówienie.'
                                    });
                                }
                            }
                        }
                    } catch (guardErr) {
                        if (
                            guardErr &&
                            typeof guardErr === 'object' &&
                            'status' in (guardErr as Record<string, unknown>)
                        )
                            throw guardErr;
                        logger.warn('Offers', 'Guard ordered well failed', String(guardErr));
                    }
                }

                if (old) {
                    try {
                        newHistory = JSON.parse(old.history || '[]');
                    } catch (_e) {
                        logger.warn(
                            'Offers',
                            'Uszkodzony JSON history podczas zapisu oferty studni',
                            docId
                        );
                    }
                    // FINAL: snapshot slim jak rury (bez bloba data!) — pełne
                    // dane lądują w audit_logs (logAudit poniżej). Pełny snapshot
                    // 7 MB × 5 wpisów = 29 MB history paraliżowało każdy search
                    // (json_each po history na liście).
                    const oldWells = extractWellsFromOfferData(old.data);
                    const snapshot = {
                        updatedAt: new Date().toISOString(),
                        timestamp: new Date().toISOString(),
                        state: old.state,
                        totalPrice: old.totalPrice ?? 0,
                        totalBrutto: old.totalPrice ?? 0,
                        wellCount: Array.isArray(oldWells) ? oldWells.length : 0,
                        lastEditedBy: authReq.user?.username || authReq.user?.id || null
                    };
                    newHistory.unshift(snapshot);
                    if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);

                    let auditData: Record<string, unknown> = {};
                    try {
                        auditData = JSON.parse(old.data || '{}');
                    } catch {
                        auditData = {};
                    }
                    logAudit(
                        'studnia_oferta',
                        docId,
                        authReq.user?.id || '',
                        'update',
                        o,
                        auditData
                    );
                } else {
                    logAudit('studnia_oferta', docId, authReq.user?.id || '', 'create', o);
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const clientName = o.clientName || null;
                const investName = o.investName || null;
                const clientNip = o.clientNip || null;
                const clientNumber = o.clientNumber || null;
                const created = normalizeDate(o.createdAt);
                const updated = new Date().toISOString();
                const offerNumber = o.number || o.offer_number || '';
                // P0-D2: version to kolumna (top-level o.version), nie blob o.
                const postClientVersion = typeof o.version === 'number' ? o.version : null;
                const { version: _postVersion, ...blobSrc } = o as Record<string, unknown>;
                const dataStr = JSON.stringify(blobSrc);
                const historyStr = JSON.stringify(newHistory);
                const wellCount = extractWellsFromIncoming(o as Record<string, unknown>).length;
                // E-2: derived persisted metadata — klient nie ustawia autorytatywnie
                const rawPrice =
                    (o as Record<string, unknown>).totalPrice ??
                    (o as Record<string, unknown>).price ??
                    ((o as Record<string, unknown>).data &&
                        ((o as Record<string, unknown>).data as Record<string, unknown>)
                            .totalPrice);
                const totalPrice = (() => {
                    const n = Number(rawPrice);
                    return isNaN(n) ? 0 : n;
                })();

                pending.push({
                    docId,
                    exists: !!old,
                    serverVersion: old?.version ?? null,
                    clientVersion: postClientVersion,
                    create: {
                        id: docId,
                        userId: effectiveUserId,
                        offer_number: offerNumber,
                        state: state,
                        clientName,
                        investName,
                        clientNip,
                        clientNumber,
                        createdAt: created,
                        updatedAt: updated,
                        data: dataStr,
                        history: historyStr,
                        wellCount,
                        totalPrice
                    },
                    update: {
                        userId: effectiveUserId,
                        offer_number: offerNumber,
                        state: state,
                        clientName,
                        investName,
                        clientNip,
                        clientNumber,
                        updatedAt: updated,
                        data: dataStr,
                        history: historyStr,
                        wellCount,
                        totalPrice
                    },
                    fts: {
                        id: docId,
                        offer_number: offerNumber,
                        clientName,
                        investName,
                        clientNumber
                    }
                });
            }
            // Atomowy zapis wszystkich ofert — all-or-nothing (P1.1 correctness).
            // Timeout 30 s zamiast domyślnych 5 s: upsert oferty z ~3k studni
            // (~10 MB JSON) potrafi trwać >6 s na SQLite (Transaction API error).
            await prisma.$transaction(async (tx) => {
                for (const w of pending) {
                    // Twarda blokada: brak wiersza = stara sesja = przepusc (chroni 409).
                    await assertDocLockForWrite(tx, {
                        docType: 'offer_studnie',
                        docId: w.docId,
                        user: { id: authReq.user?.id || '' }
                    });
                    // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                    await versionedWrite(tx.offers_studnie_rel, {
                        id: w.docId,
                        exists: w.exists,
                        serverVersion: w.serverVersion,
                        clientVersion: w.clientVersion,
                        createData: w.create,
                        updateData: w.update,
                        conflictMessage: 'Oferta zmieniona przez innego użytkownika'
                    });
                }
            }, HOT_TX_OPTS);
            const results: Record<string, unknown>[] = [];
            let ftsFailed = 0;
            for (const w of pending) {
                if (!(await syncFts5('studnie', w.fts))) ftsFailed++;
                results.push({ id: w.docId, ok: true });
            }
            // P1-B: cichy dryf FTS widoczny w logu (zapis biznesowy już zacommitowany).
            if (ftsFailed > 0)
                logger.warn(
                    'Offers',
                    `FTS sync pominięty dla ${ftsFailed}/${pending.length} ofert studni`
                );

            logger.info(
                'Offers',
                `Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`
            );
            searchCache.invalidateAll();
            // P1-A: odpowiedź finałowa (< 500) ląduje pod kluczem do replay.
            if (idemKey)
                await completeIdempotencyKey(idemUser, idemEndpoint, idemKey, 200, {
                    ok: true,
                    results
                });
            res.json({ ok: true, results });
        } catch (e: unknown) {
            if (mapDocLockConflict(res, e)) return;
            if (mapVersionConflict(res, e)) return;
            if (mapPrismaError(res, e)) return;
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Offers', 'Błąd POST offers/studnie', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.put(
    '/studnie',
    requireAuth,
    writeOffersLimiter,
    validateData(offersStudnieBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const incoming: Array<Record<string, unknown>> = req.body.data || [];

            const incomingIds: string[] = incoming
                .map((o) => (typeof o.id === 'string' ? o.id : ''))
                .filter(Boolean);
            const existingDocs: Array<{
                id: string;
                userId: string | null;
                data: string | null;
                version: number | null;
            }> =
                incomingIds.length > 0
                    ? (await prisma.offers_studnie_rel.findMany({
                          where: { id: { in: incomingIds } },
                          select: { id: true, userId: true, data: true, version: true }
                      })) || []
                    : [];
            const existingById = new Map(existingDocs.map((d) => [d.id, d]));
            // P4-P0: guard + dane jednym zapytaniem (nie per oferta w pętli).
            const orderedGuardMapPut = await getOrderedWellIdsForOffers(incomingIds);
            const forbidden = !canEditDoc(authReq.user) && existingDocs.length > 0;
            if (forbidden) {
                return res.status(403).json({
                    error: 'Forbidden — nie masz uprawnień do modyfikacji jednej z ofert'
                });
            }

            // P1.1: walidacja + kolekcja, potem atomowy zapis batch
            const pendingPut: Array<{
                docId: string;
                create: Record<string, unknown>;
                update: Record<string, unknown>;
                // P0-D2: optimistic locking.
                exists: boolean;
                serverVersion: number | null;
                clientVersion: number | null;
                fts: {
                    id: string;
                    offer_number: string | null;
                    clientName: string | null;
                    investName: string | null;
                    clientNumber: string | null;
                };
            }> = [];
            for (const o of incoming) {
                let docId = typeof o.id === 'string' ? o.id : '';
                if (!docId) {
                    docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
                }

                // Guard PUT: pełna blokada studni na zamówieniu (tylko ordered)
                if (docId) {
                    const oldDoc = existingById.get(docId);
                    if (oldDoc?.data) {
                        const orderedIds = orderedGuardMapPut.get(docId) || new Set<string>();
                        if (orderedIds.size > 0) {
                            const oldWells = extractWellsFromOfferData(oldDoc.data);
                            const newWells = extractWellsFromIncoming(o as Record<string, unknown>);
                            for (const oid of orderedIds) {
                                const oldWell = oldWells.find((w) => w.id === oid) as
                                    Record<string, unknown> | undefined;
                                const newWell = newWells.find((w) => w.id === oid) as
                                    Record<string, unknown> | undefined;
                                if (oldWell && !newWell) {
                                    return res.status(403).json({
                                        error: 'Nie można usunąć studni na zamówieniu — usuń najpierw zamówienie.'
                                    });
                                }
                                if (
                                    oldWell &&
                                    newWell &&
                                    !isWellDiffWhitelisted(oldWell, newWell)
                                ) {
                                    return res.status(403).json({
                                        error: 'Studnia na zamówieniu — Konfiguracja i Parametry zablokowane. Edytuj przez zamówienie.'
                                    });
                                }
                            }
                        }
                    }
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const dataPayload = (o.data as Record<string, unknown>) || {};
                const clientName =
                    (o.clientName as string) || (dataPayload.clientName as string) || null;
                const investName =
                    (o.investName as string) || (dataPayload.investName as string) || null;
                const clientNip =
                    (o.clientNip as string) || (dataPayload.clientNip as string) || null;
                const clientNumber =
                    (o.clientNumber as string) || (dataPayload.clientNumber as string) || null;
                const created = normalizeDate(o.createdAt, { exactMs: true });
                const wellCountPut = extractWellsFromIncoming(o as Record<string, unknown>).length;
                const rawPricePut =
                    (o as Record<string, unknown>).totalPrice ??
                    (o as Record<string, unknown>).price ??
                    (dataPayload as Record<string, unknown>).totalPrice;
                const totalPricePut = (() => {
                    const n = Number(rawPricePut);
                    return isNaN(n) ? 0 : n;
                })();

                // P0-D2: version to kolumna (top-level o.version), nie blob o.data.
                const putClientVersion = typeof o.version === 'number' ? o.version : null;
                const putOld = existingById.get(docId);
                // Model współpracy: żądana zmiana opiekuna wygrywa,
                // fallback: stara kolumna, potem self (nigdy ślepo edytujący).
                const putRequestedUserId = typeof o.userId === 'string' && o.userId ? o.userId : '';
                const putUserId = putRequestedUserId || putOld?.userId || authReq.user?.id || '';
                pendingPut.push({
                    docId,
                    exists: !!putOld,
                    serverVersion: putOld?.version ?? null,
                    clientVersion: putClientVersion,
                    create: {
                        id: docId,
                        userId: putUserId,
                        state: state,
                        clientName,
                        investName,
                        clientNip,
                        clientNumber,
                        createdAt: created,
                        data: o.data ? JSON.stringify(o.data) : '{}',
                        wellCount: wellCountPut,
                        totalPrice: totalPricePut
                    },
                    update: {
                        userId: putUserId,
                        state: state,
                        clientName,
                        investName,
                        clientNip,
                        clientNumber,
                        createdAt: created,
                        data: o.data ? JSON.stringify(o.data) : '{}',
                        wellCount: wellCountPut,
                        totalPrice: totalPricePut
                    },
                    fts: {
                        id: docId,
                        offer_number: (o.offer_number as string) || null,
                        clientName,
                        investName,
                        clientNumber
                    }
                });
            }
            await prisma.$transaction(async (tx) => {
                for (const w of pendingPut) {
                    // Twarda blokada: brak wiersza = stara sesja = przepusc (chroni 409).
                    await assertDocLockForWrite(tx, {
                        docType: 'offer_studnie',
                        docId: w.docId,
                        user: { id: authReq.user?.id || '' }
                    });
                    // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                    await versionedWrite(tx.offers_studnie_rel, {
                        id: w.docId,
                        exists: w.exists,
                        serverVersion: w.serverVersion,
                        clientVersion: w.clientVersion,
                        createData: w.create,
                        updateData: w.update,
                        conflictMessage: 'Oferta zmieniona przez innego użytkownika'
                    });
                }
            }, HOT_TX_OPTS);
            let ftsPutFailed = 0;
            for (const w of pendingPut) {
                if (!(await syncFts5('studnie', w.fts))) ftsPutFailed++;
            }
            // P1-B: cichy dryf FTS widoczny w logu (zapis biznesowy już zacommitowany).
            if (ftsPutFailed > 0)
                logger.warn(
                    'Offers',
                    `FTS sync pominięty dla ${ftsPutFailed}/${pendingPut.length} ofert studni (PUT)`
                );

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
            if (mapDocLockConflict(res, e)) return;
            if (mapVersionConflict(res, e)) return;
            if (mapPrismaError(res, e)) return;
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Offers', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.delete('/studnie/:id', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        logger.info('Offers', 'DELETE /studnie/:id start', { id, userId: authReq.user?.id });

        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { id: true, userId: true, data: true }
        });
        if (!offer) {
            logger.warn('Offers', 'Oferta studni nie istnieje', { id });
            return res.status(404).json({ error: 'Oferta studni nie istnieje' });
        }

        if (authReq.user?.role !== 'admin' && offer.userId !== authReq.user?.id) {
            return res.status(403).json({ error: 'Brak uprawnien do usuniecia tej oferty' });
        }

        let oldData: Record<string, unknown> = {};
        try {
            oldData = JSON.parse(offer.data || '{}');
        } catch (_e) {
            logger.warn('Offers', 'Uszkodzony JSON data podczas usuwania oferty studni', id);
        }
        logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

        // P0-E: guard + kasowanie biznesowe w JEDNEJ transakcji.
        // FTS to dane pochodne — po COMMIT, nigdy nie blokuje kasowania.
        // P1-E: także żywe zamówienia (nie tylko PZ) blokują kasowanie.
        try {
            await prisma.$transaction(async (tx) => {
                if (await hasProductionOrdersForOffer(id, tx)) {
                    throw {
                        status: 403,
                        message:
                            'Nie można usunąć oferty — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zamówieniach tej oferty.'
                    };
                }
                const orderCount = await tx.orders_studnie_rel.count({
                    where: { offerStudnieId: id }
                });
                if (orderCount > 0) {
                    throw {
                        status: 403,
                        message:
                            'Nie można usunąć oferty — ma przypisane zamówienia. Usuń najpierw zamówienia tej oferty.'
                    };
                }
                await tx.offers_studnie_rel.delete({ where: { id } });
                // P1-E: shares w tej samej tx (koniec okna crash→sierota).
                try {
                    await (tx as any).document_shares?.deleteMany?.({
                        where: { documentType: 'offer_studnie', documentId: id }
                    });
                } catch (e: unknown) {
                    logger.warn(
                        'Offers',
                        'Pomijam czyszczenie shares (legacy?)',
                        e instanceof Error ? e.message : String(e)
                    );
                }
            }, HOT_TX_OPTS);
        } catch (e: unknown) {
            if ((e as { status?: number }).status === 403) {
                return res
                    .status(403)
                    .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
            }
            throw e;
        }
        await removeFts5('studnie', id);

        logger.info(
            'Offers',
            `Oferta studnie ${req.params.id} usunięta przez ${authReq.user?.username}`
        );
        searchCache.invalidateAll();
        res.json({ ok: true });
    } catch (e: unknown) {
        if (mapPrismaError(res, e)) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', `Błąd DELETE /studnie/:id (${req.params.id})`, message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
