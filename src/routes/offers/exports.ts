import express from 'express';
import prisma from '../../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { generateOfferRuryPDF, generateOfferStudniePDF } from '../../services/pdfGenerator';
import { generateOfferRuryDOCX, generateOfferStudnieDOCX } from '../../services/docx';
import { logger } from '../../utils/logger';
import { canReadDoc } from '../../utils/ownership';
import { EXPORT_LIMITER } from '../../middleware/rateLimiters';

const router = express.Router();

/* ===== PUNKTY KOŃCOWE EKSPORTU (EXPORT) ===== */

/**
 * @openapi
 * /api/offers-rury/{id}/export-pdf:
 *   get:
 *     tags: [Offers]
 *     summary: Eksport oferty rur do PDF
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plik PDF
 */
// GET /api/offers-rury/:id/export-pdf
router.get('/:id/export-pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const pdfBuffer = await generateOfferRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${safeId}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: message });
    }
});

/**
 * @openapi
 * /api/offers-rury/studnie/{id}/export-pdf:
 *   get:
 *     tags: [Offers]
 *     summary: Eksport oferty studni do PDF
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Plik PDF
 */
// GET /api/offers-studnie/:id/export-pdf
router.get('/studnie/:id/export-pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const pdfBuffer = await generateOfferStudniePDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_studnie_${safeId}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: message });
    }
});

/**
 * @openapi
 * /api/offers-rury/{id}/export-docx:
 *   get:
 *     tags: [Offers]
 *     summary: Eksport oferty rur do DOCX
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Plik DOCX
 */
// GET /api/offers-rury/:id/export-docx
router.get('/:id/export-docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const docxBuffer = await generateOfferRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${safeId}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: message });
    }
});

/**
 * @openapi
 * /api/offers-rury/studnie/{id}/export-docx:
 *   get:
 *     tags: [Offers]
 *     summary: Eksport oferty studni do DOCX
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Plik DOCX
 */
// GET /api/offers-studnie/:id/export-docx
router.get('/studnie/:id/export-docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const { id } = req.params;
        const offer = await prisma.offers_studnie_rel.findUnique({
            where: { id },
            select: { userId: true }
        });
        if (!offer || !canReadDoc(authReq.user, offer.userId)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const safeId = String(id)
            .replace(/[^a-z0-9_-]/gi, '_')
            .slice(0, 100);
        const docxBuffer = await generateOfferStudnieDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_studnie_${safeId}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: message });
    }
});

export default router;
