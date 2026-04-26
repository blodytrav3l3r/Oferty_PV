import express from 'express';
import {
    selectManholeComponents,
    getAvailableComponents,
    validateManhole
} from '../services/antygrawity';
import { requireAuth } from '../middleware/auth';
import { validateData } from '../validators/authSchema';
import { autoSelectConfigSchema, validateComponentsSchema } from '../validators/offerSchemas';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/products-studnie/auto-select
 * Automatycznie dobiera elementy studni na podstawie konfiguracji
 *
 * Ciało żądania (body):
 * {
 *   targetDn: number (1000, 1200, 1500, 2000, 2500),
 *   targetHeight: number (w mm),
 *   magazyn: string ('WL' lub 'KLB'),
 *   zakonczenieType: string ('konus' lub 'plyta_din', opcjonalnie, domyślnie: 'konus'),
 *   przejscia: tablica (opcjonalnie),
 *   hasPlytaOdciazajaca: boolean (opcjonalnie, domyślnie: false),
 *   hasPierscienOdciazajacy: boolean (opcjonalnie, domyślnie: false)
 * }
 */
router.post('/auto-select', requireAuth, validateData(autoSelectConfigSchema), async (req, res) => {
    try {
        const config = req.body;

        // Dodatkowa walidacja logiczna
        if (!config.targetDn) {
            return res.status(400).json({ error: 'Wymagane pole: targetDn' });
        }
        if (!config.targetHeight) {
            return res.status(400).json({ error: 'Wymagane pole: targetHeight' });
        }

        const result = await selectManholeComponents(config);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('AutoSelect', 'Błąd auto-select', message);
        res.status(500).json({ error: message });
    }
});

/**
 * GET /api/products-studnie/available-components/:dn
 * Pobiera dostępne komponenty dla konkretnej średnicy DN i magazynu
 *
 * Parametry zapytania (query):
 * - magazyn: string ('WL' lub 'KLB', domyślnie: 'WL')
 */
router.get('/available-components/:dn', requireAuth, async (req, res) => {
    try {
        const dn = parseInt(req.params.dn);
        const magazyn = (req.query.magazyn as string) || 'WL';

        if (isNaN(dn)) {
            return res.status(400).json({ error: 'DN musi być liczbą' });
        }

        const components = await getAvailableComponents(dn, magazyn);
        res.json({ components });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('AutoSelect', 'Błąd dostępnych komponentów', message);
        res.status(500).json({ error: message });
    }
});

/**
 * POST /api/products-studnie/validate
 * Waliduje konfigurację studni
 *
 * Ciało żądania (body):
 * {
 *   components: array,
 *   config: object
 * }
 */
router.post('/validate', requireAuth, validateData(validateComponentsSchema), async (req, res) => {
    try {
        const { components, config } = req.body;

        const validation = validateManhole(components, config);
        res.json(validation);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('AutoSelect', 'Błąd walidacji', message);
        res.status(500).json({ error: message });
    }
});

export default router;
