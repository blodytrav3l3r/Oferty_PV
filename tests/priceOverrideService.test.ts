/**
 * Testy jednostkowe priceOverrideService.
 *
 * Pokrycie:
 * - restoreDefaultsFromJson(): guard timestamp, restore do LIVE + *_Default,
 *   walidacja manifestu v2 (SHA-256, count), kompatybilność v1,
 *   brak częściowego zapisu przy uszkodzonym JSON / niespójnym manifeście,
 *   force (CLI prices:import) pomija guard.
 * - saveDefaults(): manifest v2 (schemaVersion, sekcje, hashe), brak zapisu
 *   do seed_*.json (ceny nie trafiają do publicznego repo).
 */

import fs from 'fs';

const txMock = {
    productsRury: { deleteMany: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    productsStudnie: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    precoKonfig: { deleteMany: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    precoKinety: { deleteMany: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    precoZakresy: { deleteMany: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    productsRuryDefault: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    productsStudnieDefault: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    precoKonfigDefault: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    precoKinetyDefault: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    precoZakresyDefault: {
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    settings: { upsert: jest.fn().mockResolvedValue({}) }
};

const VALID_JSON = JSON.stringify({
    version: 1,
    exportedAt: '2026-08-10T12:00:00.000Z',
    rury: [{ id: 'r1', name: 'Rura', category: 'Rury Betonowe', price: 100 }],
    studnie: [
        { id: 's1', name: 'Studnia', category: 'Studnie', componentType: 'dennica', price: 200 }
    ],
    preco: {
        konfig: [{ id: 'k1', key: '1000', value: '{}' }],
        kinety: [{ id: 'kt1', order: 1, dn: 300, wellDn: 1000, height: 1, cena: 100 }],
        zakresy: [{ id: 'z1', order: 1, label: 'A', min: 0, max: 100, grupy: '{}', wellDn: 1000 }]
    }
});

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn(),
            upsert: jest.fn().mockResolvedValue({})
        },
        productsRury: {
            findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Rura', price: 100 }])
        },
        productsStudnie: {
            findMany: jest.fn().mockResolvedValue([{ id: 's1', name: 'Studnia', price: 200 }])
        },
        precoKonfig: {
            findMany: jest.fn().mockResolvedValue([{ id: 'k1', key: '1000', value: '{}' }])
        },
        precoKinety: {
            findMany: jest
                .fn()
                .mockResolvedValue([
                    { id: 'kt1', order: 1, dn: 300, wellDn: 1000, height: 1, cena: 100 }
                ])
        },
        precoZakresy: {
            findMany: jest.fn().mockResolvedValue([])
        },
        $transaction: jest.fn(async (arg: any) => {
            if (typeof arg === 'function') {
                return arg(txMock);
            }
            return undefined;
        })
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/services/seedExporter', () => ({
    writeSeedFiles: jest.fn()
}));

// Mock tylko odczytu pliku snapshotu — GLOBALNY mock fs.readFileSync zatruwałby
// transform cache (jest-workers współdzielą transformację): kolejny suite w tym
// samym workerze czytał JSON jako skompilowany moduł → "Unexpected token ':'".
const realReadFileSync = fs.readFileSync.bind(fs);
const realExistsSync = fs.existsSync.bind(fs);
let fileContent = VALID_JSON;
let fileExists = true;

jest.spyOn(fs, 'existsSync').mockImplementation((p: unknown) => {
    return String(p).includes('price_defaults.json')
        ? fileExists
        : realExistsSync(p as fs.PathLike);
});
jest.spyOn(fs, 'readFileSync').mockImplementation((p: unknown, ...args: unknown[]) => {
    if (String(p).includes('price_defaults.json')) {
        return fileContent;
    }
    return realReadFileSync(p as fs.PathLike, ...(args as [BufferEncoding]));
});
jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);

import prisma from '../src/prismaClient';
import * as seedExporter from '../src/services/seedExporter';
import { logger } from '../src/utils/logger';
import { priceOverrideService, sha256Canonical } from '../src/services/priceOverrideService';

const prismaMock = prisma as unknown as {
    settings: {
        findUnique: jest.Mock;
        upsert: jest.Mock;
    };
    $transaction: jest.Mock;
};
const loggerMock = logger as unknown as Record<'info' | 'warn' | 'error' | 'debug', jest.Mock>;

