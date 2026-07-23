/**
 * Price Override Service
 *
 * Porównuje LIVE vs DEFAULT dla kazdego modulu:
 * - Rury i Studnie: porownanie wiersz po wierszu przez rowsDiffer()
 * - PRECO: porownanie key-value (konfig), isSameArray (kinety, zakresy)
 *
 * Roznica wynika z tego, ze PRECO ma strukture hierarchiczna (DN -> {konfig + kinety + zakresy}),
 * a nie relacyjna tabele produktow. To nie jest katalog produktow tylko tabela kalkulacyjna.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../prismaClient';
import { logger } from '../utils/logger';

interface RuryOverrides {
    records: Record<string, Record<string, unknown>>;
    deletedIds: string[];
}

interface StudnieOverrides {
    records: Record<string, Record<string, unknown>>;
    deletedIds: string[];
}

// PRECO ma osobny format (konfig/key-value, kinety/tablica, zakresy/tablica),
// bo Preco* tables nie sa plaskie jak ProductsRury/Studnie tylko zagniezdzone
// (JSON w konfigu, osobne tabele dla kinet i zakresow).
// Dlatego computeAll() porownuje Preco*Default z Preco*Live osobno.
interface PrecoOverrides {
    konfig: Record<string, string> | null;
    kinety: Array<{
        order: number;
        dn: number;
        wellDn: number;
        height: number;
        cena: number;
    }> | null;
    zakresy: Array<{
        order: number;
        label: string;
        min: number;
        max: number;
        grupy: string;
        wellDn: number;
    }> | null;
}

interface PriceOverrideData {
    version: 1;
    exportedAt: string;
    rury: RuryOverrides;
    studnie: StudnieOverrides;
    preco: PrecoOverrides;
}

function rowsDiffer(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        if (k === 'id') continue;
        if (String(a[k]) !== String(b[k])) return true;
    }
    return false;
}

function isSameArray(a: unknown[], b: unknown[], ignoreFields: string[] = ['id']): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const aObj = a[i] as Record<string, unknown>;
        const bObj = b[i] as Record<string, unknown>;
        for (const key of Object.keys(aObj)) {
            if (ignoreFields.includes(key)) continue;
            if (String(aObj[key]) !== String(bObj[key])) return false;
        }
    }
    return true;
}

class PriceOverrideService {
    private readonly overridesPath: string;

    constructor() {
        this.overridesPath = path.join(__dirname, '..', '..', 'data', 'price_overrides.json');
    }

    async computeAll(): Promise<PriceOverrideData> {
        const [ruryLive, ruryDef, studnieLive, studnieDef] = await Promise.all([
            prisma.productsRury.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsRuryDefault.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsStudnieDefault.findMany({ orderBy: { id: 'asc' } })
        ]);

        const ruryRecords: Record<string, Record<string, unknown>> = {};
        const ruryDeletedIds: string[] = [];

        {
            const defMap = new Map(ruryDef.map((r) => [r.id, r]));
            for (const live of ruryLive) {
                const def = defMap.get(live.id);
                if (!def) {
                    ruryRecords[live.id] = live as unknown as Record<string, unknown>;
                } else if (
                    rowsDiffer(
                        live as unknown as Record<string, unknown>,
                        def as unknown as Record<string, unknown>
                    )
                ) {
                    ruryRecords[live.id] = live as unknown as Record<string, unknown>;
                }
                defMap.delete(live.id);
            }
            for (const [id] of defMap) ruryDeletedIds.push(id);
        }

        const studnieRecords: Record<string, Record<string, unknown>> = {};
        const studnieDeletedIds: string[] = [];

        {
            const defMap = new Map(studnieDef.map((r) => [r.id, r]));
            for (const live of studnieLive) {
                const def = defMap.get(live.id);
                if (!def) {
                    studnieRecords[live.id] = live as unknown as Record<string, unknown>;
                } else if (
                    rowsDiffer(
                        live as unknown as Record<string, unknown>,
                        def as unknown as Record<string, unknown>
                    )
                ) {
                    studnieRecords[live.id] = live as unknown as Record<string, unknown>;
                }
                defMap.delete(live.id);
            }
            for (const [id] of defMap) studnieDeletedIds.push(id);
        }

        const [konfigLive, konfigDef, kinetyLive, kinetyDef, zakresyLive, zakresyDef] =
            await Promise.all([
                prisma.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
                prisma.precoKonfigDefault.findMany({ orderBy: { key: 'asc' } }),
                prisma.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
                prisma.precoKinetyDefault.findMany({
                    orderBy: [{ wellDn: 'asc' }, { order: 'asc' }]
                }),
                prisma.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
                prisma.precoZakresyDefault.findMany({
                    orderBy: [{ wellDn: 'asc' }, { order: 'asc' }]
                })
            ]);

        const konfigLiveMap = new Map(konfigLive.map((r) => [r.key, r.value]));
        const konfigDefMap = new Map(konfigDef.map((r) => [r.key, r.value]));
        let konfigOverride: Record<string, string> | null = null;
        if (konfigLive.length !== konfigDef.length) {
            konfigOverride = Object.fromEntries(konfigLiveMap);
        } else {
            for (const [key, value] of konfigLiveMap) {
                if (konfigDefMap.get(key) !== value) {
                    konfigOverride = Object.fromEntries(konfigLiveMap);
                    break;
                }
            }
        }

        const kinetyOverride = isSameArray(kinetyLive, kinetyDef)
            ? null
            : kinetyLive.map((k) => ({
                  order: k.order,
                  dn: k.dn,
                  wellDn: k.wellDn,
                  height: k.height,
                  cena: k.cena
              }));

        const zakresyOverride = isSameArray(zakresyLive, zakresyDef)
            ? null
            : zakresyLive.map((z) => ({
                  order: z.order,
                  label: z.label,
                  min: z.min,
                  max: z.max,
                  grupy: z.grupy,
                  wellDn: z.wellDn
              }));

        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            rury: { records: ruryRecords, deletedIds: ruryDeletedIds },
            studnie: { records: studnieRecords, deletedIds: studnieDeletedIds },
            preco: { konfig: konfigOverride, kinety: kinetyOverride, zakresy: zakresyOverride }
        };
    }

    async exportOverrides(): Promise<{
        total: number;
        rury: number;
        studnie: number;
        preco: number;
    }> {
        const data = await this.computeAll();

        const ruryN = Object.keys(data.rury.records).length + data.rury.deletedIds.length;
        const studnieN = Object.keys(data.studnie.records).length + data.studnie.deletedIds.length;
        let precoN = 0;
        if (data.preco.konfig) precoN += Object.keys(data.preco.konfig).length;
        if (data.preco.kinety) precoN += data.preco.kinety.length;
        if (data.preco.zakresy) precoN += data.preco.zakresy.length;

        const hasAny = ruryN > 0 || studnieN > 0 || precoN > 0;

        if (!hasAny) {
            if (fs.existsSync(this.overridesPath)) {
                fs.unlinkSync(this.overridesPath);
                logger.info('PriceOverride', 'Usunięto pusty price_overrides.json');
            }
            return { total: 0, rury: 0, studnie: 0, preco: 0 };
        }

        fs.writeFileSync(this.overridesPath, JSON.stringify(data, null, 2), 'utf-8');
        logger.info(
            'PriceOverride',
            `Nadpisania zapisane: rury=${ruryN}, studnie=${studnieN}, preco=${precoN}`
        );

        return { total: ruryN + studnieN + precoN, rury: ruryN, studnie: studnieN, preco: precoN };
    }

    async applyOverrides(): Promise<void> {
        if (!fs.existsSync(this.overridesPath)) {
            logger.info('PriceOverride', 'Brak price_overrides.json — pomijam');
            return;
        }

        let data: PriceOverrideData;
        try {
            const raw = fs.readFileSync(this.overridesPath, 'utf-8');
            data = JSON.parse(raw) as PriceOverrideData;
        } catch (err) {
            logger.error('PriceOverride', 'Błąd parsowania price_overrides.json', String(err));
            return;
        }

        if (data.version !== 1) {
            logger.error('PriceOverride', `Nieobsługiwana wersja: ${data.version}`);
            return;
        }

        logger.info('PriceOverride', 'Aplikowanie nadpisań...');

        if (Object.keys(data.rury.records).length > 0 || data.rury.deletedIds.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const [id, rec] of Object.entries(data.rury.records)) {
                    await tx.productsRury.upsert({
                        where: { id },
                        update: rec as never,
                        create: rec as never
                    });
                }
                for (const id of data.rury.deletedIds) {
                    await tx.productsRury.delete({ where: { id } }).catch(() => {});
                }
            });
            logger.info(
                'PriceOverride',
                `  Rury: ${Object.keys(data.rury.records).length} ups, ${data.rury.deletedIds.length} del`
            );
        }

        if (Object.keys(data.studnie.records).length > 0 || data.studnie.deletedIds.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const [id, rec] of Object.entries(data.studnie.records)) {
                    await tx.productsStudnie.upsert({
                        where: { id },
                        update: rec as never,
                        create: rec as never
                    });
                }
                for (const id of data.studnie.deletedIds) {
                    await tx.productsStudnie.delete({ where: { id } }).catch(() => {});
                }
            });
            logger.info(
                'PriceOverride',
                `  Studnie: ${Object.keys(data.studnie.records).length} ups, ${data.studnie.deletedIds.length} del`
            );
        }

        const hasPreco =
            data.preco.konfig !== null || data.preco.kinety !== null || data.preco.zakresy !== null;

        if (hasPreco) {
            await prisma.$transaction(async (tx) => {
                if (data.preco.konfig !== null) {
                    await tx.precoKonfig.deleteMany();
                    const rows = Object.entries(data.preco.konfig).map(([key, value]) => ({
                        id: `preco_konfig_${key}`,
                        key,
                        value
                    }));
                    if (rows.length > 0) await tx.precoKonfig.createMany({ data: rows });
                }
                if (data.preco.kinety !== null) {
                    await tx.precoKinety.deleteMany();
                    const rows = data.preco.kinety.map((k, i) => ({
                        id: `preco_kinety_${k.wellDn}_${i}`,
                        order: k.order,
                        dn: k.dn,
                        wellDn: k.wellDn,
                        height: k.height,
                        cena: k.cena
                    }));
                    if (rows.length > 0) await tx.precoKinety.createMany({ data: rows });
                }
                if (data.preco.zakresy !== null) {
                    await tx.precoZakresy.deleteMany();
                    const rows = data.preco.zakresy.map((z, i) => ({
                        id: `preco_zakres_${z.label}_${i}`,
                        order: z.order,
                        label: z.label,
                        min: z.min,
                        max: z.max,
                        grupy: z.grupy,
                        wellDn: z.wellDn
                    }));
                    if (rows.length > 0) await tx.precoZakresy.createMany({ data: rows });
                }
            });
            logger.info(
                'PriceOverride',
                `  PRECO: konfig=${data.preco.konfig ? Object.keys(data.preco.konfig).length : 0}, kinety=${data.preco.kinety ? data.preco.kinety.length : 0}, zakresy=${data.preco.zakresy ? data.preco.zakresy.length : 0}`
            );
        }

        logger.info('PriceOverride', 'Nadpisania zastosowane');
    }
}

export const priceOverrideService = new PriceOverrideService();
