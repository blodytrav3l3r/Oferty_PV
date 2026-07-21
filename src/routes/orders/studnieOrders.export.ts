import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { EXPORT_LIMITER } from '../../middleware/rateLimiters';
import { studnieOfferExportSchema } from '../../validators/offerSchemas';
import { logger } from '../../utils/logger';
import { canReadDoc, canWriteDoc } from '../../utils/ownership';
import {
    generateKartaBudowyPDF,
    generateStudniePDFFromContext,
    generateStudnieOrderPDF,
    lookupOfferUsers
} from '../../services/pdfGenerator';
import type { StudnieOfferData, UserContactInfo } from '../../services/pdfGenerator';
import {
    generateKartaBudowyDOCX,
    generateStudnieDOCXFromContext,
    generateStudnieOrderDOCX
} from '../../services/docx';
import router from './studnieOrders.crud';

const exportOrdersLimiter = EXPORT_LIMITER;

/* ===== EKSPORT KARTY BUDOWY ===== */

// GET /api/orders-studnie/:id/export-karta-pdf
router.get('/:id/export-karta-pdf', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const order = await prisma.orders_studnie_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!order || !canReadDoc(authReq.user, order.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const pdfBuffer = await generateKartaBudowyPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${safeId}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy PDF', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/orders-studnie/:id/export-karta-docx
router.get('/:id/export-karta-docx', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const order = await prisma.orders_studnie_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!order || !canReadDoc(authReq.user, order.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const docxBuffer = await generateKartaBudowyDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${safeId}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy DOCX', message);
        res.status(500).json({ error: message });
    }
});

/* ===== EKSPORT ZAMÓWIENIA (PDF/DOCX) — wariant Oferty ===== */

// GET /api/orders-studnie/:id/export-pdf
// Generuje PDF Zamówienia (wariant Oferty) z bieżącego stanu zamówienia w DB.
router.get('/:id/export-pdf', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;
        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        if (!o || !canWriteDoc(authReq.user, o.userId)) {
            return res.status(404).json({ error: 'Zamówienie studni nie znalezione' });
        }
        const pdfBuffer = await generateStudnieOrderPDF(docId);
        const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="zamowienie_studnie_${safeId}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd GET orders-studnie export-pdf', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/orders-studnie/:id/export-docx
router.get('/:id/export-docx', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;
        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        if (!o || !canWriteDoc(authReq.user, o.userId)) {
            return res.status(404).json({ error: 'Zamówienie studni nie znalezione' });
        }
        const docxBuffer = await generateStudnieOrderDOCX(docId);
        const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="zamowienie_studnie_${safeId}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd GET orders-studnie export-docx', message);
        res.status(500).json({ error: message });
    }
});

/* ===== EKSPORT ZAMÓWIENIA JAKO OFERTY (PDF/DOCX) ===== */

// POST /api/orders-studnie/:id/export-offer-pdf
// Generuje PDF oferty w formacie standardowym na podstawie bieżącego stanu edycji zamówienia.
// Body: { items, clientName, clientNip, clientAddress, clientContact, investName,
//         investAddress, notes, paymentTerms, validity, validityDays, date,
//         transportKm, transportRate, orderNumber, offerNumber }
router.post('/:id/export-offer-pdf', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = studnieOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
            });
        }
        const body = parseResult.data as Record<string, unknown>;
        const items = body.items as Array<Record<string, unknown>>;

        const docId = req.params.id;
        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o &&
            authReq.user?.role === 'pro' &&
            (authReq.user?.subUsers || []).includes(o.userId || '');
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie studni nie znalezione' });
        }

        let authorUser: UserContactInfo | null = null;
        let guardianUser: UserContactInfo | null = null;
        try {
            const lu = await lookupOfferUsers(body, o.userId || '');
            authorUser = lu.authorUser;
            guardianUser = lu.guardianUser;
        } catch (e) {
            logger.warn('Orders', 'Błąd lookupOfferUsers w studnie export-offer-pdf', e);
        }

        const totalTransportCost = Number(body.transportKm ?? 0) * Number(body.transportRate ?? 0);

        const ctx: StudnieOfferData = {
            offerNumber: String(body.orderNumber || body.offerNumber || docId.substring(0, 8)),
            clientName: String(body.clientName ?? 'Klient niezidentyfikowany'),
            clientNip: String(body.clientNip ?? ''),
            clientAddress: String(body.clientAddress ?? ''),
            clientPhone: String(body.clientContact ?? ''),
            investName: String(body.investName ?? ''),
            investAddress: String(body.investAddress ?? ''),
            items,
            transportCost: totalTransportCost,
            createdAt: String(body.date ?? new Date().toISOString()),
            validityDays: Number(body.validityDays ?? 30),
            notes: String(body.notes ?? ''),
            paymentTerms: String(body.paymentTerms ?? ''),
            validity: String(body.validity ?? ''),
            authorUser,
            guardianUser
        };

        const pdfBuffer = await generateStudniePDFFromContext(ctx);
        const safeOrder = String(ctx.offerNumber || docId).replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_studnie_zamowienie_${safeOrder}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd POST orders-studnie export-offer-pdf', message);
        res.status(500).json({ error: message });
    }
});

// POST /api/orders-studnie/:id/export-offer-docx
// Generuje DOCX oferty w formacie standardowym na podstawie bieżącego stanu edycji zamówienia.
// Body: jak export-offer-pdf
router.post('/:id/export-offer-docx', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = studnieOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
            });
        }
        const body = parseResult.data as Record<string, unknown>;
        const items = body.items as Array<Record<string, unknown>>;

        const docId = req.params.id;
        const o = await prisma.orders_studnie_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        const isOwner = o && o.userId === authReq.user?.id;
        const isProParent =
            o &&
            authReq.user?.role === 'pro' &&
            (authReq.user?.subUsers || []).includes(o.userId || '');
        if (!o || (authReq.user?.role !== 'admin' && !isOwner && !isProParent)) {
            return res.status(404).json({ error: 'Zamówienie studni nie znalezione' });
        }

        let authorUser: UserContactInfo | null = null;
        let guardianUser: UserContactInfo | null = null;
        try {
            const lu = await lookupOfferUsers(body, o.userId || '');
            authorUser = lu.authorUser;
            guardianUser = lu.guardianUser;
        } catch (e) {
            logger.warn('Orders', 'Błąd lookupOfferUsers w studnie export-offer-docx', e);
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
            notes: body.notes ?? '',
            paymentTerms: body.paymentTerms ?? ''
        };

        const ctx = {
            offerNumber: String(body.orderNumber || body.offerNumber || docId.substring(0, 8)),
            offerData,
            wells: items,
            authorUser,
            guardianUser
        };

        const docxBuffer = await generateStudnieDOCXFromContext(ctx);
        const safeOrder = String(ctx.offerNumber || docId).replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_studnie_zamowienie_${safeOrder}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd POST orders-studnie export-offer-docx', message);
        res.status(500).json({ error: message });
    }
});

export default router;