describe('priceOverrideService.restoreDefaultsFromJson', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fileContent = VALID_JSON;
        fileExists = true;
        (prisma.productsRury.findMany as jest.Mock).mockResolvedValue([
            { id: 'r1', name: 'Rura', price: 100 }
        ]);
        (prisma.productsStudnie.findMany as jest.Mock).mockResolvedValue([
            { id: 's1', name: 'Studnia', price: 200 }
        ]);
        (prisma.precoKonfig.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', key: '1000' }]);
        (prisma.precoKinety.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.precoZakresy.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('pomija restore gdy baza ma timestamp >= exportedAt (synchronizacja)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'pricelist_defaults_updated_at',
            value: '2026-08-10T13:00:00.000Z'
        });

        const summary = await priceOverrideService.restoreDefaultsFromJson();

        expect(summary?.skippedGuard).toBe(true);
        expect(loggerMock.debug).toHaveBeenCalledWith(
            'PriceOverride',
            expect.stringContaining('pomijam restore')
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(txMock.productsRuryDefault.deleteMany).not.toHaveBeenCalled();
    });

    it('wykonuje restore do LIVE + Default gdy baza nie ma timestampu (transfer)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue(null);

        const summary = await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.info).toHaveBeenCalledWith(
            'PriceOverride',
            'Przywracanie domyślnych cenników z JSON...'
        );
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(txMock.productsRury.deleteMany).toHaveBeenCalledTimes(1);
        expect(txMock.productsRury.createMany).toHaveBeenCalledWith({
            data: [{ id: 'r1', name: 'Rura', category: 'Rury Betonowe', price: 100 }]
        });
        expect(txMock.productsRuryDefault.deleteMany).toHaveBeenCalledTimes(1);
        expect(txMock.productsRuryDefault.createMany).toHaveBeenCalledWith({
            data: [{ id: 'r1', name: 'Rura', category: 'Rury Betonowe', price: 100 }]
        });
        expect(summary?.rury).toBe(1);
        expect(summary?.diff.rury.added).toBe(0);
    });

    it('odrzuca snapshot z rurą bez category — brak zapisu DB', async () => {
        const bad = JSON.parse(VALID_JSON);
        delete bad.rury[0].category;
        fileContent = JSON.stringify(bad);

        const summary = await priceOverrideService.restoreDefaultsFromJson();

        expect(summary).toBeNull();
        expect(loggerMock.error).toHaveBeenCalledWith(
            'PriceOverride',
            expect.stringContaining('rury[0].category')
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(txMock.productsRury.deleteMany).not.toHaveBeenCalled();
        expect(txMock.productsRury.createMany).not.toHaveBeenCalled();
    });

    it('odrzuca snapshot ze studnią bez componentType', async () => {
        const bad = JSON.parse(VALID_JSON);
        delete bad.studnie[0].componentType;
        fileContent = JSON.stringify(bad);

        const summary = await priceOverrideService.restoreDefaultsFromJson();

        expect(summary).toBeNull();
        expect(loggerMock.error).toHaveBeenCalledWith(
            'PriceOverride',
            expect.stringContaining('studnie[0].componentType')
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('force=true pomija guard timestamp (CLI prices:import)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'pricelist_defaults_updated_at',
            value: '2026-08-10T13:00:00.000Z'
        });

        const summary = await priceOverrideService.restoreDefaultsFromJson(undefined, {
            force: true
        });

        expect(summary?.skippedGuard).toBe(false);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('no-op z debug gdy brak price_defaults.json', async () => {
        fileExists = false;

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.debug).toHaveBeenCalledWith(
            'PriceOverride',
            'Brak price_defaults.json — pomijam'
        );
        expect(prismaMock.settings.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('loguje error i nie uruchamia transakcji przy uszkodzonym JSON', async () => {
        fileContent = '{broken';

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.error).toHaveBeenCalledWith(
            'PriceOverride',
            'Błąd parsowania price_defaults.json',
            expect.any(String)
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('odrzuca manifest v2 z niespójnym SHA-256 bez częściowego zapisu', async () => {
        const manifest = JSON.parse(VALID_JSON);
        manifest.schemaVersion = 2;
        manifest.sections = {
            rury: { count: 1, sha256: 'zly-hash' },
            studnie: { count: 1, sha256: 'zly-hash' },
            precoKonfig: { count: 1, sha256: 'zly-hash' },
            precoKinety: { count: 1, sha256: 'zly-hash' },
            precoZakresy: { count: 1, sha256: 'zly-hash' }
        };
        fileContent = JSON.stringify(manifest);

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.error).toHaveBeenCalledWith(
            'PriceOverride',
            expect.stringContaining('Niespójny manifest')
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(txMock.productsRury.deleteMany).not.toHaveBeenCalled();
    });

    it('przyjmuje poprawny manifest v2 i liczy diff zmian', async () => {
        const manifest = JSON.parse(VALID_JSON);
        manifest.schemaVersion = 2;
        (prisma.productsRury.findMany as jest.Mock).mockResolvedValue([
            { id: 'r1', name: 'Rura', price: 999 }
        ]);
        (prisma.productsStudnie.findMany as jest.Mock).mockResolvedValue([
            { id: 's2', name: 'Inna', price: 200 }
        ]);
        (prisma.precoKonfig.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.precoKinety.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.precoZakresy.findMany as jest.Mock).mockResolvedValue([]);
        manifest.sections = {
            rury: { count: 1, sha256: sha256Canonical(manifest.rury) },
            studnie: { count: 1, sha256: sha256Canonical(manifest.studnie) },
            precoKonfig: { count: 1, sha256: sha256Canonical(manifest.preco.konfig) },
            precoKinety: { count: 1, sha256: sha256Canonical(manifest.preco.kinety) },
            precoZakresy: { count: 1, sha256: sha256Canonical(manifest.preco.zakresy) }
        };
        fileContent = JSON.stringify(manifest);
        prismaMock.settings.findUnique.mockResolvedValue(null);

        const summary = await priceOverrideService.restoreDefaultsFromJson();

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(summary?.schemaVersion).toBe(2);
        expect(summary?.diff.rury.changed).toBe(1);
        expect(summary?.diff.studnie.removed).toBe(1);
        expect(summary?.diff.studnie.added).toBe(1);
    });
});

describe('priceOverrideService.saveDefaults', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.writeFileSync as jest.Mock).mockClear();
        (fs.renameSync as jest.Mock).mockClear();
        (prisma.productsRury.findMany as jest.Mock).mockResolvedValue([
            { id: 'r1', name: 'Rura', price: 100 }
        ]);
        (prisma.productsStudnie.findMany as jest.Mock).mockResolvedValue([
            { id: 's1', name: 'Studnia', price: 200 }
        ]);
        (prisma.precoKonfig.findMany as jest.Mock).mockResolvedValue([{ id: 'k1', key: '1000' }]);
        (prisma.precoKinety.findMany as jest.Mock).mockResolvedValue([
            { id: 'kt1', order: 1, dn: 300, wellDn: 1000, height: 1, cena: 100 }
        ]);
        (prisma.precoZakresy.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('zapisuje domyślne z manifestem v2 i NIE pisze do seed_*.json', async () => {
        const summary = await priceOverrideService.saveDefaults();

        expect(summary).toEqual({
            rury: 1,
            studnie: 1,
            precoKonfig: 1,
            precoKinety: 1,
            precoZakresy: 0
        });

        expect(fs.renameSync).toHaveBeenCalledTimes(1);
        const written = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string;
        const pkg = JSON.parse(written);
        expect(pkg.schemaVersion).toBe(2);
        expect(pkg.sections.rury).toEqual({ count: 1, sha256: expect.any(String) });
        expect(pkg.sections.studnie.count).toBe(1);
        expect(pkg.sections.precoKinety.count).toBe(1);
        expect(pkg.sections.precoZakresy.count).toBe(0);

        // Ceny użytkownika NIE trafiają do committed seed_*.json (repo publiczne).
        expect(seedExporter.writeSeedFiles).not.toHaveBeenCalled();
        expect(loggerMock.warn).not.toHaveBeenCalled();

        // Timestamp zapisany wewnątrz transakcji (atomowość zapisu domyślnych).
        expect(txMock.settings.upsert).toHaveBeenCalledTimes(1);
        expect(txMock.settings.upsert.mock.calls[0][0]).toMatchObject({
            where: { key: 'pricelist_defaults_updated_at' }
        });
    });

    it('gdy transakcja pada, plik wraca do poprzedniej treści i błąd propaguje', async () => {
        (prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('tx fail'));

        await expect(priceOverrideService.saveDefaults()).rejects.toThrow('tx fail');

        // rollback: drugi zapis + drugi rename, treść = stary snapshot
        expect(fs.renameSync).toHaveBeenCalledTimes(2);
        const writes = (fs.writeFileSync as jest.Mock).mock.calls;
        const lastWrite = writes[writes.length - 1][1] as string;
        expect(lastWrite).toBe(fileContent);
    });

    it('gdy zapis pliku pada, transakcja DB nie jest wywoływana', async () => {
        (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('write fail');
        });

        await expect(priceOverrideService.saveDefaults()).rejects.toThrow('write fail');

        expect(txMock.productsRuryDefault.deleteMany).not.toHaveBeenCalled();
        expect(txMock.settings.upsert).not.toHaveBeenCalled();
    });
});
