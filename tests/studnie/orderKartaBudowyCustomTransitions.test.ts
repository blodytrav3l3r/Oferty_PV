// @ts-nocheck -- VM sandbox, celowo brak typów dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('karta budowy studni: przejścia niestandardowe z oferty', () => {
    function loadKartaBudowyTransitionContext() {
        const container = { innerHTML: '' };
        const context = {
            window: {},
            escapeHtml: (value) => String(value),
            escapeHtmlAttr: (value) => String(value),
            document: {
                getElementById: (id) => (id === 'step4-przejscia-details-table' ? container : null),
                querySelectorAll: () => []
            },
            studnieProducts: [
                {
                    id: 'PRZ-PCV-LITE-315',
                    componentType: 'przejscie',
                    active: 1,
                    category: 'PVC-lite',
                    dn: 315
                }
            ],
            wells: [
                {
                    przejscia: [
                        { productId: 'PRZ-PCV-LITE-315' },
                        {
                            isCustom: true,
                            customTypeId: 'custom-kaczmarek',
                            customName: 'Kaczmarek',
                            dn: 315
                        },
                        {
                            isCustom: true,
                            customTypeId: 'custom-kaczmarek',
                            customName: 'Kaczmarek',
                            dn: 400
                        },
                        { isCustom: true, customTypeId: 'custom-xxx', customName: 'xxx', dn: 20 }
                    ]
                }
            ]
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderPrzejscia.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return { context, container };
    }

    test('łączy typy własne i katalogowe w szczegółach oferty z zakresem DN', () => {
        const { context, container } = loadKartaBudowyTransitionContext();
        const rows = context.buildOfferPrzejsciaTypes();

        expect(rows).toEqual([
            {
                rodzaj: 'Kaczmarek',
                dnOd: 315,
                dnDo: 400,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            },
            {
                rodzaj: 'PVC-lite',
                dnOd: 315,
                dnDo: 315,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            },
            {
                rodzaj: 'xxx',
                dnOd: 20,
                dnDo: 20,
                ilosc: 1,
                uwagi: '',
                czyPrzejscie: 'TAK',
                source: 'offer'
            }
        ]);

        context.renderPrzejsciaDetailsTable(null);
        expect(container.innerHTML).toContain('Kaczmarek');
        expect(container.innerHTML).toContain(
            '<option value="Kaczmarek" selected>Kaczmarek</option>'
        );
        expect(container.innerHTML).toContain('value="315"');
        expect(container.innerHTML).toContain('value="400"');
        expect(container.innerHTML).toMatch(/id="step4-psz-offer-0-rodzaj"[^>]*display:none;/);
        expect(container.innerHTML).not.toContain('<option value="Inne" selected>Inne</option>');
        expect(context.collectPrzejsciaDetailsFromTable()).toEqual(rows);
    });
});
