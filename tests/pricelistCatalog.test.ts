/**
 * Katalog PDF/DOCX: ACTIVE ma pierwszeństwo, seed tylko przy braku wersji.
 * Błąd odczytu nie może zniknąć cicho — dokument szedłby do klienta z cenami fabrycznymi.
 */
import { getCatalogStudnieRows, getRuryCategoryMap } from '../src/services/pricelist/catalog';
import { getSeedRury, getSeedStudnie } from '../src/services/pricelist/seedData';
import { logger } from '../src/utils/logger';

const resolveActive = jest.fn();
jest.mock('../src/services/pricelist/usage', () => ({
    resolveActive: (...args: unknown[]) => resolveActive(...args)
}));

const getVersionExport = jest.fn();
jest.mock('../src/services/pricelist/export', () => ({
    getVersionExport: (...args: unknown[]) => getVersionExport(...args)
}));

jest.mock('../src/utils/logger', () => ({
    logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getCatalogStudnieRows', () => {
    it('bierze wiersze ACTIVE, gdy wersja istnieje', async () => {
        resolveActive.mockResolvedValue({ id: 'v1', version: 'Sv1' });
        getVersionExport.mockResolvedValue({
            sections: {
                studnie: [
                    { id: 's1', componentType: 'dennica', category: 'K', dn: '1000', height: 1000 }
                ]
            }
        });

        const rows = await getCatalogStudnieRows();

        expect(resolveActive).toHaveBeenCalledWith('studnie');
        expect(getVersionExport).toHaveBeenCalledWith('v1');
        expect(rows).toEqual([
            { id: 's1', componentType: 'dennica', category: 'K', dn: '1000', height: 1000 }
        ]);
    });

    it('brak ACTIVE = seed fabryczny bez błędu w logu', async () => {
        resolveActive.mockResolvedValue(null);

        const rows = await getCatalogStudnieRows();

        expect(rows).toHaveLength(getSeedStudnie().length);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('pusta sekcja ACTIVE traktowana jak brak wersji (seed)', async () => {
        resolveActive.mockResolvedValue({ id: 'v1', version: 'Sv1' });
        getVersionExport.mockResolvedValue({ sections: { studnie: [] } });

        const rows = await getCatalogStudnieRows();

        expect(rows).toHaveLength(getSeedStudnie().length);
    });

    it('błąd odczytu wersji: log error z kontekstem i fallback do seeda', async () => {
        resolveActive.mockResolvedValue({ id: 'v-broken', version: 'Sv1' });
        getVersionExport.mockRejectedValue(new Error('DB locked'));

        const rows = await getCatalogStudnieRows();

        expect(rows).toHaveLength(getSeedStudnie().length);
        expect(logger.error).toHaveBeenCalledWith(
            'PricelistCatalog',
            expect.stringContaining('studnie'),
            'DB locked'
        );
    });
});

describe('getRuryCategoryMap', () => {
    it('mapuje tylko żądane id (z ACTIVE)', async () => {
        resolveActive.mockResolvedValue({ id: 'v1', version: 'Rv1' });
        getVersionExport.mockResolvedValue({
            sections: {
                rury: [
                    { id: 'r1', category: 'WITROS' },
                    { id: 'r2', category: 'PVC' },
                    { id: 'r3', category: 'PE' }
                ]
            }
        });

        const map = await getRuryCategoryMap(['r1', 'r3', 'nie-ma']);

        expect([...map.entries()]).toEqual([
            ['r1', 'WITROS'],
            ['r3', 'PE']
        ]);
    });

    it('brak wersji = kategorie z seeda', async () => {
        resolveActive.mockResolvedValue(null);
        const seed = getSeedRury();

        const map = await getRuryCategoryMap([String(seed[0].id)]);

        expect(map.get(String(seed[0].id))).toBe(String(seed[0].category));
    });
});
