import express from 'express';
import prisma from '../prismaClient';
import { logAudit } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { parseJsonField } from '../helpers';

const router = express.Router();

/* ===== ORDERS STUDNIE (Zamówienia) ===== */

router.get('/', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        let orders: any[];
        if (authReq.user?.role === 'admin') {
            orders = await prisma.orders_studnie_rel.findMany();
        } else if (authReq.user?.role === 'pro') {
            const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
            orders = await prisma.orders_studnie_rel.findMany({
                where: { userId: { in: allowedIds } }
            });
        } else {
            orders = await prisma.orders_studnie_rel.findMany({
                where: { userId: authReq.user?.id }
            });
        }

        const mapped = orders.map((o: any) => {
            const parsedData = parseJsonField(o.data);
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const { id, type, userId, offerStudnieId, createdAt, status, ...rest } = o;
            const dataStr = JSON.stringify(rest);
            const old = await prisma.orders_studnie_rel.findUnique({
                where: { id: docId },
                select: { data: true }
            });
            const newData = { ...rest };

            if (old) {
                logAudit(
                    'order',
                    docId,
                    authReq.user?.id || '',
                    'update',
                    newData,
                    parseJsonField(old.data)
                );
            } else {
                logAudit('order', docId, authReq.user?.id || '', 'create', newData);
            }

            await prisma.orders_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id,
                    offerStudnieId: offerStudnieId || '',
                    createdAt: createdAt || new Date().toISOString(),
                    status: status || 'new',
                    data: dataStr
                },
                update: {
                    userId: authReq.user?.id,
                    offerStudnieId: offerStudnieId || '',
                    createdAt: createdAt || new Date().toISOString(),
                    status: status || 'new',
                    data: dataStr
                }
            });
        }

        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

