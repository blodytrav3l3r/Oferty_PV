/**
 * productionSearchUtils — unit czystych funkcji (pokrycie ogona 13%).
 * Bez DB: parseSearchParams / normalizedCreatedAtSql / mapProductionOrderRow.
 */
import {
    parseSearchParams,
    normalizedCreatedAtSql,
    mapProductionOrderRow
} from '../src/utils/productionSearchUtils';

describe('parseSearchParams', () => {
    it('puste wejście → bezpieczne defaulty', () => {
        const p = parseSearchParams({});
        expect(p).toEqual({
            q: '',
            status: 'all',
            dateFrom: '',
            dateTo: '',
            userId: '',
            productionOrderNumber: '',
            salesOrderNumber: '',
            cursor: '',
            cursorId: '',
            limit: 50,
            sort: 'createdAt',
            order: 'desc'
        });
    });

    it('obcy status/sort/order spadają do defaultów; daty muszą być YYYY-MM-DD', () => {
        const p = parseSearchParams({
            status: 'hacked',
            sort: 'password',
            order: 'sideways',
            dateFrom: '2026-1-1',
            dateTo: 'nie-data'
        });
        expect(p.status).toBe('all');
        expect(p.sort).toBe('createdAt');
        expect(p.order).toBe('desc');
        expect(p.dateFrom).toBe('');
        expect(p.dateTo).toBe('');
    });

    it('poprawne daty przechodzą; limit clamp 1..500; asc przechodzi', () => {
        const p = parseSearchParams({
            dateFrom: '2026-01-01',
            dateTo: '2026-10-04',
            limit: '9999',
            order: 'asc',
            q: '  SYM/1  '
        });
        expect(p.dateFrom).toBe('2026-01-01');
        expect(p.dateTo).toBe('2026-10-04');
        expect(p.limit).toBe(500);
        expect(p.order).toBe('asc');
        expect(p.q).toBe('SYM/1');
    });

    it('limit nie-liczba → 50; status draft przechodzi', () => {
        const p = parseSearchParams({ limit: 'abc', status: 'draft' });
        expect(p.limit).toBe(50);
        expect(p.status).toBe('draft');
    });
});

describe('normalizedCreatedAtSql (mieszane ISO/epoch, klasa #38)', () => {
    it('CASE obsługuje epoch-ms i ISO', () => {
        const sql = normalizedCreatedAtSql() as unknown as { sql: string };
        expect(sql.sql).toContain('CASE');
        expect(sql.sql).toContain('unixepoch');
    });
});

describe('mapProductionOrderRow', () => {
    it('brak wersji → 1; brak liczników → 0; brak nazw → undefined', () => {
        const r = mapProductionOrderRow({
            id: 'x',
            data: '{}'
        }) as Record<string, unknown>;
        expect(r.version).toBe(1);
        expect(r.printCountZlecenia).toBe(0);
        expect(r.printCountEtykieta).toBe(0);
        expect(r.handlerName).toBeUndefined();
    });

    it('kolumna version wygrywa z blobem; handler z imienia+nazwiska', () => {
        const r = mapProductionOrderRow({
            id: 'x',
            version: 7,
            handlerFirstName: 'Jan',
            handlerLastName: 'Kowalski',
            data: JSON.stringify({ version: 2, printCountZlecenia: 2.9 })
        }) as Record<string, unknown>;
        expect(r.version).toBe(7);
        expect(r.handlerName).toBe('Jan Kowalski');
        expect(r.printCountZlecenia).toBe(2);
    });

    it('ujemny licznik → 0 (kompatybilność wsteczna)', () => {
        const r = mapProductionOrderRow({
            id: 'x',
            data: JSON.stringify({ printCountZlecenia: -5 })
        }) as Record<string, unknown>;
        expect(r.printCountZlecenia).toBe(0);
    });
});
