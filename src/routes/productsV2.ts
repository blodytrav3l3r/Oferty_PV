import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema } from '../validators/offerSchemas';
import { requireFinitePrice, InvalidPriceError } from '../validators/finiteNumbers';
import { pricelistLock } from '../middleware/writeLock';
import prisma from '../prismaClient';
import {
    findLatestDraft,
    getEditorPricing,
    getPricelistWriteTarget,
    parseIfMatch,
    parseVersionIdHeader,
    saveRowsToDraft
} from '../services/pricelist/writeTarget';
import { buildXlsx } from '../utils/minimalXlsx';
import {
    PricelistVersionError,
    RURY_LIVE_SHEET,
    cennikMetaSheet,
    currentPricelistLabel,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    projectVersionToLiveShape,
    requireExportSource,
    requirePricingSource,
    resolveActive,
    resolveActivePricing
} from '../services/pricelistVersionService';
import { versionExportFilename } from '../utils/exportFilenames';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const { runWithLock } = pricelistLock;

// ──────────────────────────────────────────
// GET / — wszystkie produkty z ProductsRury
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        res.setHeader('X-Pricelist-Write-Target', getPricelistWriteTarget());
        const source = requirePricingSource(req.query.source);
        if (!source) {
            const editor = await getEditorPricing('rury');
            if (!editor.fallback) {
                res.json({ data: editor.data });
                return;
            }
        }
        if (source === 'active') {
            const active = await resolveActivePricing('rury');
            if (active.fallback) {
                // Etap 1: brak ACTIVE = brak ceny oferty. Cichy fallback do LIVE
                // dawał oferty wycenione z zamrożonego snapshotu.
                res.status(409).json({
                    error: 'Brak aktywnego cennika rur — opublikuj wersję',
                    code: 'NO_ACTIVE_VERSION'
                });
                return;
            }
            res.json({ data: active.data });
            return;
        }
        const products = await prisma.productsRury.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products });
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// PUT / — bulk save (usuń wszystko + utwórz)
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(pricelistDataSchema),
    async (req, res) => {
        try {
            const result = await runWithLock(async () => {
                const arr: Record<string, unknown>[] = req.body.data;
                const mapped = arr.map((item, idx) => ({
                    id: String(item.id),
                    name: String(item.name ?? ''),
                    category: String(item.category ?? ''),
                    // D-FIX-2: brak/cicha koercja ceny na 0 zabroniona.
                    price: requireFinitePrice(item.price, `data[${idx}].price`),
                    transport: item.transport != null ? Number(item.transport) : null,
                    weight: item.weight != null ? Number(item.weight) : null,
                    area: item.area != null ? Number(item.area) : null
                }));

                const editVersionId = parseVersionIdHeader(req.get('X-Pricelist-Version-Id'));
                if (editVersionId) {
                    // Jawna edycja opublikowanej wersji (w miejscu, z ostrzeżeniem w UI).
                    const v = await saveRowsToDraft(
                        'rury',
                        mapped,
                        req.user?.id,
                        parseIfMatch(req.get('If-Match')),
                        editVersionId
                    );
                    return {
                        ok: true,
                        count: arr.length,
                        target: 'version',
                        versionId: v.id,
                        sha256: v.sha256
                    };
                }

                const draft = await saveRowsToDraft(
                    'rury',
                    mapped,
                    req.user?.id,
                    parseIfMatch(req.get('If-Match'))
                );
                return {
                    ok: true,
                    count: arr.length,
                    target: 'draft',
                    versionId: draft.id
                };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            // D-FIX-2: invalid numeric input to 400 (przed tx — nic nie zapisane).
            if (err instanceof InvalidPriceError) {
                res.status(400).json({ error: err.message });
                return;
            }
            if (err instanceof PricelistVersionError) {
                res.status(err.statusCode).json({ error: err.message, code: err.code });
                return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PUT error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// PATCH /:id — wyłączone: LIVE jest tylko do odczytu (etap 1)
// ──────────────────────────────────────────
router.patch('/:id', requireAuth, requireAdmin, writeLimiter, (_req, res) => {
    res.status(409).json({
        error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
        code: 'LIVE_READ_ONLY'
    });
});

// ──────────────────────────────────────────
// DELETE /:id — wyłączone: LIVE jest tylko do odczytu (etap 1)
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, (_req, res) => {
    res.status(409).json({
        error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
        code: 'LIVE_READ_ONLY'
    });
});

// ──────────────────────────────────────────
// GET /export.xlsx?source=live|default|active — XLSX z serwera (Etap C),
// shape 1:1 z eksportem FE (jak GET /:id/export wersji)
router.get('/export.xlsx', requireAuth, async (req, res) => {
    try {
        const requested = requireExportSource(req.query.source);
        // Etap 1: eksport "live" = bieżący szkic (jak dotąd w trybie draft).
        const source = requested === 'live' ? 'draft' : requested;
        if (source === 'draft') {
            const draft = await findLatestDraft('rury');
            if (!draft) {
                res.status(409).json({
                    error: 'Brak szkicu cennika rur',
                    code: 'NO_DRAFT_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(draft.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, RURY_LIVE_SHEET));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Rury_${draft.version}_Draft.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        if (source === 'active') {
            const active = await resolveActive('rury');
            if (!active) {
                res.status(409).json({
                    error: 'Brak aktywnej wersji cennika rur',
                    code: 'NO_ACTIVE_VERSION'
                });
                return;
            }
            const { sheets } = await getVersionExportSheets(active.id);
            const xlsx = await buildXlsx(liveSheetsToXlsxSheets(sheets, RURY_LIVE_SHEET));
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Cennik_Rury_${active.version}_Export.xlsx"`
            );
            res.send(xlsx);
            return;
        }
        // Etap 1: `?source=live` aliasuje do szkicu, więc tu zostaje tylko
        // `default` — eksport tabel LIVE nie jest już dostępny.
        const rows = await prisma.productsRuryDefault.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        const live = projectVersionToLiveShape('rury', {
            rury: rows as unknown as Array<Record<string, unknown>>
        });
        // Nazwa pliku i arkusz `_Cennik` niosą numer cennika (szkic → obowiązujący),
        // więc eksport z edytora nie jest anonimowy.
        const label = await currentPricelistLabel('rury');
        const xlsx = await buildXlsx([
            ...liveSheetsToXlsxSheets(live, RURY_LIVE_SHEET),
            cennikMetaSheet('Rury', label)
        ]);
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${label ? versionExportFilename('rury', label) : 'Cennik_Rury_Export.xlsx'}"`
        );
        res.send(xlsx);
    } catch (err: unknown) {
        if (err instanceof PricelistVersionError) {
            res.status(err.statusCode).json({ error: err.message, code: err.code });
            return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET /export.xlsx error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// GET /default — domyślny cennik
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const products = await prisma.productsRuryDefault.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        res.json({ data: products });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'GET /default error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
