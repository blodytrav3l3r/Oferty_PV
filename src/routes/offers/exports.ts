import express from 'express';
import { requireAuth } from '../../middleware/auth';
import { generateOfferRuryPDF, generateOfferStudniePDF } from '../../services/pdfGenerator';
import { generateOfferRuryDOCX, generateOfferStudnieDOCX } from '../../services/docx';
import { logger } from '../../utils/logger';

const router = express.Router();

/* ===== PUNKTY KOŃCOWE EKSPORTU (EXPORT) ===== */

// GET /api/offers-rury/:id/export-pdf
router.get('/:id/export-pdf', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateOfferRuryPDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/offers-studnie/:id/export-pdf
router.get('/studnie/:id/export-pdf', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const pdfBuffer = await generateOfferStudniePDF(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="oferta_studnie_${id}.pdf"`);
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu PDF', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/offers-rury/:id/export-docx
router.get('/:id/export-docx', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const docxBuffer = await generateOfferRuryDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="oferta_rury_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: message });
    }
});

// GET /api/offers-studnie/:id/export-docx
router.get('/studnie/:id/export-docx', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const docxBuffer = await generateOfferStudnieDOCX(id);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="oferta_studnie_${id}.docx"`);
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Export', 'Błąd eksportu DOCX', message);
        res.status(500).json({ error: message });
    }
});

export default router;
