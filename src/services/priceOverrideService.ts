/**
 * Price Override Service
 *
 * Zarządza domyślnymi cennikami (tabele *_Default + snapshot price_defaults.json).
 * Snapshot jest zapisywany przy saveDefaults() i przywracany przy starcie serwera,
 * o ile timestamp w bazie (settings.pricelist_defaults_updated_at) nie jest nowszy.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../prismaClient';
import { logger } from '../utils/logger';

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

class PriceOverrideService {
    private readonly defaultsPath: string;

    constructor() {
        this.defaultsPath = path.join(__dirname, '..', '..', 'data', 'price_defaults.json');
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

        // Najpierw zapis pliku, potem transakcja DB: gdyby zapis pliku rzucił błąd,
        // baza nie jest ruszona i nic nie zostaje w niespójnym stanie.
        const tmpPath = this.defaultsPath + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(jsonData, null, 2), 'utf-8');
        fs.renameSync(tmpPath, this.defaultsPath);

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

    async restoreDefaultsFromJson(): Promise<void> {
        if (!fs.existsSync(this.defaultsPath)) {
            logger.debug('PriceOverride', 'Brak price_defaults.json — pomijam');
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

        // Guard synchronizacji: pomijamy restore, gdy baza jest na bieżąco ze snapshotem.
        // Świeża maszyna (transfer) nie ma jeszcze settings.pricelist_defaults_updated_at
        // (np. czysta baza po install) -> restore działa i wczytuje JSON.
        // Maszyna źródłowa po saveDefaults() ma timestamp >= exportedAt w JSON -> pomijany.
        // Porównujemy wyłącznie timestampy w formacie ISO (toISOString). Wartość w innym
        // formacie (np. sqlite datetime '2026-08-10 19:00:06') porównana leksykograficznie
        // z ISO (' ' < 'T') błędnie przepuściłaby restore i nadpisała nowszą bazę starszym
        // snapshotem -> wtedy konserwatywnie pomijamy restore.
        const stored = await prisma.settings.findUnique({
            where: { key: 'pricelist_defaults_updated_at' }
        });
        const storedIsoValue =
            stored !== null &&
            stored.value !== null &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stored.value)
                ? stored.value
                : null;
        if (storedIsoValue !== null && storedIsoValue >= data.exportedAt) {
            logger.debug(
                'PriceOverride',
                'price_defaults.json w synchronizacji z baza — pomijam restore'
            );
            return;
        }

        logger.info('PriceOverride', 'Przywracanie domyślnych cenników z JSON...');

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
