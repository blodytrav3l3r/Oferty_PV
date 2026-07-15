jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn(),
            upsert: jest.fn()
        }
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

import prisma from '../src/prismaClient';
import fs from 'fs';
import {
    readPricelist,
    writePricelist,
    ensureProductsSeeded,
    syncSeedFile,
    syncSeedFilePatch,
    syncSeedFileDelete
} from '../src/services/pricelistService';

const mockSettings = prisma.settings as jest.Mocked<typeof prisma.settings>;

const TEST_CONFIG = {
    keyCurrent: 'test_pricelist',
    keyDefault: 'test_pricelist_default',
    seedPath: 'data/test_seed.json',
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

    it('zwraca pustą tablicę dla nieprawidłowego JSON-a (brak błędu)', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'x', value: 'not-json' });
        const result = await readPricelist('x');
        expect(result).toEqual([]);
    });
});

describe('writePricelist', () => {
    it('zapisuje dane i zwraca liczbę elementów', async () => {
        mockSettings.upsert.mockResolvedValue({} as any);
        const count = await writePricelist('test', [{ id: 'A' }, { id: 'B' }]);
        expect(count).toBe(2);
        expect(mockSettings.upsert).toHaveBeenCalledWith({
            where: { key: 'test' },
            update: { value: expect.any(String) },
            create: { key: 'test', value: expect.any(String) }
        });
    });

    it('tworzy nowy wpis gdy update nie znajdzie rekordu', async () => {
        mockSettings.upsert.mockResolvedValue({} as any);
        const count = await writePricelist('new_key', []);
        expect(count).toBe(0);
        expect(mockSettings.upsert).toHaveBeenCalledWith({
            where: { key: 'new_key' },
            update: { value: '[]' },
            create: { key: 'new_key', value: '[]' }
        });
    });
});

describe('ensureProductsSeeded', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('pomija seedowanie gdy cennik już istnieje', async () => {
        mockSettings.findUnique.mockResolvedValue({ key: 'test_pricelist', value: '[]' });
        const existsSyncSpy = jest.spyOn(fs, 'existsSync');
        await ensureProductsSeeded(TEST_CONFIG);
        expect(existsSyncSpy).not.toHaveBeenCalled();
        expect(mockSettings.upsert).not.toHaveBeenCalled();
        existsSyncSpy.mockRestore();
    });

    it('seeduje z pliku gdy cennik nie istnieje', async () => {
        mockSettings.findUnique.mockResolvedValue(null);
        mockSettings.upsert.mockResolvedValue({} as any);
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readFileSync').mockReturnValue('[{"id":"P1","name":"Test"}]');
        await ensureProductsSeeded(TEST_CONFIG);
        expect(mockSettings.upsert).toHaveBeenCalledTimes(2);
        mockSettings.upsert.mock.calls.forEach((call) => {
            expect(call[0].update.value).toBe('[{"id":"P1","name":"Test"}]');
        });
        jest.restoreAllMocks();
    });

    it('pomija seedowanie gdy brak pliku seed', async () => {
        mockSettings.findUnique.mockResolvedValue(null);
        mockSettings.upsert.mockResolvedValue({} as any);
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        await ensureProductsSeeded(TEST_CONFIG);
        expect(mockSettings.upsert).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });
});

describe('syncSeedFile', () => {
    const tmp = 'data/test_sync_seed.json';
    afterEach(() => {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* ok */
        }
    });

    it('zapisuje dane do pliku', () => {
        syncSeedFile(tmp, [{ id: 'P1', price: 100 }]);
        const raw = fs.readFileSync(tmp, 'utf-8');
        const data = JSON.parse(raw);
        expect(data).toEqual([{ id: 'P1', price: 100 }]);
    });

    it('nadpisuje istniejący plik', () => {
        fs.writeFileSync(tmp, JSON.stringify([{ id: 'OLD' }]));
        syncSeedFile(tmp, [{ id: 'P2' }]);
        const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(data).toEqual([{ id: 'P2' }]);
    });

    it('nie rzuca błędem gdy brak uprawnień (loguje error)', () => {
        expect(() => syncSeedFile('/invalid/path/seed.json', [])).not.toThrow();
    });
});

describe('syncSeedFilePatch', () => {
    const tmp = 'data/test_patch_seed.json';
    beforeEach(() => {
        fs.writeFileSync(
            tmp,
            JSON.stringify([
                { id: 'P1', price: 100, name: 'A' },
                { id: 'P2', price: 200, name: 'B' }
            ])
        );
    });
    afterEach(() => {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* ok */
        }
    });

    it('aktualizuje istniejący rekord', () => {
        syncSeedFilePatch(tmp, 'P1', { price: 999 });
        const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(data).toEqual([
            { id: 'P1', price: 999, name: 'A' },
            { id: 'P2', price: 200, name: 'B' }
        ]);
    });

    it('nie zmienia pliku gdy brak ID', () => {
        syncSeedFilePatch(tmp, 'NONEXIST', { price: 999 });
        const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(data).toHaveLength(2);
    });

    it('nie rzuca błędem gdy plik nie istnieje', () => {
        expect(() => syncSeedFilePatch('data/nonexist.json', 'P1', {})).not.toThrow();
    });
});

describe('syncSeedFileDelete', () => {
    const tmp = 'data/test_delete_seed.json';
    beforeEach(() => {
        fs.writeFileSync(
            tmp,
            JSON.stringify([
                { id: 'P1', price: 100 },
                { id: 'P2', price: 200 },
                { id: 'P3', price: 300 }
            ])
        );
    });
    afterEach(() => {
        try {
            fs.unlinkSync(tmp);
        } catch {
            /* ok */
        }
    });

    it('usuwa rekord po ID', () => {
        syncSeedFileDelete(tmp, 'P2');
        const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(data).toEqual([
            { id: 'P1', price: 100 },
            { id: 'P3', price: 300 }
        ]);
    });

    it('nic nie robi gdy ID nie istnieje', () => {
        syncSeedFileDelete(tmp, 'NONEXIST');
        const data = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(data).toHaveLength(3);
    });

    it('nie rzuca błędem gdy plik nie istnieje', () => {
        expect(() => syncSeedFileDelete('data/nonexist.json', 'P1')).not.toThrow();
    });
});
