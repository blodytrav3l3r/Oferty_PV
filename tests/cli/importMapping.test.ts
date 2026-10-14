// @ts-nocheck -- import skryptu CLI + vm, celowy brak typow
/* =============================================================
   F1 (opcja C): kontrakt mapowania scripts/import-offers.ts.
   Pinuje: parsePlNumber PL/EN, payload 1:1 z FE (rury/studnie
   externalImport.js), rabat 0-100 (bez /100), Zod serwera przechodzi.
   ============================================================= */
import {
    parsePlNumber,
    looksBinary,
    normalizeHeader,
    validateHeaders,
    groupRowsIntoOffers,
    detectModule,
    buildRuryPayload,
    buildStudniePayload
} from '../../scripts/import-offers';
import { offersBatchSchema, offersStudnieBatchSchema } from '../../src/validators/offerSchemas';

function ruryRow(over = {}) {
    return {
        NUMER_OFERTY: 'OF/1',
        NR_STUDNI: '',
        GLEBOKOSC: '',
        INDEKS_CZESCI: 'ABC-1',
        ILOSC: '2',
        CENA_JEDNOSTKOWA: '100',
        WERSJA: '1',
        RABAT: '',
        SREDNICA: '',
        ZAKONCZENIE: '',
        MAGAZYN: '',
        LP: '1',
        ...over
    };
}

describe('import-offers: parsePlNumber', () => {
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
        expect(parsePlNumber(raw)).toBe(expected);
    });

    test.each([[''], ['   '], ['brak'], ['-'], ['—'], ['12abc'], [null], [undefined], [NaN]])(
        '%s -> null (nigdy ciche 0)',
        (raw) => {
            expect(parsePlNumber(raw)).toBeNull();
        }
    );

    test('liczba przechodzi, Infinity -> null', () => {
        expect(parsePlNumber(12.5)).toBe(12.5);
        expect(parsePlNumber(Infinity)).toBeNull();
    });
});

describe('import-offers: naglowki i grupowanie (1:1 FE)', () => {
    test('looksBinary: tekst ok, NUL/ESC -> binarka', () => {
        expect(looksBinary('NUMER_OFERTY,ILOSC\nOF/1,2\n')).toBe(false);
        expect(looksBinary('PK\x03\x04')).toBe(true);
        expect(looksBinary('a\tb\nc\rd')).toBe(false);
    });

    test('normalize/validate jak XlsxImportShared', () => {
        expect(normalizeHeader('  ilosc ')).toBe('ILOSC');
        expect(validateHeaders(['NUMER_OFERTY', 'ILOSC'])).toEqual([
            'INDEKS_CZESCI',
            'CENA_JEDNOSTKOWA'
        ]);
    });

    test('grupowanie + BRAK_NUMERU', () => {
        const groups = groupRowsIntoOffers([
            ruryRow({ NUMER_OFERTY: 'OF/1' }),
            ruryRow({ NUMER_OFERTY: 'OF/2' }),
            ruryRow({ NUMER_OFERTY: '' })
        ]);
        expect(groups).toHaveLength(3);
        expect(groups.find((g) => g.number === 'BRAK_NUMERU').rows).toHaveLength(1);
    });
});

describe('import-offers: detectModule (1:1 toolbar.js)', () => {
    const sets = { rury: new Set(['R-1']), studnie: new Set(['S-1']) };
    test('TR-RURY / TR-STUDNIE rozstrzyga', () => {
        expect(
            detectModule({ number: 'OF/1', rows: [ruryRow({ INDEKS_CZESCI: 'TR-RURY' })] }, sets)
        ).toBe('rury');
        expect(
            detectModule({ number: 'OF/1', rows: [ruryRow({ INDEKS_CZESCI: 'TR-STUDNIE' })] }, sets)
        ).toBe('studnie');
    });

    test('glosowanie katalogu, remis -> unknown', () => {
        expect(
            detectModule({ number: 'OF/1', rows: [ruryRow({ INDEKS_CZESCI: 'R-1' })] }, sets)
        ).toBe('rury');
        expect(
            detectModule({ number: 'OF/1', rows: [ruryRow({ INDEKS_CZESCI: 'XXX' })] }, sets)
        ).toBe('unknown');
        expect(
            detectModule({ number: 'OF/1', rows: [ruryRow({ INDEKS_CZESCI: 'XXX' })] }, null)
        ).toBe('unknown');
    });
});

