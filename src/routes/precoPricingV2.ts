import express from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PRECO_PRICING_LIMITER } from '../middleware/rateLimiters';
import { readPricelist, writePricelist } from '../services/pricelistService';
import prisma from '../prismaClient';

const router = express.Router();
const writeLimiter = PRECO_PRICING_LIMITER;

const SETTINGS_KEY_DEFAULT = 'preco_pricing_default';

type PrecoEntry = Record<string, unknown>;

// Seed PRECO tables przy starcie jeśli puste
(async function seedPrecoTables() {
    try {
        const count = await prisma.precoKonfig.count();
        if (count > 0) return;
        const seedPath = path.resolve('data/seed_preco.json');
        if (!fs.existsSync(seedPath)) return;
        const raw = fs.readFileSync(seedPath, 'utf-8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return;
        const input = data[0] as PrecoEntry;
        await savePrecoData(input);
        logger.info('PrecoPricingV2', 'Zainicjalizowano tabele PRECO z seed');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('PrecoPricingV2', 'Seed PRECO skipped:', message);
    }
})();

// ──────────────────────────────────────────
// Pomocnik: buduje strukturę PRECO z 3 tabel
// ──────────────────────────────────────────
async function buildPrecoResponse(): Promise<PrecoEntry> {
    const konfigRows = await prisma.precoKonfig.findMany();
    const kinetyRows = await prisma.precoKinety.findMany();
    const zakresyRows = await prisma.precoZakresy.findMany();

    const kinetyByDn = new Map<number, { dn: number; prosta: number; dodWlot: number }[]>();
    for (const k of kinetyRows) {
        const arr = kinetyByDn.get(k.dnStudni) ?? [];
        arr.push({ dn: k.dnRury, prosta: k.prosta, dodWlot: k.dodWlot });
        kinetyByDn.set(k.dnStudni, arr);
    }

    // Grupuj zakresy per-DN + per-typ
    const zakresyByDn = new Map<number, Map<string, Map<string, { min: number; max: number; grupy: Record<string, number> }>>>();

    for (const z of zakresyRows) {
        const dn = z.dnStudni ?? 1000; // fallback dla starych wierszy
        if (!zakresyByDn.has(dn)) zakresyByDn.set(dn, new Map());
        const byTyp = zakresyByDn.get(dn)!;
        if (!byTyp.has(z.typ)) byTyp.set(z.typ, new Map<string, { min: number; max: number; grupy: Record<string, number> }>());
        const grouped = byTyp.get(z.typ)!;
        const key = `${z.minVal}|${z.maxVal}`;
        if (!grouped.has(key)) {
            grouped.set(key, { min: z.minVal, max: z.maxVal, grupy: {} });
        }
        grouped.get(key)!.grupy[z.grupaDn] = z.cena;
    }

    const result: PrecoEntry = {};
    for (const konfig of konfigRows) {
        const dnKey = String(konfig.dnStudni);
        const byTyp = zakresyByDn.get(konfig.dnStudni) ?? new Map();
        const getRanges = (typ: string) => {
            const grouped = byTyp.get(typ);
            return grouped ? [...grouped.values()].sort((a, b) => a.min - b.min) : [];
        };
        result[dnKey] = {
            kinety: kinetyByDn.get(konfig.dnStudni) ?? [],
            spadekKineta: getRanges('spadekKineta'),
            spadekMufa: getRanges('spadekMufa'),
            uniesienie: getRanges('uniesienie'),
            redukcja: getRanges('redukcja'),
            skrzynkaWlazowa: konfig.skrzynkaWlazowa,
            cenaPelnaWysMB: konfig.cenaPelnaWysMB,
            cenaDnoOsadnika: konfig.cenaDnoOsadnika
        };
    }

    return result;
}

// ──────────────────────────────────────────
// Pomocnik: zapisuje strukturę PRECO do 3 tabel
// ──────────────────────────────────────────
async function savePrecoData(input: PrecoEntry): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await tx.precoKonfig.deleteMany();
        await tx.precoKinety.deleteMany();
        await tx.precoZakresy.deleteMany();

        const zakresyRows: { dnStudni: number; typ: string; minVal: number; maxVal: number; grupaDn: string; cena: number }[] = [];
        const seenZakresy = new Set<string>();

        for (const [dnKey, entry] of Object.entries(input)) {
            const dnStudni = Number(dnKey);
            if (isNaN(dnStudni)) continue;

            const e = entry as Record<string, unknown>;

            await tx.precoKonfig.create({
                data: {
                    dnStudni,
                    skrzynkaWlazowa: Number(e.skrzynkaWlazowa ?? 0),
                    cenaPelnaWysMB: Number(e.cenaPelnaWysMB ?? 0),
                    cenaDnoOsadnika: Number(e.cenaDnoOsadnika ?? 0)
                }
            });

            const kinety = e.kinety as Array<{ dn: number; prosta: number; dodWlot: number }> | undefined;
            if (kinety) {
                for (const k of kinety) {
                    await tx.precoKinety.create({
                        data: {
                            dnStudni,
                            dnRury: Number(k.dn),
                            prosta: Number(k.prosta),
                            dodWlot: Number(k.dodWlot)
                        }
                    });
                }
            }

            const rangeTypes = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;
            for (const typ of rangeTypes) {
                const ranges = e[typ] as Array<{ min: number; max: number; grupy: Record<string, number> }> | undefined;
                    if (ranges) {
                        for (const r of ranges) {
                            for (const [grupaDn, cena] of Object.entries(r.grupy ?? {})) {
                                const key = `${dnStudni}|${typ}|${r.min}|${r.max}|${grupaDn}`;
                                if (seenZakresy.has(key)) continue;
                                seenZakresy.add(key);
                                zakresyRows.push({
                                    dnStudni,
                                    typ,
                                    minVal: Number(r.min),
                                    maxVal: Number(r.max),
                                    grupaDn,
                                    cena: Number(cena)
                                });
                            }
                        }
                    }
            }
        }

        for (const z of zakresyRows) {
            await tx.precoZakresy.create({ data: z });
        }
    });
}

