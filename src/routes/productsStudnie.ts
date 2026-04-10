import express from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

/* ===== CENNIK STUDNI — zapis/odczyt z tabeli settings (JSON) ===== */

const KEY_CURRENT = 'pricelist_studnie';
const KEY_DEFAULT = 'pricelist_studnie_default';
const LEGACY_TABLE = 'products_studnie_rel';

/**
 * Jednorazowa migracja: jeśli klucz pricelist_studnie nie istnieje,
 * kopiuje dane ze starej tabeli relacyjnej products_studnie_rel.
 */
async function migrateFromLegacyIfNeeded(): Promise<void> {
    try {
        const existing = await prisma.settings.findUnique({
            where: { key: KEY_CURRENT }
        });
        if (existing) return; // już zmigrowane

        // Sprawdź, czy stara tabela istnieje i ma dane
        let rows: any[] = [];
        try {
            rows = await (prisma as any)[LEGACY_TABLE].findMany();
        } catch (_e) {
            // Tabela nie istnieje — brak danych do migracji
            return;
        }

        if (rows.length === 0) return;

        // Spłaszcz kolumnę data JSON do głównego obiektu
        const products = rows.map((row: any) => {
            let extra = {};
            try {
                if (row.data) extra = JSON.parse(row.data);
            } catch (_e) {}
            const { data, ...rest } = row;
            return { ...rest, ...extra };
        });

        const json = JSON.stringify(products);
        try {
            await prisma.settings.update({
                where: { key: KEY_CURRENT },
                data: { value: json }
            });
        } catch {
            await prisma.settings.create({
                data: { key: KEY_CURRENT, value: json }
            });
        }
        console.log(
            `[Migracja] Przeniesiono ${products.length} produktów studni do nowego formatu JSON.`
        );
    } catch (err: any) {
        console.error('[Migracja studnie] Błąd:', err.message);
    }

    // Migracja starych wartości fabrycznych (klucz 'default_studnie' → KEY_DEFAULT)
    try {
        const oldDefault = await prisma.settings.findUnique({
            where: { key: 'default_studnie' }
        });
        if (oldDefault && oldDefault.value) {
            const existingNew = await prisma.settings.findUnique({
                where: { key: KEY_DEFAULT }
            });
            if (!existingNew) {
                await prisma.settings.upsert({
                    where: { key: KEY_DEFAULT },
                    update: { value: oldDefault.value },
                    create: { key: KEY_DEFAULT, value: oldDefault.value }
                });
                console.log('[Migracja] Przeniesiono wartości fabryczne studni do nowego klucza.');
            }
        }
    } catch (err: any) {
        console.error('[Migracja default_studnie] Błąd:', err.message);
    }
}

// Uruchom migrację przy starcie
migrateFromLegacyIfNeeded();

// ──────────────────────────────────────────
// GET /api/products-studnie → Pobiera bieżący cennik studni
// ──────────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const row = await prisma.settings.findUnique({
            where: { key: KEY_CURRENT }
        });
        const data = row ? JSON.parse(row.value || '[]') : [];
        res.json({ data });
    } catch (err: any) {
        console.error('[GET /api/products-studnie] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie → Zapisuje bieżący cennik studni
// ──────────────────────────────────────────
router.put('/', requireAuth as any, async (req, res) => {
    try {
        const arr = req.body.data;
        if (!Array.isArray(arr)) {
            return res.status(400).json({ error: 'Dane muszą być tablicą' });
        }

        const json = JSON.stringify(arr);
        try {
            await prisma.settings.update({
                where: { key: KEY_CURRENT },
                data: { value: json }
            });
        } catch {
            await prisma.settings.create({
                data: { key: KEY_CURRENT, value: json }
            });
        }

        res.json({ ok: true, count: arr.length });
    } catch (err: any) {
        console.error('[PUT /api/products-studnie] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ──────────────────────────────────────────
// GET /api/products-studnie/default → Pobiera wartości fabryczne studni
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const row = await prisma.settings.findUnique({
            where: { key: KEY_DEFAULT }
        });
        const data = row ? JSON.parse(row.value || '[]') : [];
        res.json({ data });
    } catch (err: any) {
        console.error('[GET /api/products-studnie/default] Błąd:', err.message);
        res.json({ data: [] });
    }
});

// ──────────────────────────────────────────
// PUT /api/products-studnie/default → Zapisuje wartości fabryczne studni
// ──────────────────────────────────────────
router.put('/default', requireAuth as any, async (req, res) => {
    try {
        const arr = req.body.data || [];
        const json = JSON.stringify(arr);
        try {
            await prisma.settings.update({
                where: { key: KEY_DEFAULT },
                data: { value: json }
            });
        } catch {
            await prisma.settings.create({
                data: { key: KEY_DEFAULT, value: json }
            });
        }

        res.json({ ok: true, count: arr.length });
    } catch (err: any) {
        console.error('[PUT /api/products-studnie/default] Błąd:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
