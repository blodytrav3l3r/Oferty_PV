/**
 * Price Override Service
 *
 * Zarządza domyślnymi cennikami (tabele *_Default + snapshot price_defaults.json).
 * Snapshot (schemaVersion 2) jest zapisywany przy saveDefaults() / prices:export
 * i przywracany przy starcie serwera do tabel LIVE + *_Default, o ile timestamp
 * w bazie (settings.pricelist_defaults_updated_at) nie jest nowszy.
 *
 * Zapis domyślnych jest all-or-nothing: plik zapisywany przed transakcją, na błąd
 * transakcji cofany do poprzedniej treści (kompensacja); crash po zapisie pliku
 * pokrywa startowy restoreDefaultsFromJson().
 *
 * Transfer cenników między urządzeniami:
 *   urządzenie A:  saveDefaults()  lub  npm run prices:export
 *   urządzenie B:  skopiuj price_defaults.json do data/ (lub PRICE_DEFAULTS_PATH)
 *                  -> przy starcie restoreDefaultsFromJson() uzupełnia LIVE + *_Default
 *   lub ręcznie:   npm run prices:import <plik>  (walidacja + raport diff)
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { z } from 'zod';
import prisma from '../prismaClient';
import { logger } from '../utils/logger';
import {
    productsRuryRowSchema,
    productsStudnieRowSchema,
    precoKonfigRowSchema,
    precoKinetyRowSchema,
    precoZakresyRowSchema
} from '../validators/priceDefaultsSchemas';
import type {
    ProductsRuryRow,
    ProductsStudnieRow,
    PrecoKonfigRow,
    PrecoKinetyRow,
    PrecoZakresyRow
} from '../validators/priceDefaultsSchemas';

interface SectionManifest {
    count: number;
    sha256: string;
}

interface PriceDefaultsJson {
    schemaVersion: 2;
    exportedAt: string;
    rury: ProductsRuryRow[];
    studnie: ProductsStudnieRow[];
    preco: {
        konfig: PrecoKonfigRow[];
        kinety: PrecoKinetyRow[];
        zakresy: PrecoZakresyRow[];
    };
    sections: {
        rury: SectionManifest;
        studnie: SectionManifest;
        precoKonfig: SectionManifest;
        precoKinety: SectionManifest;
        precoZakresy: SectionManifest;
    };
}

interface LegacyPriceDefaultsJson {
    version: 1;
    exportedAt: string;
    rury: ProductsRuryRow[];
    studnie: ProductsStudnieRow[];
    preco: {
        konfig: PrecoKonfigRow[];
        kinety: PrecoKinetyRow[];
        zakresy: PrecoZakresyRow[];
    };
}

export interface RestoreSummary {
    rury: number;
    studnie: number;
    precoKonfig: number;
    precoKinety: number;
    precoZakresy: number;
    diff: {
        rury: { added: number; removed: number; changed: number };
        studnie: { added: number; removed: number; changed: number };
        precoKonfig: { added: number; removed: number; changed: number };
        precoKinety: { added: number; removed: number; changed: number };
        precoZakresy: { added: number; removed: number; changed: number };
    };
    skippedGuard: boolean;
    schemaVersion: number;
}

/** Kanoniczny stringify (rekurencyjne sortowanie kluczy) — stabilny SHA dla JSON. */
function canonicalStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalStringify).join(',') + ']';
    }
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return (
            '{' +
            Object.keys(obj)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]))
                .join(',') +
            '}'
        );
    }
    return JSON.stringify(value);
}

function sha256Canonical(value: unknown): string {
    return createHash('sha256').update(canonicalStringify(value), 'utf-8').digest('hex');
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function diffById(
    current: Record<string, unknown>[],
    incoming: Record<string, unknown>[]
): { added: number; removed: number; changed: number } {
    const cur = new Map(current.map((r) => [String(r.id), r]));
    const inc = new Map(incoming.map((r) => [String(r.id), r]));
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const [id, row] of inc) {
        if (!cur.has(id)) {
            added++;
        } else if (canonicalStringify(cur.get(id)) !== canonicalStringify(row)) {
            changed++;
        }
    }
    for (const id of cur.keys()) {
        if (!inc.has(id)) removed++;
    }
    return { added, removed, changed };
}

