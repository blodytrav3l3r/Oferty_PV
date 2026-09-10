import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';
import { normalizeDate } from '../../helpers';
import { searchCache } from '../../utils/searchCache';
import { syncFts5 } from '../../utils/fts5Sync';
import { buildRoleWhereClauseWithShares } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { canReadDoc, canEditDoc, resolveEditUserId } from '../../utils/ownership';
import { versionedWrite, mapVersionConflict } from '../../utils/versionWrite';
import { assertDocLockForWrite, mapDocLockConflict } from '../../utils/docLocks';
import { mapPrismaError } from '../../utils/prismaErrors';
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    idempotencyKeyFrom
} from '../../utils/idempotency';
import { OfferMapped } from '../../types/models';
import { offersBatchSchema, paginationQuerySchema } from '../../validators/offerSchemas';
import { recordDbBusy } from '../../utils/metrics';
import { HOT_TX_OPTS } from '../../utils/hotTx';

const router = express.Router();
const uuidv4 = crypto.randomUUID.bind(crypto);

const writeOffersLimiter = WRITE_LIMITER;

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const pq = paginationQuerySchema.parse(req.query);
        const roleClause = authReq.user
            ? await buildRoleWhereClauseWithShares(authReq.user, 'offer')
            : undefined;
        const orderBy = pq.sort ? { [pq.sort]: pq.order } : { createdAt: 'desc' as const };
        const [offers, totalCount] = await Promise.all([
            prisma.offers_rel.findMany({
                where: roleClause,
                skip: pq.skip,
                take: pq.limit,
                orderBy,
                select: {
                    id: true,
                    userId: true,
                    offer_number: true,
                    state: true,
                    createdAt: true,
                    updatedAt: true,
                    transportCost: true,
                    clientName: true,
                    investName: true,
                    clientNumber: true,
                    version: true
                }
            }),
            prisma.offers_rel.count({ where: roleClause })
        ]);

        const offerIds = offers.map((o) => o.id);
        const allItemsRaw = await prisma.offer_items_rel.findMany({
            where: { offerId: { in: offerIds } }
        });
        const itemsByOffer = new Map<string, typeof allItemsRaw>();
        for (const item of allItemsRaw) {
            if (!item.offerId) continue;
            const arr = itemsByOffer.get(item.offerId) || [];
            arr.push(item);
            itemsByOffer.set(item.offerId, arr);
        }

        const mapped: OfferMapped[] = [];
        for (const offer of offers) {
            const itemsRaw = itemsByOffer.get(offer.id) || [];
            const items = itemsRaw.map((i) => ({
                id: i.id,
                productId: i.productId,
                quantity: i.quantity,
                discount: i.discount,
                price: i.price,
                unitPrice: i.price ?? 0
            }));

            mapped.push({
                id: offer.id,
                type: 'offer',
                userId: offer.userId,
                title: `Oferta ${offer.offer_number || offer.id}`,
                price: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
                status: offer.state === 'final' ? 'active' : 'draft',
                createdAt: offer.createdAt || null,
                updatedAt: offer.updatedAt || offer.createdAt || null,
                lastEditedBy: offer.userId,
                clientName: offer.clientName,
                investName: offer.investName,
                clientNumber: offer.clientNumber,
                items: items,
                transportCost: offer.transportCost || 0,
                // P0-D2: baza optimistic lockingu (round-trip bez zmian frontu).
                version: offer.version ?? 1
            });
        }

        res.json({ data: mapped, totalCount, skip: pq.skip, limit: pq.limit });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post(
    '/',
    requireAuth,
    writeOffersLimiter,
    validateData(offersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        // P1-A: Idempotency-Key (opcjonalny) — retry nie tworzy duplikatu.
        const idemEndpoint = 'POST /api/offers-rury';
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

            // P4-P0: prefetch jednym findMany zamiast N+1 findUnique/findMany w pętli.
            const incomingIds: string[] = incoming
                .map((o: { id?: unknown }) => o.id)
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
            const oldOffers =
                incomingIds.length > 0
                    ? (await prisma.offers_rel.findMany({ where: { id: { in: incomingIds } } })) ||
                      []
                    : [];
            const oldById = new Map(oldOffers.map((o) => [o.id, o]));
            const oldItemsRows =
                oldOffers.length > 0
                    ? (await prisma.offer_items_rel.findMany({
                          where: { offerId: { in: oldOffers.map((o) => o.id) } }
                      })) || []
                    : [];
            const oldItemsByOffer = new Map<string, typeof oldItemsRows>();
            for (const row of oldItemsRows) {
                if (!row.offerId) continue;
                const arr = oldItemsByOffer.get(row.offerId);
                if (arr) arr.push(row);
                else oldItemsByOffer.set(row.offerId, [row]);
            }

            const results: Record<string, unknown>[] = [];
            const pendingWrites: Array<{
                docId: string;
                effectiveUserId: string;
                offerNumber: string;
                state: string;
                clientName: string | null;
                investName: string | null;
                clientNip: string | null;
                clientNumber: string | null;
                created: string | null;
                updated: string;
                historyStr: string;
                dataStr: string;
                transportCost: number;
                items: unknown[];
                // P0-D2: optimistic locking.
                exists: boolean;
                serverVersion: number | null;
                clientVersion: number | null;
                fts: {
                    id: string;
                    offer_number: string;
                    clientName: string | null;
                    investName: string | null;
                    clientNumber: string | null;
                };
            }> = [];

            for (const o of incoming) {
                let docId = o.id;
                if (!docId) {
                    // P1-A: deterministyczne id przy kluczu — retry trafia w ten sam rekord.
                    const idemIdx = incoming.indexOf(o);
                    docId = idemKey
                        ? 'idem-' +
                          crypto
                              .createHash('sha256')
                              .update(`${idemUser}|${idemEndpoint}|${idemKey}|${idemIdx}`)
                              .digest('hex')
                              .slice(0, 16)
                        : uuidv4();
                }

                let newHistory: unknown[] = [];
                const old = oldById.get(docId);

                let effectiveUserId: string;
                if (old) {
                    if (!canEditDoc(authReq.user)) {
                        return res
                            .status(403)
                            .json({ error: 'Brak uprawnień do modyfikacji tej oferty' });
                    }
                    // Model współpracy: update honoruje zmianę opiekuna
                    // (incoming.userId), fallback: stara kolumna, potem self.
                    effectiveUserId =
                        (typeof o.userId === 'string' && o.userId) ||
                        old.userId ||
                        authReq.user?.id ||
                        '';
                } else {
                    const resolved = resolveEditUserId(authReq.user, o.userId);
                    if (!resolved.allowed) {
                        return res.status(403).json({
                            error: 'Brak uprawnień do utworzenia oferty dla tego użytkownika'
                        });
                    }
                    effectiveUserId = resolved.effectiveUserId;
                }

                if (old) {
                    try {
                        newHistory = JSON.parse(old.history || '[]');
                    } catch (_e) {
                        logger.warn(
                            'Offers',
                            'Uszkodzony JSON history podczas zapisu oferty rur',
                            docId
                        );
                    }
                    const oldItems = oldItemsByOffer.get(docId) || [];
                    const snapshot = {
                        updatedAt: old.updatedAt || old.createdAt,
                        state: old.state,
                        transportCost: old.transportCost,
                        items: oldItems.map((i) => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            discount: i.discount,
                            price: i.price
                        }))
                    };
                    newHistory.unshift(snapshot);
                    if (newHistory.length > 5) newHistory = newHistory.slice(0, 5);

                    logAudit(
                        'offer',
                        docId,
                        authReq.user?.id || '',
                        'update',
                        {
                            state: o.status === 'active' ? 'final' : 'draft',
                            transportCost: o.transportCost,
                            items: o.items
                        },
                        snapshot
                    );
                } else {
                    logAudit('offer', docId, authReq.user?.id || '', 'create', {
                        state: o.status === 'active' ? 'final' : 'draft',
                        transportCost: o.transportCost,
                        items: o.items
                    });
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const clientName = o.clientName || null;
                const investName = o.investName || null;
                const clientNip = o.clientNip || null;
                const clientNumber = o.clientNumber || null;
                const created = normalizeDate(o.createdAt, { exactMs: true });
                const updated = new Date().toISOString();
                const offerNumber = o.offer_number || o.number || '';
                // P0-D2: version to kolumna, nie blob.
                const { version: clientVersionRaw, ...blobSrc } = o;
                const clientVersion =
                    typeof clientVersionRaw === 'number' ? clientVersionRaw : null;
                const dataStr = JSON.stringify(blobSrc);

                pendingWrites.push({
                    docId,
                    effectiveUserId,
                    offerNumber,
                    state,
                    clientName,
                    investName,
                    clientNip,
                    clientNumber,
                    created,
                    updated,
                    historyStr: JSON.stringify(newHistory),
                    dataStr,
                    transportCost: o.transportCost || 0,
                    items: o.items || [],
                    exists: !!old,
                    serverVersion: (old?.version as number | null | undefined) ?? null,
                    clientVersion,
                    fts: {
                        id: docId,
                        offer_number: offerNumber,
                        clientName,
                        investName,
                        clientNumber
                    }
                });
                results.push({ id: docId, ok: true });
            }

            await prisma.$transaction(async (tx) => {
                for (const w of pendingWrites) {
                    // Twarda blokada: brak wiersza = stara sesja = przepusc (chroni 409).
                    await assertDocLockForWrite(tx, {
                        docType: 'offer',
                        docId: w.docId,
                        user: { id: authReq.user?.id || '' }
                    });
                    // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                    await versionedWrite(tx.offers_rel, {
                        id: w.docId,
                        exists: w.exists,
                        serverVersion: w.serverVersion,
                        clientVersion: w.clientVersion,
                        createData: {
                            userId: w.effectiveUserId,
                            offer_number: w.offerNumber,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            updatedAt: w.updated,
                            transportCost: w.transportCost,
                            history: w.historyStr,
                            data: w.dataStr
                        },
                        updateData: {
                            userId: w.effectiveUserId,
                            offer_number: w.offerNumber,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            updatedAt: w.updated,
                            transportCost: w.transportCost,
                            history: w.historyStr,
                            data: w.dataStr
                        },
                        conflictMessage: 'Oferta zmieniona przez innego użytkownika'
                    });

                    await tx.offer_items_rel.deleteMany({
                        where: { offerId: w.docId }
                    });
                    if (w.items.length > 0) {
                        await tx.offer_items_rel.createMany({
                            data: (
                                w.items as Array<{
                                    id?: string;
                                    unitPrice?: number;
                                    price?: number;
                                    productId: string;
                                    quantity: number;
                                    discount: number;
                                }>
                            ).map((item) => ({
                                id: item.id || uuidv4(),
                                offerId: w.docId,
                                productId: item.productId,
                                quantity: item.quantity || 0,
                                discount: item.discount || 0,
                                price:
                                    item.unitPrice !== undefined ? item.unitPrice : item.price || 0
                            }))
                        });
                    }
                }
            }, HOT_TX_OPTS);
            let ftsFailed = 0;
            for (const w of pendingWrites) {
                if (!(await syncFts5('rury', w.fts))) ftsFailed++;
            }
            // P1-B: cichy dryf FTS widoczny w logu (zapis biznesowy już zacommitowany).
            if (ftsFailed > 0)
                logger.warn(
                    'Offers',
                    `FTS sync pominięty dla ${ftsFailed}/${pendingWrites.length} ofert rury`
                );

            logger.info(
                'Offers',
                `Zapisano ${results.length} ofert rury przez ${authReq.user?.username}`
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
            if (/locked|busy|timeout|P2028|P2034/i.test(message)) recordDbBusy();
            logger.error('Offers', 'Błąd POST offers', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.put(
    '/',
    requireAuth,
    writeOffersLimiter,
    validateData(offersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const docId = req.body.id;
            if (docId) {
                const existing = await prisma.offers_rel.findUnique({
                    where: { id: docId },
                    select: { userId: true }
                });
                if (existing && !canEditDoc(authReq.user)) {
                    return res.status(403).json({ error: 'Forbidden' });
                }
            }

            const incoming = req.body.data || [];

            const incomingIds: string[] = incoming
                .map((o: { id?: unknown }) => (typeof o.id === 'string' ? o.id : ''))
                .filter(Boolean);
            const putVersions = new Map<string, number>();
            const putUserIds = new Map<string, string>();
            if (incomingIds.length > 0) {
                const existingDocs =
                    (await prisma.offers_rel.findMany({
                        where: { id: { in: incomingIds } },
                        select: { id: true, userId: true, version: true }
                    })) || [];
                for (const d of existingDocs) putVersions.set(d.id, d.version ?? 1);
                for (const d of existingDocs) {
                    if (d.userId) putUserIds.set(d.id, d.userId);
                }
                const forbidden = !canEditDoc(authReq.user) && existingDocs.length > 0;
                if (forbidden) {
                    return res.status(403).json({
                        error: 'Forbidden — nie masz uprawnień do modyfikacji jednej z ofert'
                    });
                }
            }

            const pendingPut: Array<{
                docId: string;
                state: string;
                clientName: string | null;
                investName: string | null;
                clientNip: string | null;
                clientNumber: string | null;
                created: string | null;
                dataStr: string;
                transportCost: number;
                items: unknown[];
                // Model współpracy: żądana zmiana opiekuna (puste = bez zmiany).
                requestedUserId: string;
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
                    docId = crypto.randomUUID();
                }

                const state = o.status === 'active' ? 'final' : 'draft';
                const clientName = o.clientName || null;
                const investName = o.investName || null;
                const clientNip = o.clientNip || null;
                const clientNumber = o.clientNumber || null;
                const created = normalizeDate(o.createdAt, { exactMs: true });
                // P0-D2: version to kolumna, nie blob.
                const { version: clientVersionRaw, ...blobSrc } = o;
                const clientVersion =
                    typeof clientVersionRaw === 'number' ? clientVersionRaw : null;
                const dataStr = JSON.stringify(blobSrc);
                const serverVersion = putVersions.get(docId) ?? null;

                pendingPut.push({
                    docId,
                    state,
                    clientName,
                    investName,
                    clientNip,
                    clientNumber,
                    created,
                    dataStr,
                    transportCost: o.transportCost || 0,
                    items: o.items || [],
                    requestedUserId: typeof o.userId === 'string' ? o.userId : '',
                    exists: serverVersion != null,
                    serverVersion,
                    clientVersion,
                    fts: {
                        id: docId,
                        offer_number: o.offer_number || null,
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
                        docType: 'offer',
                        docId: w.docId,
                        user: { id: authReq.user?.id || '' }
                    });
                    // Model współpracy: żądana zmiana opiekuna wygrywa,
                    // fallback: stara kolumna, potem self (nigdy ślepo edytujący).
                    const putUserId =
                        w.requestedUserId || putUserIds.get(w.docId) || authReq.user?.id || '';
                    // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                    await versionedWrite(tx.offers_rel, {
                        id: w.docId,
                        exists: w.exists,
                        serverVersion: w.serverVersion,
                        clientVersion: w.clientVersion,
                        createData: {
                            userId: putUserId,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            transportCost: w.transportCost,
                            data: w.dataStr
                        },
                        updateData: {
                            userId: putUserId,
                            state: w.state,
                            clientName: w.clientName,
                            investName: w.investName,
                            clientNip: w.clientNip,
                            clientNumber: w.clientNumber,
                            createdAt: w.created,
                            transportCost: w.transportCost,
                            data: w.dataStr
                        },
                        conflictMessage: 'Oferta zmieniona przez innego użytkownika'
                    });

                    await tx.offer_items_rel.deleteMany({
                        where: { offerId: w.docId }
                    });
                    if (w.items.length > 0) {
                        await tx.offer_items_rel.createMany({
                            data: (
                                w.items as Array<{
                                    id?: string;
                                    unitPrice?: number;
                                    price?: number;
                                    productId: string;
                                    quantity: number;
                                    discount: number;
                                }>
                            ).map((item) => ({
                                id: item.id || uuidv4(),
                                offerId: w.docId,
                                productId: item.productId,
                                quantity: item.quantity || 0,
                                discount: item.discount || 0,
                                price:
                                    item.unitPrice !== undefined ? item.unitPrice : item.price || 0
                            }))
                        });
                    }
                }
            }, HOT_TX_OPTS);
            let ftsPutFailed = 0;
            for (const w of pendingPut) {
                if (!(await syncFts5('rury', w.fts))) ftsPutFailed++;
            }
            // P1-B: cichy dryf FTS widoczny w logu (zapis biznesowy już zacommitowany).
            if (ftsPutFailed > 0)
                logger.warn(
                    'Offers',
                    `FTS sync pominięty dla ${ftsPutFailed}/${pendingPut.length} ofert rury (PUT)`
                );

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
            if (mapDocLockConflict(res, e)) return;
            if (mapVersionConflict(res, e)) return;
            if (mapPrismaError(res, e)) return;
            const message = e instanceof Error ? e.message : 'Unknown error';
            if (/locked|busy|timeout|P2028|P2034/i.test(message)) recordDbBusy();
            logger.error('Offers', 'Błąd PUT offers', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.post('/:id/duplicate', requireAuth, writeOffersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;

        const source = await prisma.offers_rel.findUnique({ where: { id } });
        if (!source) {
            return res.status(404).json({ error: 'Oferta źródłowa nie istnieje' });
        }
        if (!canReadDoc(authReq.user, source.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do odczytu oferty źródłowej' });
        }

        const sourceItems = await prisma.offer_items_rel.findMany({ where: { offerId: id } });

        const newId = uuidv4();
        const resolved = resolveEditUserId(authReq.user, undefined);
        if (!resolved.allowed) {
            return res.status(403).json({ error: 'Brak uprawnień do utworzenia oferty' });
        }

        let dupClientName: string | null = null;
        let dupInvestName: string | null = null;
        let dupClientNumber: string | null = null;
        try {
            const srcData = JSON.parse(source.data || '{}');
            dupClientName = srcData.clientName || null;
            dupInvestName = srcData.investName || null;
            dupClientNumber = srcData.clientNumber || null;
        } catch {
            logger.warn('Offers', 'Uszkodzony JSON data przy kopiowaniu oferty rur', id);
        }

        await prisma.offers_rel.create({
            data: {
                id: newId,
                userId: resolved.effectiveUserId,
                offer_number: source.offer_number ? `${source.offer_number}-KOPIA` : '',
                state: 'draft',
                clientName: dupClientName,
                investName: dupInvestName,
                clientNumber: dupClientNumber,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                transportCost: source.transportCost ?? 0,
                history: '[]',
                data: source.data || '{}',
                version: 1
            }
        });

        await syncFts5('rury', {
            id: newId,
            offer_number: source.offer_number ? `${source.offer_number}-KOPIA` : '',
            clientName: dupClientName,
            investName: dupInvestName,
            clientNumber: dupClientNumber
        });

        if (sourceItems.length > 0) {
            await prisma.offer_items_rel.createMany({
                data: sourceItems.map((item) => ({
                    id: uuidv4(),
                    offerId: newId,
                    productId: item.productId,
                    quantity: item.quantity,
                    discount: item.discount,
                    price: item.price
                }))
            });
        }

        logAudit('offer', newId, authReq.user?.id || '', 'duplicate', null, { sourceId: id });

        logger.info(
            'Offers',
            `Oferta ${id} zduplikowana jako ${newId} przez ${authReq.user?.username}`
        );

        searchCache.invalidateAll();
        return res.json({ ok: true, data: { id: newId } });
    } catch (e: unknown) {
        if (mapPrismaError(res, e)) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd POST /:id/duplicate', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
