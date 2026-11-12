import fs from 'fs';
import path from 'path';
import vm from 'vm';

interface NumberingApi {
    getNextOfferNumber: (options: {
        prefix: 'OF' | 'OS';
        offers: Array<{ number?: string; offer_number?: string }>;
        organizationUnit?: string | null;
        year: number;
    }) => string;
}

describe('numeracja nowych ofert według jednostki i roku', () => {
    const loadNumberingApi = (): NumberingApi => {
        const window: Partial<NumberingApi> = {};
        const document = { addEventListener: () => {}, getElementById: () => null };
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/shared/offerNumbering.js'),
            'utf8'
        );

        vm.runInNewContext(source, { window, document });
        return window as NumberingApi;
    };

    test('oddziela liczniki jednostek i kontynuuje najwyższy numer w bieżącym roku', () => {
        const { getNextOfferNumber } = loadNumberingApi();
        const offers = [
            { number: 'OF/000007/ASM/2026' },
            { offer_number: 'OF/000003/WL/2026' },
            { number: 'OF/000099/ASM/2025' }
        ];

        expect(
            getNextOfferNumber({
                prefix: 'OF',
                offers,
                organizationUnit: 'ASM_KLUCZBORK',
                year: 2026
            })
        ).toBe('OF/000008/ASM/2026');
        expect(
            getNextOfferNumber({
                prefix: 'OF',
                offers,
                organizationUnit: 'WL_WLOCLAWEK',
                year: 2026
            })
        ).toBe('OF/000004/WL/2026');
    });

    test('rozpoczyna nową numerację od 000001 po zmianie roku', () => {
        const { getNextOfferNumber } = loadNumberingApi();

        expect(
            getNextOfferNumber({
                prefix: 'OF',
                offers: [{ number: 'OF/000042/ASM/2026' }],
                organizationUnit: 'ASM_KLUCZBORK',
                year: 2027
            })
        ).toBe('OF/000001/ASM/2027');
    });

    test('stosuje kod jednostki również do numerów ofert studni', () => {
        const { getNextOfferNumber } = loadNumberingApi();

        expect(
            getNextOfferNumber({
                prefix: 'OS',
                offers: [],
                organizationUnit: 'WL_WLOCLAWEK',
                year: 2026
            })
        ).toBe('OS/000001/WL/2026');
    });
});
