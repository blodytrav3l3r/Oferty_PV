export {};

/**
 * Detektor rozjazdu ACTIVE vs LIVE.
 *
 * Regresja, którą to łapie: `approveVersion` nie synchronizuje LIVE, a
 * `prices:verify` porównywał tylko LIVE = tabele domyślne = plik. Efekt: 5 dennic
 * DN1200 miało w LIVE 1150, a we wszystkich wersjach 1050 — oferty liczyły
 * 1050, eksport pokazywał 1150, wszystkie bramy były zielone.
 */

import { compareIndexes, formatDrift, indexRows } from '../src/services/pricelist/drift';
import type { DriftReport } from '../src/services/pricelist/drift';

function rows(list: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return list;
}

describe('indexRows: klucz i pole ceny', () => {
    test('rury/studnie: klucz = id, cena = price', () => {
        const map = indexRows(
            'studnie',
            rows([
                { id: 'A-1', price: 100, name: 'x' },
                { id: 'A-2', price: 200, name: 'y' }
            ]),
            'price'
        );
        expect([...map.keys()]).toEqual(['A-1', 'A-2']);
        expect(map.get('A-1')?.price).toBe(100);
    });

    test('PRECO: JSON-string normalizowany (formatowanie nie jest rozjazdem)', () => {
        const a = indexRows('preco', rows([{ id: 'k', value: '{"a":1,"b":2}' }]), null);
        const b = indexRows('preco', rows([{ id: 'k', value: '{ "b": 2, "a": 1 }' }]), null);
        const { counts } = compareIndexes(a, b);
        expect(counts.changed).toBe(0);
    });

    test('PRECO: różnica wartości w JSON jest rozjazdem', () => {
        const a = indexRows('preco', rows([{ id: 'k', value: '{"cena":1150}' }]), null);
        const b = indexRows('preco', rows([{ id: 'k', value: '{"cena":1050}' }]), null);
        expect(compareIndexes(a, b).counts.changed).toBe(1);
    });
});

describe('compareIndexes', () => {
    test('identyczne zbiory → ok', () => {
        const live = indexRows('rury', rows([{ id: 'R1', price: 10 }]), 'price');
        const active = indexRows('rury', rows([{ id: 'R1', price: 10 }]), 'price');
        const { counts } = compareIndexes(live, active);
        expect(counts).toEqual({
            live: 1,
            active: 1,
            onlyLive: 0,
            onlyActive: 0,
            changed: 0,
            priceDiff: 0
        });
    });

    test('różnica ceny → changed + priceDiff, próbka z cenami', () => {
        const live = indexRows('studnie', rows([{ id: 'DDD-12-115', price: 1150 }]), 'price');
        const active = indexRows('studnie', rows([{ id: 'DDD-12-115', price: 1050 }]), 'price');
        const { counts, samples } = compareIndexes(live, active);
        expect(counts.changed).toBe(1);
        expect(counts.priceDiff).toBe(1);
        expect(samples[0]).toMatchObject({
            key: 'DDD-12-115',
            kind: 'changed',
            field: 'price',
            live: 1150,
            active: 1050
        });
    });

    test('tylko w LIVE i tylko w ACTIVE są liczone osobno', () => {
        const live = indexRows(
            'rury',
            rows([
                { id: 'R1', price: 1 },
                { id: 'R2', price: 2 }
            ]),
            'price'
        );
        const active = indexRows(
            'rury',
            rows([
                { id: 'R2', price: 2 },
                { id: 'R3', price: 3 }
            ]),
            'price'
        );
        const { counts } = compareIndexes(live, active);
        expect(counts.onlyLive).toBe(1);
        expect(counts.onlyActive).toBe(1);
        expect(counts.changed).toBe(0);
    });

    test('zmiana flagi (bez ceny) to changed, ale nie priceDiff', () => {
        const live = indexRows(
            'studnie',
            rows([{ id: 'S1', price: 10, magazynWL: true }]),
            'price'
        );
        const active = indexRows(
            'studnie',
            rows([{ id: 'S1', price: 10, magazynWL: false }]),
            'price'
        );
        const { counts, fields, samples } = compareIndexes(live, active);
        expect(counts.changed).toBe(1);
        expect(counts.priceDiff).toBe(0);
        expect(fields).toEqual({ magazynWL: 1 });
        expect(samples[0].field).toBe('magazynWL');
    });

    test('agreguje różne pola (cena + dn) w jednym raporcie', () => {
        const live = indexRows(
            'studnie',
            rows([
                { id: 'S1', price: 1150, dn: '1000/1500' },
                { id: 'S2', price: 10, dn: '1000/1500' }
            ]),
            'price'
        );
        const active = indexRows(
            'studnie',
            rows([
                { id: 'S1', price: 1050, dn: '1000' },
                { id: 'S2', price: 10, dn: '1000' }
            ]),
            'price'
        );
        const { counts, fields, samples } = compareIndexes(live, active);
        expect(counts.changed).toBe(2);
        expect(counts.priceDiff).toBe(1);
        expect(fields).toEqual({ price: 1, dn: 2 });
        // próbki z ceną idą pierwsze
        expect(samples[0]).toMatchObject({ key: 'S1', field: 'price', live: 1150, active: 1050 });
    });

    test('limit próbek nie zmienia liczników', () => {
        const liveRows = Array.from({ length: 30 }, (_, i) => ({ id: `R${i}`, price: i }));
        const activeRows = Array.from({ length: 30 }, (_, i) => ({ id: `R${i}`, price: i + 1 }));
        const { counts, samples } = compareIndexes(
            indexRows('rury', rows(liveRows), 'price'),
            indexRows('rury', rows(activeRows), 'price'),
            5
        );
        expect(counts.changed).toBe(30);
        expect(samples).toHaveLength(5);
    });
});

describe('formatDrift', () => {
    function report(overrides: Partial<DriftReport>): DriftReport {
        return {
            type: 'studnie',
            activeVersionId: 'v1',
            noActive: false,
            counts: {
                live: 690,
                active: 690,
                onlyLive: 0,
                onlyActive: 0,
                changed: 5,
                priceDiff: 5
            },
            samples: [],
            fields: {},
            ok: false,
            ...overrides
        };
    }

    test('rozjazd pokazuje liczniki, ceny i pola', () => {
        const line = formatDrift(report({ fields: { price: 5, dn: 280 } }));
        expect(line).toContain('ROZJAZD');
        expect(line).toContain('changed=5');
        expect(line).toContain('ceny=5');
        expect(line).toContain('pola: dn=280 price=5');
    });

    test('zgodność', () => {
        const line = formatDrift(
            report({
                ok: true,
                counts: {
                    live: 1,
                    active: 1,
                    onlyLive: 0,
                    onlyActive: 0,
                    changed: 0,
                    priceDiff: 0
                }
            })
        );
        expect(line).toContain('OK');
        expect(line).not.toContain('ROZJAZD');
    });

    test('brak ACTIVE jest jawnie oznaczony', () => {
        const line = formatDrift(
            report({
                activeVersionId: null,
                noActive: true,
                counts: {
                    live: 690,
                    active: 0,
                    onlyLive: 0,
                    onlyActive: 0,
                    changed: 0,
                    priceDiff: 0
                }
            })
        );
        expect(line).toContain('BRAK aktywnej wersji');
    });
});
