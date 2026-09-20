import express from 'express';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { generateOfferRuryPDF, generateOfferStudniePDF } from '../../services/pdfGenerator';
import { mapPdfError } from '../../services/pdf/pdfEngine';
import { generateOfferRuryDOCX, generateOfferStudnieDOCX } from '../../services/docx';
import { logger } from '../../utils/logger';
import { canReadDoc } from '../../utils/ownership';
import { EXPORT_LIMITER } from '../../middleware/rateLimiters';
import { exportFilename } from '../../utils/exportFilenames';

const router = express.Router();

/* ===== PUNKTY KOŃCOWE EKSPORTU (EXPORT) ===== */

// GET /api/offers-rury/:id/export-pdf
router.get('/:id/export-pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_rel.findUnique({
            where: { id },
            select: { userId: true, offer_number: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const pdfBuffer = await generateOfferRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename('oferta_rury', [[offer.offer_number, id]], 'pdf')}"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        if (mapPdfError(res, e, 'offers-rury')) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// GET /api/offers-studnie/:id/export-pdf
router.get('/studnie/:id/export-pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { userId: true, offer_number: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const pdfBuffer = await generateOfferStudniePDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename('oferta_studnie', [[offer.offer_number, id]], 'pdf')}"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        if (mapPdfError(res, e, 'offers-studnie')) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// GET /api/offers-rury/:id/export-docx
router.get('/:id/export-docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_rel.findUnique({
            where: { id },
            select: { userId: true, offer_number: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const docxBuffer = await generateOfferRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename('oferta_rury', [[offer.offer_number, id]], 'docx')}"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// GET /api/offers-studnie/:id/export-docx
router.get('/studnie/:id/export-docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { userId: true, offer_number: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const docxBuffer = await generateOfferStudnieDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename('oferta_studnie', [[offer.offer_number, id]], 'docx')}"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
