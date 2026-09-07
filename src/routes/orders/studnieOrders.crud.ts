import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { searchCache } from '../../utils/searchCache';
import { studnieOrdersBatchSchema, studnieOrderUpdateSchema } from '../../validators/offerSchemas';
import { observeStudnieOrderDto } from '../../validators/orderSchemas';
import { canWriteDoc, canReadWithShare } from '../../utils/ownership';
import { buildRoleWhereConditionWithShares } from '../../utils/roleFilter';
import { countProductionOrdersForOrder } from '../../utils/productionOrderGuard';
import { versionedWrite, mapVersionConflict } from '../../utils/versionWrite';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const router = express.Router();

// Rate limiter dla operacji na zamówieniach (60 zapytań na minutę)
const writeOrdersLimiter = WRITE_LIMITER;

/* ===== SLIM-AUDIT dla order/create =====
 * Pełne wells (megabajty przy tysiącach studni) żyją w orders_studnie_rel;
 * audit dostaje streszczenie z deterministycznym hashem kanonu wells-DTO
 * (weryfikacja „czy zapis odpowiada utworzeniu" bez 18 MB w audit_logs).
 * Restore z audytu jest wyłączone dla 'order' (kartotekaAudit canRestore),
 * podgląd i historia biorą orderNumber/totalNetto/clientName — wszystko w slim.
 * Skala wpisu: ~18 MB -> <1 KB.
 */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

function buildOrderCreateAudit(
    newData: Record<string, unknown>,
    resolvedOfferId: string,
    docId: string
): Record<string, unknown> {
    const wells = Array.isArray(newData['wells']) ? (newData['wells'] as unknown[]) : [];
    const num = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;
    return {
        _slimAudit: true,
        id: docId,
        offerId: resolvedOfferId,
        offerNumber: (newData['offerNumber'] ?? newData['number'] ?? null) as unknown,
        orderNumber: (newData['orderNumber'] ?? null) as unknown,
        clientName: (newData['clientName'] ?? null) as unknown,
        wellsCount: wells.length,
        totalNetto: num(newData['totalNetto']),
        totalBrutto: num(newData['totalBrutto']),
        totalWeight: num(newData['totalWeight']),
        // flaga obecności (bez treści): podtrzymuje summary „zawiera kartę budowy"
        ...(newData['kartaBudowy'] ? { kartaBudowy: true } : {}),
        wellsHash: crypto.createHash('sha256').update(stableStringify(wells)).digest('hex')
    };
}