describe('import-offers: buildRuryPayload (1:1 FE)', () => {
    test('ksztalt jak FE, rabat 0-100 bez /100', () => {
        const errors = [];
        const built = buildRuryPayload(
            'OF/1',
            [
                ruryRow({
                    ILOSC: '2',
                    CENA_JEDNOSTKOWA: '1 234,50',
                    RABAT: '10',
                    NR_STUDNI: 'PEHD-3MM'
                })
            ],
            errors
        );
        expect(errors).toHaveLength(0);
        expect(built.module).toBe('rury');
        expect(built.payload.items[0]).toEqual({
            productId: 'ABC-1',
            quantity: 2,
            discount: 10,
            unitPrice: 1234.5,
            price: 1234.5,
            pehdType: 'PEHD-3MM'
        });
    });

    test('TR-RURY filtrowany + transportSeparate', () => {
        const errors = [];
        const built = buildRuryPayload(
            'OF/1',
            [ruryRow(), ruryRow({ INDEKS_CZESCI: 'TR-RURY' })],
            errors
        );
        expect(built.payload.items).toHaveLength(1);
        expect(built.payload.transportSeparate).toBe(true);
    });

    test('bledne wiersze -> null + error (qty 0, ujemna, rabat 250, tekst)', () => {
        for (const over of [
            { ILOSC: '0' },
            { ILOSC: '-2' },
            { ILOSC: 'brak' },
            { CENA_JEDNOSTKOWA: 'za darmo' },
            { RABAT: '250' }
        ]) {
            const errors = [];
            expect(buildRuryPayload('OF/1', [ruryRow(over)], errors)).toBeNull();
            expect(errors).toHaveLength(1);
        }
    });

    test('payload przechodzi offersBatchSchema (Zod serwera)', () => {
        const errors = [];
        const built = buildRuryPayload('OF/1', [ruryRow()], errors);
        const parsed = offersBatchSchema.safeParse({ data: [built.payload] });
        expect(parsed.success).toBe(true);
    });
});

describe('import-offers: buildStudniePayload (1:1 FE)', () => {
    const typeMap = new Map([['DEN-1', 'dennica']]);
    const codes = { dennicaWl: 'WL', dennicaKlb: 'M0', nadbudowaWl: 'WL', nadbudowaKlb: 'M0' };

    test('grupowanie po NR_STUDNI + magazyn WL -> Wloclawek', () => {
        const errors = [];
        const built = buildStudniePayload(
            'OS/1',
            [
                ruryRow({
                    NR_STUDNI: 'S1',
                    INDEKS_CZESCI: 'DEN-1',
                    MAGAZYN: 'WL',
                    SREDNICA: '1000',
                    GLEBOKOSC: '3'
                }),
                ruryRow({ NR_STUDNI: 'S1', INDEKS_CZESCI: 'NAD-1', MAGAZYN: 'M0' }),
                ruryRow({ NR_STUDNI: 'S2', INDEKS_CZESCI: 'NAD-1', MAGAZYN: '' })
            ],
            typeMap,
            codes,
            errors
        );
        expect(errors).toHaveLength(0);
        expect(built.wellsCount).toBe(2);
        const s1 = built.payload.wells.find((w) => w.name === 'S1');
        expect(s1.magazynDennica).toBe('Włocławek');
        expect(s1.magazynNadbudowa).toBe('Kluczbork');
        expect(s1.dn).toBe('1000');
        expect(s1.depth).toBe(3);
        expect(s1.components[0]).toEqual({
            indeks: 'DEN-1',
            ilosc: 2,
            rabat: 0,
            cenaJednostkowa: 100
        });
    });

    test('TR-STUDNIE filtrowany, bledna ilosc -> null', () => {
        const errors = [];
        const built = buildStudniePayload(
            'OS/1',
            [ruryRow({ INDEKS_CZESCI: 'TR-STUDNIE' }), ruryRow({ ILOSC: 'x' })],
            typeMap,
            codes,
            errors
        );
        expect(built).toBeNull();
        expect(built === null && errors[0].col).toBe('ILOSC');
    });

    test('payload przechodzi offersStudnieBatchSchema (Zod serwera)', () => {
        const errors = [];
        const built = buildStudniePayload(
            'OS/1',
            [ruryRow({ SREDNICA: '1000' })],
            typeMap,
            codes,
            errors
        );
        expect(errors).toHaveLength(0);
        const parsed = offersStudnieBatchSchema.safeParse({ data: [built.payload] });
        expect(parsed.success).toBe(true);
    });

    test('pusta SREDNICA -> brak klucza dn (nie "", serwer wymaga min 1)', () => {
        const errors = [];
        const built = buildStudniePayload(
            'OS/1',
            [ruryRow({ SREDNICA: '' })],
            typeMap,
            codes,
            errors
        );
        expect(errors).toHaveLength(0);
        expect('dn' in built.payload.wells[0]).toBe(false);
        const parsed = offersStudnieBatchSchema.safeParse({ data: [built.payload] });
        expect(parsed.success).toBe(true);
    });
});
