import express from 'express';
import { generatePDF, getChromiumStatus } from '../services/pdf/pdfEngine';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @openapi
 * /health/pdf:
 *   get:
 *     tags: [System]
 *     summary: Diagnostyka generowania PDF (Chromium)
 *     description: Lekki check bez launchowania przeglądarki. Z ?smoke=1 renderuje jedną stronę testową end-to-end.
 *     parameters:
 *       - in: query
 *         name: smoke
 *         schema:
 *           type: string
 *         description: "smoke=1 uruchamia próbny render PDF"
 *     responses:
 *       200:
 *         description: Chromium gotowy
 *       503:
 *         description: Chromium niedostępny lub smoke-test nieudany
 */
router.get('/', async (req, res) => {
    const status = getChromiumStatus();
    if (req.query.smoke === '1') {
        try {
            const buf = await generatePDF(
                '<html><body><h1>S.O.K. — test generowania PDF</h1></body></html>'
            );
            res.json({ ...status, smoke: { ok: true, bytes: buf.length } });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('HealthPdf', 'Smoke-test PDF nieudany', message);
            res.status(503).json({
                ...status,
                status: 'degraded',
                smoke: { ok: false, error: message }
            });
        }
        return;
    }
    res.status(status.status === 'ok' ? 200 : 503).json(status);
});

export default router;
