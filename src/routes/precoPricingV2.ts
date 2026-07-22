import express from 'express';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PRECO_PRICING_LIMITER } from '../middleware/rateLimiters';
import { validateData } from '../validators/authSchema';
import { precoPricingUpdateSchema, precoPricingPatchSchema } from '../validators/offerSchemas';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRECO_PRICING_LIMITER;

const RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

let writeLock = false;
const WRITE_TIMEOUT = 30000;

function acquireLock(): Promise<boolean> {
    return new Promise((resolve) => {
        const check = () => {
            if (!writeLock) {
                writeLock = true;
                resolve(true);
                return;
            }
            setTimeout(check, 100);
        };
        check();
        setTimeout(() => resolve(false), WRITE_TIMEOUT);
    });
}

function releaseLock() {
    writeLock = false;
}

// ──────────────────────────────────────────
// formatPrecoResponse — odczyt z Preco* tables → format zagnieżdżony
// Frontend oczekuje: { data: [{ "1000": { skrzynkaWlazowa, cenaPelnaWysMB,
//   cenaDnoOsadnika, kinety: [...] }, "spadekKineta": [...], ... }] }
// ──────────────────────────────────────────
async function formatPrecoResponse(konfigTable: any, kinetyTable: any, zakresyTable: any) {
    const [konfigRows, kinetyRows, zakresyRows] = await Promise.all([
        konfigTable.findMany(),
        kinetyTable.findMany({ orderBy: [{ dn: 'asc' }, { height: 'asc' }] }),
        zakresyTable.findMany({ orderBy: { order: 'asc' } })
    ]);

    if (konfigRows.length === 0 && zakresyRows.length === 0) {
        return { data: [{}] };
    }

    const entry: Record<string, unknown> = {};

    for (const row of konfigRows) {
        const parsed = JSON.parse(row.value);
        const kinety = kinetyRows
            .filter((k: any) => k.dn === Number(row.key))
            .map((k: any) => ({ order: k.order, height: k.height, cena: k.cena }));
        entry[row.key] = { ...parsed, kinety };
    }

    for (const label of RANGE_TYPES) {
        entry[label] = zakresyRows
            .filter((z: any) => z.label === label)
            .map((z: any) => ({ order: z.order, min: z.min, max: z.max }));
    }

    return { data: [entry] };
}

// ──────────────────────────────────────────
// flattenAndSave — format zagnieżdżony → Preco* tables (deleteMany + createMany)
// ──────────────────────────────────────────
async function flattenAndSave(input: Record<string, unknown>, isDefault: boolean) {
    const konfigTable: any = isDefault ? prisma.precoKonfigDefault : prisma.precoKonfig;
    const kinetyTable: any = isDefault ? prisma.precoKinetyDefault : prisma.precoKinety;
    const zakresyTable: any = isDefault ? prisma.precoZakresyDefault : prisma.precoZakresy;

    const konfigRows: { id: string; key: string; value: string }[] = [];
    const kinetyRows: { id: string; order: number; dn: number; height: number; cena: number }[] =
        [];
    const zakresyRows: { id: string; order: number; label: string; min: number; max: number }[] =
        [];
    let kinetyIdx = 0;
    let zakresIdx = 0;

    for (const [key, value] of Object.entries(input)) {
        const dn = Number(key);
        if (
            !Number.isNaN(dn) &&
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
        ) {
            const obj = value as Record<string, unknown>;
            const { kinety, ...scalarFields } = obj;
            konfigRows.push({
                id: `preco_konfig_${key}`,
                key,
                value: JSON.stringify(scalarFields)
            });
            if (Array.isArray(kinety)) {
                for (const k of kinety) {
                    const kin = k as Record<string, unknown>;
                    kinetyRows.push({
                        id: `preco_kinety_${key}_${kinetyIdx}`,
                        order: (kin.order as number) ?? kinetyIdx,
                        dn,
                        height: kin.height as number,
                        cena: kin.cena as number
                    });
                    kinetyIdx++;
                }
            }
        }
    }

    for (const label of RANGE_TYPES) {
        const arr = input[label];
        if (Array.isArray(arr)) {
            for (const item of arr) {
                const it = item as Record<string, unknown>;
                zakresyRows.push({
                    id: `preco_zakres_${label}_${zakresIdx}`,
                    order: (it.order as number) ?? zakresIdx,
                    label,
                    min: it.min as number,
                    max: it.max as number
                });
                zakresIdx++;
            }
        }
    }

    const ops: any[] = [
        konfigTable.deleteMany(),
        kinetyTable.deleteMany(),
        zakresyTable.deleteMany()
    ];
    if (konfigRows.length > 0) ops.push(konfigTable.createMany({ data: konfigRows }));
    if (kinetyRows.length > 0) ops.push(kinetyTable.createMany({ data: kinetyRows }));
    if (zakresyRows.length > 0) ops.push(zakresyTable.createMany({ data: zakresyRows }));

    await prisma.$transaction(ops);
}

