/**
 * F2: API wersjonowania cenników (Expand & Contract — obok starego LIVE).
 *
 * GET /?type= · POST /:type/drafts · PUT /:id · POST /:id/activate
 * POST /:id/backdate · GET /:id/diff · GET /:id/export (XLSX).
 * Admin + lock per-type + PRICELIST_WRITE_LIMITER (wzorzec priceOverrides.ts).
 */

import express from 'express';
import { z } from 'zod';
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
    cloneAsDraft,
    createDraft,
    countVersionUsage,
    deleteVersion,
    getVersionDiff,
    getVersionExportSheets,
    updateDraft
} from '../services/pricelistVersionService';
import prisma from '../prismaClient';
import { buildXlsx, type XlsxSheet } from '../utils/minimalXlsx';
import { versionExportFilename } from '../utils/exportFilenames';

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
        // Ile ofert/zamówień trzyma pieczątkę wersji (pod wyszarzony „Usuń" w FE).
        // Wersji jest mało, więc batch: per wersja 4 county równolegle.
        const withUsage = await Promise.all(
            versions.map(async (v) => ({
                ...v,
                usedBy: (await countVersionUsage(v.id)).total
            }))
        );
        // Autor: nazwa zamiast id (kolumna Autor w panelu). Batch 1 query;
        // nie-user (auto-ensure/backfill) i usunięci zostają słownie po id.
        const authorIds = [
            ...new Set(
                withUsage
                    .map((v) => v.createdBy)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];
        const authors =
            authorIds.length > 0
                ? await prisma.users.findMany({
                      where: { id: { in: authorIds } },
                      select: { id: true, username: true, firstName: true, lastName: true }
                  })
                : [];
        const authorName = new Map(
            authors.map((u) => [
                u.id,
                [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
            ])
        );
        res.json({
            versions: withUsage.map((v) => ({
                ...v,
                createdByName:
                    typeof v.createdBy === 'string'
                        ? (authorName.get(v.createdBy) ?? v.createdBy)
                        : null
            }))
        });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/**
 * F3: etykiety wersji na oś czasu (bez cen) — dla badge „cennik vX" w ofertach.
 * Bez requireAdmin: tylko ACTIVE/BACKDATE, tylko id/version/seq/effectiveFrom.
 * Z ?ids=a,b,c (max 50): te wersje BEZ filtra statusu (też archiwalne —
 * pieczątki ofert nie kłamią „legacy"); zły format → 422.
 */
router.get('/labels', requireAuth, async (req, res) => {
    try {
        const { type, ids } = req.query;
        if (type !== undefined && !isKnownType(type)) {
            res.status(422).json({
                error: 'Nieprawidłowy typ cennika (dozwolone: rury, studnie, preco)',
                code: 'INVALID_TYPE'
            });
            return;
        }
        if (ids !== undefined) {
            if (typeof ids !== 'string') {
                res.status(422).json({
                    error: 'Nieprawidłowy format ids (oczekiwano a,b,c, max 50)',
                    code: 'INVALID_IDS'
                });
                return;
            }
            const list = ids.split(',').map((s) => s.trim());
            if (list.length === 0 || list.length > 50 || list.some((s) => s.length === 0)) {
                res.status(422).json({
                    error: 'Nieprawidłowy format ids (oczekiwano a,b,c, max 50)',
                    code: 'INVALID_IDS'
                });
                return;
            }
            const versions = await prisma.pricelistVersion.findMany({
                where: {
                    ...(type === undefined ? {} : { type }),
                    id: { in: [...new Set(list)] }
                },
                select: { id: true, type: true, seq: true, version: true, effectiveFrom: true },
                orderBy: [{ type: 'asc' }, { seq: 'desc' }]
            });
            res.json({ versions });
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

/** Usunięcie wersji: allowlist jak dziś + archiwalne bez użycia (ACTIVE/BACKDATE zawsze 409). */
router.delete('/:id', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (req, res) => {
    try {
        const parsed = versionIdParamsSchema.safeParse(req.params);
        if (!parsed.success) {
            res.status(400).json({
                error: 'Nieprawidłowy identyfikator wersji',
                code: 'INVALID_ID'
            });
            return;
        }
        const result = await deleteVersion(parsed.data.id, { userId: userIdOf(req) });
        res.json(result);
    } catch (err) {
        sendVersionError(res, err);
    }
});

/**
 * Kształt body PUT: tylko typy (rows dowolne, note string). Domenę
 * (trim/max 500/NO_CHANGES/zod wierszy per typ) zostawia serwisowi
 * (updateDraft → 422) — bez dublowania błędów 400/422.
 */
const updateDraftBodySchema = z.object({
    rows: z.unknown().optional(),
    note: z.string().optional()
});

/**
 * Edycja wersji (tylko DRAFT/SCHEDULED/BACKDATE_REQUESTED): podmiana wierszy
 * i/lub noty. rows undefined = bez podmiany wierszy (sama nota dozwolona);
 * note undefined = nota bez zmian, pusty string czyści notę. Brak obu → 422.
 * Labelka version niemutowalna (nigdy z inputu).
 */
router.put('/:id', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (req, res) => {
    try {
        const paramsParsed = versionIdParamsSchema.safeParse(req.params);
        if (!paramsParsed.success) {
            res.status(400).json({
                error: 'Nieprawidłowy identyfikator wersji',
                code: 'INVALID_ID'
            });
            return;
        }
        const bodyParsed = updateDraftBodySchema.safeParse(req.body ?? {});
        if (!bodyParsed.success) {
            res.status(400).json({
                error: 'Nieprawidłowe dane edycji wersji (rows dowolne, note musi być tekstem)',
                code: 'INVALID_BODY'
            });
            return;
        }
        const version = await updateDraft(
            paramsParsed.data.id,
            bodyParsed.data.rows,
            bodyParsed.data.note
        );
        res.json({ version });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Aktywacja SCHEDULED (due); opcjonalna nota → wpis audytu ACTIVATE. */
router.post(
    '/:id/activate',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const { note } = (req.body ?? {}) as { note?: unknown };
            const version = await activate(req.params.id, { userId: userIdOf(req), note });
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

/** Faza B: rollback — kopia wierszy dowolnej wersji → nowy DRAFT (seq auto). */
const versionIdParamsSchema = z.object({ id: z.string().min(1) });

router.post(
    '/:id/clone-draft',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const parsed = versionIdParamsSchema.safeParse(req.params);
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Nieprawidłowy identyfikator wersji',
                    code: 'INVALID_ID'
                });
                return;
            }
            const version = await cloneAsDraft(parsed.data.id, { userId: userIdOf(req) });
            res.status(201).json({ version });
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

/** Eksport wersji do XLSX — shape 1:1 z eksportem LIVE (studnie + PRECO same-seq jak F1). */
router.get('/:id/export', requireAuth, requireAdmin, async (req, res) => {
    try {
        const {
            version,
            sheets: live,
            precoIncluded
        } = await getVersionExportSheets(req.params.id);
        if (!isKnownType(version.type)) {
            res.status(422).json({ error: 'Wersja ma nieznany typ', code: 'INVALID_TYPE' });
            return;
        }
        // Flaga dla UI: studnie bez PRECO same-seq eksportują same studnie (ciche
        // pominięcie zamienione na toast po stronie FE).
        res.setHeader('X-Preco-Included', precoIncluded ? '1' : '0');
        const sheets: XlsxSheet[] = Object.entries(live).map(([name, rows]) => {
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
            `attachment; filename="${versionExportFilename(version.type, version.version)}"`
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
