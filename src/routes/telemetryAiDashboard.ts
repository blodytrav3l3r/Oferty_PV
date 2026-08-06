/**
 * REST API dla modułu AI Learning Engine i Knowledge Base.
 *
 * Wszystkie endpointy są ADMIN-ONLY (dane rekomendacji/AI).
 * AI nie może modyfikować solvera — to pasywny obserwator.
 */

import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { READ_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import { learningEngine } from '../services/telemetry/learning';
import { KnowledgeBase } from '../services/telemetry/learning/KnowledgeBase';
import prisma from '../prismaClient';

const router = express.Router();
const kb = new KnowledgeBase();

/* ===== LEARNING ENGINE ===== */

/**
 * POST /api/telemetry/ai/learning/run
 * Wymusza pełny cykl uczenia (analiza historyczna).
 */
router.post('/ai/learning/run', requireAuth, requireAdmin, READ_LIMITER, async (_req, res) => {
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
router.get('/ai/knowledge/patterns', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    const dn = (req.query.dn as string) || 'all_dn';
    const minConfidence = parseFloat((req.query.minConfidence as string) || '0.3');
    try {
        const [patterns, telemetryCount, patternsTotal, allDnPatterns, engineStatus] =
            await Promise.all([
                kb.getPatternsForDn(dn, minConfidence),
                prisma.ai_telemetry_logs.count(),
                kb.countPatterns(),
                kb.getPatternsForDn('all_dn', minConfidence),
                learningEngine.getStatus()
            ]);
        return res.json({
            items: patterns,
            telemetryCount,
            patternsTotal,
            patternsOtherDn: Math.max(0, allDnPatterns.length - patterns.length),
            lastRunAt: engineStatus?.lastRunAt || null
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('AiDashboard', `Error: ${message}`);
        return res.status(500).json({ error: 'Błąd' });
    }
});

/**
 * GET /api/telemetry/ai/knowledge/stats
 * Statystyki bazy wiedzy do dashboardu.
 */
router.get('/ai/knowledge/stats', requireAuth, requireAdmin, READ_LIMITER, async (_req, res) => {
    try {
        const stats = await kb.getStats();
        return res.json(stats);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('AiDashboard', `Error: ${message}`);
        return res.status(500).json({ error: 'Błąd' });
    }
});

export default router;
