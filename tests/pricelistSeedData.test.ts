/**
 * `data/seed_*.json` to jedyne źródło cennika fabrycznego (bootstrap, „Przywróć
 * domyślne", `?source=default`). Test pilnuje kontraktu kształtu pozycji wersji.
 */
import {
    getSeedPrecoItems,
    getSeedPrecoNested,
    getSeedRury,
    getSeedRuryItems,
    getSeedStudnie,
    getSeedStudnieItems
} from '../src/services/pricelist/seedData';

const VERSION_ID = 'test-v1';

function expectUniqueIds(rows: Array<Record<string, unknown>>, prefix: string): void {
    const ids = rows.map((row) => String(row.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(prefix)).toBe(true);
}

describe('seed rury', () => {
    it('pozycje wersji mają prefiks wersji i skończoną cenę', () => {
        const rows = getSeedRuryItems(VERSION_ID);

        expectUniqueIds(rows, `${VERSION_ID}:`);
        for (const row of rows) {
            expect(row.versionId).toBe(VERSION_ID);
            expect(typeof row.price).toBe('number');
            expect(Number.isFinite(row.price as number)).toBe(true);
        }
    });

    it('odczyt dla edytora zwraca kopie (mutacja nie psuje cache)', () => {
        const first = getSeedRury();
        const priceBefore = first[0].price;
        first[0].price = -1;

        expect(getSeedRury()[0].price).toBe(priceBefore);
    });
});

describe('seed studnie', () => {
    it('dn jest tekstem, flagi magazynowe to boolean', () => {
        const rows = getSeedStudnieItems(VERSION_ID);

        expectUniqueIds(rows, `${VERSION_ID}:`);
        for (const row of rows) {
            if (row.dn !== null) expect(typeof row.dn).toBe('string');
            expect(typeof row.active).toBe('boolean');
            expect(typeof row.magazynWL).toBe('boolean');
        }
        expect(getSeedStudnie().every((row) => row.dn === null || typeof row.dn === 'string')).toBe(
            true
        );
    });

    it('pusta cena w seedzie nie tworzy NaN (domyślnie 0)', () => {
        for (const row of getSeedStudnieItems(VERSION_ID)) {
            expect(Number.isFinite(row.price as number)).toBe(true);
        }
    });
});

describe('seed preco', () => {
    it('konfig, kinety i zakresy mają unikalne id z prefiksem wersji', () => {
        const { konfig, kinety, zakresy } = getSeedPrecoItems(VERSION_ID);

        expectUniqueIds(konfig, `${VERSION_ID}:konfig:`);
        expectUniqueIds(kinety, `${VERSION_ID}:kinety:`);
        expectUniqueIds(zakresy, `${VERSION_ID}:zakresy:`);
    });

    it('wartości konfigu są JSON-em (kolumna tekstowa)', () => {
        const { konfig } = getSeedPrecoItems(VERSION_ID);

        for (const row of konfig) {
            const parsed = JSON.parse(String(row.value));
            expect(parsed).toBeInstanceOf(Object);
        }
    });

    it('wersja zagnieżdżona (dla `?source=default`) jest niezależną kopią', () => {
        const nested = getSeedPrecoNested();
        const keys = Object.keys(nested);
        expect(keys.length).toBeGreaterThan(0);

        const firstKey = keys[0];
        const before = JSON.stringify(nested[firstKey]);
        nested[firstKey] = { skazone: true };

        expect(JSON.stringify(getSeedPrecoNested()[firstKey])).toBe(before);
    });
});
