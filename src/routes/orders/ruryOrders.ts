import express from 'express';
import prisma from '../../prismaClient';
import { logAudit } from '../../db';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { parseJsonField, normalizeDate } from '../../helpers';
import { validateData } from '../../validators/authSchema';
import { WRITE_LIMITER, EXPORT_LIMITER } from '../../middleware/rateLimiters';
import { ruryOrdersBatchSchema, ruryOrderUpdateSchema, ruryOfferExportSchema } from '../../validators/offerSchemas';
import { logger } from '../../utils/logger';
import { canWriteDoc } from '../../utils/ownership';
import { buildRoleWhereSql } from '../../utils/roleFilter';
import { generateRuryPDFFromContext, lookupOfferUsers } from '../../services/pdfGenerator';
import type { RuryOfferData, UserContactInfo } from '../../services/pdfGenerator';
import { generateRuryDOCXFromContext } from '../../services/docx';

const router = express.Router();

const writeOrdersLimiter = WRITE_LIMITER;
const exportOrdersLimiter = EXPORT_LIMITER;

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
        const counter = await prisma.order_counters_rury.findUnique({
            where: { userId_year: { userId, year } }
        });
        const nextNumber = (counter?.lastNumber || 0) + 1;

        await prisma.order_counters_rury.upsert({
            where: { userId_year: { userId, year } },
            create: { userId, year, lastNumber: nextNumber },
            update: { lastNumber: nextNumber }
        });

        const formatted = `${symbol}/ZR/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
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
                userId: incomingUserId,
                offerId,
                createdAt: createdAtRaw,
                status,
                ...rest
            } = o;
            const dataStr = JSON.stringify(rest);

            const createdAt = normalizeDate(createdAtRaw);

            const old = await prisma.orders_rury_rel.findUnique({
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

            await prisma.orders_rury_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: targetUserId,
                    offerId: offerId || '',
                    createdAt: createdAt,
                    status: status || 'new',
                    data: dataStr
                },
                update: {
                    userId: targetUserId,
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

// POST /api/orders-rury/:id/export-offer-pdf
// Generuje PDF oferty w formacie standardowym na podstawie bieżącego stanu edycji zamówienia.
// Body: { items, clientName, clientNip, clientAddress, clientContact, investName,
//         investAddress, investContractor, notes, paymentTerms, validity, validityDays,
//         date, transportKm, transportRate, orderNumber, offerNumber }
router.post('/:id/export-offer-pdf', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = ruryOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
            });
        }
        const body = parseResult.data as Record<string, unknown>;
        const items = body.items as Array<Record<string, unknown>>;

        const docId = req.params.id;
        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o &&
            authReq.user?.role === 'pro' &&
            (authReq.user?.subUsers || []).includes(o.userId || '');
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        let authorUser: UserContactInfo | null = null;
        let guardianUser: UserContactInfo | null = null;
        try {
            const lu = await lookupOfferUsers(body, o.userId || '');
            authorUser = lu.authorUser;
            guardianUser = lu.guardianUser;
        } catch (e) {
            logger.warn('Orders', 'Błąd lookupOfferUsers w export-offer-pdf', e);
        }

        const ctx: RuryOfferData = {
            offerNumber: String(body.orderNumber || body.offerNumber || docId.substring(0, 8)),
            clientName: String(body.clientName ?? 'Klient niezidentyfikowany'),
            clientNip: String(body.clientNip ?? ''),
            clientAddress: String(body.clientAddress ?? ''),
            clientPhone: String(body.clientContact ?? ''),
            investName: String(body.investName ?? ''),
            investAddress: String(body.investAddress ?? ''),
            investContractor: String(body.investContractor ?? ''),
            items,
            createdAt: String(body.date ?? new Date().toISOString()),
            validityDays: Number(body.validityDays ?? 30),
            notes: String(body.notes ?? ''),
            paymentTerms: String(body.paymentTerms ?? ''),
            validity: String(body.validity ?? ''),
            authorUser,
            guardianUser
        };

        const pdfBuffer = await generateRuryPDFFromContext(ctx);
        const safeOrder = String(ctx.offerNumber || docId).replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_zamowienie_${safeOrder}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd POST orders-rury export-offer-pdf', message);
        res.status(500).json({ error: message });
    }
});

// POST /api/orders-rury/:id/export-offer-docx
// Generuje DOCX oferty w formacie standardowym na podstawie bieżącego stanu edycji zamówienia.
// Body: jak export-offer-pdf
router.post('/:id/export-offer-docx', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = ruryOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
            });
        }
        const body = parseResult.data as Record<string, unknown>;
        const items = body.items as Array<Record<string, unknown>>;

        const docId = req.params.id;
        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o &&
            authReq.user?.role === 'pro' &&
            (authReq.user?.subUsers || []).includes(o.userId || '');
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }

        let authorUser: UserContactInfo | null = null;
        let guardianUser: UserContactInfo | null = null;
        try {
            const lu = await lookupOfferUsers(body, o.userId || '');
            authorUser = lu.authorUser;
            guardianUser = lu.guardianUser;
        } catch (e) {
            logger.warn('Orders', 'Błąd lookupOfferUsers w export-offer-docx', e);
        }

        const offerData: Record<string, unknown> = {
            date: body.date ?? new Date().toISOString(),
            validity: body.validity ?? '',
            clientName: body.clientName ?? 'Klient niezidentyfikowany',
            clientNip: body.clientNip ?? '',
            clientAddress: body.clientAddress ?? '',
            clientContact: body.clientContact ?? '',
            investName: body.investName ?? '',
            investAddress: body.investAddress ?? '',
            investContractor: body.investContractor ?? '',
            notes: body.notes ?? '',
            paymentTerms: body.paymentTerms ?? ''
        };

        const ctx = {
            offerNumber: String(body.orderNumber || body.offerNumber || docId.substring(0, 8)),
            offerData,
            items,
            authorUser,
            guardianUser
        };

        const docxBuffer = await generateRuryDOCXFromContext(ctx);
        const safeOrder = String(ctx.offerNumber || docId).replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_rury_zamowienie_${safeOrder}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd POST orders-rury export-offer-docx', message);
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
