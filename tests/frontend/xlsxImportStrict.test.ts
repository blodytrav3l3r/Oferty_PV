// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* =============================================================
   A+B: scisle liczby importu ofert (koniec cichego 0, D-FIX-2).
   SSoT: XlsxImportShared.parsePlNumber; rury _buildItems;
   studnie _groupRowsStrict (+ legacy _groupRows nietkniety).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function contextWithShared() {
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of ['public/js/import-export/shared/xlsxImportShared.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
    }
    return sandbox;
}

function loadRury(sandbox) {
    const f = 'public/js/import-export/rury/externalImport.js';
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
    return sandbox.window.RuryExternalImport;
}

function loadStudnie(sandbox) {
    const f = 'public/js/import-export/studnie/externalImport.js';
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
    return sandbox.window.StudnieExternalImport;
}

describe('strict: parsePlNumber (SSoT)', () => {
    const sb = contextWithShared();
    const P = sb.window.XlsxImportShared.parsePlNumber;

    test.each([
        ['1 234,50', 1234.5],
        ['1 234,50', 1234.5],
        ['1,234.50', 1234.5],
        ['1.234,50', 1234.5],
        ['10%', 10],
        ['10,5', 10.5],
        ['-5', -5],
        ['250', 250]
    ])('%s -> %s', (raw, expected) => {
        expect(P(raw)).toBe(expected);
    });

    test.each([[''], ['   '], ['brak'], ['-'], ['—'], ['12abc'], [null], [undefined], [NaN]])(
        '%s -> null (nigdy ciche 0)',
        (raw) => {
            expect(P(raw)).toBeNull();
        }
    );

    test('number przechodzi, Infinity -> null', () => {
        expect(P(12.5)).toBe(12.5);
        expect(P(Infinity)).toBeNull();
    });
});

describe('strict: rury _buildItems', () => {
    const sb = contextWithShared();
    const R = loadRury(sb);
    const row = (over = {}) => ({
        NUMER_OFERTY: 'OF/1',
        NR_STUDNI: '',
        GLEBOKOSC: '',
        INDEKS_CZESCI: 'ABC-1',
        ILOSC: '2',
        CENA_JEDNOSTKOWA: '1 234,50',
        WERSJA: '1',
        RABAT: '10',
        SREDNICA: '',
        ZAKONCZENIE: '',
        MAGAZYN: '',
        LP: '1',
        ...over
    });

    test('ksztalt jak wczesniej, rabat 0-100 bez zmian', () => {
        const { items, errors } = R._buildItems([row({ NR_STUDNI: 'PEHD-3MM' })]);
        expect(errors).toHaveLength(0);
        expect(items[0]).toEqual({
            productId: 'ABC-1',
            quantity: 2,
            discount: 10,
            unitPrice: 1234.5,
            price: 1234.5,
            pehdType: 'PEHD-3MM'
        });
    });

    test('TR-RURY filtrowany + flaga', () => {
        const { items, transportSeparate } = R._buildItems([
            row(),
            row({ INDEKS_CZESCI: 'TR-RURY' })
        ]);
        expect(items).toHaveLength(1);
        expect(transportSeparate).toBe(true);
    });

    test('bledne wiersze pomijane z bledem (qty 0, tekst, rabat 250)', () => {
        const { items, errors } = R._buildItems([
            row(),
            row({ ILOSC: '0' }),
            row({ ILOSC: 'brak' }),
            row({ CENA_JEDNOSTKOWA: 'za darmo' }),
            row({ RABAT: '250' })
        ]);
        expect(items).toHaveLength(1);
        expect(errors).toHaveLength(4);
        expect(errors.map((e) => e.col)).toEqual(['ILOSC', 'ILOSC', 'CENA_JEDNOSTKOWA', 'RABAT']);
        expect(errors[0].row).toBe(3);
    });
});

describe('strict: studnie _groupRowsStrict', () => {
    const sb = contextWithShared();
    // Stub MagazynCodes 1:1 z magazynCodes.js (DENNICA_TYPES + WL->Wloclawek).
    sb.MagazynCodes = {
        isDennicaType: (ct) => ['dennica', 'kineta', 'styczna'].includes(ct),
        warehouseForCode: (code) =>
            String(code || '')
                .trim()
                .toUpperCase() === 'WL'
                ? 'Włocławek'
                : 'Kluczbork'
    };
    const S = loadStudnie(sb);
    const typeMap = new Map([['DEN-1', 'dennica']]);
    const row = (over = {}) => ({
        NUMER_OFERTY: 'OS/1',
        NR_STUDNI: 'S1',
        GLEBOKOSC: '3',
        INDEKS_CZESCI: 'DEN-1',
        ILOSC: '2',
        CENA_JEDNOSTKOWA: '100',
        WERSJA: '1',
        RABAT: '10',
        SREDNICA: '1000',
        ZAKONCZENIE: 'X',
        MAGAZYN: 'WL',
        LP: '1',
        ...over
    });

    test('rabat 0-100 bez /100, magazyn WL -> Wloclawek (fallback)', () => {
        const { wells, errors } = S._groupRowsStrict([row()], null, typeMap);
        expect(errors).toHaveLength(0);
        expect(wells).toHaveLength(1);
        expect(wells[0].magazynDennica).toBe('Włocławek');
        expect(wells[0].components[0]).toEqual({
            indeks: 'DEN-1',
            ilosc: 2,
            rabat: 10,
            cenaJednostkowa: 100
        });
    });

    test('bledne wiersze pomijane, poprawne zostaja', () => {
        const { wells, errors } = S._groupRowsStrict(
            [row(), row({ ILOSC: 'x' }), row({ RABAT: '250' })],
            null,
            typeMap
        );
        expect(wells[0].components).toHaveLength(1);
        expect(errors).toHaveLength(2);
    });

    test('legacy _groupRows nietkniety (stare /100 + finalPrice)', () => {
        const wells = S._groupRows([row({ RABAT: '10' })], null, typeMap);
        expect(wells[0].components[0].rabat).toBeCloseTo(0.1);
        expect(wells[0].components[0].cenaJednostkowa).toBe(100);
    });
});

describe('strict: showRowErrors', () => {
    test('bez showModal -> resolve close + warn (srodowisko testowe)', async () => {
        const sb = contextWithShared();
        const warns = [];
        sb.console = { warn: (...a) => warns.push(a) };
        const res = await sb.window.XlsxImportShared.showRowErrors(
            [
                {
                    sheet: 'Import',
                    row: 3,
                    col: 'ILOSC',
                    value: 'brak',
                    reason: 'ilosc-calkowita-dodatnia'
                }
            ],
            'stat'
        );
        expect(res).toBe('close');
        expect(warns.length).toBe(1);
    });
});
