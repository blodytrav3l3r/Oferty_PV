import * as fs from 'fs';
import * as path from 'path';
import {
    observeStudnieOrderDto,
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

/** Delta FE→BE znana w dniu symulacji (do decyzji LEGACY przy flipie). */
const KNOWN_DELTA = ['frozenPrecoSuma', 'redukcjaZakonczenieByDn', 'stycznaDn'];

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

    test('KNOWN_ANOMALY: type w kontrakcie, a flagowane jako leak', () => {
        const obs = observeStudnieOrderDto({
            wells: [{ id: 'w1', type: 'standard', config: [], przejscia: [] }]
        });
        // Kontrakt zna 'type' (ORDER_WELL_DTO_FIELDS) — a denylist też.
        expect(ORDER_WELL_DTO_FIELDS).toContain('type');
        expect(obs.unknownKeysTotal).toBe(0);
        // Stan obecny do rozstrzygnięcia przed flipem (nie FIX w tym teście).
        expect(obs.runtimeLeaked).toContain('type');
    });

    test('werdykt symulacji: flip NIE jest dziś bezpieczny', () => {
        const obs = observeStudnieOrderDto({ wells: [fullFeWell()] });
        const strictWouldRejectLegal =
            obs.unknownWellKeys.length > 0 || obs.runtimeLeaked.includes('type');
        // Gdy to padnie (false), kontrakt dogoniony — wolno projektować flip.
        expect(strictWouldRejectLegal).toBe(true);
    });
});
