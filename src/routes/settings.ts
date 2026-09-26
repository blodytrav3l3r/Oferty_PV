import express from 'express';
import prisma from '../prismaClient';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateData } from '../validators/authSchema';
import {
    yearLetterSchema,
    magazynCodesSchema,
    DEFAULT_MAGAZYN_CODES
} from '../validators/offerSchemas';
import { logger } from '../utils/logger';

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
        logger.error('Settings', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
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

            await prisma.settings.upsert({
                where: { key },
                update: { value: letter.toUpperCase() },
                create: { key, value: letter.toUpperCase() }
            });

            res.json({ ok: true, letter: letter.toUpperCase(), year });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Settings', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

/* ===== KODY MAGAZYNÓW (słownik MAGAZYN dennica/nadbudowa) ===== */

const MAGAZYN_CODES_KEY = 'magazyn_codes';

function parseMagazynCodes(raw: string | null | undefined) {
    if (!raw) return { ...DEFAULT_MAGAZYN_CODES };
    try {
        const parsed = magazynCodesSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
    } catch {
        // uszkodzony JSON — fallback do domyślnych
    }
    return { ...DEFAULT_MAGAZYN_CODES };
}

router.get('/magazyn-codes', requireAuth, async (_req, res) => {
    try {
        const row = await prisma.settings.findUnique({
            where: { key: MAGAZYN_CODES_KEY }
        });
        res.json(parseMagazynCodes(row ? row.value : null));
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Settings', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

router.put(
    '/magazyn-codes',
    requireAuth,
    requireAdmin,
    validateData(magazynCodesSchema),
    async (req, res) => {
        try {
            const codes = req.body;

            await prisma.settings.upsert({
                where: { key: MAGAZYN_CODES_KEY },
                update: { value: JSON.stringify(codes) },
                create: { key: MAGAZYN_CODES_KEY, value: JSON.stringify(codes) }
            });

            res.json(codes);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('Settings', 'Błąd serwera', message);
            res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
        }
    }
);

/* ===== ODCZYT USTAWIENIA PO KLUCZU (allowlista) ===== */
// Wildcard bez allowlisty pozwalał każdemu zalogowanemu czytać wewnętrzne
// klucze (flagi AI/timestamps). Frontend używa tylko
// pricelist_defaults_updated_at (priceDefaults.js) — reszta ma dedykowane trasy.
const SETTINGS_READ_ALLOWLIST = new Set(['pricelist_defaults_updated_at']);
const SETTINGS_READ_PATTERN = /^year_letter_\d{4}$/;

router.get('/:key', requireAuth, async (req, res) => {
    try {
        const { key } = req.params;
        if (!SETTINGS_READ_ALLOWLIST.has(key) && !SETTINGS_READ_PATTERN.test(key)) {
            res.status(404).json({ error: 'Ustawienie nie istnieje' });
            return;
        }
        const row = await prisma.settings.findUnique({
            where: { key }
        });
        res.json({ key, value: row ? row.value : null });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Settings', 'Błąd serwera', message);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

export default router;
