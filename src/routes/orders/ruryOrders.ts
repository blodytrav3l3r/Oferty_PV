import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { ruryOrdersBatchSchema, ruryOrderUpdateSchema } from '../../validators/offerSchemas';
import { logger } from '../../utils/logger';

const router = express.Router();

const writeOrdersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na zamówieniach. Odczekaj minutę.'
});

function buildRoleWhereSql(user: { role: string; id: string; subUsers?: string[] }): string {
    if (user.role === 'admin') return '';
    const isValidId = (id: string): boolean => typeof id === 'string' && id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id);
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])]
            .filter(isValidId)
            .map(id => `'${id.replace(/'/g, "''")}'`)
            .join(',');
        return `WHERE "userId" IN (${allowedIds})`;
    }
    const safeId = isValidId(user.id) ? user.id.replace(/'/g, "''") : '__invalid__';
    return `WHERE "userId" = '${safeId}'`;
}

router.get('/', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const whereSql = authReq.user ? buildRoleWhereSql(authReq.user) : '';
        const orders = await prisma.$queryRawUnsafe<
            Array<{
                id: string;
                userId: string | null;
                offerId: string | null;
                status: string | null;
                createdAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "offerId", status, data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_rury_rel ${whereSql}`);

        const mapped = orders.map((o) => {
            const parsedData = parseJsonField<Record<string, unknown>>(o.data, {});
            return {
                id: o.id,
                type: 'order',
                userId: o.userId,
                offerId: o.offerId,
                status: o.status,
                createdAt: o.createdAt,
                ...parsedData
            };
        });

        res.json({ data: mapped });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, writeOrdersLimiter, validateData(ruryOrdersBatchSchema), async (req, res) => {
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
                userId: _userId,
                offerId,
                createdAt: createdAtRaw,
                status,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

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

            const old = await prisma.orders_rury_rel.findUnique({
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
                    parseJsonField<Record<string, unknown>>(old.data, {})
                );
            } else {
                logAudit('order', docId, authReq.user?.id || '', 'create', newData);
            }

            await prisma.orders_rury_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id || '',
                    offerId: offerId || '',
                    createdAt: createdAt,
                    status: status || 'new',
                    data: dataStr
                },
                update: {
                    userId: authReq.user?.id || '',
                    offerId: offerId || '',
                    createdAt: createdAt,
                    status: status || 'new',
                    data: dataStr
                }
            });
        }

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd PUT orders-rury', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/orders-rury/:id/export-karta-pdf
router.get('/:id/export-karta-pdf', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { generateKartaBudowyRuryPDF } = await import('../../services/pdfGenerator');
        const pdfBuffer = await generateKartaBudowyRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy Rury PDF', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/orders-rury/:id/export-karta-docx
router.get('/:id/export-karta-docx', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { generateKartaBudowyRuryDOCX } = await import('../../services/docx');
        const docxBuffer = await generateKartaBudowyRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy Rury DOCX', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId }
        });
        if (!o || (authReq.user?.role !== 'admin' && o.userId !== authReq.user?.id)) {
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
                ...parsedData
            }
        });
    } catch (_e: unknown) {
        res.status(404).json({ error: 'Zamówienie nie znalezione' });
    }
});

router.patch('/:id', requireAuth, writeOrdersLimiter, validateData(ruryOrderUpdateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, status: true, data: true }
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

        const newStatus = req.body.status || o.status;
        const newUserId = req.body.userId || o.userId;
        const dataStr = JSON.stringify(updatedData);

        await prisma.orders_rury_rel.update({
            where: { id: docId },
            data: {
                status: newStatus,
                userId: newUserId,
                data: dataStr
            }
        });

        logAudit('order', docId, authReq.user?.id || '', 'update', updatedData, oldData);

        res.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

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

        if (authReq.user?.role === 'admin') {
            await prisma.$executeRaw`DELETE FROM orders_rury_rel WHERE id = ${docId}`;
        } else {
            await prisma.orders_rury_rel.deleteMany({
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
