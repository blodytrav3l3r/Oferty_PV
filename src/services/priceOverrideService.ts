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
import { DN_SIZES, ZAKRESY_TYPES } from '../constants/precoSizes';

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

interface PriceDefaultsJson {
    version: 1;
    exportedAt: string;
    rury: Record<string, unknown>[];
    studnie: Record<string, unknown>[];
    preco: {
        konfig: Record<string, unknown>[];
        kinety: Record<string, unknown>[];
        zakresy: Record<string, unknown>[];
    };
}

function safeJsonParse(val: string, fallback: unknown = {}): unknown {
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

class PriceOverrideService {
    private readonly overridesPath: string;
    private readonly defaultsPath: string;
    private readonly dataDir: string;

    constructor() {
        this.overridesPath = path.join(__dirname, '..', '..', 'data', 'price_overrides.json');
        this.defaultsPath = path.join(__dirname, '..', '..', 'data', 'price_defaults.json');
        this.dataDir = path.dirname(this.defaultsPath);
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

    async saveDefaults(): Promise<{
        rury: number;
        studnie: number;
        precoKonfig: number;
        precoKinety: number;
        precoZakresy: number;
    }> {
        logger.info('PriceOverride', 'Zapisywanie bieżącego stanu jako domyślne...');

        const [ruryLive, studnieLive, konfigLive, kinetyLive, zakresyLive] = await Promise.all([
            prisma.productsRury.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } }),
            prisma.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
            prisma.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
            prisma.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
        ]);

        await prisma.$transaction(async (tx) => {
            await tx.productsRuryDefault.deleteMany();
            await tx.productsStudnieDefault.deleteMany();
            await tx.precoKonfigDefault.deleteMany();
            await tx.precoKinetyDefault.deleteMany();
            await tx.precoZakresyDefault.deleteMany();

            if (ruryLive.length > 0) await tx.productsRuryDefault.createMany({ data: ruryLive });
            if (studnieLive.length > 0)
                await tx.productsStudnieDefault.createMany({ data: studnieLive });
            if (konfigLive.length > 0) await tx.precoKonfigDefault.createMany({ data: konfigLive });
            if (kinetyLive.length > 0) await tx.precoKinetyDefault.createMany({ data: kinetyLive });
            if (zakresyLive.length > 0)
                await tx.precoZakresyDefault.createMany({ data: zakresyLive });
        });

        const now = new Date().toISOString();
        const jsonData: PriceDefaultsJson = {
            version: 1,
            exportedAt: now,
            rury: ruryLive as unknown as Record<string, unknown>[],
            studnie: studnieLive as unknown as Record<string, unknown>[],
            preco: {
                konfig: konfigLive as unknown as Record<string, unknown>[],
                kinety: kinetyLive as unknown as Record<string, unknown>[],
                zakresy: zakresyLive as unknown as Record<string, unknown>[]
            }
        };

        fs.writeFileSync(this.defaultsPath, JSON.stringify(jsonData, null, 2), 'utf-8');

        await this.syncSeedFiles(ruryLive, studnieLive, konfigLive, kinetyLive, zakresyLive);

        await prisma.settings.upsert({
            where: { key: 'pricelist_defaults_updated_at' },
            update: { value: now },
            create: { key: 'pricelist_defaults_updated_at', value: now }
        });

        logger.info(
            'PriceOverride',
            `Domyślne zapisane: rury=${ruryLive.length}, studnie=${studnieLive.length}, preco=${konfigLive.length + kinetyLive.length + zakresyLive.length}`
        );

        return {
            rury: ruryLive.length,
            studnie: studnieLive.length,
            precoKonfig: konfigLive.length,
            precoKinety: kinetyLive.length,
            precoZakresy: zakresyLive.length
        };
    }

    private async syncSeedFiles(
        ruryLive: Record<string, unknown>[],
        studnieLive: Record<string, unknown>[],
        konfigLive: Array<{ id: string; key: string; value: string }>,
        kinetyLive: Array<{
            id: string;
            order: number;
            dn: number;
            wellDn: number;
            height: number;
            cena: number;
        }>,
        zakresyLive: Array<{
            id: string;
            order: number;
            label: string;
            min: number;
            max: number;
            grupy: string;
            wellDn: number;
        }>
    ): Promise<void> {
        try {
            fs.writeFileSync(
                path.join(this.dataDir, 'seed_rury.json'),
                JSON.stringify(ruryLive, null, 2),
                'utf-8'
            );

            fs.writeFileSync(
                path.join(this.dataDir, 'seed_studnie.json'),
                JSON.stringify(studnieLive, null, 2),
                'utf-8'
            );

            const konfigByKey = new Map(konfigLive.map((k) => [k.key, k]));
            const kinetyByDn = new Map<number, typeof kinetyLive>();
            for (const k of kinetyLive) {
                const arr = kinetyByDn.get(k.wellDn);
                if (arr) arr.push(k);
                else kinetyByDn.set(k.wellDn, [k]);
            }
            const zakresyByDn = new Map<number, typeof zakresyLive>();
            for (const z of zakresyLive) {
                const arr = zakresyByDn.get(z.wellDn);
                if (arr) arr.push(z);
                else zakresyByDn.set(z.wellDn, [z]);
            }
            const precoObj: Record<string, unknown> = {};
            for (const dnStr of DN_SIZES) {
                const dn = Number(dnStr);
                const konfig = konfigByKey.get(dnStr);
                if (!konfig) continue;
                const scalars = safeJsonParse(konfig.value) as Record<string, unknown>;
                const entry: Record<string, unknown> = {
                    skrzynkaWlazowa: scalars.skrzynkaWlazowa,
                    cenaPelnaWysMB: scalars.cenaPelnaWysMB,
                    cenaDnoOsadnika: scalars.cenaDnoOsadnika
                };
                const kinety = kinetyByDn.get(dn);
                if (kinety) {
                    entry.kinety = kinety.map((k) => ({
                        dn: k.dn,
                        prosta: k.height,
                        dodWlot: k.cena
                    }));
                }
                const zakresy = zakresyByDn.get(dn);
                if (zakresy) {
                    for (const typ of ZAKRESY_TYPES) {
                        const entries = zakresy
                            .filter((z) => z.label === typ)
                            .sort((a, b) => a.order - b.order)
                            .map((z) => ({
                                min: z.min,
                                max: z.max,
                                grupy: safeJsonParse(z.grupy)
                            }));
                        if (entries.length > 0) entry[typ] = entries;
                    }
                }
                precoObj[dnStr] = entry;
            }

            fs.writeFileSync(
                path.join(this.dataDir, 'seed_preco.json'),
                JSON.stringify([precoObj], null, 2),
                'utf-8'
            );

            logger.info(
                'PriceOverride',
                `Seed zaktualizowane: rury=${ruryLive.length}, studnie=${studnieLive.length}, preco=${konfigLive.length} konfig`
            );
        } catch (err) {
            logger.error('PriceOverride', 'Błąd zapisu seed_*.json', String(err));
        }
    }

    async restoreDefaultsFromJson(): Promise<void> {
        if (!fs.existsSync(this.defaultsPath)) {
            logger.info('PriceOverride', 'Brak price_defaults.json — pomijam');
            return;
        }

        let data: PriceDefaultsJson;
        try {
            const raw = fs.readFileSync(this.defaultsPath, 'utf-8');
            data = JSON.parse(raw) as PriceDefaultsJson;
        } catch (err) {
            logger.error('PriceOverride', 'Błąd parsowania price_defaults.json', String(err));
            return;
        }

        if (data.version !== 1) {
            logger.error(
                'PriceOverride',
                `Nieobsługiwana wersja price_defaults.json: ${data.version}`
            );
            return;
        }

        logger.info('PriceOverride', 'Przywracanie domyślnych cenników z JSON...');

        if (
            !data.preco ||
            !Array.isArray(data.preco.konfig) ||
            !Array.isArray(data.preco.kinety) ||
            !Array.isArray(data.preco.zakresy)
        ) {
            logger.error(
                'PriceOverride',
                'Nieprawidłowa struktura price_defaults.json - brak preco'
            );
            return;
        }
        if (!Array.isArray(data.rury)) {
            logger.error(
                'PriceOverride',
                'Nieprawidłowa struktura price_defaults.json - brak rury'
            );
            return;
        }
        if (!Array.isArray(data.studnie)) {
            logger.error(
                'PriceOverride',
                'Nieprawidłowa struktura price_defaults.json - brak studnie'
            );
            return;
        }

        await prisma.$transaction(async (tx) => {
            await tx.productsRuryDefault.deleteMany();
            if (data.rury.length > 0) {
                await tx.productsRuryDefault.createMany({ data: data.rury as never[] });
            }

            await tx.productsStudnieDefault.deleteMany();
            if (data.studnie.length > 0) {
                await tx.productsStudnieDefault.createMany({ data: data.studnie as never[] });
            }

            await tx.precoKonfigDefault.deleteMany();
            if (data.preco.konfig.length > 0) {
                await tx.precoKonfigDefault.createMany({ data: data.preco.konfig as never[] });
            }

            await tx.precoKinetyDefault.deleteMany();
            if (data.preco.kinety.length > 0) {
                await tx.precoKinetyDefault.createMany({ data: data.preco.kinety as never[] });
            }

            await tx.precoZakresyDefault.deleteMany();
            if (data.preco.zakresy.length > 0) {
                await tx.precoZakresyDefault.createMany({ data: data.preco.zakresy as never[] });
            }
        });

        logger.info(
            'PriceOverride',
            `Domyślne przywrócone: rury=${data.rury.length}, studnie=${data.studnie.length}, preco=${data.preco.konfig.length + data.preco.kinety.length + data.preco.zakresy.length}`
        );
    }
}

export const priceOverrideService = new PriceOverrideService();