/** Formatuje ścieżkę błędu zod do czytelnej postaci (rury[0].category). */
function formatPath(path: Array<string | number | symbol>): string {
    if (path.length === 0) return '';
    let out = typeof path[0] === 'number' ? `[${path[0]}]` : `.${String(path[0])}`;
    for (const part of path.slice(1)) {
        out += typeof part === 'number' ? `[${part}]` : `.${String(part)}`;
    }
    return out;
}

/**
 * Waliduje sekcję snapshotu względem schematu kontraktu (1:1 z modelami Prisma).
 * Zwraca wiersze (oczyszczone do pól modelu) lub null z pełnym raportem błędów
 * per wiersz/pole. Nigdy nie zapisuje częściowo — walidacja przed jakimkolwiek write.
 */
function parseSection<T>(rows: unknown, sectionName: string, schema: z.ZodType<T>): T[] | null {
    const parsed = schema.array().safeParse(rows);
    if (parsed.success) return parsed.data;

    const details = parsed.error.issues
        .map((issue) => `${sectionName}${formatPath(issue.path)} — ${issue.message}`)
        .join('; ');
    logger.error(
        'PriceOverride',
        `Nieprawidłowa sekcja ${sectionName} w price_defaults.json: ${details}`
    );
    logger.error(
        'PriceOverride',
        'Napraw snapshot (npm run prices:export) lub usuń plik data/price_defaults.json'
    );
    return null;
}

class PriceOverrideService {
    private readonly defaultsPath: string;

    /** Ścieżka snapshotu (PRICE_DEFAULTS_PATH lub data/price_defaults.json). */
    get snapshotPath(): string {
        return this.defaultsPath;
    }

    constructor() {
        // PRICE_DEFAULTS_PATH pozwala na montowanie snapshotu z wolumenu (Docker)
        // bez kopiowania go do data/.
        this.defaultsPath =
            process.env.PRICE_DEFAULTS_PATH ??
            path.join(__dirname, '..', '..', 'data', 'price_defaults.json');
    }

