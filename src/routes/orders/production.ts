import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { buildRoleWhereClause } from '../../utils/roleFilter';
import { logger } from '../../utils/logger';

const router = express.Router();

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const orders = await prisma.production_orders_rel.findMany({
            where: roleClause
        });

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.get('/registry', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const roleClause = authReq.user ? buildRoleWhereClause(authReq.user) : undefined;
        const orders = await prisma.production_orders_rel.findMany({
            where: roleClause,
            orderBy: { createdAt: 'desc' }
        });

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const {
                id: _id,
                type: _type,
                userId,
                orderId,
                wellId,
                elementIndex,
                createdAt,
                updatedAt,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

            const old = await prisma.production_orders_rel.findUnique({
                where: { id: docId },
                select: { data: true }
            });
            if (old) {
                logAudit(
                    'production_order',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    rest,
                    parseJsonField<Record<string, unknown>>(old.data, {})
                );
            } else {
                logAudit('production_order', docId, authReq.user?.id || '', 'create', rest);
            }

            await prisma.production_orders_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: userId || authReq.user?.id,
                    creatorId: authReq.user?.id,
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    createdAt: createdAt || new Date().toISOString(),
                    updatedAt: updatedAt || new Date().toISOString(),
                    data: dataStr
                },
                update: {
                    userId: userId || authReq.user?.id,
                    creatorId: authReq.user?.id,
                    orderId: orderId || '',
                    wellId: wellId || '',
                    elementIndex: elementIndex || 0,
                    createdAt: createdAt || new Date().toISOString(),
                    updatedAt: updatedAt || new Date().toISOString(),
                    data: dataStr
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.post('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const o = req.body;
        if (!o || !o.wellId) return res.status(400).json({ error: 'Nieprawidłowe dane zlecenia' });

        let docId = o.id;
        if (!docId) {
            docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        }

        const {
            id: _id,
            type: _type,
            userId,
            orderId,
            wellId,
            elementIndex,
            createdAt,
            updatedAt,
            ...rest
        } = o;
        const dataStr = JSON.stringify(rest);

        const old = await prisma.production_orders_rel.findUnique({
            where: { id: docId },
            select: { data: true }
        });
        if (old) {
            logAudit(
                'production_order',
                docId,
                authReq.user?.id || '',
                'update',
                rest,
                parseJsonField<Record<string, unknown>>(old.data, {})
            );
        } else {
            logAudit('production_order', docId, authReq.user?.id || '', 'create', rest);
        }

        await prisma.production_orders_rel.upsert({
            where: { id: docId },
            create: {
                id: docId,
                userId: userId || authReq.user?.id,
                creatorId: authReq.user?.id,
                orderId: orderId || '',
                wellId: wellId || '',
                elementIndex: elementIndex || 0,
                createdAt: createdAt || new Date().toISOString(),
                updatedAt: updatedAt || new Date().toISOString(),
                data: dataStr
            },
            update: {
                userId: userId || authReq.user?.id,
                creatorId: authReq.user?.id,
                orderId: orderId || '',
                wellId: wellId || '',
                elementIndex: elementIndex || 0,
                createdAt: createdAt || new Date().toISOString(),
                updatedAt: updatedAt || new Date().toISOString(),
                data: dataStr
            }
        });

        res.json({ ok: true, id: docId });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Production', 'Błąd POST', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const order = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!order || (authReq.user?.role !== 'admin' && order.userId !== authReq.user?.id)) {
            return res.status(404).json({ error: 'Zlecenie nie znalezione' });
        }

        const parsedData = parseJsonField<Record<string, unknown>>(order.data, {});

        res.json({
            data: {
                id: order.id,
                type: 'production_order',
                userId: order.userId,
                orderId: order.orderId,
                wellId: order.wellId,
                elementIndex: order.elementIndex,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                ...parsedData
            }
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});

        if (oldData.status === 'accepted') {
            return res
                .status(403)
                .json({ error: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.' });
        }

        logAudit('production_order', docId, existing.userId || '', 'delete', null, oldData);

        // Recykling numeru zlecenia produkcyjnego (recykle)
        const prodNum = (oldData.productionOrderNumber as string) || '';
        if (prodNum) {
            const parts = prodNum.split('/');
            if (parts.length >= 4) {
                const seqNumber = parseInt(parts[2], 10);
                const yearShort = parseInt(parts[3], 10);
                const fullYear = 2000 + yearShort;
                if (seqNumber > 0) {
                    await prisma.recycled_production_numbers.upsert({
                        where: {
                            userId_year_seqNumber: {
                                userId: existing.userId || '',
                                year: fullYear,
                                seqNumber
                            }
                        },
                        create: {
                            userId: existing.userId || '',
                            year: fullYear,
                            seqNumber
                        },
                        update: {}
                    });
                }
            }
        }

        if (authReq.user?.role === 'admin') {
            await prisma.production_orders_rel.delete({
                where: { id: docId }
            });
        } else {
            await prisma.production_orders_rel.deleteMany({
                where: { id: docId, userId: authReq.user?.id }
            });
        }
        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
