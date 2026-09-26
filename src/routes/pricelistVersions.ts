/**
 * F2: API wersjonowania cenników (Expand & Contract — obok starego LIVE).
 *
 * GET /?type= · POST /:type/drafts · PUT /:id · POST /:id/activate
 * POST /:id/backdate · GET /:id/diff · GET /:id/export (XLSX).
 * Admin + lock per-type + PRICELIST_WRITE_LIMITER (wzorzec priceOverrides.ts).
 */

import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { createModuleLock } from '../middleware/writeLock';
import { PRICELIST_WRITE_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import {
    PRICELIST_TYPES,
    PricelistVersionError,
    activate,
    activateDue,
    applyBackdate,
    createDraft,
    getVersionDiff,
    getVersionExport,
    updateDraft
} from '../services/pricelistVersionService';
import prisma from '../prismaClient';
import { buildXlsx, type XlsxSheet } from '../utils/minimalXlsx';

const router = express.Router();

/** Lock per-type (jak service: Map<type, lock>, nie globalny). */
const routeLocks = new Map<string, ReturnType<typeof createModuleLock>>();

function lockFor(type: string): ReturnType<typeof createModuleLock> {
    let lock = routeLocks.get(type);
    if (!lock) {
        lock = createModuleLock();
        routeLocks.set(type, lock);
    }
    return lock;
}

function sendVersionError(res: express.Response, err: unknown): void {
    if (err instanceof PricelistVersionError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('PricelistVersions', 'Błąd serwera', message);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
}

function userIdOf(req: express.Request): string | undefined {
    const id = (req as express.Request & { user?: { id?: unknown } }).user?.id;
    return typeof id === 'string' ? id : undefined;
}

function isKnownType(value: unknown): value is (typeof PRICELIST_TYPES)[number] {
    return typeof value === 'string' && (PRICELIST_TYPES as readonly string[]).includes(value);
}

/** Lista wersji (opcjonalny filtr ?type=), najnowsze seq pierwsze. */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.query;
        if (type !== undefined && !isKnownType(type)) {
            res.status(422).json({
                error: 'Nieprawidłowy typ cennika (dozwolone: rury, studnie, preco)',
                code: 'INVALID_TYPE'
            });
            return;
        }
        const versions = await prisma.pricelistVersion.findMany({
            where: type === undefined ? undefined : { type },
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        res.json({ versions });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/**
 * F3: etykiety wersji na oś czasu (bez cen) — dla badge „cennik vX" w ofertach.
 * Bez requireAdmin: tylko ACTIVE/BACKDATE, tylko id/version/seq/effectiveFrom.
 */
router.get('/labels', requireAuth, async (req, res) => {
    try {
        const { type } = req.query;
        if (type !== undefined && !isKnownType(type)) {
            res.status(422).json({
                error: 'Nieprawidłowy typ cennika (dozwolone: rury, studnie, preco)',
                code: 'INVALID_TYPE'
            });
            return;
        }
        const versions = await prisma.pricelistVersion.findMany({
            where: {
                ...(type === undefined ? {} : { type }),
                status: { in: ['ACTIVE', 'BACKDATE'] }
            },
            select: { id: true, type: true, seq: true, version: true, effectiveFrom: true },
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        res.json({ versions });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Nowy draft wersji (seq auto, version = v{seq} — nigdy z inputu). */
router.post(
    '/:type/drafts',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const { type } = req.params;
            if (!isKnownType(type)) {
                res.status(422).json({
                    error: 'Nieprawidłowy typ cennika (dozwolone: rury, studnie, preco)',
                    code: 'INVALID_TYPE'
                });
                return;
            }
            const { rows, effectiveFrom, note } = req.body as {
                rows?: unknown;
                effectiveFrom?: string;
                note?: string;
            };
            const result = await lockFor(type).runWithLock(() =>
                createDraft(type, rows, { effectiveFrom, note, createdBy: userIdOf(req) })
            );
            if (!result.acquired) {
                res.status(429).json({ error: 'Zapis w toku, spróbuj ponownie za chwilę' });
                return;
            }
            res.status(201).json({ version: result.value });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Podmiana wierszy (tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED). */
router.put('/:id', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (req, res) => {
    try {
        const { rows } = req.body as { rows?: unknown };
        const version = await updateDraft(req.params.id, rows);
        res.json({ version });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Aktywacja SCHEDULED (due); przeszłość → 409 PERIOD_OVERLAP. */
router.post(
    '/:id/activate',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const version = await activate(req.params.id, { userId: userIdOf(req) });
            res.json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Backdate: nota ≥ 10 znaków; kolizja (type, effectiveFrom) → 409. */
router.post(
    '/:id/backdate',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const { note } = req.body as { note?: unknown };
            const version = await applyBackdate(req.params.id, note, {
                userId: userIdOf(req)
            });
            res.json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Ręczny trigger crona (awaryjny; cron robi to co 5 min + przy starcie). */
router.post(
    '/activate-due',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const result = await activateDue(undefined, { userId: userIdOf(req) });
            res.json(result);
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Diff wersji względem poprzedniej (seq-1). */
router.get('/:id/diff', requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await getVersionDiff(req.params.id));
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Eksport wersji do XLSX (jeden wiersz = jedna pozycja, jak frontend). */
router.get('/:id/export', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { version, sections } = await getVersionExport(req.params.id);
        const sheets: XlsxSheet[] = Object.entries(sections).map(([name, rows]) => {
            const headers = rows.length > 0 ? Object.keys(rows[0]) : ['id'];
            return {
                name,
                headers,
                rows: rows.map((row) => headers.map((h) => toCell(row[h])))
            };
        });
        const xlsx = await buildXlsx(
            sheets.length > 0 ? sheets : [{ name: 'Cennik', headers: ['id'], rows: [] }]
        );
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="cennik-${version.type}-${version.version}.xlsx"`
        );
        res.send(xlsx);
    } catch (err) {
        sendVersionError(res, err);
    }
});

function toCell(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

export default router;