router.get('/production', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        let orders: any[];
        if (authReq.user?.role === 'admin') {
            orders = await prisma.production_orders_rel.findMany();
        } else if (authReq.user?.role === 'pro') {
            const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
            orders = await prisma.production_orders_rel.findMany({
                where: { userId: { in: allowedIds } }
            });
        } else {
            orders = await prisma.production_orders_rel.findMany({
                where: { userId: authReq.user?.id }
            });
        }

        const mapped = orders.map((o: any) => {
            const parsedData = parseJsonField(o.data);
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/production/registry', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        // For now, use simple query without complex subqueries (they'll need raw SQL)
        let orders: any[];
        if (authReq.user?.role === 'admin') {
            orders = await prisma.production_orders_rel.findMany({
                orderBy: { createdAt: 'desc' }
            });
        } else if (authReq.user?.role === 'pro') {
            const allowedIds = [authReq.user?.id, ...(authReq.user?.subUsers || [])];
            orders = await prisma.production_orders_rel.findMany({
                where: { userId: { in: allowedIds } },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            orders = await prisma.production_orders_rel.findMany({
                where: { userId: authReq.user?.id },
                orderBy: { createdAt: 'desc' }
            });
        }

        const mapped = orders.map((o: any) => {
            const parsedData = parseJsonField(o.data);
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/production', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const incoming = req.body.data || [];

        for (const o of incoming) {
            let docId = o.id;
            if (!docId) {
                docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
            }

            const {
                id,
                type,
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
                    parseJsonField(old.data)
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/production', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const o = req.body;
        if (!o || !o.wellId) return res.status(400).json({ error: 'Nieprawidłowe dane zlecenia' });

        let docId = o.id;
        if (!docId) {
            docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        }

        const { id, type, userId, orderId, wellId, elementIndex, createdAt, updatedAt, ...rest } =
            o;
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
                parseJsonField(old.data)
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
    } catch (e: any) {
        console.error('[POST /production] Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/production/:id', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const order = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!order || (authReq.user?.role !== 'admin' && order.userId !== authReq.user?.id)) {
            return res.status(404).json({ error: 'Zlecenie nie znalezione' });
        }

        const parsedData = parseJsonField(order.data);

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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/production/:id', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.production_orders_rel.findUnique({
            where: { id: docId }
        });
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField(existing.data);

        if (oldData.status === 'accepted') {
            return res
                .status(403)
                .json({ error: 'Nie można usunąć zatwierdzonego zlecenia. Najpierw je cofnij.' });
        }

        logAudit('production_order', docId, existing.userId, 'delete', null, oldData);

        // Recycle the production order number
        const prodNum = oldData.productionOrderNumber || '';
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
                                userId: existing.userId,
                                year: fullYear,
                                seqNumber
                            }
                        },
                        create: {
                            userId: existing.userId,
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
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/recycled', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const year = new Date().getFullYear();
        const rows = await prisma.recycled_production_numbers.findMany({
            where: { userId: authReq.user?.id, year },
            orderBy: { seqNumber: 'asc' }
        });
        res.json({ recycled: rows.map((r: any) => r.seqNumber) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER NUMBER GENERATION ===== */

router.get('/next-number/:userId', requireAuth as any, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;
        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;

        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/claim-number/:userId', requireAuth as any, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';

        const counter = await prisma.order_counters.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;

        await prisma.order_counters.upsert({
            where: { userId_year: { userId, year } },
            create: { userId, year, lastNumber: nextNumber },
            update: { lastNumber: nextNumber }
        });

        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTION ORDER NUMBER GENERATION ===== */

router.post('/claim-production-number/:userId', requireAuth as any, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();
        const yearShort = String(year).slice(-2);

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { symbol: true, productionOrderStartNumber: true }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const symbol = user.symbol || '??';
        const startNum = user.productionOrderStartNumber || 1;

        // Get year letter
        const letterKey = 'year_letter_' + year;
        const letterRow = await prisma.settings.findUnique({
            where: { key: letterKey }
        });
        const yearLetter = letterRow ? letterRow.value : '?';

        // Check for recycled numbers
        const recycled = await prisma.recycled_production_numbers.findFirst({
            where: { userId, year },
            orderBy: { seqNumber: 'asc' }
        });

        let nextNumber: number;
        if (recycled) {
            nextNumber = recycled.seqNumber;
            await prisma.recycled_production_numbers.delete({
                where: {
                    userId_year_seqNumber: { userId, year, seqNumber: nextNumber }
                }
            });
        } else {
            const counter = await prisma.production_order_counters.findUnique({
                where: { userId_year: { userId, year } }
            });
            const lastNum = counter?.lastNumber || 0;
            nextNumber = Math.max(lastNum + 1, startNum);

            await prisma.production_order_counters.upsert({
                where: { userId_year: { userId, year } },
                create: { userId, year, lastNumber: nextNumber },
                update: { lastNumber: nextNumber }
            });
        }

        const formatted = `${symbol}/${yearLetter}/${String(nextNumber).padStart(5, '0')}/${yearShort}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, yearLetter, year });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER BY ID ===== */

router.get('/:id', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId }
        });
        if (!o || (authReq.user?.role !== 'admin' && o.userId !== authReq.user?.id)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const parsedData = parseJsonField(o.data);

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
    } catch (e: any) {
        res.status(404).json({ error: 'Zamówienie nie znalezione' });
    }
});

router.patch('/:id', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId }
        });
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o && authReq.user?.role === 'pro' && (authReq.user?.subUsers || []).includes(o.userId);
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        const oldData = parseJsonField(o.data);
        const updatedData = { ...oldData, ...req.body };
        delete updatedData.id;
        delete updatedData.type;
        delete updatedData.userId;
        delete updatedData.offerStudnieId;
        delete updatedData.status;
        delete updatedData.createdAt;

        const newStatus = req.body.status || o.status;
        const newUserId = req.body.userId || o.userId;

        await prisma.orders_studnie_rel.update({
            where: { id: docId },
            data: {
                status: newStatus,
                userId: newUserId,
                data: JSON.stringify(updatedData)
            }
        });

        logAudit('order', docId, authReq.user?.id || '', 'update', updatedData, oldData);

        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', requireAuth as any, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId }
        });
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField(existing.data);
        const offerId = oldData.offerId || '';

        if (offerId) {
            const allPOs = await prisma.production_orders_rel.findMany();
            const acceptedPOs = allPOs.filter((po: any) => {
                const poData = parseJsonField(po.data);
                return poData.offerId === offerId && poData.status === 'accepted';
            });

            if (acceptedPOs.length > 0) {
                return res.status(403).json({
                    error: 'Nie można usunąć zamówienia — zawiera zaakceptowane zlecenia produkcyjne. Najpierw cofnij ich akceptację.'
                });
            }
        }

        logAudit('order', docId, authReq.user?.id || '', 'delete', null, oldData);

        if (authReq.user?.role === 'admin') {
            await prisma.orders_studnie_rel.delete({
                where: { id: docId }
            });
        } else {
            await prisma.orders_studnie_rel.deleteMany({
                where: { id: docId, userId: authReq.user?.id }
            });
        }
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
