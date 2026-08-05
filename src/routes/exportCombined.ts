import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateCombinedOfferPDF, generateCombinedOfferDOCX } from '../services/combinedExport';
import { logger } from '../utils/logger';
import { canReadDoc } from '../utils/ownership';
import { EXPORT_LIMITER } from '../middleware/rateLimiters';

const router = express.Router();

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ===== WYDRUK ŁĄCZNY OFERTY (RURY + STUDNIE) ===== */

/**
 * Weryfikuje istnienie obu ofert i uprawnienia do ich odczytu.
 * Zwraca true tylko gdy obie oferty istnieją i użytkownik ma do nich dostęp.
 */
async function canExportBothOffers(
    authReq: AuthenticatedRequest,
    offerRuryId: string,
    offerStudnieId: string
): Promise<boolean> {
    const [ruryOffer, studnieOffer] = await Promise.all([
        prisma.offers_rel.findUnique({
            where: { id: offerRuryId },
            select: { userId: true }
        }),
        prisma.offers_studnie_rel.findUnique({
            where: { id: offerStudnieId },
            select: { userId: true }
        })
    ]);

    if (!ruryOffer || !studnieOffer) return false;
    return (
        canReadDoc(authReq.user, ruryOffer.userId) && canReadDoc(authReq.user, studnieOffer.userId)
    );
}

/**
 * Waliduje body żądania. Zwraca oba identyfikatory lub null (gdy któregoś brakuje).
 */
function parseBody(body: unknown): { offerRuryId: string; offerStudnieId: string } | null {
    const b = (body || {}) as Record<string, unknown>;
    const offerRuryId = typeof b.offerRuryId === 'string' ? b.offerRuryId.trim() : '';
    const offerStudnieId = typeof b.offerStudnieId === 'string' ? b.offerStudnieId.trim() : '';
    if (!offerRuryId || !offerStudnieId) return null;
    return { offerRuryId, offerStudnieId };
}

function makeSafeId(id: string): string {
    return String(id)
        .replace(/[^a-z0-9_-]/gi, '_')
        .slice(0, 8);
}

// POST /api/export-combined/pdf
router.post('/pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const ids = parseBody(req.body);
        if (!ids) {
            return res.status(400).json({
                error: 'Wymagane są identyfikatory obu ofert (offerRuryId, offerStudnieId)'
            });
        }

        if (!(await canExportBothOffers(authReq, ids.offerRuryId, ids.offerStudnieId))) {
            return res.status(404).json({ error: 'Not found' });
        }

        const pdfBuffer = await generateCombinedOfferPDF(ids.offerRuryId, ids.offerStudnieId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_laczna_${makeSafeId(ids.offerRuryId)}_${makeSafeId(ids.offerStudnieId)}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('ExportCombined', 'Błąd eksportu PDF łącznego', message);
        res.status(500).json({ error: message });
    }
});

// POST /api/export-combined/docx
router.post('/docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const ids = parseBody(req.body);
        if (!ids) {
            return res.status(400).json({
                error: 'Wymagane są identyfikatory obu ofert (offerRuryId, offerStudnieId)'
            });
        }

        if (!(await canExportBothOffers(authReq, ids.offerRuryId, ids.offerStudnieId))) {
            return res.status(404).json({ error: 'Not found' });
        }

        const docxBuffer = await generateCombinedOfferDOCX(ids.offerRuryId, ids.offerStudnieId);
        res.setHeader('Content-Type', DOCX_CONTENT_TYPE);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="oferta_laczna_${makeSafeId(ids.offerRuryId)}_${makeSafeId(ids.offerStudnieId)}.docx"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('ExportCombined', 'Błąd eksportu DOCX łącznego', message);
        res.status(500).json({ error: message });
    }
});

export default router;
