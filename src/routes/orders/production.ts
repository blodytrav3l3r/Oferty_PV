import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { logger } from '../../utils/logger';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { productionOrdersBatchSchema, productionOrderCreateSchema } from '../../validators/offerSchemas';

const router = express.Router();

// Rate limiter dla operacji na zleceniach produkcyjnych (60 zapytań na minutę)
const writeProductionLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na zleceniach produkcyjnych. Odczekaj minutę.'
});

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

// Buduje SQL WHERE clause na podstawie roli użytkownika
// Wszystkie wartości pochodzą z sesji auth (zaufane), ale dla bezpieczeństwa walidujemy
function buildRoleWhereSql(user: { role: string; id: string; subUsers?: string[] }): string {
    if (user.role === 'admin') return '';
    const isValidId = (id: string): boolean => typeof id === 'string' && id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id);
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])]
            .filter(isValidId)
            .map(id => `'${id.replace(/'/g, "''")}'`)
            .join(',');
        return `WHERE production_orders_rel."userId" IN (${allowedIds})`;
    }
    const safeId = isValidId(user.id) ? user.id.replace(/'/g, "''") : '__invalid__';
    return `WHERE production_orders_rel."userId" = '${safeId}'`;
}

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereSql = authReq.user ? buildRoleWhereSql(authReq.user) : '';
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
                handlerFirstName: string | null;
                handlerLastName: string | null;
                handlerUsername: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                creatorUsername: string | null;
            }>
        >(`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         ${whereSql}`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            
            const handlerName = o.handlerFirstName || o.handlerLastName 
                ? `${o.handlerFirstName || ''} ${o.handlerLastName || ''}`.trim() 
                : o.handlerUsername || '';
                
            const creatorName = o.creatorFirstName || o.creatorLastName 
                ? `${o.creatorFirstName || ''} ${o.creatorLastName || ''}`.trim() 
                : o.creatorUsername || '';

            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                handlerName: handlerName || undefined,
                creatorName: creatorName || undefined,
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
        const whereSql = authReq.user ? buildRoleWhereSql(authReq.user) : '';
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                orderId: string | null;
                wellId: string | null;
                elementIndex: number | null;
                createdAt: string | null;
                updatedAt: string | null;
                data: string | null;
                handlerFirstName: string | null;
                handlerLastName: string | null;
                handlerUsername: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
                creatorUsername: string | null;
            }>
        >(`SELECT production_orders_rel.id, production_orders_rel."userId", production_orders_rel."orderId", production_orders_rel."wellId", production_orders_rel."elementIndex", production_orders_rel.data,
            CASE WHEN production_orders_rel."createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."createdAt" END as "createdAt",
            CASE WHEN production_orders_rel."updatedAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST(production_orders_rel."updatedAt" AS INTEGER)/1000, 'unixepoch')
                ELSE production_orders_rel."updatedAt" END as "updatedAt",
            u1."firstName" as handlerFirstName, u1."lastName" as handlerLastName, u1.username as handlerUsername,
            u2."firstName" as creatorFirstName, u2."lastName" as creatorLastName, u2.username as creatorUsername
         FROM production_orders_rel 
         LEFT JOIN users u1 ON production_orders_rel."userId" = u1.id
         LEFT JOIN users u2 ON production_orders_rel."creatorId" = u2.id
         ${whereSql} ORDER BY production_orders_rel."createdAt" DESC`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            
            const handlerName = o.handlerFirstName || o.handlerLastName 
                ? `${o.handlerFirstName || ''} ${o.handlerLastName || ''}`.trim() 
                : o.handlerUsername || '';
                
            const creatorName = o.creatorFirstName || o.creatorLastName 
                ? `${o.creatorFirstName || ''} ${o.creatorLastName || ''}`.trim() 
                : o.creatorUsername || '';

            return {
                id: o.id,
                type: 'production_order',
                userId: o.userId,
                orderId: o.orderId,
                wellId: o.wellId,
                elementIndex: o.elementIndex,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
                handlerName: handlerName || undefined,
                creatorName: creatorName || undefined,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, writeProductionLimiter, validateData(productionOrdersBatchSchema), async (req, res) => {
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

router.post('/', requireAuth, writeProductionLimiter, validateData(productionOrderCreateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const o = req.body;

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
            createdAt: createdAtRaw,
            updatedAt: updatedAtRaw,
            ...rest
        } = o;
        const dataStr = JSON.stringify(rest);

        // Konwersja dat z timestamp na ISO string
        const convertDate = (raw: unknown): string => {
            if (typeof raw === 'number') return new Date(raw).toISOString();
            if (raw instanceof Date) return raw.toISOString();
            if (typeof raw === 'string') {
                if (/^\d+$/.test(raw)) return new Date(Number(raw)).toISOString();
                return raw;
            }
            return new Date().toISOString();
        };
        const createdAt = convertDate(createdAtRaw);
        const updatedAt = convertDate(updatedAtRaw);

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
                userId: userId || authReq.user?.id || '',
                creatorId: authReq.user?.id || '',
                orderId: orderId || '',
                wellId: wellId || '',
                elementIndex: elementIndex || 0,
                createdAt: createdAt,
                updatedAt: updatedAt,
                data: dataStr
            },
            update: {
                userId: userId || authReq.user?.id || '',
                creatorId: authReq.user?.id || '',
                orderId: orderId || '',
                wellId: wellId || '',
                elementIndex: elementIndex || 0,
                updatedAt: updatedAt,
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

router.delete('/:id', requireAuth, writeProductionLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const existing = await prisma.production_orders_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, data: true }
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
        const prodNum = typeof oldData.productionOrderNumber === 'string' ? oldData.productionOrderNumber : '';
        if (prodNum) {
            const parts = prodNum.split('/');
            if (parts.length >= 4) {
                const seqNumber = parseInt(parts[2], 10);
                const yearShort = parseInt(parts[3], 10);
                const fullYear = 2000 + yearShort;
                if (seqNumber > 0) {
                    await prisma.$executeRaw`
                        INSERT INTO recycled_production_numbers ("userId", year, seqNumber)
                        VALUES (${existing.userId || ''}, ${fullYear}, ${seqNumber})
                        ON CONFLICT ("userId", year, seqNumber) DO NOTHING
                    `;
                }
            }
        }

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRaw`DELETE FROM production_orders_rel WHERE id = ${docId}`;
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
