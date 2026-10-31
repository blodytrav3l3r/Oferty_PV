/**
 * Kanoniczny JSON / SHA / diff po `id` — jedyne miejsce, w którym porównujemy
 * wersje cennika (sha256 trafia do `If-Match` i do nagłówka wersji).
 */
import { canonicalStringify, diffById, sha256Canonical } from '../src/services/pricelist/canonical';

describe('canonicalStringify', () => {
    it('kolejność kluczy nie zmienia wyniku', () => {
        expect(canonicalStringify({ b: 1, a: 2 })).toBe(canonicalStringify({ a: 2, b: 1 }));
    });

    it('sortuje klucze rekurencyjnie, zachowuje kolejność tablic', () => {
        expect(canonicalStringify({ x: { b: [3, 1], a: 2 } })).toBe('{"x":{"a":2,"b":[3,1]}}');
        expect(canonicalStringify([1, 2])).not.toBe(canonicalStringify([2, 1]));
    });

    it('null, liczby i stringi zostają bez zmian', () => {
        expect(canonicalStringify(null)).toBe('null');
        expect(canonicalStringify(10.5)).toBe('10.5');
        expect(canonicalStringify('ą')).toBe('"ą"');
    });
});

describe('sha256Canonical', () => {
    it('ten sam hash dla tej samej treści w innej kolejności kluczy', () => {
        expect(sha256Canonical({ a: 1, b: 2 })).toBe(sha256Canonical({ b: 2, a: 1 }));
    });

    it('inny hash po zmianie wartości', () => {
        expect(sha256Canonical({ a: 1 })).not.toBe(sha256Canonical({ a: 2 }));
    });
});

describe('diffById', () => {
    it('liczy dodane, usunięte i zmienione wiersze', () => {
        const current = [
            { id: 'a', price: 10 },
            { id: 'b', price: 20 },
            { id: 'c', price: 30 }
        ];
        const incoming = [
            { id: 'b', price: 20 },
            { id: 'c', price: 31 },
            { id: 'd', price: 40 }
        ];

        expect(diffById(current, incoming)).toEqual({ added: 1, removed: 1, changed: 1 });
    });

    it('brak zmian = zera', () => {
        const rows = [{ id: 'a', price: 10 }];
        expect(diffById(rows, [{ price: 10, id: 'a' }])).toEqual({
            added: 0,
            removed: 0,
            changed: 0
        });
    });

    it('id 1 i "1" to ten sam wiersz, ale inny typ id = zmiana', () => {
        expect(diffById([{ id: 1, price: 5 }], [{ id: '1', price: 5 }])).toEqual({
            added: 0,
            removed: 0,
            changed: 1
        });
    });
});
