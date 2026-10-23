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
import { PRICELIST_WRITE_LIMITER, READ_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import {
    PRICELIST_TYPES,
    PricelistVersionError,
    activate,
    approveVersion,
    applyBackdate,
    cloneAsDraft,
    createDraft,
    countVersionUsageBatch,
    deleteVersion,
    getPrecoReferences,
    getVersionDiff,
    getVersionExportSheets,
    getVersionPreview,
    getVersionsSummary,
    publishDraft,
    updateDraft
} from '../services/pricelistVersionService';
import prisma from '../prismaClient';
import { deriveState } from '../services/pricelist/validation';
import { getVersionChecks, isChecksStale } from '../services/pricelist/checks';
import { parseIfMatch } from '../services/pricelist/writeTarget';
import { buildXlsx, type XlsxSheet } from '../utils/minimalXlsx';
import { versionExportFilename } from '../utils/exportFilenames';

const router = express.Router();

function sendVersionError(res: express.Response, err: unknown): void {
    if (err instanceof PricelistVersionError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            ...(err.details === undefined ? {} : { details: err.details })
        });
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

/** Id wersji: tylko bezpieczny alfabet (bez echa surowego id w błędzie, plan §5). */
const versionIdParamsSchema = z.object({
    id: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[A-Za-z0-9_-]+$/)
});

function parseVersionId(params: unknown): string | null {
    const parsed = versionIdParamsSchema.safeParse(params);
    return parsed.success ? parsed.data.id : null;
}

function sendInvalidId(res: express.Response): void {
    res.status(400).json({
        error: 'Nieprawidłowy identyfikator wersji',
        code: 'INVALID_ID'
    });
}

const ALIAS_SUNSET = 'Wed, 31 Mar 2027 23:59:59 GMT';

/** S2b: aliasy publish/activate/backdate wygasają na rzecz POST /:id/approve. */
function markDeprecatedAlias(res: express.Response): void {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', ALIAS_SUNSET);
}

