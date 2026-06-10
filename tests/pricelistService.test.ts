jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn()
        }
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

import prisma from '../src/prismaClient';
import { readPricelist, writePricelist, migrateFromLegacyIfNeeded } from '../src/services/pricelistService';

const mockSettings = prisma.settings as jest.Mocked<typeof prisma.settings>;

const TEST_CONFIG = {
    keyCurrent: 'test_pricelist',
    keyDefault: 'test_pricelist_default',
    legacyTable: 'products_test_rel',
    legacyDefaultKey: 'default_test',
    label: 'test'
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('readPricelist', () => {
    it('zwraca pustą tablicę gdy brak wpisu', async () => {
        mockSettings.findUnique.mockResolvedValue(null);
        const result = await readPricelist('missing');
        expect(result).toEqual([]);
    });

    it('zwraca sparsowane dane gdy wpis istnieje', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'x', value: '[{"id":"P1"}]' });
        const result = await readPricelist('x');
        expect(result).toEqual([{ id: 'P1' }]);
    });

    it('zwraca pustą tablicę dla pustego JSON-a', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'x', value: '[]' });
        const result = await readPricelist('x');
        expect(result).toEqual([]);
    });

    it('rzuca błąd dla nieprawidłowego JSON-a', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'x', value: 'not-json' });
        await expect(readPricelist('x')).rejects.toThrow();
    });
});

describe('writePricelist', () => {
    it('zapisuje dane i zwraca liczbę elementów', async () => {
        mockSettings.update.mockResolvedValue({} as any);
        const count = await writePricelist('test', [{ id: 'A' }, { id: 'B' }]);
        expect(count).toBe(2);
        expect(mockSettings.update).toHaveBeenCalledWith({
            where: { key: 'test' },
            data: { value: expect.any(String) }
        });
    });

    it('tworzy nowy wpis gdy update nie znajdzie rekordu', async () => {
        mockSettings.update.mockRejectedValue(new Error('Not found'));
        mockSettings.create.mockResolvedValue({} as any);
        const count = await writePricelist('new_key', []);
        expect(count).toBe(0);
        expect(mockSettings.create).toHaveBeenCalledWith({
            data: { key: 'new_key', value: '[]' }
        });
    });
});

describe('migrateFromLegacyIfNeeded', () => {
    it('pomija migrację gdy cennik już istnieje', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'test_pricelist', value: '[]' });
        await migrateFromLegacyIfNeeded(TEST_CONFIG);
        expect(mockSettings.update).not.toHaveBeenCalled();
        expect(mockSettings.create).not.toHaveBeenCalled();
    });
});
