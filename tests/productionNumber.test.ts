import { formatProductionNumber, parseProductionNumber } from '../src/utils/productionNumber';

describe('production number format', () => {
    test('formats new global numbers without user symbol', () => {
        expect(formatProductionNumber('A', 42, 2026)).toBe('A/00042/26');
    });

    test.each([
        ['A/00042/26', { year: 2026, seqNumber: 42 }],
        ['SA/A/00042/26', { year: 2026, seqNumber: 42 }]
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
