import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { searchCache } from '../../utils/searchCache';
import { ruryOrdersBatchSchema, ruryOrderUpdateSchema } from '../../validators/offerSchemas';
import { logger } from '../../utils/logger';
import { canWriteDoc, canReadWithShare } from '../../utils/ownership';
import { buildRoleWhereConditionWithShares } from '../../utils/roleFilter';
import { versionedWrite, mapVersionConflict } from '../../utils/versionWrite';
import crypto from 'crypto';

const router = express.Router();

const writeOrdersLimiter = WRITE_LIMITER;

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
            ? buildRoleWhereConditionWithShares(authReq.user, 'order_rury')
            : Prisma.empty;
        if (offerIds.length > 0) {
            const idCond = Prisma.sql`"offerId" IN (${Prisma.join(offerIds)})`;
            whereCondition =
                whereCondition !== Prisma.empty
                    ? Prisma.sql`${whereCondition} AND ${idCond}`
                    : Prisma.sql`WHERE ${idCond}`;
        }
        const orders = await prisma.$queryRaw<
            Array<{
                id: string;
                userId: string | null;
                offerId: string | null;
                status: string | null;
                createdAt: string | null;
                version: number | null;
                data: string | null;
            }>
        >`SELECT id, "userId", "offerId", status, data, version,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_rury_rel ${whereCondition}`;

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerId: o.offerId,
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
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.post('/claim-rury-number/:userId', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const userId = req.params.userId;
        if (!userId) return res.status(400).json({ error: 'Brak userId' });
        if (!canWriteDoc(authReq.user, userId)) {
            return res.status(403).json({ error: 'Brak uprawnień do numeru tego użytkownika' });
        }

        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = user.symbol || '??';
        const counter = await prisma.order_counters_rury.upsert({
            where: { userId_year: { userId, year } },
            create: { userId, year, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } }
        });
        const nextNumber = counter.lastNumber;

        const formatted = `${symbol}/ZR/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put(
    '/',
    requireAuth,
    writeOrdersLimiter,
    validateData(ruryOrdersBatchSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const incoming = req.body.data || [];

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
                            offerId,
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

                        const old = await tx.orders_rury_rel.findUnique({
                            where: { id: docId },
                            select: { data: true, userId: true, version: true }
                        });

                        if (old && !canWriteDoc(authReq.user, old.userId)) {
                            throw { status: 403, message: 'Brak uprawnień do tego zamówienia' };
                        }
                        const targetUserId =
                            old?.userId || incomingUserId || authReq.user?.id || '';
                        if (!canWriteDoc(authReq.user, targetUserId)) {
                            throw { status: 403, message: 'Brak uprawnień do tego zamówienia' };
                        }
                        const newData = { ...rest };

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
                            logAudit('order', docId, authReq.user?.id || '', 'create', newData);
                        }

                        // P0-D2: predykat wersji w zapisie (kolumna wygrywa z blobem).
                        await versionedWrite(tx.orders_rury_rel, {
                            id: docId,
                            exists: !!old,
                            serverVersion: old?.version ?? null,
                            clientVersion,
                            createData: {
                                userId: targetUserId,
                                offerId: offerId || '',
                                createdAt: createdAt,
                                status: status || 'new',
                                data: dataStr
                            },
                            updateData: {
                                userId: targetUserId,
                                offerId: offerId || '',
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
            if (mapVersionConflict(res, e)) return;
            if ((e as { status?: number }).status === 403) {
                return res
                    .status(403)
                    .json({ error: (e as { message?: string }).message || 'Brak uprawnień' });
            }
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Orders', 'Błąd PUT orders-rury', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId }
        });
        if (!o || !(await canReadWithShare(authReq.user, o.userId, 'order_rury', docId))) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});

        res.json({
            data: {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerId: o.offerId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData,
                // P0-D2: kolumna wygrywa z blobem.
                version: o.version ?? 1
            }
        });
    } catch (_e: unknown) {
        res.status(404).json({ error: 'Zamówienie nie znalezione' });
    }
});

router.patch(
    '/:id',
    requireAuth,
    writeOrdersLimiter,
    validateData(ruryOrderUpdateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const docId = req.params.id;

            const o = await prisma.orders_rury_rel.findUnique({
                where: { id: docId },
                select: { id: true, userId: true, status: true, data: true, version: true }
            });
            const isOwner = o && o.userId === authReq.user?.id;
            const isProParent =
                o &&
                authReq.user?.role === 'pro' &&
                (authReq.user?.subUsers || []).includes(o.userId || '');
            if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
                return res.status(404).json({ error: 'Zamówienie nie znalezione' });
            }

            const oldData = parseJsonField<Record<string, unknown>>(o.data, {});
            const updatedData = { ...oldData, ...req.body };
            delete updatedData.id;
            delete updatedData.type;
            delete updatedData.userId;
            delete updatedData.offerId;
            delete updatedData.status;
            delete updatedData.createdAt;
            // P0-D2: version to kolumna, nie blob.
            const patchVersion = typeof req.body.version === 'number' ? req.body.version : null;
            delete updatedData.version;

            const newStatus = req.body.status || o.status;
            const newUserId = req.body.userId || o.userId;

            if (req.body.userId && req.body.userId !== o.userId && authReq.user?.role !== 'admin') {
                return res
                    .status(403)
                    .json({ error: 'Tylko administrator może zmienić opiekuna zamówienia' });
            }

            const dataStr = JSON.stringify(updatedData);

            if (patchVersion != null) {
                // P0-D2: predykat w JEDNYM SQL.
                const upd = await prisma.orders_rury_rel.updateMany({
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
                        serverVersion: o.version ?? 1
                    });
                }
            } else {
                await prisma.orders_rury_rel.update({
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
            logger.error('RuryOrders', 'Błąd zapisu zamówień rury', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

router.delete('/:id', requireAuth, writeOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, data: true }
        });
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});

        logAudit('order', docId, authReq.user?.id || '', 'delete', null, oldData);

        // P0-E: kasowanie w transakcji (predykat własności w samym DELETE).
        await prisma.$transaction(async (tx) => {
            if (authReq.user?.role === 'admin') {
                await tx.$executeRaw`DELETE FROM orders_rury_rel WHERE id = ${docId}`;
            } else {
                await tx.orders_rury_rel.deleteMany({
                    where: { id: docId, userId: authReq.user?.id }
                });
            }
            // P1-E: shares w tej samej tx (koniec okna crash→sierota).
            try {
                await (tx as any).document_shares?.deleteMany?.({
                    where: { documentType: 'order_rury', documentId: docId }
                });
            } catch (e: unknown) {
                logger.warn(
                    'Offers',
                    'Pomijam czyszczenie shares (legacy?)',
                    e instanceof Error ? e.message : String(e)
                );
            }
        });
        searchCache.invalidateAll();
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Offers', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
