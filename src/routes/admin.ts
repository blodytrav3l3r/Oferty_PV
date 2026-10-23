import express from 'express';
import { requireAuth, requireAdmin, getActiveSessionsByUser } from '../middleware/auth';
import { ADMIN_USERS_LIMITER } from '../middleware/rateLimiters';
import { revokeSessionsForAdmin } from '../services/sessionAdmin';
import { mapPrismaError } from '../utils/prismaErrors';
import { logger } from '../utils/logger';
import { ftsSyncStatus, rebuildFts5 } from '../utils/fts5Sync';

const router = express.Router();

const adminSessionsLimiter = ADMIN_USERS_LIMITER;

/* P1-B: FTS to dane pochodne — status i rebuild wyłącznie dla admina. */

// GET /api/admin/fts-status — szybka kontrola spójności (tylko odczyty).
router.get('/fts-status', requireAuth, requireAdmin, async (_req, res) => {
    try {
        res.json(await ftsSyncStatus());
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Admin', 'Błąd fts-status', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// POST /api/admin/fts-rebuild — pełna przebudowa z tabel biznesowych.
// Wyłącznie na żądanie (nigdy automatycznie): długi zapis na dużej bazie.
router.post('/fts-rebuild', requireAuth, requireAdmin, async (_req, res) => {
    try {
        let done = 0;
        const total = await rebuildFts5((n) => {
            done = n;
        });
        res.json({ ok: true, rows: total, lastProgress: done });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Admin', 'Błąd fts-rebuild', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

/* ===== Sesje — widok i wymuszone wylogowanie (admin) ===== */

// GET /api/admin/sessions — aktywne sesje per użytkownik (bez tokenów).
// Reguła wygaśnięcia wspólna z requireAuth (isSessionActive).
router.get('/sessions', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const data = await getActiveSessionsByUser();
        res.json({
            ok: true,
            data,
            summary: {
                activeUsers: data.length,
                activeSessions: data.reduce((n, u) => n + u.sessionCount, 0),
                // data jest posortowane malejąco — pierwszy wpis to max.
                lastActivityAt: data.length > 0 ? data[0].lastActivityAt : null,
                generatedAt: Date.now()
            }
        });
    } catch (e) {
        logger.error('Admin', 'Błąd listy sesji', e);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// DELETE /api/admin/sessions/:userId — wylogowanie wszystkich sesji użytkownika.
// Idempotentne: 0 = brak aktywnych sesji w chwili wywołania (także gdy konto
// zniknęło między odczytem a kasowaniem) — nie jest to błąd.
router.delete(
    '/sessions/:userId',
    requireAuth,
    requireAdmin,
    adminSessionsLimiter,
    async (req, res) => {
        const userId = String(req.params.userId || '').trim();
        if (!userId || userId.length > 64) {
            res.status(400).json({ error: 'Nieprawidłowy identyfikator użytkownika' });
            return;
        }
        // Self-revoke blokujemy: admin nie odcina się w połowie operacji.
        if (req.user && req.user.id === userId) {
            res.status(400).json({
                error: 'Nie można wylogować własnej sesji — użyj przycisku Wyloguj',
                code: 'SELF_REVOKE_BLOCKED'
            });
            return;
        }
        try {
            const result = await revokeSessionsForAdmin(userId, req.user!.id);
            if (!result) {
                res.status(404).json({ error: 'Użytkownik nie istnieje', code: 'NOT_FOUND' });
                return;
            }
            res.json({ ok: true, revoked: result.revoked });
        } catch (e) {
            if (mapPrismaError(res, e)) return;
            logger.error('Admin', 'Błąd revoke sesji', e);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

export default router;
