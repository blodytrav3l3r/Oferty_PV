import express from 'express';
import prisma from '../../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../../middleware/auth';
import { EXPORT_LIMITER } from '../../../middleware/rateLimiters';
import { ruryOfferExportSchema } from '../../../validators/rurySchemas';
import { logger } from '../../../utils/logger';
import { canReadDoc, canWriteDoc } from '../../../utils/ownership';
import { generateKartaBudowyRuryPDF } from '../../../services/pdf/pdfStudnieBuilder';
import {
    generateRuryPDFFromContext,
    generateRuryOrderPDF,
    lookupOfferUsers
} from '../../../services/pdfGenerator';
import type { RuryOfferData, UserContactInfo } from '../../../services/pdfGenerator';
import {
    generateRuryDOCXFromContext,
    generateRuryOrderDOCX,
    generateKartaBudowyRuryDOCX
} from '../../../services/docx';

const router = express.Router();
const exportOrdersLimiter = EXPORT_LIMITER;

router.get('/:id/export-karta-pdf', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const order = await prisma.orders_rury_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!order || !canReadDoc(authReq.user, order.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const pdfBuffer = await generateKartaBudowyRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${safeId}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy Rury PDF', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id/export-karta-docx', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const order = await prisma.orders_rury_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!order || !canReadDoc(authReq.user, order.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const docxBuffer = await generateKartaBudowyRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="karta_budowy_${safeId}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu Karty Budowy Rury DOCX', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id/export-pdf', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;
        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        if (!o || !canWriteDoc(authReq.user, o.userId)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }
        const pdfBuffer = await generateRuryOrderPDF(docId);
        const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="zamowienie_rury_${safeId}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd GET orders-rury export-pdf', message);
        res.status(500).json({ error: message });
    }
});

router.get('/:id/export-docx', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const docId = req.params.id;
        const o = await prisma.orders_rury_rel.findUnique({
            where: { id: docId },
            select: { id: true, userId: true }
        });
        if (!o || !canWriteDoc(authReq.user, o.userId)) {
            return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        }
        const docxBuffer = await generateRuryOrderDOCX(docId);
        const safeId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="zamowienie_rury_${safeId}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd GET orders-rury export-docx', message);
        res.status(500).json({ error: message });
    }
});

router.post('/:id/export-offer-pdf', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = ruryOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
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
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_rury_zamowienie_${safeOrder}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Orders', 'Błąd POST orders-rury export-offer-pdf', message);
        res.status(500).json({ error: message });
    }
});

router.post('/:id/export-offer-docx', requireAuth, exportOrdersLimiter, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const parseResult = ruryOfferExportSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Nieprawidłowe dane eksportu oferty',
                details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
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

export default router;
