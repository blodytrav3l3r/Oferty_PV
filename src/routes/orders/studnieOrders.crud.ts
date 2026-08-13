import express from 'express';
import prisma, { Prisma } from '../../prismaClient';
import { logAudit } from '../../services/auditService';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER } from '../../middleware/rateLimiters';
import { searchCache } from '../../utils/searchCache';
import { studnieOrdersBatchSchema, studnieOrderUpdateSchema } from '../../validators/offerSchemas';
import { canWriteDoc } from '../../utils/ownership';
import { buildRoleWhereCondition } from '../../utils/roleFilter';
import { countProductionOrdersForOrder } from '../../utils/productionOrderGuard';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const router = express.Router();

// Rate limiter dla operacji na zamówieniach (60 zapytań na minutę)
const writeOrdersLimiter = WRITE_LIMITER;

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
        let whereCondition = authReq.user ? buildRoleWhereCondition(authReq.user) : Prisma.empty;
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
                data: string | null;
            }>
        >`SELECT id, "userId", "offerStudnieId", status, data,
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
                ...parsedData
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
                    ...rest
                } = o;
                const dataStr = JSON.stringify(rest);

                const createdAt = normalizeDate(createdAtRaw);

                const old = await prisma.orders_studnie_rel.findUnique({
                    where: { id: docId },
                    select: { data: true, userId: true }
                });

                const targetUserId = old?.userId || incomingUserId || authReq.user?.id || '';
                if (!canWriteDoc(authReq.user, targetUserId)) {
                    return res.status(403).json({ error: 'Brak uprawnień do tego zamówienia' });
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

                const resolvedOfferId = offerStudnieId || (o.offerId as string | undefined) || '';
                await prisma.orders_studnie_rel.upsert({
                    where: { id: docId },
                    create: {
                        id: docId,
                        userId: targetUserId,
                        offerStudnieId: resolvedOfferId,
                        createdAt: createdAt,
                        status: status || 'new',
                        data: dataStr
                    },
                    update: {
                        userId: targetUserId,
                        offerStudnieId: resolvedOfferId,
                        createdAt: createdAt,
                        status: status || 'new',
                        data: dataStr
                    }
                });
            }

            searchCache.invalidateAll();
            res.json({ ok: true });
        } catch (e: unknown) {
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
        if (!o || !canWriteDoc(authReq.user, o.userId)) {
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
                ...parsedData
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
    validateData(studnieOrderUpdateSchema),
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const docId = req.params.id;

            const o = await prisma.orders_studnie_rel.findUnique({
                where: { id: docId },
                select: { id: true, userId: true, status: true, data: true }
            });
            if (!o || !canWriteDoc(authReq.user, o.userId)) {
                return res.status(404).json({ error: 'Zamówienie nie znalezione' });
            }

            const oldData = parseJsonField<Record<string, unknown>>(o.data, {});
            const updatedData = { ...oldData, ...req.body };
            delete updatedData.id;
            delete updatedData.type;
            delete updatedData.userId;
            delete updatedData.offerStudnieId;
            delete updatedData.status;
            delete updatedData.createdAt;

            const newStatus = req.body.status || o.status;
            const newUserId = req.body.userId || o.userId;
            if (!canWriteDoc(authReq.user, newUserId)) {
                return res
                    .status(403)
                    .json({ error: 'Brak uprawnień do zapisu dla tego użytkownika' });
            }
            const dataStr = JSON.stringify(updatedData);

            await prisma.orders_studnie_rel.update({
                where: { id: docId },
                data: {
                    status: newStatus,
                    userId: newUserId,
                    data: dataStr
                }
            });

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

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRaw`DELETE FROM orders_studnie_rel WHERE id = ${docId}`;
        } else {
            await prisma.orders_studnie_rel.deleteMany({
                where: { id: docId, userId: authReq.user?.id }
            });
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
