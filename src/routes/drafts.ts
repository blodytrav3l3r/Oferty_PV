/**
 * L2: trasy serwerowego draftu (cross-device).
 *
 * Kontrakt HTTP (patrz docs/plans/2026-10-25-draft-l2-server-review.md):
 * - GET    /api/drafts                    → metadane (bez payloadu)
 * - GET    /api/drafts/:kind/:docId       → pełny draft + ETag "<version>"
 * - PUT    /api/drafts/:kind/:docId       → zapis; If-Match wymagany do nadpisania
 * - DELETE /api/drafts/:kind/:docId       → jawne odrzucenie
 *
 * `userId` pochodzi WYŁĄCZNIE z sesji. Klucz tabeli jest per-user, więc cudzy
 * draft jest nieosiągalny na poziomie zapytania — trasa nie musi (i nie może)
 * ujawniać, czy taki wiersz istnieje.
 */
import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { READ_LIMITER, WRITE_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { draftPutBodySchema, parseDraftParams } from '../validators/draftSchemas';
import { deleteDraft, getDraft, listDrafts, saveDraft } from '../services/drafts/draftService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Parsuje `If-Match: "<version>"`. Zwraca:
 * - liczbę → wersja oczekiwana,
 * - `null` → brak nagłówka,
 * - `'invalid'` → nagłówek jest, ale niepoprawny (400, nie ciche pominięcie).
 */
function parseIfMatch(raw: unknown): number | null | 'invalid' {
    if (raw === undefined) return null;
    const text = String(raw).trim().replace(/^W\//, '').replace(/"/g, '');
    if (!text) return 'invalid';
    if (!/^\d+$/.test(text)) return 'invalid';
    const n = Number(text);
    return n >= 1 ? n : 'invalid';
}

/** Wspólny guard: sesja + poprawne parametry trasy. */
function requireDraftTarget(req: express.Request, res: express.Response) {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
        return null;
    }
    const target = parseDraftParams(req.params.kind, req.params.docId);
    if (!target) {
        res.status(400).json({ error: 'Nieprawidłowy rodzaj lub ID dokumentu' });
        return null;
    }
    return { userId, kind: target.kind, docId: target.docId };
}

router.get('/', requireAuth, READ_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) return res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    try {
        const data = await listDrafts(userId);
        return res.json({ data });
    } catch (e) {
        logger.error('Drafts', `Lista draftów nieudana: ${e}`);
        return res.status(500).json({ error: 'Nie udało się pobrać listy draftów' });
    }
});

router.get('/:kind/:docId', requireAuth, READ_LIMITER, async (req, res) => {
    const target = requireDraftTarget(req, res);
    if (!target) return;
    try {
        const draft = await getDraft(target.userId, target.kind, target.docId);
        if (!draft) return res.status(404).json({ error: 'Draft nie istnieje' });
        res.setHeader('ETag', `"${draft.version}"`);
        return res.json({ data: draft });
    } catch (e) {
        logger.error('Drafts', `Odczyt draftu nieudany: ${e}`);
        return res.status(500).json({ error: 'Nie udało się pobrać draftu' });
    }
});

router.put(
    '/:kind/:docId',
    requireAuth,
    WRITE_LIMITER,
    validateData(draftPutBodySchema),
    async (req, res) => {
        const target = requireDraftTarget(req, res);
        if (!target) return;
        const ifMatch = parseIfMatch(req.headers['if-match']);
        if (ifMatch === 'invalid')
            return res.status(400).json({
                error: 'Nieprawidłowy nagłówek If-Match',
                code: 'INVALID_IF_MATCH'
            });
        try {
            const result = await saveDraft({
                userId: target.userId,
                kind: target.kind,
                docId: target.docId,
                payload: req.body?.payload,
                baseVersion: req.body?.baseVersion ?? null,
                ifMatch
            });
            switch (result.status) {
                case 'ok':
                    res.setHeader('ETag', `"${result.version}"`);
                    return res.json({
                        version: result.version,
                        updatedAt: result.updatedAt,
                        bytes: result.bytes
                    });
                case 'conflict':
                    return res.status(409).json({
                        error: 'Draft ma nowszą wersję na serwerze',
                        code: 'DRAFT_CONFLICT',
                        serverVersion: result.serverVersion,
                        serverUpdatedAt: result.serverUpdatedAt
                    });
                case 'precondition_required':
                    // 428 (RFC 6585): brak If-Match to brak warunku wstępnego,
                    // nie „warunek nie zaszedł” (412) i nie konflikt treści.
                    return res.status(428).json({
                        error: 'Draft już istnieje — wymagany nagłówek If-Match',
                        code: 'DRAFT_PRECONDITION_REQUIRED',
                        serverVersion: result.serverVersion
                    });
                case 'not_found':
                    return res.status(404).json({
                        error: 'Draft nie istnieje',
                        code: 'DRAFT_NOT_FOUND'
                    });
                case 'too_large':
                    return res.status(413).json({
                        error: 'Draft przekracza limit rozmiaru',
                        code: 'DRAFT_TOO_LARGE',
                        bytes: result.bytes,
                        limit: result.limit
                    });
                case 'limit':
                    return res.status(409).json({
                        error: 'Limit liczby draftów osiągnięty',
                        code: 'DRAFT_LIMIT',
                        count: result.count,
                        limit: result.limit
                    });
                default:
                    return res.status(400).json({
                        error: 'Payload draftu musi być obiektem JSON',
                        code: 'DRAFT_INVALID_PAYLOAD'
                    });
            }
        } catch (e) {
            logger.error('Drafts', `Zapis draftu nieudany: ${e}`);
            return res.status(500).json({ error: 'Nie udało się zapisać draftu' });
        }
    }
);

router.delete('/:kind/:docId', requireAuth, WRITE_LIMITER, async (req, res) => {
    const target = requireDraftTarget(req, res);
    if (!target) return;
    try {
        // Idempotentny: brak draftu = już osiągnięty stan (204). 404 byłby
        // nieodróżnialny od cudzego draftu i tak, a klient i tak traktuje
        // oba kody jako sukces (draftSyncRemove).
        await deleteDraft(target.userId, target.kind, target.docId);
        return res.status(204).end();
    } catch (e) {
        logger.error('Drafts', `Usunięcie draftu nieudane: ${e}`);
        return res.status(500).json({ error: 'Nie udało się usunąć draftu' });
    }
});

export default router;
