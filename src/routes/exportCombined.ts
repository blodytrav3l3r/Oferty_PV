import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateCombinedOfferPDF, generateCombinedOfferDOCX } from '../services/combinedExport';
import { mapPdfError } from '../services/pdf/pdfEngine';
import { logger } from '../utils/logger';
import { canReadDoc } from '../utils/ownership';
import { EXPORT_LIMITER } from '../middleware/rateLimiters';
import { exportFilename } from '../utils/exportFilenames';

const router = express.Router();

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ===== WYDRUK ŁĄCZNY OFERTY (RURY + STUDNIE) ===== */

/**
 * Weryfikuje istnienie obu ofert i uprawnienia do ich odczytu.
 * Zwraca rekordy (z numerami do nazw plików) lub null.
 */
async function canExportBothOffers(
    authReq: AuthenticatedRequest,
    offerRuryId: string,
    offerStudnieId: string
): Promise<{ ruryOfferNumber: string | null; studnieOfferNumber: string | null } | null> {
    const [ruryOffer, studnieOffer] = await Promise.all([
        prisma.offers_rel.findUnique({
            where: { id: offerRuryId },
            select: { userId: true, offer_number: true }
        }),
        prisma.offers_studnie_rel.findUnique({
            where: { id: offerStudnieId },
            select: { userId: true, offer_number: true }
        })
    ]);

    if (!ruryOffer || !studnieOffer) return null;
    const allowed =
        canReadDoc(authReq.user, ruryOffer.userId) && canReadDoc(authReq.user, studnieOffer.userId);
    if (!allowed) return null;
    return {
        ruryOfferNumber: ruryOffer.offer_number,
        studnieOfferNumber: studnieOffer.offer_number
    };
}

// E3b: walidacja identyfikatorów — kształt, nie UUID. ID ofert w realnych bazach
// to nie tylko crypto.randomUUID (ruryCrud/studnieCrud): bazy z historią zawierają
// legacy ID sprzed migracji UUID (np. "offer_1789903931590",
// "offer_studnie_1789827260384") — .uuid() odrzucało je twardym 400 i cały eksport
// łączny był dla takich baz martwy. Bezpieczeństwo (IDOR) zapewnia
// canExportBothOffers (findUnique + canReadDoc), nie kształt stringa — wzorzec
// jak production.ts (min/max zamiast uuid() dla legalnych payloadów frontendu).
const OFFER_ID_RE = /^[\w.-]+$/;
const combinedExportSchema = z.object({
    offerRuryId: z
        .string()
        .trim()
        .min(1, 'Wybierz ofertę rur')
        .max(64)
        .regex(OFFER_ID_RE, 'Nieprawidłowy identyfikator oferty rur'),
    offerStudnieId: z
        .string()
        .trim()
        .min(1, 'Wybierz ofertę studni')
        .max(64)
        .regex(OFFER_ID_RE, 'Nieprawidłowy identyfikator oferty studni')
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

// POST /api/export-combined/pdf
router.post('/pdf', requireAuth, EXPORT_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const result = parseBody(req.body);
        if ('issues' in result) {
            return res.status(400).json({
                error: 'Nieprawidłowe identyfikatory ofert (offerRuryId, offerStudnieId)',
                details: result.issues
            });
        }
        const ids = result.ids;

        const offers = await canExportBothOffers(authReq, ids.offerRuryId, ids.offerStudnieId);
        if (!offers) {
            return res.status(404).json({ error: 'Not found' });
        }

        const pdfBuffer = await generateCombinedOfferPDF(ids.offerRuryId, ids.offerStudnieId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename(
                'oferta_laczna',
                [
                    [offers.ruryOfferNumber, ids.offerRuryId],
                    [offers.studnieOfferNumber, ids.offerStudnieId]
                ],
                'pdf'
            )}"`
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
                error: 'Nieprawidłowe identyfikatory ofert (offerRuryId, offerStudnieId)',
                details: result.issues
            });
        }
        const ids = result.ids;

        const offers = await canExportBothOffers(authReq, ids.offerRuryId, ids.offerStudnieId);
        if (!offers) {
            return res.status(404).json({ error: 'Not found' });
        }

        const docxBuffer = await generateCombinedOfferDOCX(ids.offerRuryId, ids.offerStudnieId);
        res.setHeader('Content-Type', DOCX_CONTENT_TYPE);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${exportFilename(
                'oferta_laczna',
                [
                    [offers.ruryOfferNumber, ids.offerRuryId],
                    [offers.studnieOfferNumber, ids.offerStudnieId]
                ],
                'docx'
            )}"`
        );
        res.send(docxBuffer);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('ExportCombined', 'Błąd eksportu DOCX łącznego', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
