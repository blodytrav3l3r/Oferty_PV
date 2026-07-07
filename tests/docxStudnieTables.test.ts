import { groupWellsByDn } from '../src/services/docx/studnie/tables';

describe('docx/studnie/tables — groupWellsByDn (DN uppercase + productName)', () => {
    it('groupuje po DN (uppercase) — flow zamowienia z buildStudnieOrderContextFromOrderId', () => {
        const items = [
            {
                DN: '1000',
                productName: 'Studnia DN1000 #1',
                height: 2000,
                weight: 1500,
                zwienczenie: 'Płyta',
                price: 5000,
                transportCost: 250,
                totalPrice: 5250
            },
            {
                DN: '1500',
                productName: 'Studnia DN1500 #2 (nowa)',
                height: 2200,
                weight: 2000,
                zwienczenie: 'Właz',
                price: 7000,
                transportCost: 350,
                totalPrice: 7350
            }
        ];
        const grouped = groupWellsByDn(items);

        expect(Object.keys(grouped).sort()).toEqual(['1000', '1500']);
        expect(grouped['1000']).toHaveLength(1);
        expect(grouped['1000'][0].name).toBe('Studnia DN1000 #1');
        expect(grouped['1500'][0].name).toBe('Studnia DN1500 #2 (nowa)');
    });

    it('groupuje po dn (lowercase) — flow oferty z offerData.wellsExport (backward compat)', () => {
        const items = [
            {
                dn: '1000',
                name: 'Studnia DN1000 oferty',
                height: 2000,
                weight: 1500,
                zwienczenie: 'Płyta',
                price: 5000,
                transportCost: 250,
                totalPrice: 5250
            }
        ];
        const grouped = groupWellsByDn(items);

        expect(Object.keys(grouped)).toEqual(['1000']);
        expect(grouped['1000'][0].name).toBe('Studnia DN1000 oferty');
    });

    it('fallback do "Inne" gdy brak DN i dn (regression test)', () => {
        const items = [{ productName: 'Studnia bez DN', height: 2000, price: 1000 }];
        const grouped = groupWellsByDn(items);

        expect(Object.keys(grouped)).toEqual(['Inne']);
        expect(grouped['Inne']).toHaveLength(1);
        expect(grouped['Inne'][0].name).toBe('Studnia bez DN');
    });

    it('result zawiera name z productName (uppercase) preferowane nad name (lowercase)', () => {
        const items = [{ DN: '1000', productName: 'Z productName', name: 'Z name' }];
        const grouped = groupWellsByDn(items);

        expect(grouped['1000'][0].name).toBe('Z productName');
    });
});
