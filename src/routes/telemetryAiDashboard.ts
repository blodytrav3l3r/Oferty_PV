/**
 * REST API dla modułu AI Learning Engine i Knowledge Base.
 *
 * Wszystkie endpointy są ADMIN-ONLY (dane rekomendacji/AI).
 * AI nie może modyfikować solvera — to pasywny obserwator.
 */

import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { READ_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import { learningEngine } from '../services/telemetry/learning';
import { KnowledgeBase } from '../services/telemetry/learning/KnowledgeBase';
import { RecommendationEngine } from '../services/telemetry/learning/RecommendationEngine';

const router = express.Router();
const kb = new KnowledgeBase();
const recommend = new RecommendationEngine();

/* ===== LEARNING ENGINE ===== */

/**
 * GET /api/telemetry/ai/learning/status
 * Status silnika uczącego.
 */
router.get('/ai/learning/status', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    try {
        return res.json(learningEngine.getStatus());
    } catch (_e) {
        return res.status(500).json({ error: 'Błąd' });
    }
});

/**
 * POST /api/telemetry/ai/learning/run
 * Wymusza pełny cykl uczenia (analiza historyczna).
 */
router.post('/ai/learning/run', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    try {
        const summary = await learningEngine.runFullCycle();
        logger.info(
            'LearningEngine',
            `[manual run] patterns=${summary.patternsDetected}, persisted=${summary.persistedToKb}, ms=${summary.durationMs}`
        );
        return res.json(summary);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return res.status(500).json({ error: message });
    }
});

/* ===== KNOWLEDGE BASE ===== */

/**
 * GET /api/telemetry/ai/knowledge/patterns
 * Lista wzorców w bazie wiedzy per DN.
 */
router.get('/ai/knowledge/patterns', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    const dn = (req.query.dn as string) || 'all_dn';
    const minConfidence = parseFloat((req.query.minConfidence as string) || '0.3');
    try {
        const patterns = await kb.getPatternsForDn(dn, minConfidence);
        return res.json({ dn, minConfidence, items: patterns, total: patterns.length });
    } catch (_e) {
        return res.status(500).json({ error: 'Błąd' });
    }
});

/**
 * GET /api/telemetry/ai/knowledge/stats
 * Statystyki bazy wiedzy do dashboardu.
 */
router.get('/ai/knowledge/stats', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    try {
        const stats = await kb.getStats();
        return res.json(stats);
    } catch (_e) {
        return res.status(500).json({ error: 'Błąd' });
    }
});

/* ===== RECOMMENDATIONS ===== */

/**
 * GET /api/telemetry/ai/recommendations/:telemetryId
 * Zwraca rekomendacje AI dla danego rekordu telemetry.
 */
router.get('/ai/recommendations/:telemetryId', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    try {
        const dn = req.query.dn as string | undefined;
        const recs = await recommend.recommendForTelemetry(req.params.telemetryId, dn);
        return res.json({ items: recs, total: recs.length });
    } catch (_e) {
        return res.status(500).json({ error: 'Błąd' });
    }
});

/**
 * POST /api/telemetry/ai/recommendations/decide
 * Decyzja akceptacji/odrzucenia rekomendacji.
 */
router.post('/ai/recommendations/decide', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' });
    }
    try {
        const { id, accepted } = req.body;
        if (!id || typeof accepted !== 'boolean') {
            return res.status(400).json({ error: 'Brak id lub accepted' });
        }
        await recommend.applyDecision(id, accepted, authReq.user?.id || 'unknown');
        return res.json({ success: true });
    } catch (_e) {
        return res.status(500).json({ error: 'Błąd' });
    }
});

export default router;
