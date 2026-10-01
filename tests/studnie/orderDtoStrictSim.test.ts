import * as fs from 'fs';
import * as path from 'path';
import {
    observeStudnieOrderDto,
    studnieOrderItemSchema,
    ORDER_WELL_DTO_FIELDS,
    ORDER_CONFIG_ITEM_DTO_FIELDS,
    ORDER_PRZEJSCIE_DTO_FIELDS
} from '../../src/validators/orderSchemas';

/**
 * Symulacja flipa `.passthrough()` → `.strict()` dla zamówień studni.
 *
 * Zamiast czekać na produkcyjne logi `[DTO-observe]`, test odtwarza ruch:
 * buduje payload DOKŁADNIE z allowlist frontendu (orderDto.js, parsowane
 * ze źródła — brak duplikacji list) i puszcza przez observeStudnieOrderDto.
 *
 * Konwencje:
 * - KNOWN_DELTA: klucze emitowane przez FE, nieznane kontraktowi BE.
 *   Każdy NOWY klucz spoza tej listy wywala test → wymusza decyzję
 *   KEEP / STRIP / STRICT / LEGACY zanim flip stanie się bezpieczny.
 * - KNOWN_ANOMALY_TYPE: 'type' jest w kontrakcie BE i w denylist runtime
 *   jednocześnie — observe flaguje legalne pole jako leak. Do rozstrzygnięcia
 *   przed flipem (usunąć z denylist albo udokumentować jako celowe).
 */

const FE_SRC = path.join(__dirname, '..', '..', 'public', 'js', 'studnie', 'orderDto.js');

function feList(varName: string): string[] {
    const src = fs.readFileSync(FE_SRC, 'utf8');
    const m = new RegExp(`const ${varName} = \\[([\\s\\S]*?)\\];`).exec(src);
    if (!m) throw new Error(`nie znaleziono ${varName} w orderDto.js`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** Delta FE→BE: pusta od domknięcia kontraktu (3 klucze LEGACY dodane).
 * Każdy NOWY klucz spoza tej listy wywala test → wymusza decyzję
 * KEEP / STRIP / STRICT / LEGACY zanim flip stanie się bezpieczny. */
const KNOWN_DELTA: string[] = [];

function fullFeWell(): Record<string, unknown> {
    const well: Record<string, unknown> = {};
    for (const k of feList('ORDER_WELL_FIELDS')) {
        well[k] = k === 'dn' ? '1000' : `v-${k}`;
    }
    well['config'] = [
        Object.fromEntries(feList('ORDER_CONFIG_ITEM_FIELDS').map((k) => [k, `c-${k}`]))
    ];
    well['przejscia'] = [
        Object.fromEntries(feList('ORDER_PRZEJSCIE_FIELDS').map((k) => [k, `p-${k}`]))
    ];
    return well;
}

describe('orderDtoStrictSim — symulacja flipa do .strict()', () => {
    test('parzystość list FE↔BE dla config i przejść (identyczne)', () => {
        expect(feList('ORDER_CONFIG_ITEM_FIELDS').sort()).toEqual(
            [...ORDER_CONFIG_ITEM_DTO_FIELDS].sort()
        );
        expect(feList('ORDER_PRZEJSCIE_FIELDS').sort()).toEqual(
            [...ORDER_PRZEJSCIE_DTO_FIELDS].sort()
        );
    });

    test('payload w kształcie FE: tylko KNOWN_DELTA spoza kontraktu', () => {
        const obs = observeStudnieOrderDto({ wells: [fullFeWell()] });
        expect(obs.wellsChecked).toBe(1);
        expect(obs.unknownConfigKeys).toEqual([]);
        expect(obs.unknownPrzejscieKeys).toEqual([]);
        // Twardy gate: nowy klucz z FE bez decyzji kontraktowej = FAIL.
        expect([...obs.unknownWellKeys].sort()).toEqual([...KNOWN_DELTA].sort());
    });

    test('garbage spoza kontraktu wykryty (strict by odrzucił)', () => {
        const well = fullFeWell();
        (well as Record<string, unknown>)['solverCache'] = {};
        (well as Record<string, unknown>)['__totallyNew'] = 1;
        const obs = observeStudnieOrderDto({ wells: [well] });
        expect(obs.unknownKeysTotal).toBeGreaterThan(KNOWN_DELTA.length);
        expect(obs.unknownWellKeys).toContain('solverCache');
    });

    test('runtime leak wykryty (strict by odrzucił, dane nie mogą iść w blob)', () => {
        const well = fullFeWell();
        for (const k of ['__resCache', '_lastAutoConfig', 'configErrors']) {
            (well as Record<string, unknown>)[k] = 1;
        }
        const obs = observeStudnieOrderDto({ wells: [well] });
        expect(obs.runtimeLeaked).toEqual(
            expect.arrayContaining(['__resCache', '_lastAutoConfig', 'configErrors'])
        );
    });

    test('type w kontrakcie i NIE flagowane jako leak (anomalia naprawiona)', () => {
        const obs = observeStudnieOrderDto({
            wells: [{ id: 'w1', type: 'standard', config: [], przejscia: [] }]
        });
        // Kontrakt zna 'type', denylist już nie — czysta studnia bez alarmów.
        expect(ORDER_WELL_DTO_FIELDS).toContain('type');
        expect(obs.unknownKeysTotal).toBe(0);
        expect(obs.runtimeLeaked).not.toContain('type');
    });

    test('werdykt symulacji: poziom studni gotowy, top-level NIE (rest→blob)', () => {
        const obs = observeStudnieOrderDto({ wells: [fullFeWell()] });
        // Poziom studni/config/przejść: zero unknown — strict-safe.
        expect(obs.unknownKeysTotal).toBe(0);
        expect(obs.runtimeLeaked).toEqual([]);
        // ALE: route robi `...rest → blob` (studnieOrders.crud.ts:201-206),
        // więc top-level MUSI zostać passthrough do inwentaryzacji kluczy
        // (offerId, updatedAt, serverVersion, ...). Ślepy strict na
        // studnieOrderItemSchema dziś odrzuciłby legalny ruch.
        expect(studnieOrderItemSchema.safeParse({ id: 'o1', offerId: 'x' }).success).toBe(true);
    });
});
