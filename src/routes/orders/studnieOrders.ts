import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { studnieOrdersBatchSchema, studnieOrderUpdateSchema } from '../../validators/offerSchemas';
import { logger } from '../../utils/logger';
import { generateKartaBudowyPDF } from '../../services/pdfGenerator';
import { generateKartaBudowyDOCX } from '../../services/docx';

const router = express.Router();

// Rate limiter dla operacji na zamówieniach (60 zapytań na minutę)
const writeOrdersLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxHits: 60,
    message: 'Zbyt wiele operacji na zamówieniach. Odczekaj minutę.'
});

/* ===== ZAMÓWIENIA STUDNIE ===== */

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
                offerStudnieId: string | null;
                status: string | null;
                createdAt: string | null;
                data: string | null;
            }>
        >(`SELECT id, "userId", "offerStudnieId", status, data,
            CASE WHEN "createdAt" GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
                THEN datetime(CAST("createdAt" AS INTEGER)/1000, 'unixepoch')
                ELSE "createdAt" END as "createdAt"
         FROM orders_studnie_rel ${whereSql}`);

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
        res.status(500).json({ error: message });
    }
});

router.put('/', requireAuth, writeOrdersLimiter, validateData(studnieOrdersBatchSchema), async (req, res) => {
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
                offerStudnieId,
                createdAt: createdAtRaw,
                status,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

            // Konwersja daty
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
                    parseJsonField<Record<string, unknown>>(old.data, {})
                );
            } else {
                logAudit('order', docId, authReq.user?.id || '', 'create', newData);
            }

            await prisma.orders_studnie_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: authReq.user?.id || '',
                    offerStudnieId: offerStudnieId || '',
                    createdAt: createdAt,
                    status: status || 'new',
                    data: dataStr
                },
                update: {
                    userId: authReq.user?.id || '',
                    offerStudnieId: offerStudnieId || '',
                    createdAt: createdAt,
                    status: status || 'new',
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

/* ===== EKSPORT KARTY BUDOWY ===== */

// GET /api/orders-studnie/:id/export-karta-pdf
router.get('/:id/export-karta-pdf', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateKartaBudowyPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy PDF', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/orders-studnie/:id/export-karta-docx
router.get('/:id/export-karta-docx', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const docxBuffer = await generateKartaBudowyDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy DOCX', message);
        res.status(500).json({ error: message });
    }
});

/* ===== ZAMÓWIENIE PO ID (ZAMÓWIENIE) ===== */

router.get('/:id', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_studnie_rel.findUnique({
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

router.patch('/:id', requireAuth, writeOrdersLimiter, validateData(studnieOrderUpdateSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;

        const o = await prisma.orders_studnie_rel.findUnique({
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
        delete updatedData.offerStudnieId;
        delete updatedData.status;
        delete updatedData.createdAt;

        const newStatus = req.body.status || o.status;
        const newUserId = req.body.userId || o.userId;
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

        const existing = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true, data: true }
        });
        if (!existing) return res.json({ ok: true });

        const oldData = parseJsonField<Record<string, unknown>>(existing.data, {});
        const offerId = oldData.offerId || '';

        if (offerId) {
            const allPOs = await prisma.$queryRawUnsafe<
                Array<{ data: string | null }>
            >('SELECT data FROM production_orders_rel');
            const acceptedPOs = allPOs.filter((po) => {
                const poData = parseJsonField<Record<string, unknown>>(po.data, {});
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
            await prisma.$executeRaw`DELETE FROM orders_studnie_rel WHERE id = ${docId}`;
        } else {
            await prisma.orders_studnie_rel.deleteMany({
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