    /** Buduje pakiet cenników (manifest v2) z bieżących tabel live. */
    async buildPricePackage(): Promise<PriceDefaultsJson> {
        const [ruryLive, studnieLive, konfigLive, kinetyLive, zakresyLive] = await Promise.all([
            prisma.productsRury.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } }),
            prisma.precoKonfig.findMany({ orderBy: { key: 'asc' } }),
            prisma.precoKinety.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] }),
            prisma.precoZakresy.findMany({ orderBy: [{ wellDn: 'asc' }, { order: 'asc' }] })
        ]);

        const section = (arr: unknown[]): SectionManifest => ({
            count: arr.length,
            sha256: sha256Canonical(arr)
        });

        return {
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            rury: ruryLive,
            studnie: studnieLive,
            preco: {
                konfig: konfigLive,
                kinety: kinetyLive,
                zakresy: zakresyLive
            },
            sections: {
                rury: section(ruryLive),
                studnie: section(studnieLive),
                precoKonfig: section(konfigLive),
                precoKinety: section(kinetyLive),
                precoZakresy: section(zakresyLive)
            }
        };
    }

    async saveDefaults(): Promise<{
        rury: number;
        studnie: number;
        precoKonfig: number;
        precoKinety: number;
        precoZakresy: number;
    }> {
        logger.info('PriceOverride', 'Zapisywanie bieżącego stanu jako domyślne...');

        const pkg = await this.buildPricePackage();
        const now = pkg.exportedAt;
        const tmpPath = this.defaultsPath + '.tmp';

        // Kompensacja: poprzednia treść pliku (do rollbacku, gdy transakcja padnie).
        // Brak możliwości odczytu = nie da się cofnąć -> best-effort usunięcie.
        let oldContent: string | null = null;
        try {
            oldContent = fs.existsSync(this.defaultsPath)
                ? fs.readFileSync(this.defaultsPath, 'utf-8')
                : null;
        } catch {
            oldContent = null;
            logger.debug(
                'PriceOverride',
                'Nie można odczytać poprzedniego snapshotu — rollback niemożliwy'
            );
        }

        // Zapis pliku ATOMOWO (tmp -> rename). Błąd tutaj = baza nietknięta (spójne).
        fs.writeFileSync(tmpPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        fs.renameSync(tmpPath, this.defaultsPath);

        // Cała praca DB (w tym timestamp) w JEDNEJ transakcji.
        // Błąd transakcji = rollback pliku do oldContent -> obie strony stare (spójne).
        try {
            await prisma.$transaction(async (tx) => {
                await tx.productsRuryDefault.deleteMany();
                await tx.productsStudnieDefault.deleteMany();
                await tx.precoKonfigDefault.deleteMany();
                await tx.precoKinetyDefault.deleteMany();
                await tx.precoZakresyDefault.deleteMany();

                if (pkg.rury.length > 0)
                    await tx.productsRuryDefault.createMany({ data: pkg.rury });
                if (pkg.studnie.length > 0)
                    await tx.productsStudnieDefault.createMany({ data: pkg.studnie });
                if (pkg.preco.konfig.length > 0)
                    await tx.precoKonfigDefault.createMany({ data: pkg.preco.konfig });
                if (pkg.preco.kinety.length > 0)
                    await tx.precoKinetyDefault.createMany({ data: pkg.preco.kinety });
                if (pkg.preco.zakresy.length > 0)
                    await tx.precoZakresyDefault.createMany({ data: pkg.preco.zakresy });

                await tx.settings.upsert({
                    where: { key: 'pricelist_defaults_updated_at' },
                    update: { value: now },
                    create: { key: 'pricelist_defaults_updated_at', value: now }
                });
            });
        } catch (err) {
            if (oldContent !== null) {
                fs.writeFileSync(tmpPath, oldContent, 'utf-8');
                fs.renameSync(tmpPath, this.defaultsPath);
            } else {
                fs.rmSync(this.defaultsPath, { force: true });
            }
            logger.warn(
                'PriceOverride',
                'Transakcja zapisu domyślnych nieudana — snapshot cofnięty:',
                String(err)
            );
            throw err;
        }

        logger.info(
            'PriceOverride',
            `Domyślne zapisane: rury=${pkg.rury.length}, studnie=${pkg.studnie.length}, preco=${pkg.preco.konfig.length + pkg.preco.kinety.length + pkg.preco.zakresy.length}`
        );

        return {
            rury: pkg.rury.length,
            studnie: pkg.studnie.length,
            precoKonfig: pkg.preco.konfig.length,
            precoKinety: pkg.preco.kinety.length,
            precoZakresy: pkg.preco.zakresy.length
        };
    }

    /**
     * Przywraca cenniki ze snapshotu do tabel LIVE + *_Default.
     *
     * @param filePath - ścieżka snapshotu (domyślnie data/price_defaults.json)
     * @param options.force - true = pomiń guard timestamp (CLI prices:import);
     *                        false = pomiń restore gdy baza ma timestamp >= exportedAt (start)
     */
    async restoreDefaultsFromJson(
        filePath?: string,
        options: { force?: boolean } = {}
    ): Promise<RestoreSummary | null> {
        const target = filePath ?? this.defaultsPath;

        if (!fs.existsSync(target)) {
            logger.debug('PriceOverride', 'Brak price_defaults.json — pomijam');
            return null;
        }

        let raw: string;
        try {
            raw = fs.readFileSync(target, 'utf-8');
        } catch (err) {
            logger.error('PriceOverride', 'Błąd odczytu price_defaults.json', String(err));
            return null;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            logger.error('PriceOverride', 'Błąd parsowania price_defaults.json', String(err));
            return null;
        }

        // Walidacja struktury (wspólna dla v1 i v2).
        const data = parsed as Partial<LegacyPriceDefaultsJson> & Partial<PriceDefaultsJson>;
        if (
            !Array.isArray(data.rury) ||
            !Array.isArray(data.studnie) ||
            !isPlainRecord(data.preco) ||
            !Array.isArray(data.preco.konfig) ||
            !Array.isArray(data.preco.kinety) ||
            !Array.isArray(data.preco.zakresy)
        ) {
            logger.error('PriceOverride', 'Nieprawidłowa struktura price_defaults.json');
            return null;
        }

        // Walidacja kontraktu pól (1:1 z modelami Prisma) — PRZED jakimkolwiek
        // zapisem DB. Brakujący wymagany field (np. category) = odrzut z raportem,
        // nigdy cichy zapis z placeholderem do tabel pieniężnych.
        const incoming = {
            rury: parseSection(data.rury, 'rury', productsRuryRowSchema),
            studnie: parseSection(data.studnie, 'studnie', productsStudnieRowSchema),
            konfig: parseSection(data.preco.konfig, 'precoKonfig', precoKonfigRowSchema),
            kinety: parseSection(data.preco.kinety, 'precoKinety', precoKinetyRowSchema),
            zakresy: parseSection(data.preco.zakresy, 'precoZakresy', precoZakresyRowSchema)
        };
        if (
            !incoming.rury ||
            !incoming.studnie ||
            !incoming.konfig ||
            !incoming.kinety ||
            !incoming.zakresy
        ) {
            return null;
        }

        const rury = incoming.rury;
        const studnie = incoming.studnie;
        const konfig = incoming.konfig;
        const kinety = incoming.kinety;
        const zakresy = incoming.zakresy;

        const schemaVersion = data.schemaVersion ?? (data.version as number) ?? 1;

        if (schemaVersion === 2) {
            // Weryfikacja integralności: liczba wierszy + SHA-256 per sekcja.
            const checks: Array<[keyof PriceDefaultsJson['sections'], unknown[]]> = [
                ['rury', data.rury],
                ['studnie', data.studnie],
                ['precoKonfig', data.preco.konfig],
                ['precoKinety', data.preco.kinety],
                ['precoZakresy', data.preco.zakresy]
            ];
            for (const [key, rows] of checks) {
                const manifest = data.sections?.[key];
                if (
                    !manifest ||
                    manifest.count !== rows.length ||
                    manifest.sha256 !== sha256Canonical(rows)
                ) {
                    logger.error(
                        'PriceOverride',
                        `Niespójny manifest sekcji ${String(key)} — przerywam bez zapisu`
                    );
                    return null;
                }
            }
        } else if (schemaVersion !== 1) {
            logger.error(
                'PriceOverride',
                `Nieobsługiwana wersja price_defaults.json: ${schemaVersion}`
            );
            return null;
        }

        const exportedAt = data.exportedAt;

        // Guard synchronizacji: pomijamy restore, gdy baza jest na bieżąco ze snapshotem.
        // Świeża maszyna (transfer) nie ma jeszcze settings.pricelist_defaults_updated_at
        // -> restore działa i wczytuje JSON. Porównujemy wyłącznie timestampy w formacie
        // ISO (toISOString); wartość w innym formacie traktujemy konserwatywnie (restore).
        if (!options.force) {
            const stored = await prisma.settings.findUnique({
                where: { key: 'pricelist_defaults_updated_at' }
            });
            const storedIsoValue =
                stored !== null &&
                stored.value !== null &&
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stored.value)
                    ? stored.value
                    : null;
            if (exportedAt && storedIsoValue !== null && storedIsoValue >= exportedAt) {
                logger.debug(
                    'PriceOverride',
                    'price_defaults.json w synchronizacji z baza — pomijam restore'
                );
                return {
                    rury: 0,
                    studnie: 0,
                    precoKonfig: 0,
                    precoKinety: 0,
                    precoZakresy: 0,
                    diff: {
                        rury: { added: 0, removed: 0, changed: 0 },
                        studnie: { added: 0, removed: 0, changed: 0 },
                        precoKonfig: { added: 0, removed: 0, changed: 0 },
                        precoKinety: { added: 0, removed: 0, changed: 0 },
                        precoZakresy: { added: 0, removed: 0, changed: 0 }
                    },
                    skippedGuard: true,
                    schemaVersion
                };
            }
        }

        logger.info('PriceOverride', 'Przywracanie domyślnych cenników z JSON...');

        // Diff do raportu (przed nadpisaniem).
        const [curRury, curStudnie, curKonfig, curKinety, curZakresy] = await Promise.all([
            prisma.productsRury.findMany({ orderBy: { id: 'asc' } }),
            prisma.productsStudnie.findMany({ orderBy: { id: 'asc' } }),
            prisma.precoKonfig.findMany({ orderBy: { id: 'asc' } }),
            prisma.precoKinety.findMany({ orderBy: { id: 'asc' } }),
            prisma.precoZakresy.findMany({ orderBy: { id: 'asc' } })
        ]);
        const diff = {
            rury: diffById(curRury, rury),
            studnie: diffById(curStudnie, studnie),
            precoKonfig: diffById(curKonfig, konfig),
            precoKinety: diffById(curKinety, kinety),
            precoZakresy: diffById(curZakresy, zakresy)
        };

        await prisma.$transaction(async (tx) => {
            for (const table of [
                'productsRury',
                'productsStudnie',
                'precoKonfig',
                'precoKinety',
                'precoZakresy'
            ]) {
                await (tx as Record<string, any>)[table].deleteMany();
            }
            for (const table of [
                'productsRuryDefault',
                'productsStudnieDefault',
                'precoKonfigDefault',
                'precoKinetyDefault',
                'precoZakresyDefault'
            ]) {
                await (tx as Record<string, any>)[table].deleteMany();
            }

            if (rury.length > 0) {
                await tx.productsRury.createMany({ data: rury });
                await tx.productsRuryDefault.createMany({ data: rury });
            }
            if (studnie.length > 0) {
                await tx.productsStudnie.createMany({ data: studnie });
                await tx.productsStudnieDefault.createMany({ data: studnie });
            }
            if (konfig.length > 0) {
                await tx.precoKonfig.createMany({ data: konfig });
                await tx.precoKonfigDefault.createMany({ data: konfig });
            }
            if (kinety.length > 0) {
                await tx.precoKinety.createMany({ data: kinety });
                await tx.precoKinetyDefault.createMany({ data: kinety });
            }
            if (zakresy.length > 0) {
                await tx.precoZakresy.createMany({ data: zakresy });
                await tx.precoZakresyDefault.createMany({ data: zakresy });
            }
            if (exportedAt) {
                await tx.settings.upsert({
                    where: { key: 'pricelist_defaults_updated_at' },
                    update: { value: exportedAt },
                    create: { key: 'pricelist_defaults_updated_at', value: exportedAt }
                });
            }
        });

        logger.info(
            'PriceOverride',
            `Domyślne przywrócone: rury=${rury.length}, studnie=${studnie.length}, preco=${konfig.length + kinety.length + zakresy.length}`
        );

        return {
            rury: rury.length,
            studnie: studnie.length,
            precoKonfig: konfig.length,
            precoKinety: kinety.length,
            precoZakresy: zakresy.length,
            diff,
            skippedGuard: false,
            schemaVersion
        };
    }
}

export const priceOverrideService = new PriceOverrideService();
export { diffById, sha256Canonical };
