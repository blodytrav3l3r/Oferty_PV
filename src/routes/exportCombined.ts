import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateCombinedOfferPDF, generateCombinedOfferDOCX } from '../services/combinedExport';
import { mapPdfError } from '../services/pdf/pdfEngine';
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

// E3b: twarda walidacja identyfikatorów (UUID + maxLength), wzorzec telemetryAiMl.ts.
// ID ofert powstają przez crypto.randomUUID (ruryCrud/studnieCrud), więc poprawne
// dane zawsze są UUID; reszta (IDOR-probe, wklejone śmieci) dostaje 400 z detalami.
const combinedExportSchema = z.object({
    offerRuryId: z.string().trim().min(1).max(64).uuid(),
    offerStudnieId: z.string().trim().min(1).max(64).uuid()
});

type CombinedIds = z.infer<typeof combinedExportSchema>;

/**
 * Waliduje body żądania. Zwraca oba identyfikatory lub issues (brak/zły format).
 */
function parseBody(body: unknown): { ids: CombinedIds } | { issues: unknown } {
    const parsed = combinedExportSchema.safeParse(body);
    if (!parsed.success) return { issues: parsed.error.issues };
    return { ids: parsed.data };
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
        const result = parseBody(req.body);
        if ('issues' in result) {
            return res.status(400).json({
                error: 'Wymagane są identyfikatory obu ofert (offerRuryId, offerStudnieId)',
                details: result.issues
            });
        }
        const ids = result.ids;

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
        if (mapPdfError(res, e, 'combined')) return;
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('ExportCombined', 'Błąd eksportu PDF łącznego', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// POST /api/export-combined/docx
router.post('/docx', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const result = parseBody(req.body);
        if ('issues' in result) {
            return res.status(400).json({
                error: 'Wymagane są identyfikatory obu ofert (offerRuryId, offerStudnieId)',
                details: result.issues
            });
        }
        const ids = result.ids;

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
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
