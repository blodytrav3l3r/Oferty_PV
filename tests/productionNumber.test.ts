import {
    formatProductionNumber,
    formatProductionPrintNumber,
    parseProductionNumber
} from '../src/utils/productionNumber';

describe('production number format', () => {
    test('formats new global numbers without user symbol', () => {
        expect(formatProductionNumber('A', 42, 2026)).toBe('A/00042/26');
    });

    test.each([
        ['A/00042/26', { year: 2026, seqNumber: 42 }],
        ['SA/A/00042/26', { year: 2026, seqNumber: 42 }],
        ['XX/PZ/00042/26', { year: 2026, seqNumber: 42 }]
    ])('parses current and legacy formats: %s', (value, expected) => {
        expect(parseProductionNumber(value)).toEqual(expected);
    });

    test.each([
        'A/00000/26',
        'A/42/26',
        'A/000042/26',
        'SA/A/00042/2',
        'A/not-a-number/26',
        'SA/00042/26',
        'A/2147483648/26',
        'AB/A/9999999999/26'
    ])('rejects malformed or zero numbers: %s', (value) => {
        expect(parseProductionNumber(value)).toBeNull();
    });
});

describe('produkcja — numer na wydruku zlecenia', () => {
    test('prefiks roku zastąpiony symbolem opiekuna', () => {
        expect(formatProductionPrintNumber('N/00002/26', 'SA')).toBe('SA/00002/26');
        expect(formatProductionPrintNumber('A/00042/26', 'LK')).toBe('LK/00042/26');
    });

    test('brak symbolu → numer bez zmian (fallback jak na liście/etykiecie)', () => {
        expect(formatProductionPrintNumber('N/00002/26', null)).toBe('N/00002/26');
        expect(formatProductionPrintNumber('N/00002/26', '   ')).toBe('N/00002/26');
    });

    test('symbol spoza [A-Za-z0-9]{1,6} → numer bez zmian (brak HTML w wydruku)', () => {
        expect(formatProductionPrintNumber('N/00002/26', '<b>SA')).toBe('N/00002/26');
        expect(formatProductionPrintNumber('N/00002/26', 'SA/')).toBe('N/00002/26');
        expect(formatProductionPrintNumber('N/00002/26', 'SYSTEMADMIN')).toBe('N/00002/26');
    });

    test('pusty numer → pusty string', () => {
        expect(formatProductionPrintNumber('', 'SA')).toBe('');
        expect(formatProductionPrintNumber(null, 'SA')).toBe('');
    });

    test('numer bez separatorów → bez zmian', () => {
        expect(formatProductionPrintNumber('N00000226', 'SA')).toBe('N00000226');
    });

    test('numer nie jest modyfikowany w bazie — parse nadal widzi format roku', () => {
        expect(parseProductionNumber('N/00002/26')).toEqual({ year: 2026, seqNumber: 2 });
        expect(parseProductionNumber(formatProductionPrintNumber('N/00002/26', 'SA'))).toBeNull();
    });
});
