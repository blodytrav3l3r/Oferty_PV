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
import { validateRows } from '../src/services/pricelist/validation';

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

    it('seed i wersja bazowa zawierają kinety z co najmniej jednym poprawnym pasmem ceny', () => {
        const rows = getSeedStudnieItems(VERSION_ID);
        const validatedRows = validateRows('studnie', rows) as unknown as Array<
            Record<string, unknown>
        >;
        const kinety = validatedRows.filter((row) => row.componentType === 'kineta');

        expect(kinety.length).toBeGreaterThan(0);
        for (const kineta of kinety) {
            const hasUsableBand = [1, 2, 3].some((number) => {
                const min = kineta[`hMin${number}`];
                const max = kineta[`hMax${number}`];
                const price = kineta[`cena${number}`];
                return (
                    typeof min === 'number' &&
                    typeof max === 'number' &&
                    typeof price === 'number' &&
                    min <= max
                );
            });
            expect(hasUsableBand).toBe(true);
        }
    });

    it('odrzuca kinetę bez poprawnego pasma przy walidacji cennika domyślnego', () => {
        const rows = getSeedStudnieItems(VERSION_ID) as Array<Record<string, unknown>>;
        const targetIndex = rows.findIndex((row) => row.componentType === 'kineta');
        expect(targetIndex).toBeGreaterThanOrEqual(0);
        const invalidRows = rows.map((row, index) =>
            index === targetIndex
                ? {
                      ...row,
                      hMin1: null,
                      hMax1: null,
                      cena1: null,
                      hMin2: null,
                      hMax2: null,
                      cena2: null,
                      hMin3: null,
                      hMax3: null,
                      cena3: null
                  }
                : row
        );

        expect(() => validateRows('studnie', invalidRows)).toThrow(
            'Kineta musi mieć co najmniej jeden poprawny zakres Hmin/Hmax z ceną'
        );
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

    it('zakresy uniesienie/redukcja: max > 0, max >= min i brak nakładania', () => {
        const { zakresy } = getSeedPrecoItems(VERSION_ID);
        const byKey = new Map<string, Array<{ order: number; min: number; max: number }>>();
        for (const row of zakresy) {
            const label = String(row.label);
            if (label !== 'uniesienie' && label !== 'redukcja') continue;
            const key = `${String(row.wellDn)}|${label}`;
            const list = byKey.get(key) ?? [];
            list.push({
                order: Number(row.order),
                min: Number(row.min),
                max: Number(row.max)
            });
            byKey.set(key, list);
        }

        const violations: string[] = [];
        for (const [key, list] of byKey) {
            const sorted = [...list].sort((a, b) => a.order - b.order);
            for (const r of sorted) {
                if (!(r.max > 0) || r.max < r.min) {
                    violations.push(`${key} order ${r.order}: ${r.min}-${r.max}`);
                }
            }
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].min <= sorted[i - 1].max) {
                    violations.push(
                        `${key}: ${sorted[i - 1].min}-${sorted[i - 1].max} nachodzi na ${sorted[i].min}-${sorted[i].max}`
                    );
                }
            }
        }

        expect(violations).toEqual([]);
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
