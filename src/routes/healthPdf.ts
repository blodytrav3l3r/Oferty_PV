import express from 'express';
import { generatePDF, getChromiumStatus } from '../services/pdf/pdfEngine';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @openapi
 * /health/pdf:
 *   get:
 *     tags: [System]
 *     summary: Stan generowania PDF (publiczny, minimalny)
 *     description: Publicznie zwraca wylacznie {status}. Pelna diagnostyka tylko dla admina (/api/admin/system-info). Z ?smoke=1 (admin-only) renderuje jedna strone testowa end-to-end.
 *     parameters:
 *       - in: query
 *         name: smoke
 *         schema:
 *           type: string
 *         description: "smoke=1 uruchamia probny render PDF (wymaga sesji admina)"
 *     responses:
 *       200:
 *         description: Chromium gotowy
 *       401:
 *         description: Brak autoryzacji (smoke)
 *       403:
 *         description: Wymagana rola admin (smoke)
 *       503:
 *         description: Chromium niedostepny lub smoke-test nieudany
 */
async function handleSmoke(_req: express.Request, res: express.Response): Promise<void> {
    try {
        const buf = await generatePDF(
            '<html><body><h1>S.O.K. — test generowania PDF</h1></body></html>'
        );
        const status = getChromiumStatus();
        res.json({ status: status.status, smoke: { ok: true, bytes: buf.length } });
    } catch (e: unknown) {
        const detail = e instanceof Error ? e.stack || e.message : String(e);
        logger.error('HealthPdf', 'Smoke-test PDF nieudany', detail);
        res.status(503).json({ status: 'degraded', smoke: { ok: false } });
    }
}

router.get('/', (req, res) => {
    // I-011: publicznie wylacznie minimalny {status}. Pelne pola
    // (user/home/cacheDir/executableName/shmMb/found) nigdy nie opuszczaja serwera.
    if (req.query.smoke === '1') {
        // Smoke uruchamia Chromium — wylacznie admin (chroni przed anonimowym DoS).
        void requireAuth(req, res, () => {
            void requireAdmin(req, res, () => {
                void handleSmoke(req, res);
            });
        });
        return;
    }
    const status = getChromiumStatus();
    res.status(status.status === 'ok' ? 200 : 503).json({ status: status.status });
});

export default router;
