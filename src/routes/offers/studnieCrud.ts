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
import { canWriteDoc, resolveWriteUserId, canReadWithShare } from '../../utils/ownership';
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

async function getOrderedWellIdsForOffer(offerId: string): Promise<Set<string>> {
    if (!offerId) return new Set();
    const rows = await prisma.$queryRaw<Array<{ data: string | null }>>`
        SELECT data FROM orders_studnie_rel
        WHERE "offerStudnieId" = ${offerId}
           OR json_extract(data, '$.offerId') = ${offerId}
           OR json_extract(data, '$.offerStudnieId') = ${offerId}
    `;
    const ids = new Set<string>();
    for (const r of rows) {
        if (!r.data) continue;
        try {
            const d = JSON.parse(r.data);
            const wells =
                (d.wells as Array<{ id?: string }>) ||
                ((d.data as Record<string, unknown>)?.wells as Array<{ id?: string }>) ||
                (((d.data as Record<string, unknown>)?.data as Record<string, unknown>)
                    ?.wells as Array<{
                    id?: string;
                }>) ||
                [];
            for (const w of wells) if (w?.id) ids.add(w.id);
            if (Array.isArray(d))
                for (const w of d)
                    if ((w as Record<string, unknown>)?.id)
                        ids.add((w as Record<string, unknown>).id as string);
            // also check top-level wells inside data string if nested
            const altWells = extractWellsFromOfferData(r.data);
            for (const w of altWells)
                if ((w as Record<string, unknown>).id)
                    ids.add((w as Record<string, unknown>).id as string);
        } catch {}
    }
    return ids;
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
                  }>
              >`SELECT id, "userId", "offer_number", state, "wellCount", "totalPrice",
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
                  }>
              >`SELECT id, "userId", "offer_number", state, "wellCount", "totalPrice",
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
                totalPrice: typeof offer.totalPrice === 'number' ? offer.totalPrice : 0
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
        try {
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
            }> =
                incomingIds.length > 0
                    ? (await prisma.offers_studnie_rel.findMany({
                          where: { id: { in: incomingIds } },
                          select: { id: true, history: true, data: true, state: true, userId: true }
                      })) || []
                    : [];
            const oldMap = new Map(oldsList.map((r) => [r.id, r]));
            // P1.1: walidacja + kolekcja, potem atomowy zapis batch w jednej transakcji
            const pending: Array<{
                docId: string;
                create: Record<string, unknown>;
                update: Record<string, unknown>;
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
                if (!docId) docId = uuidv4();

                let newHistory: unknown[] = [];
                let effectiveUserId: string;
                const old = oldMap.get(docId) || null;
                if (old) {
                    if (!canWriteDoc(authReq.user, old.userId)) {
                        return res
                            .status(403)
                            .json({ error: 'Brak uprawnień do modyfikacji tej oferty' });
                    }
                    effectiveUserId = old.userId || authReq.user?.id || '';
                } else {
                    const resolved = resolveWriteUserId(authReq.user, o.userId);
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
                        const orderedIds = await getOrderedWellIdsForOffer(docId);
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
                    let snapshotData: Record<string, unknown> = {};
                    try {
                        snapshotData = JSON.parse(old.data || '{}');
                    } catch {
                        snapshotData = {};
                    }
                    const snapshot = {
                        timestamp: new Date().toISOString(),
                        state: old.state,
                        data: snapshotData
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
                const dataStr = JSON.stringify(o);
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
            // Atomowy zapis wszystkich ofert — all-or-nothing (P1.1 correctness)
            await prisma.$transaction(async (tx) => {
                for (const w of pending) {
                    await (tx as unknown as typeof prisma).offers_studnie_rel.upsert({
                        where: { id: w.docId },
                        create: w.create as never,
                        update: w.update as never
                    });
                }
            });
            const results: Record<string, unknown>[] = [];
            for (const w of pending) {
                await syncFts5('studnie', w.fts);
                results.push({ id: w.docId, ok: true });
            }

            logger.info(
                'Offers',
                `Zapisano ${results.length} ofert studnie przez ${authReq.user?.username}`
            );
            searchCache.invalidateAll();
            res.json({ ok: true, results });
        } catch (e: unknown) {
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
            const existingDocs: Array<{ id: string; userId: string | null }> =
                incomingIds.length > 0
                    ? (await prisma.offers_studnie_rel.findMany({
                          where: { id: { in: incomingIds } },
                          select: { id: true, userId: true }
                      })) || []
                    : [];
            const forbidden = existingDocs.some(
                (d) => d.userId && !canWriteDoc(authReq.user, d.userId)
            );
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
                    const oldDoc = await prisma.offers_studnie_rel.findUnique({
                        where: { id: docId },
                        select: { data: true }
                    });
                    if (oldDoc?.data) {
                        const orderedIds = await getOrderedWellIdsForOffer(docId);
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

                pendingPut.push({
                    docId,
                    create: {
                        id: docId,
                        userId: authReq.user?.id,
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
                        userId: authReq.user?.id,
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
                    await (tx as unknown as typeof prisma).offers_studnie_rel.upsert({
                        where: { id: w.docId },
                        create: w.create as never,
                        update: w.update as never
                    });
                }
            });
            for (const w of pendingPut) await syncFts5('studnie', w.fts);

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
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

        if (await hasProductionOrdersForOffer(id)) {
            return res.status(403).json({
                error: 'Nie można usunąć oferty — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zamówieniach tej oferty.'
            });
        }

        let oldData: Record<string, unknown> = {};
        try {
            oldData = JSON.parse(offer.data || '{}');
        } catch (_e) {
            logger.warn('Offers', 'Uszkodzony JSON data podczas usuwania oferty studni', id);
        }
        logAudit('studnia_oferta', id, authReq.user?.id || '', 'delete', null, oldData);

        await prisma.offers_studnie_rel.delete({ where: { id } });
        try {
            await (prisma as any).document_shares?.deleteMany?.({
                where: { documentType: 'offer_studnie', documentId: id }
            });
        } catch {}
        await removeFts5('studnie', id);

        logger.info(
            'Offers',
            `Oferta studnie ${req.params.id} usunięta przez ${authReq.user?.username}`
        );
        searchCache.invalidateAll();
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', `Błąd DELETE /studnie/:id (${req.params.id})`, message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
