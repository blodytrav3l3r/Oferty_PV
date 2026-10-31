import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PRECO_PRICING_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { precoPricingUpdateSchema } from '../validators/offerSchemas';
import { InvalidPriceError } from '../validators/finiteNumbers';
import { pricelistLock } from '../middleware/writeLock';
import { buildXlsx } from '../utils/minimalXlsx';
import { flattenPrecoRows, getPrecoDefault, getPrecoLive } from '../services/precoPricing';
import { recordPricelistFallback } from '../utils/metrics';
import {
    findLatestDraft,
    getEditorPricing,
    getPricelistWriteTarget,
    parseIfMatch,
    parseVersionIdHeader,
    saveRowsToDraft
} from '../services/pricelist/writeTarget';
import {
    PricelistVersionError,
    cennikMetaSheet,
    currentPricelistLabel,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    projectPrecoNestedToSheets,
    requireExportSource,
    requirePricingSource,
    resolveActive,
    resolveActivePricing
} from '../services/pricelistVersionService';
import { versionExportFilename } from '../utils/exportFilenames';

const router = express.Router();
const writeLimiter = PRECO_PRICING_LIMITER;

const { runWithLock } = pricelistLock;

// ──────────────────────────────────────────
// GET / — pełna struktura PRECO z Preco* tables
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        res.setHeader('X-Pricelist-Write-Target', getPricelistWriteTarget());
        const source = requirePricingSource(req.query.source);
        let fallbackHeader = false;
        if (!source) {
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
                const editVersionId = parseVersionIdHeader(req.get('X-Pricelist-Version-Id'));
                if (editVersionId) {
                    const v = await saveRowsToDraft(
                        'preco',
                        flattenPrecoRows(input),
                        req.user?.id,
                        parseIfMatch(req.get('If-Match')),
                        editVersionId
                    );
                    return {
                        ok: true,
                        target: 'version',
                        versionId: v.id,
                        sha256: v.sha256
                    };
                }

                const draft = await saveRowsToDraft(
                    'preco',
                    flattenPrecoRows(input),
                    req.user?.id,
                    parseIfMatch(req.get('If-Match'))
                );
                return { ok: true, target: 'draft', versionId: draft.id };
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
            if (err instanceof PricelistVersionError) {
                res.status(err.statusCode).json({ error: err.message, code: err.code });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PUT error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// PATCH / — wyłączone: LIVE jest tylko do odczytu (etap 1)
// ──────────────────────────────────────────
router.patch('/', requireAuth, requireAdmin, writeLimiter, (_req, res) => {
    res.status(409).json({
        error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
        code: 'LIVE_READ_ONLY'
    });
});

// ──────────────────────────────────────────
// GET /export.xlsx?source=live|default|active — sama część PRECO (Etap C),
// projekcja kształtu zagnieżdżonego 1:1 z eksportem FE
router.get('/export.xlsx', requireAuth, async (req, res) => {
    try {
        const requested = requireExportSource(req.query.source);
        // Etap 1: eksport "live" = bieżący szkic (jak dotąd w trybie draft).
        const source = requested === 'live' ? 'draft' : requested;
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
        // Etap 1: `?source=live` aliasuje do szkicu, więc tu zostaje tylko
        // `default` — eksport tabel LIVE nie jest już dostępny.
        const result = await getPrecoDefault();
        const entry = (result.data[0] ?? {}) as Record<string, unknown>;
        const live = projectPrecoNestedToSheets(entry);
        const label = await currentPricelistLabel('preco');
        const xlsx = await buildXlsx([
            ...liveSheetsToXlsxSheets(live, 'PRECO_Kinety'),
            cennikMetaSheet('Preco', label)
        ]);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${label ? versionExportFilename('preco', label) : 'Cennik_Preco_Export.xlsx'}"`
        );
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
