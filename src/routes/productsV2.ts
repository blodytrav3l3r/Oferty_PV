import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';
import { validateData } from '../validators/authSchema';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { pricelistDataSchema, productPatchSchema } from '../validators/offerSchemas';
import { requireFinitePrice, InvalidPriceError } from '../validators/finiteNumbers';
import { pricelistLock } from '../middleware/writeLock';
import prisma from '../prismaClient';
import { logAudit } from '../services/auditService';
import { recordPricelistFallback, recordPricelistLiveWrite } from '../utils/metrics';
import {
    findLatestDraft,
    getEditorPricing,
    getPricelistWriteTarget,
    saveRowsToDraft
} from '../services/pricelist/writeTarget';
import { buildXlsx } from '../utils/minimalXlsx';
import {
    PricelistVersionError,
    RURY_LIVE_SHEET,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    projectVersionToLiveShape,
    requireExportSource,
    requirePricingSource,
    resolveActive,
    resolveActivePricing
} from '../services/pricelistVersionService';

const router = express.Router();
const writeLimiter = PRICELIST_WRITE_LIMITER;

const ALLOWED_FIELDS = ['name', 'category', 'price', 'transport', 'weight', 'area'] as const;

const { runWithLock } = pricelistLock;

// ──────────────────────────────────────────
// GET / — wszystkie produkty z ProductsRury
// ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const source = requirePricingSource(req.query.source);
        let fallbackHeader = false;
        if (!source && getPricelistWriteTarget() === 'draft') {
            const editor = await getEditorPricing('rury');
            if (!editor.fallback) {
                res.json({ data: editor.data });
                return;
            }
        }
        if (source === 'active') {
            const active = await resolveActivePricing('rury');
            if (!active.fallback) {
                res.json({ data: active.data });
                return;
            }
            fallbackHeader = true;
        }
        const products = await prisma.productsRury.findMany({
            orderBy: [{ category: 'asc' }, { id: 'asc' }]
        });
        if (fallbackHeader) {
            recordPricelistFallback('rury');
            res.setHeader('X-Pricelist-Fallback', 'live');
        }
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

                if (getPricelistWriteTarget() === 'draft') {
                    const draft = await saveRowsToDraft('rury', mapped, req.user?.id);
                    return {
                        ok: true,
                        count: arr.length,
                        target: 'draft',
                        versionId: draft.id
                    };
                }

                await prisma.$transaction([
                    prisma.productsRury.deleteMany(),
                    prisma.productsRury.createMany({ data: mapped })
                ]);

                recordPricelistLiveWrite('rury');
                await logAudit('pricelist_live', 'rury', req.user?.id ?? '', 'LIVE_WRITE', {
                    count: arr.length
                });

                return { ok: true, count: arr.length };
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
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PUT error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// PATCH /:id — edytuj jeden produkt
// ──────────────────────────────────────────
router.patch(
    '/:id',
    requireAuth,
    requireAdmin,
    writeLimiter,
    validateData(productPatchSchema),
    async (req, res) => {
        if (getPricelistWriteTarget() === 'draft') {
            res.status(409).json({
                error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
                code: 'LIVE_READ_ONLY'
            });
            return;
        }
        const { id } = req.params;
        const data: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) {
                data[key] = req.body[key];
            }
        }
        if (Object.keys(data).length === 0) {
            res.status(400).json({ error: 'Brak pól do aktualizacji' });
            return;
        }

        try {
            const result = await runWithLock(async () => {
                const updated = await prisma.productsRury.update({ where: { id }, data });
                recordPricelistLiveWrite('rury');
                await logAudit('pricelist_live', 'rury', req.user?.id ?? '', 'PATCH_LIVE_WRITE', {
                    id
                });
                return { ok: true, data: updated };
            });
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.json(result.value);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('ProductsV2', 'PATCH error', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

// ──────────────────────────────────────────
// DELETE /:id — usuń jeden produkt
// ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, writeLimiter, async (req, res) => {
    if (getPricelistWriteTarget() === 'draft') {
        res.status(409).json({
            error: 'LIVE jest tylko do odczytu; edytuj szkic cennika',
            code: 'LIVE_READ_ONLY'
        });
        return;
    }
    try {
        const result = await runWithLock(async () => {
            const { id } = req.params;
            await prisma.productsRury.delete({ where: { id } });
            recordPricelistLiveWrite('rury');
            await logAudit('pricelist_live', 'rury', req.user?.id ?? '', 'DELETE_LIVE_WRITE', {
                id
            });
            return { ok: true };
        });
        if (!result.acquired) {
            res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
            return;
        }
        res.json(result.value);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('ProductsV2', 'DELETE error', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// ──────────────────────────────────────────
// GET /export.xlsx?source=live|default|active — XLSX z serwera (Etap C),
// shape 1:1 z eksportem FE (jak GET /:id/export wersji)
router.get('/export.xlsx', requireAuth, async (req, res) => {
    try {
        const requested = requireExportSource(req.query.source);
        // S5 alias: w trybie draft eksport "live" = bieżący szkic (rollback bez zmian FE).
        const source =
            requested === 'live' && getPricelistWriteTarget() === 'draft' ? 'draft' : requested;
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
        const rows =
            source === 'live'
                ? await prisma.productsRury.findMany({
                      orderBy: [{ category: 'asc' }, { id: 'asc' }]
                  })
                : await prisma.productsRuryDefault.findMany({
                      orderBy: [{ category: 'asc' }, { id: 'asc' }]
                  });
        const live = projectVersionToLiveShape('rury', {
            rury: rows as unknown as Array<Record<string, unknown>>
        });
        const xlsx = await buildXlsx(liveSheetsToXlsxSheets(live, RURY_LIVE_SHEET));
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="Cennik_Rury_Export.xlsx"');
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