// ──────────────────────────────────────────
// GET / — pełna struktura PRECO z Preco* tables
// ──────────────────────────────────────────
router.get('/', requireAuth, async (_req, res) => {
    try {
        const result = await formatPrecoResponse(
            prisma.precoKonfig,
            prisma.precoKinety,
            prisma.precoZakresy
        );
        res.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT / — pełny zapis struktury PRECO (live + default)
// ──────────────────────────────────────────
router.put(
    '/',
    requireAuth,
    writeLimiter,
    validateData(precoPricingUpdateSchema),
    async (req, res) => {
        try {
            const lockAcquired = await acquireLock();
            if (!lockAcquired) {
                res.status(423).json({ error: 'Zasób zablokowany, spróbuj ponownie' });
                return;
            }

            const raw = req.body.data;
            let input: Record<string, unknown>;

            if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
                input = raw[0] as Record<string, unknown>;
            } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                input = raw as Record<string, unknown>;
            } else {
                res.status(400).json({ error: 'Nieprawidłowy format danych' });
                return;
            }

            await flattenAndSave(input, false);
            await flattenAndSave(input, true);
            res.json({ ok: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PUT error', message);
            res.status(500).json({ error: message });
        } finally {
            releaseLock();
        }
    }
);

// ──────────────────────────────────────────
// PATCH / — częściowa aktualizacja
// Odczytuje aktualny stan, głęboko scala DN entry, zapisuje do live
// ──────────────────────────────────────────
router.patch(
    '/',
    requireAuth,
    writeLimiter,
    validateData(precoPricingPatchSchema),
    async (req, res) => {
        try {
            const lockAcquired = await acquireLock();
            if (!lockAcquired) {
                res.status(423).json({ error: 'Zasób zablokowany, spróbuj ponownie' });
                return;
            }

            const patch = req.body.data as Record<string, unknown>;
            if (!patch || typeof patch !== 'object') {
                res.status(400).json({ error: 'Nieprawidłowy format danych' });
                return;
            }

            const current = await formatPrecoResponse(
                prisma.precoKonfig,
                prisma.precoKinety,
                prisma.precoZakresy
            );
            const entry: Record<string, unknown> =
                current.data.length > 0 ? { ...(current.data[0] as Record<string, unknown>) } : {};

            for (const [key, value] of Object.entries(patch)) {
                const dn = Number(key);
                if (
                    !Number.isNaN(dn) &&
                    typeof value === 'object' &&
                    value !== null &&
                    !Array.isArray(value)
                ) {
                    const existing = (entry[key] as Record<string, unknown>) || {};
                    entry[key] = { ...existing, ...(value as Record<string, unknown>) };
                } else if ((RANGE_TYPES as readonly string[]).includes(key)) {
                    entry[key] = value;
                }
            }

            await flattenAndSave(entry, false);
            res.json({ ok: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            logger.error('PrecoPricingV2', 'PATCH error', message);
            res.status(500).json({ error: message });
        } finally {
            releaseLock();
        }
    }
);

// ──────────────────────────────────────────
// GET /default — fabryczne wartości PRECO z Preco*Default tables
// ──────────────────────────────────────────
router.get('/default', requireAuth, async (_req, res) => {
    try {
        const count = await prisma.precoKonfigDefault.count();
        if (count > 0) {
            const result = await formatPrecoResponse(
                prisma.precoKonfigDefault,
                prisma.precoKinetyDefault,
                prisma.precoZakresyDefault
            );
            res.json(result);
            return;
        }
        const liveResult = await formatPrecoResponse(
            prisma.precoKonfig,
            prisma.precoKinety,
            prisma.precoZakresy
        );
        res.json(liveResult);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET /default error', message);
        res.status(500).json({ error: message });
    }
});

export default router;