/* ===== ZAMÓWIENIA STUDNIE ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const idsParam = req.query.ids;
        const offerIds =
            typeof idsParam === 'string' && idsParam
                ? idsParam
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 200)
                : [];
        let whereCondition = authReq.user
            ? buildRoleWhereConditionWithShares(authReq.user, 'order_studnie')
            : Prisma.empty;
        if (offerIds.length > 0) {
            const idCond = Prisma.sql`"offerStudnieId" IN (${Prisma.join(offerIds)})`;
            whereCondition =
                whereCondition !== Prisma.empty
                    ? Prisma.sql`${whereCondition} AND ${idCond}`
                    : Prisma.sql`WHERE ${idCond}`;
        }
        const orders = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                offerStudnieId: string | null;
                status: string | null;
                createdAt: string | null;
                version: number | null;
                data: string | null;
            }>
        >`SELECT id, "userId", "offerStudnieId", status, data, version,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_studnie_rel ${whereCondition}`;

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerStudnieId: o.offerStudnieId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData,
                // P0-D2: kolumna wygrywa z blobem.
                version: o.version ?? 1
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('StudnieOrders', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put(
    '/',
    requireAuth,
    writeOrdersLimiter,
    validateData(studnieOrdersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const incoming = req.body.data || [];

            // P0.3 observe (non-blocking): wykryj klucze spoza kontraktu DTO.
            // Request NIGDY nie jest odrzucany na tym etapie — tylko log.
            // Enforcement (.strict()) dopiero po audycie logów (P1).
            for (const o of incoming) {
                try {
                    const obs = observeStudnieOrderDto(o);
                    if (
                        obs.unknownWellKeys.length > 0 ||
                        obs.unknownConfigKeys.length > 0 ||
                        obs.unknownPrzejscieKeys.length > 0 ||
                        obs.runtimeLeaked.length > 0
                    ) {
                        logger.warn('StudnieOrders', '[DTO-observe] klucz spoza kontraktu', {
                            orderId: (o as { id?: unknown }).id,
                            wellsChecked: obs.wellsChecked,
                            unknownWellKeys: obs.unknownWellKeys,
                            unknownConfigKeys: obs.unknownConfigKeys,
                            unknownPrzejscieKeys: obs.unknownPrzejscieKeys,
                            runtimeLeaked: obs.runtimeLeaked
                        });
                    }
                } catch {
                    // obserwacja pasywna
                }
            }

            // P0-C/D2: cały batch w jednej transakcji + predykat wersji.
            await prisma.$transaction(
                async (tx) => {
                    for (const o of incoming) {
                        let docId = o.id;
                        if (!docId) {
                            docId = crypto.randomUUID();
                        }

                        const {
                            id: _id,
                            type: _type,
                            userId: incomingUserId,
                            offerStudnieId,
                            createdAt: createdAtRaw,
                            status,
                            version: clientVersionRaw,
                            ...rest
                        } = o;
                        // P0-D2: baza optimistic lockingu — nie trafia do bloba JSON.
                        const clientVersion =
                            typeof clientVersionRaw === 'number' ? clientVersionRaw : null;
                        const dataStr = JSON.stringify(rest);

                        const createdAt = normalizeDate(createdAtRaw);

                        const old = await tx.orders_studnie_rel.findUnique({
                            where: { id: docId },
                            select: { data: true, userId: true, version: true }
                        });

                        if (old && !canWriteDoc(authReq.user, old.userId)) {
                            throw { status: 403, message: 'Brak uprawnień do tego zamówienia' };
                        }
                        // P1 HIGH: optimistic concurrency dla single-save (data.length === 1).
                        // baseUpdatedAt == null (create) albo zgodny → zapis; rozjazd → 409.
                        const singleBase =
                            incoming.length === 1
                                ? (req.body.baseUpdatedAt as string | undefined)
                                : undefined;
                        if (old && singleBase != null) {
                            const oldData = parseJsonField<Record<string, unknown>>(old.data, {});
                            const serverUpdatedAt = oldData['updatedAt'];
                            if (
                                typeof serverUpdatedAt === 'string' &&
                                serverUpdatedAt !== '' &&
                                serverUpdatedAt !== singleBase
                            ) {
                                // P0-C: w tx nie ma return res — throw cofa batch.
                                throw {
                                    status: 409,
                                    message: 'Zamówienie zmieniono w międzyczasie',
                                    serverOrder: {
                                        id: docId,
                                        type: 'order',
                                        userId: old.userId,
                                        ...oldData
                                    }
                                };
                            }
                        }
                        const targetUserId =
                            old?.userId || incomingUserId || authReq.user?.id || '';
                        if (!canWriteDoc(authReq.user, targetUserId)) {
                            throw { status: 403, message: 'Brak uprawnień do tego zamówienia' };
                        }
                        const newData = { ...rest };
                        const resolvedOfferId =
                            offerStudnieId || (o.offerId as string | undefined) || '';

                        if (old) {
                            logAudit(
                                'order',
                                docId,
                                authReq.user?.id || '',
                                'update',
                                newData,
                                parseJsonField<Record<string, unknown>>(old.data, {})
                            );
                        } else {
                            // create: slim (pełne wells zostają w orders_studnie_rel)
                            logAudit(
                                'order',
                                docId,
                                authReq.user?.id || '',
                                'create',
                                buildOrderCreateAudit(newData, resolvedOfferId, docId)
                            );
                        }

                        // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                        await versionedWrite(tx.orders_studnie_rel, {
                            id: docId,
                            exists: !!old,
                            serverVersion: old?.version ?? null,
                            clientVersion,
                            createData: {
                                userId: targetUserId,
                                offerStudnieId: resolvedOfferId,
                                createdAt: createdAt,
                                status: status || 'new',
                                data: dataStr
                            },
                            updateData: {
                                userId: targetUserId,
                                offerStudnieId: resolvedOfferId,
                                createdAt: createdAt,
                                status: status || 'new',
                                data: dataStr
                            },
                            conflictMessage: 'Zamówienie zmieniono w międzyczasie'
                        });
                    }
                },
                { timeout: 30000 }
            );

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
            // P0-C: baseUpdatedAt-throw niesie gotowy serverOrder (przed generyką).
            if (
                (e as { status?: number }).status === 409 &&
                (e as { serverOrder?: unknown }).serverOrder
            ) {
                return res.status(409).json({
                    error: (e as { message?: string }).message || 'Konflikt wersji',
                    code: (e as { code?: string }).code,
                    serverVersion: (e as { serverVersion?: number }).serverVersion,
                    serverOrder: (e as { serverOrder?: unknown }).serverOrder
                });
            }
            if (mapVersionConflict(res, e)) return;
            if ((e as { status?: number }).status === 403) {
                return res
                    .status(403)
                    .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
            }
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('StudnieOrders', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

/* ===== ZAMÓWIENIE PO ID (ZAMÓWIENIE) ===== */

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId }
        });
        if (!o || !(await canReadWithShare(authReq.user, o.userId, 'order_studnie', docId))) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

        res.json({
            data: {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerStudnieId: o.offerStudnieId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData,
                // P0-D2: kolumna wygrywa z blobem.
                version: o.version ?? 1
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('StudnieOrdersV2', 'GET order error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.patch(
    '/:id',
    requireAuth,
    writeOrdersLimiter,
    validateData(studnieOrderUpdateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const docId = req.params.id;

            const o = await prisma.orders_studnie_rel.findUnique({
                where: { id: docId },
                select: {
                    id: true,
                    userId: true,
                    offerStudnieId: true,
                    status: true,
                    data: true,
                    version: true
                }
            });
            if (!o || !canWriteDoc(authReq.user, o.userId)) {
                return res.status(404).json({ error: 'Zamówienie nie znalezione' });
            }

            const oldData = parseJsonField<Record<string, unknown>>(o.data, {});
            // P1 HIGH: optimistic concurrency — baseUpdatedAt nie jest danymi.
            const baseUpdatedAt =
                typeof req.body.baseUpdatedAt === 'string' ? req.body.baseUpdatedAt : undefined;
            const serverUpdatedAt = oldData['updatedAt'];
            if (
                baseUpdatedAt != null &&
                typeof serverUpdatedAt === 'string' &&
                serverUpdatedAt !== '' &&
                serverUpdatedAt !== baseUpdatedAt
            ) {
                return res.status(409).json({
                    error: 'Zamówienie zmieniono w międzyczasie',
                    serverOrder: {
                        id: o.id,
                        type: 'order',
                        userId: o.userId,
                        offerStudnieId: o.offerStudnieId,
                        status: o.status,
                        ...oldData
                    }
                });
            }
            const updatedData = { ...oldData, ...req.body };
            delete updatedData.id;
            delete updatedData.type;
            delete updatedData.userId;
            delete updatedData.offerStudnieId;
            delete updatedData.status;
            delete updatedData.createdAt;
            delete updatedData.baseUpdatedAt;
            // P0-D2: version to kolumna, nie blob.
            const patchVersion = typeof req.body.version === 'number' ? req.body.version : null;
            delete updatedData.version;

            const newStatus = req.body.status || o.status;
            const newUserId = req.body.userId || o.userId;
            if (!canWriteDoc(authReq.user, newUserId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu dla tego użytkownika' });
            }
            const dataStr = JSON.stringify(updatedData);

            if (patchVersion != null) {
                // P0-D2: predykat w JEDNYM SQL.
                const upd = await prisma.orders_studnie_rel.updateMany({
                    where: { id: docId, version: patchVersion },
                    data: {
                        status: newStatus,
                        userId: newUserId,
                        data: dataStr,
                        version: { increment: 1 }
                    }
                });
                if (upd.count === 0) {
                    return res.status(409).json({
                        error: 'Zamówienie zmieniono w międzyczasie',
                        code: 'VERSION_CONFLICT',
                        serverVersion: o.version ?? 1,
                        serverOrder: {
                            id: o.id,
                            type: 'order',
                            userId: o.userId,
                            offerStudnieId: o.offerStudnieId,
                            status: o.status,
                            ...oldData
                        }
                    });
                }
            } else {
                await prisma.orders_studnie_rel.update({
                    where: { id: docId },
                    data: {
                        status: newStatus,
                        userId: newUserId,
                        data: dataStr,
                        version: { increment: 1 }
                    }
                });
            }

            logAudit('order', docId, authReq.user?.id || '', 'update', updatedData, oldData);

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('StudnieOrders', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.delete('/:id', requireAuth, writeOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, offerStudnieId: true, data: true }
        });
        if (!existing) return res.json({ ok: true });
        if (!canWriteDoc(authReq.user, existing.userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego zamówienia' });
        }

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});
        const offerId =
            existing.offerStudnieId || (typeof oldData.offerId === 'string' ? oldData.offerId : '');

        const poCount = await countProductionOrdersForOrder(docId, offerId);
        if (poCount > 0) {
            return res.status(403).json({
                error: 'Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.'
            });
        }

        logAudit('order', docId, authReq.user?.id || '', 'delete', null, oldData);

        // P0-E: guard + kasowanie w JEDNEJ transakcji (koniec TOCTOU guard-then-delete).
        try {
            await prisma.$transaction(async (tx) => {
                const poCount = await countProductionOrdersForOrder(docId, offerId, tx);
                if (poCount > 0) {
                    throw {
                        status: 403,
                        message:
                            'Nie można usunąć zamówienia — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.'
                    };
                }
                if (authReq.user?.role === 'admin') {
                    await tx.$executeRaw`DELETE FROM orders_studnie_rel WHERE id = ${docId}`;
                } else {
                    await tx.orders_studnie_rel.deleteMany({
                        where: { id: docId, userId: authReq.user?.id }
                    });
                }
                // P1-E: shares w tej samej tx (koniec okna crash→sierota).
                try {
                    await (tx as any).document_shares?.deleteMany?.({
                        where: { documentType: 'order_studnie', documentId: docId }
                    });
                } catch (e: unknown) {
                    logger.warn(
                        'StudnieOrders',
                        'Pomijam czyszczenie shares (legacy?)',
                        e instanceof Error ? e.message : String(e)
                    );
                }
            });
        } catch (e: unknown) {
            if ((e as { status?: number }).status === 403) {
                return res
                    .status(403)
                    .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
            }
            throw e;
        }
        searchCache.invalidateAll();
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('StudnieOrders', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
