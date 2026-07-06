import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { WRITE_LIMITER, READ_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import { wellCaseService } from '../services/learning/wellCaseService';

const router = express.Router();

/**
 * POST /api/learning/cases
 * Zapisuje przypadek studni do bazy CBR.
 * Fire-and-forget: wywoływane z frontendu po zapisie oferty.
 */
router.post(
    '/cases',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
        try {
            const body = req.body as {
                dn?: number;
                totalHeightMm?: number;
                wellType?: string;
                warehouse?: string;
                producer?: string;
                kinetType?: string;
                inflowCount?: number;
                loadClass?: string;
                manholeClass?: string;
                coverType?: string;
                componentSeq?: unknown[];
                diameterProfile?: unknown[];
                transitions?: unknown[];
                configSource?: string;
            };

            if (typeof body.dn !== 'number' || typeof body.totalHeightMm !== 'number') {
                return res.status(400).json({ error: 'Wymagane pola: dn (number), totalHeightMm (number)' });
            }
            if (!body.wellType) {
                return res.status(400).json({ error: 'Wymagane pole: wellType' });
            }

            const authReq = req as AuthenticatedRequest;
            const userId = authReq.user?.id;

            const id = await wellCaseService.createOrUpdate({
                dn: body.dn,
                totalHeightMm: body.totalHeightMm,
                wellType: body.wellType,
                warehouse: body.warehouse,
                producer: body.producer,
                kinetType: body.kinetType,
                inflowCount: body.inflowCount,
                loadClass: body.loadClass,
                manholeClass: body.manholeClass,
                coverType: body.coverType,
                componentSeq: body.componentSeq || [],
                diameterProfile: body.diameterProfile || [],
                transitions: body.transitions || [],
                configSource: body.configSource,
                userId
            });

            return res.json({ success: true, caseId: id });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Learning', `Błąd zapisu przypadku: ${message}`);
            return res.status(500).json({ error: 'Nie udało się zapisać przypadku' });
        }
    }
);

/**
 * GET /api/learning/similar-cases
 * Wyszukuje najbardziej podobne studnie w bazie CBR.
 */
router.get(
    '/similar-cases',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        try {
            const dn = parseInt(req.query.dn as string, 10);
            const height = parseInt(req.query.height as string, 10);
            const wellType = (req.query.wellType as string) || 'standard';
            const warehouse = req.query.warehouse as string | undefined;
            const producer = req.query.producer as string | undefined;
            const loadClass = req.query.loadClass as string | undefined;
            const limit = parseInt(req.query.limit as string, 10) || 100;

            if (isNaN(dn) || isNaN(height)) {
                return res.status(400).json({ error: 'Wymagane query params: dn (int), height (int)' });
            }

            const results = await wellCaseService.findSimilar({
                dn,
                totalHeightMm: height,
                wellType,
                warehouse,
                producer,
                loadClass,
                limit
            });

            return res.json({ items: results, total: results.length });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Learning', `Błąd wyszukiwania podobnych: ${message}`);
            return res.status(500).json({ error: 'Błąd wyszukiwania' });
        }
    }
);

/**
 * GET /api/learning/preferences
 * Zwraca wyuczone preferencje scoringowe dla solvera.
 * Na clean start zwraca confidence=0 z pustymi wagami.
 */
router.get(
    '/preferences',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        try {
            const dn = parseInt(req.query.dn as string, 10);
            if (isNaN(dn)) {
                return res.status(400).json({ error: 'Wymagany query param: dn (int)' });
            }
            const warehouse = req.query.warehouse as string | undefined;

            const prefs = await wellCaseService.getPreferences({ dn, warehouse });
            return res.json(prefs);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Learning', `Błąd preferencji: ${message}`);
            return res.status(500).json({ error: 'Błąd pobierania preferencji' });
        }
    }
);

/**
 * GET /api/learning/patterns
 * Statystyki i wzorce dla danego DN.
 */
router.get(
    '/patterns',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        try {
            const dn = parseInt(req.query.dn as string, 10);
            if (isNaN(dn)) {
                return res.status(400).json({ error: 'Wymagany query param: dn (int)' });
            }

            const patterns = await wellCaseService.getPatterns(dn);
            return res.json(patterns);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Learning', `Błąd wzorców: ${message}`);
            return res.status(500).json({ error: 'Błąd pobierania wzorców' });
        }
    }
);

export default router;
