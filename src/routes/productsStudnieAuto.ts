import express from 'express';
import {
    selectManholeComponents,
    getAvailableComponents,
    validateManhole
} from '../services/antygrawity';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/products-studnie/auto-select
 * Automatically select manhole components based on configuration
 *
 * Request body:
 * {
 *   targetDn: number (1000, 1200, 1500, 2000, 2500),
 *   targetHeight: number (in mm),
 *   magazyn: string ('WL' or 'KLB'),
 *   zakonczenieType: string ('konus' or 'plyta_din', optional, default: 'konus'),
 *   przejscia: array (optional),
 *   hasPlytaOdciazajaca: boolean (optional, default: false),
 *   hasPierscienOdciazajacy: boolean (optional, default: false)
 * }
 */
router.post('/auto-select', requireAuth as any, async (req, res) => {
    try {
        const config = req.body;

        // Validation
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
    } catch (err: any) {
        console.error('[POST /api/products-studnie/auto-select] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/products-studnie/available-components/:dn
 * Get available components for a specific DN and warehouse
 *
 * Query params:
 * - magazyn: string ('WL' or 'KLB', default: 'WL')
 */
router.get('/available-components/:dn', requireAuth as any, async (req, res) => {
    try {
        const dn = parseInt(req.params.dn);
        const magazyn = (req.query.magazyn as string) || 'WL';

        if (isNaN(dn)) {
            return res.status(400).json({ error: 'DN musi być liczbą' });
        }

        const components = await getAvailableComponents(dn, magazyn);
        res.json({ components });
    } catch (err: any) {
        console.error('[GET /api/products-studnie/available-components] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/products-studnie/validate
 * Validate a manhole configuration
 *
 * Request body:
 * {
 *   components: array,
 *   config: object
 * }
 */
router.post('/validate', requireAuth as any, async (req, res) => {
    try {
        const { components, config } = req.body;

        if (!components || !Array.isArray(components)) {
            return res.status(400).json({ error: 'Wymagana tablica komponentów' });
        }

        const validation = validateManhole(components, config);
        res.json(validation);
    } catch (err: any) {
        console.error('[POST /api/products-studnie/validate] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
