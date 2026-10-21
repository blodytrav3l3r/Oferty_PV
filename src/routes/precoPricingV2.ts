import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PRECO_PRICING_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { precoPricingUpdateSchema, precoPricingPatchSchema } from '../validators/offerSchemas';
import { InvalidPriceError } from '../validators/finiteNumbers';
import { pricelistLock } from '../middleware/writeLock';
import { buildXlsx } from '../utils/minimalXlsx';
import {
    flattenAndSave,
    flattenPrecoRows,
    getPrecoDefault,
    getPrecoLive,
    RANGE_TYPES
} from '../services/precoPricing';
import { logAudit } from '../services/auditService';
import { recordPricelistFallback, recordPricelistLiveWrite } from '../utils/metrics';
import {
    findLatestDraft,
    getEditorPricing,
    getPricelistWriteTarget,
    saveRowsToDraft
} from '../services/pricelist/writeTarget';
import {
    PricelistVersionError,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    projectPrecoNestedToSheets,
    requireExportSource,
    requirePricingSource,
    resolveActive,
    resolveActivePricing
} from '../services/pricelistVersionService';

const router = express.Router();
const writeLimiter = PRECO_PRICING_LIMITER;

const { runWithLock } = pricelistLock;

// ──────────────────────────────────────────
// GET / — pełna struktura PRECO z Preco* tables
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const source = requirePricingSource(req.query.source);
        let fallbackHeader = false;
        if (!source && getPricelistWriteTarget() === 'draft') {
            const editor = await getEditorPricing('preco');
            if (!editor.fallback) {
                res.json({ data: editor.data });
                return;
            }
        }
        if (source === 'active') {
            const active = await resolveActivePricing('preco');
            if (!active.fallback) {
                res.json({ data: active.data });
                return;
            }
            fallbackHeader = true;
        }
        const result = await getPrecoLive();
        if (fallbackHeader) {
            recordPricelistFallback('preco');
            res.setHeader('X-Pricelist-Fallback', 'live');
        }
        res.json(result);
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// PUT / — pełny zapis struktury PRECO (live + default)
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(precoPricingUpdateSchema),
    async (req, res) => {
        const raw = req.body.data;
        let input: Record<string, unknown>;

        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
            input = raw[0] as Record<string, unknown>;
        } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            input = raw as Record<string, unknown>;
        } else {
            res.status(400).json({ error: 'Nieprawidłowy format danych' });
            return;
        }

        try {
            const result = await runWithLock(async () => {
                if (getPricelistWriteTarget() === 'draft') {
                    const draft = await saveRowsToDraft(
                        'preco',
                        flattenPrecoRows(input),
                        req.user?.id
                    );
                    return { ok: true, target: 'draft', versionId: draft.id };
                }

                await flattenAndSave(input, false);

                recordPricelistLiveWrite('preco');
                await logAudit('pricelist_live', 'preco', req.user?.id ?? '', 'LIVE_WRITE', {
                    sections: ['konfig', 'kinety', 'zakresy']
                });

                return { ok: true };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            // D-FIX-2: invalid numeric input to 400 (throw przed tx).
            if (err instanceof InvalidPriceError) {
                res.status(400).json({ error: err.message });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PUT error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// PATCH / — częściowa aktualizacja
// Odczytuje aktualny stan, głęboko scala DN entry, zapisuje do live
// ──────────────────────────────────────────
router.patch(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(precoPricingPatchSchema),
    async (req, res) => {
        if (getPricelistWriteTarget() === 'draft') {
            res.status(409).json({
                error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
                code: 'LIVE_READ_ONLY'
            });
            return;
        }
        const patch = req.body.data as Record<string, unknown>;
        if (!patch || typeof patch !== 'object') {
            res.status(400).json({ error: 'Nieprawidłowy format danych' });
            return;
        }

        try {
            const result = await runWithLock(async () => {
                const current = await getPrecoLive();
                const entry: Record<string, unknown> =
                    current.data.length > 0
                        ? { ...(current.data[0] as Record<string, unknown>) }
                        : {};

                for (const [key, value] of Object.entries(patch)) {
                    const dn = Number(key);
                    if (
                        !Number.isNaN(dn) &&
                        typeof value === 'object' &&
                        value !== null &&
                        !Array.isArray(value)
                    ) {
                        const existing = (entry[key] as Record<string, unknown>) || {};
                        entry[key] = { ...existing, ...(value as Record<string, unknown>) };
                    } else if ((RANGE_TYPES as readonly string[]).includes(key)) {
                        entry[key] = value;
                    }
                }

                await flattenAndSave(entry, false);
                recordPricelistLiveWrite('preco');
                await logAudit('pricelist_live', 'preco', req.user?.id ?? '', 'PATCH_LIVE_WRITE', {
                    keys: Object.keys(patch)
                });
                return { ok: true };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            // D-FIX-2: invalid numeric input to 400 (flattenAndSave waliduje).
            if (err instanceof InvalidPriceError) {
                res.status(400).json({ error: err.message });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PATCH error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// GET /export.xlsx?source=live|default|active — sama część PRECO (Etap C),
// projekcja kształtu zagnieżdżonego 1:1 z eksportem FE
router.get('/export.xlsx', requireAuth, async (req, res) => {
    try {
        const requested = requireExportSource(req.query.source);
        // S5 alias: w trybie draft eksport "live" = bieżący szkic (rollback bez zmian FE).
        const source =
            requested === 'live' && getPricelistWriteTarget() === 'draft' ? 'draft' : requested;
        if (source === 'draft') {
            const draft = await findLatestDraft('preco');
            if (!draft) {
                res.status(409).json({
                    error: 'Brak szkicu cennika PRECO',
                    code: 'NO_DRAFT_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(draft.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, 'PRECO_Kinety'));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Preco_${draft.version}_Draft.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        if (source === 'active') {
            const active = await resolveActive('preco');
            if (!active) {
                res.status(409).json({
                    error: 'Brak aktywnej wersji cennika PRECO',
                    code: 'NO_ACTIVE_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(active.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, 'PRECO_Kinety'));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Preco_${active.version}_Export.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        const result = source === 'live' ? await getPrecoLive() : await getPrecoDefault();
        const entry = (result.data[0] ?? {}) as Record<string, unknown>;
        const live = projectPrecoNestedToSheets(entry);
        const xlsx = await buildXlsx(liveSheetsToXlsxSheets(live, 'PRECO_Kinety'));
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="Cennik_Preco_Export.xlsx"');
        res.send(xlsx);
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET /export.xlsx error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// GET /default — fabryczne wartości PRECO z Preco*Default tables
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const result = await getPrecoDefault();
        res.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET /default error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