/** Lista wersji (opcjonalny filtr ?type=), najnowsze seq pierwsze. */
router.get('/', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const { type } = req.query;
        if (type !== undefined && !isKnownType(type)) {
            res.status(422).json({
                error: 'Nieprawidłowy typ cennika (dozwolone: rury, studnie, preco)',
                code: 'INVALID_TYPE'
            });
            return;
        }
        const nowIso = new Date().toISOString();
        const versions = await prisma.pricelistVersion.findMany({
            where: type === undefined ? undefined : { type },
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        const latestByType = new Map<string, string>();
        for (const v of versions) {
            if (v.status !== 'APPROVED' || v.effectiveFrom > nowIso) continue;
            const current = latestByType.get(v.type);
            if (current === undefined || v.effectiveFrom > current) {
                latestByType.set(v.type, v.effectiveFrom);
            }
        }
        // Ile ofert/zamówień trzyma pieczątkę wersji (pod wyszarzony „Usuń" w FE).
        // F1: rury/studnie liczone batch (4 groupBy na całą listę, nie 4×N).
        // PRECO: jedna mapa referencji studni (getPrecoReferences).
        const hasPreco = versions.some((v) => v.type === 'preco');
        const offerVersionIds = versions.filter((v) => v.type !== 'preco').map((v) => v.id);
        const [precoRefs, usageBatch] = await Promise.all([
            hasPreco ? getPrecoReferences() : Promise.resolve(null),
            countVersionUsageBatch(offerVersionIds)
        ]);
        const withUsage = versions.map((v) => ({
            ...v,
            usedBy:
                v.type === 'preco'
                    ? (precoRefs?.get(v.id)?.count ?? 0)
                    : (usageBatch.get(v.id)?.total ?? 0),
            usedByKind: (v.type === 'preco' ? 'studnieVersions' : 'offers') as
                'studnieVersions' | 'offers'
        }));
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
                state: deriveState(
                    v.status,
                    v.effectiveFrom,
                    new Date(nowIso),
                    latestByType.get(v.type) ?? null
                ),
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
 * Bez requireAdmin: tylko APPROVED z effectiveFrom <= now, tylko id/version/seq/effectiveFrom.
 * Z ?ids=a,b,c (max 50): te wersje BEZ filtra statusu (też archiwalne —
 * pieczątki ofert nie kłamią „legacy"); zły format → 422.
 */
router.get('/labels', requireAuth, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
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
                    ...(req.user?.role === 'admin' ? {} : { status: 'APPROVED' }),
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
                status: 'APPROVED',
                effectiveFrom: { lte: new Date().toISOString() }
            },
            select: { id: true, type: true, seq: true, version: true, effectiveFrom: true },
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        res.json({ versions });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Skrót stanu cenników: aktywna + najbliższa przyszła APPROVED per typ. */
router.get('/summary', requireAuth, requireAdmin, READ_LIMITER, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        res.json(await getVersionsSummary());
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
            const result = await createDraft(type, rows, {
                effectiveFrom,
                note,
                createdBy: userIdOf(req)
            });
            res.status(201).json({ version: result });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Usunięcie: DRAFT zawsze; APPROVED tylko przyszła bez użycia. */
router.delete('/:id', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (req, res) => {
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
            return;
        }
        const result = await deleteVersion(id, { userId: userIdOf(req) });
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
 * Edycja wersji (tylko DRAFT): podmiana wierszy
 * i/lub noty. rows undefined = bez podmiany wierszy (sama nota dozwolona);
 * note undefined = nota bez zmian, pusty string czyści notę. Brak obu → 422.
 * Labelka version niemutowalna (nigdy z inputu).
 */
router.put('/:id', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, async (req, res) => {
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
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
        const version = await updateDraft(id, bodyParsed.data.rows, bodyParsed.data.note, {
            userId: userIdOf(req),
            expectedSha: parseIfMatch(req.get('If-Match'))
        });
        res.json({ version });
    } catch (err) {
        sendVersionError(res, err);
    }
});

/**
 * Publikacja roboczej (DRAFT → APPROVED; stan SCHEDULED/ACTIVE z daty).
 * Domyka lukę klonów: DRAFT nie aktywuje się bezpośrednio.
 */
router.post(
    '/:id/publish',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        markDeprecatedAlias(res);
        try {
            const id = parseVersionId(req.params);
            if (!id) {
                sendInvalidId(res);
                return;
            }
            const version = await publishDraft(id, { userId: userIdOf(req) });
            res.json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Oczekiwano daty ISO'
});

const approveBodySchema = z.object({
    effectiveFrom: isoDateString.optional(),
    note: z.string().optional(),
    checksCheckedAt: isoDateString.optional()
});

/**
 * S2b: docelowa publikacja. effectiveFrom domyślnie z wersji; nota >=10
 * wymagana tylko dla daty z przeszłości (requirePastNote). Checks doradcze:
 * edycja po ich policzeniu daje checksStale=true, nie blokuje (200).
 */
router.post(
    '/:id/approve',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const id = parseVersionId(req.params);
            if (!id) {
                sendInvalidId(res);
                return;
            }
            const parsed = approveBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                res.status(400).json({
                    error: 'Nieprawidłowe dane publikacji (daty ISO, note tekstem)',
                    code: 'INVALID_BODY'
                });
                return;
            }
            const { effectiveFrom, note, checksCheckedAt } = parsed.data;
            const version = await approveVersion(id, {
                userId: userIdOf(req),
                effectiveFrom,
                note,
                requirePastNote: true
            });
            const checkedAtIso =
                checksCheckedAt === undefined ? undefined : new Date(checksCheckedAt).toISOString();
            let checksStale = false;
            if (checkedAtIso !== undefined) {
                try {
                    checksStale = await isChecksStale(id, checkedAtIso);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    logger.warn(
                        'PricelistVersions',
                        'Nie udało się sprawdzić checksStale',
                        message
                    );
                    checksStale = true;
                }
            }
            res.json({ version, checksStale });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Alias aktywacji (due, data <= now); opcjonalna nota → audyt APPROVE. */
router.post(
    '/:id/activate',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        markDeprecatedAlias(res);
        try {
            const id = parseVersionId(req.params);
            if (!id) {
                sendInvalidId(res);
                return;
            }
            const { note } = (req.body ?? {}) as { note?: unknown };
            const version = await activate(id, { userId: userIdOf(req), note });
            res.json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Alias backdate: nota ≥ 10 znaków; kolizja (type, effectiveFrom) → 409. */
router.post(
    '/:id/backdate',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        markDeprecatedAlias(res);
        try {
            const id = parseVersionId(req.params);
            if (!id) {
                sendInvalidId(res);
                return;
            }
            const { note } = req.body as { note?: unknown };
            const version = await applyBackdate(id, note, {
                userId: userIdOf(req)
            });
            res.json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** Faza B: rollback — kopia wierszy dowolnej wersji → nowy DRAFT (seq auto). */
router.post(
    '/:id/clone-draft',
    requireAuth,
    requireAdmin,
    PRICELIST_WRITE_LIMITER,
    async (req, res) => {
        try {
            const id = parseVersionId(req.params);
            if (!id) {
                sendInvalidId(res);
                return;
            }
            const version = await cloneAsDraft(id, { userId: userIdOf(req) });
            res.status(201).json({ version });
        } catch (err) {
            sendVersionError(res, err);
        }
    }
);

/** S2a: cron usunięty — stary endpoint zostaje jako jawne 410 Gone. */
router.post('/activate-due', requireAuth, requireAdmin, PRICELIST_WRITE_LIMITER, (_req, res) => {
    res.status(410).json({
        error: 'Automatyczna aktywacja została usunięta — użyj /publish lub /approve',
        code: 'GONE'
    });
});

/** S1b: read-only checks wersji (advisory, bez CTA). */
router.get('/:id/checks', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
            return;
        }
        res.json(await getVersionChecks(id));
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Id wersji: tylko bezpieczny alfabet (bez echa surowego id w błędzie). */
router.get('/:id/preview', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
            return;
        }
        res.json(await getVersionPreview(id));
    } catch (err) {
        sendVersionError(res, err);
    }
});

/**
 * Diff wersji: bez `against` → seq-1 (legacy), z `against` → dowolna wersja
 * tego samego typu. Zły/niejednoznaczny `against` → 400 bez echa wejścia.
 */
router.get('/:id/diff', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
            return;
        }
        let againstId: string | undefined;
        if (req.query.against !== undefined) {
            const parsedAgainst = versionIdParamsSchema.shape.id.safeParse(req.query.against);
            if (!parsedAgainst.success) {
                res.status(400).json({
                    error: 'Nieprawidłowy identyfikator wersji bazowej',
                    code: 'INVALID_QUERY'
                });
                return;
            }
            againstId = parsedAgainst.data;
        }
        if (againstId === id) {
            res.status(400).json({
                error: 'Wersja bazowa porównania musi być inna niż porównywana',
                code: 'INVALID_QUERY'
            });
            return;
        }
        res.json(await getVersionDiff(id, againstId));
    } catch (err) {
        sendVersionError(res, err);
    }
});

/** Eksport wersji do XLSX — shape 1:1 z eksportem LIVE (studnie + PRECO same-seq jak F1). */
router.get('/:id/export', requireAuth, requireAdmin, READ_LIMITER, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const id = parseVersionId(req.params);
        if (!id) {
            sendInvalidId(res);
            return;
        }
        const { version, sheets: live, precoIncluded } = await getVersionExportSheets(id);
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
