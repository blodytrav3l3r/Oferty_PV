/**
 * Testy jednostkowe priceOverrideService.
 *
 * Obejmują guard synchronizacji w restoreDefaultsFromJson():
 * - pomijanie restore gdy baza ma timestamp >= exportedAt z price_defaults.json,
 * - wykonanie restore gdy baza jest starsza / nie ma wpisu (transfer na nowej maszynie),
 * - no-op przy braku pliku (debug),
 * - error przy uszkodzonym JSON (bez transakcji).
 */

import fs from 'fs';

const txMock = {
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
    }
};

const VALID_JSON = JSON.stringify({
    version: 1,
    exportedAt: '2026-08-10T12:00:00.000Z',
    rury: [{ id: 'r1', name: 'Rura', price: 100 }],
    studnie: [{ id: 's1', name: 'Studnia', price: 200 }],
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
            findUnique: jest.fn()
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

jest.spyOn(fs, 'existsSync').mockReturnValue(true);
jest.spyOn(fs, 'readFileSync').mockReturnValue(VALID_JSON);

import prisma from '../src/prismaClient';
import { logger } from '../src/utils/logger';
import { priceOverrideService } from '../src/services/priceOverrideService';

const prismaMock = prisma as unknown as {
    settings: { findUnique: jest.Mock };
    $transaction: jest.Mock;
};
const loggerMock = logger as unknown as Record<'info' | 'warn' | 'error' | 'debug', jest.Mock>;

describe('priceOverrideService.restoreDefaultsFromJson', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(VALID_JSON);
    });

    it('pomija restore gdy baza ma timestamp >= exportedAt (synchronizacja)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'pricelist_defaults_updated_at',
            value: '2026-08-10T13:00:00.000Z'
        });

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.debug).toHaveBeenCalledWith(
            'PriceOverride',
            expect.stringContaining('pomijam restore')
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(txMock.productsRuryDefault.deleteMany).not.toHaveBeenCalled();
    });

    it('wykonuje restore gdy baza nie ma timestampu (transfer na nowa maszyne)', async () => {
        prismaMock.settings.findUnique.mockResolvedValue(null);

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.info).toHaveBeenCalledWith(
            'PriceOverride',
            'Przywracanie domyślnych cenników z JSON...'
        );
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(txMock.productsRuryDefault.deleteMany).toHaveBeenCalledTimes(1);
        expect(txMock.productsRuryDefault.createMany).toHaveBeenCalledWith({
            data: [{ id: 'r1', name: 'Rura', price: 100 }]
        });
    });

    it('wykonuje restore gdy baza jest starsza niz plik', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'pricelist_defaults_updated_at',
            value: '2026-08-10T11:00:00.000Z'
        });

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.debug).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('no-op z debug gdy brak price_defaults.json', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.debug).toHaveBeenCalledWith(
            'PriceOverride',
            'Brak price_defaults.json — pomijam'
        );
        expect(prismaMock.settings.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('loguje error i nie uruchamia transakcji przy uszkodzonym JSON', async () => {
        (fs.readFileSync as jest.Mock).mockReturnValue('{broken');

        await priceOverrideService.restoreDefaultsFromJson();

        expect(loggerMock.error).toHaveBeenCalledWith(
            'PriceOverride',
            'Błąd parsowania price_defaults.json',
            expect.any(String)
        );
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
});