// ──────────────────────────────────────────
// GET / — pełna struktura PRECO z 3 tabel
// ──────────────────────────────────────────
router.get('/', async (_req, res) => {
    try {
        const result = await buildPrecoResponse();
        res.json({ data: [result] });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PUT / — pełny zapis struktury PRECO
// ──────────────────────────────────────────
router.put('/', requireAuth, writeLimiter, async (req, res) => {
    try {
        const raw = req.body.data;
        let input: PrecoEntry;

        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
            input = raw[0] as PrecoEntry;
        } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            input = raw as PrecoEntry;
        } else {
            res.status(400).json({ error: 'Nieprawidłowy format danych' });
            return;
        }

        await savePrecoData(input);
        res.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'PUT error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// PATCH / — częściowa aktualizacja
// Body: { data: { "1000": { skrzynkaWlazowa: 500 }, "spadekKineta": [...] } }
// ──────────────────────────────────────────
router.patch('/', requireAuth, writeLimiter, async (req, res) => {
    try {
        const patch = req.body.data;
        if (!patch || typeof patch !== 'object') {
            res.status(400).json({ error: 'Nieprawidłowy format danych' });
            return;
        }

        await prisma.$transaction(async (tx) => {
            const rangeTypes = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'] as const;

            for (const [key, value] of Object.entries(patch)) {
                const dnStudni = Number(key);

                if (!isNaN(dnStudni) && typeof value === 'object' && value !== null) {
                    const entry = value as Record<string, unknown>;

                    if (entry.skrzynkaWlazowa !== undefined || entry.cenaPelnaWysMB !== undefined || entry.cenaDnoOsadnika !== undefined) {
                        const existing = await tx.precoKonfig.findUnique({ where: { dnStudni } });
                        const updateData: Record<string, unknown> = {};
                        if (entry.skrzynkaWlazowa !== undefined) updateData.skrzynkaWlazowa = Number(entry.skrzynkaWlazowa);
                        if (entry.cenaPelnaWysMB !== undefined) updateData.cenaPelnaWysMB = Number(entry.cenaPelnaWysMB);
                        if (entry.cenaDnoOsadnika !== undefined) updateData.cenaDnoOsadnika = Number(entry.cenaDnoOsadnika);

                        if (existing) {
                            await tx.precoKonfig.update({ where: { dnStudni }, data: updateData });
                        } else {
                            await tx.precoKonfig.create({
                                data: {
                                    dnStudni,
                                    skrzynkaWlazowa: Number(entry.skrzynkaWlazowa ?? 0),
                                    cenaPelnaWysMB: Number(entry.cenaPelnaWysMB ?? 0),
                                    cenaDnoOsadnika: Number(entry.cenaDnoOsadnika ?? 0)
                                }
                            });
                        }
                    }

                    if (entry.kinety !== undefined) {
                        await tx.precoKinety.deleteMany({ where: { dnStudni } });
                        const kinety = entry.kinety as Array<{ dn: number; prosta: number; dodWlot: number }>;
                        if (kinety) {
                            for (const k of kinety) {
                                await tx.precoKinety.create({
                                    data: { dnStudni, dnRury: Number(k.dn), prosta: Number(k.prosta), dodWlot: Number(k.dodWlot) }
                                });
                            }
                        }
                    }
                }

                if (rangeTypes.includes(key as typeof rangeTypes[number])) {
                    await tx.precoZakresy.deleteMany({ where: { typ: key, dnStudni: null } });
                    const ranges = value as Array<{ min: number; max: number; grupy: Record<string, number> }>;
                    if (ranges) {
                        for (const r of ranges) {
                            for (const [grupaDn, cena] of Object.entries(r.grupy ?? {})) {
                                await tx.precoZakresy.create({
                                    data: { dnStudni: null, typ: key, minVal: Number(r.min), maxVal: Number(r.max), grupaDn, cena: Number(cena) }
                                });
                            }
                        }
                    }
                }
            }
        });

        res.json({ ok: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'PATCH error', message);
        res.status(500).json({ error: message });
    }
});

// ──────────────────────────────────────────
// GET /default — fabryczne wartości PRECO
// ──────────────────────────────────────────
router.get('/default', async (_req, res) => {
    try {
        const data = await readPricelist(SETTINGS_KEY_DEFAULT);
        if (Array.isArray(data) && data.length > 0) {
            res.json({ data });
            return;
        }
        const result = await buildPrecoResponse();
        const hasData = Object.keys(result).length > 0;
        if (hasData) {
            const arr = [result];
            await writePricelist(SETTINGS_KEY_DEFAULT, arr as unknown as Record<string, unknown>[]);
            res.json({ data: arr });
        } else {
            res.json({ data: [] });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('PrecoPricingV2', 'GET /default error', message);
        res.json({ data: [] });
    }
});

export default router;
