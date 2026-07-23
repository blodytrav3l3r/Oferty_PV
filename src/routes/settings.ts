import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateData } from '../validators/authSchema';
import { yearLetterSchema } from '../validators/offerSchemas';

const router = express.Router();

/* ===== LITERA ROKU (Litera roku obrotowego) ===== */

router.get('/year-letter', requireAuth, async (_req, res) => {
    try {
        const year = new Date().getFullYear();
        const key = 'year_letter_' + year;
        const row = await prisma.settings.findUnique({
            where: { key }
        });
        res.json({ letter: row ? row.value : '', year });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

router.put(
    '/year-letter',
    requireAuth,
    requireAdmin,
    validateData(yearLetterSchema),
    async (req, res) => {
        try {
            const { letter } = req.body;

            const year = new Date().getFullYear();
            const key = 'year_letter_' + year;

            try {
                await prisma.settings.update({
                    where: { key },
                    data: { value: letter.toUpperCase() }
                });
            } catch {
                await prisma.settings.create({
                    data: { key, value: letter.toUpperCase() }
                });
            }

            res.json({ ok: true, letter: letter.toUpperCase(), year });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    }
);

/* ===== ODCZYT DOWOLNEGO USTAWIENIA PO KLUCZU ===== */

router.get('/:key', requireAuth, async (req, res) => {
    try {
        const { key } = req.params;
        const row = await prisma.settings.findUnique({
            where: { key }
        });
        res.json({ key, value: row ? row.value : null });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
});

export default router;
