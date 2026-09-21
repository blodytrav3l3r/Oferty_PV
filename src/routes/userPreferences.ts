import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validateData } from '../validators/authSchema';
import { userPreferenceSchema } from '../validators/offerSchemas';
import { logger } from '../utils/logger';

const router = express.Router();

/* ===== PREFERENCJE ZALOGOWANEGO UŻYTKOWNIKA (m.in. motyw light/dark) =====
   Montowane pod /api/users/me — wyłącznie własne preferencje,
   każdy zalogowany czyta/zapisuje tylko swoje (izolacja po userId). */

// GET /api/users/me/preferences — mapa { klucz: wartość }
router.get('/preferences', requireAuth, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
        const rows = await prisma.user_preferences.findMany({
            where: { userId: authReq.user!.id }
        });
        const preferences: Record<string, string | null> = {};
        for (const row of rows) preferences[row.key] = row.value;
        res.json({ preferences });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('UserPreferences', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

// PUT /api/users/me/preferences { key, value } — upsert własnej preferencji
router.put('/preferences', requireAuth, validateData(userPreferenceSchema), async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { key, value } = req.body;
    try {
        await prisma.user_preferences.upsert({
            where: { userId_key: { userId: authReq.user!.id, key } },
            update: { value },
            create: { userId: authReq.user!.id, key, value }
        });
        res.json({ ok: true, key, value });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('UserPreferences', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
