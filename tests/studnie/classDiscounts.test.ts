import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Rabaty klasowe studni (E600/F900) — getWellDiscountPct przez getItemAssessedPrice', () => {
    let ctx: any;

    const studnieProducts = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            area: 1.732,
            price: 740,
            doplataPEHD: null,
            name: 'Dennica DN1000'
        },
        {
            id: 'krag-1000-500',
            componentType: 'krag',
            dn: '1000',
            height: 500,
            area: 1.57,
            price: 400,
            doplataPEHD: null,
            name: 'Krąg DN1000'
        },
        {
            id: 'plyta-1000',
            componentType: 'plyta_din',
            dn: '1000',
            area: 0.785,
            price: 300,
            doplataPEHD: null,
            name: 'Płyta DIN DN1000'
        },
        {
            id: 'konus-1000',
            componentType: 'konus',
            dn: '1000',
            area: 1.1,
            price: 450,
            doplataPEHD: null,
            name: 'Konus DN1000'
        },
        {
            id: 'przejscie-1000',
            componentType: 'przejscie',
            dn: '1000',
            price: 200,
            doplataPEHD: null,
            name: 'Przejście DN1000'
        }
    ];

    function loadContext() {
        const context: any = {
            studnieProducts,
            wellDiscounts: {},
            precoPricing: {},
            FLOW_TYPES: { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' },
            calcPrecoPricingPure: () => ({ suma: 0, error: null }),
            showToast: () => {},
            isWellOrdered: () => false,
            getOrderForWellId: () => null,
            resolveEffectiveProduct: (_well: any, productId: string, _item: any) =>
                studnieProducts.find((pr) => pr.id === productId),
            buildConfigMap: () => [],
            findAssignedElement: () => null,
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            window: {}
        };
        context.window.isPreviewMode = false;
        vm.createContext(context);
        const paintingCode = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellPainting.js'),
            'utf8'
        );
        const pricingCode = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellPricing.js'),
            'utf8'
        );
        vm.runInContext(paintingCode, context);
        vm.runInContext(pricingCode, context);
        return context;
    }

    function makeWell(overrides: Record<string, unknown> = {}) {
        return {
            dn: '1000',
            config: [{ productId: 'DDD-1000-300', quantity: 1 }],
            wkladkaDennica: 'brak',
            klasaNosnosci_korpus: 'D400',
            klasaNosnosci_zwienczenie: 'D400',
            ...overrides
        };
    }

    function product(id: string) {
        return studnieProducts.find((pr) => pr.id === id);
    }

    function setDiscounts(disc: Record<string, unknown>) {
        vm.runInContext(`wellDiscounts = ${JSON.stringify({ '1000': disc })}`, ctx);
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    test('1. D400 dennica + dennica=10 → 740*0.9 = 666', () => {
        setDiscounts({ dennica: 10 });
        const well = makeWell();
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(666);
    });

    test('2. Korpus E600 dennica + dennicaE600=15 → 740*0.85 = 629', () => {
        setDiscounts({ dennica: 10, dennicaE600: 15 });
        const well = makeWell({ klasaNosnosci_korpus: 'E600' });
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(629);
    });

    test('3. Korpus E600 krag + nadbudowaE600=8 → 400*0.92 = 368', () => {
        setDiscounts({ nadbudowa: 5, nadbudowaE600: 8 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        });
        const p = product('krag-1000-500');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(368);
    });

    test('4. Korpus F900 krag + nadbudowaF900=10 (baza 5) → 400*0.9 = 360', () => {
        setDiscounts({ nadbudowa: 5, nadbudowaF900: 10 });
        const well = makeWell({
            klasaNosnosci_korpus: 'F900',
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        });
        const p = product('krag-1000-500');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(360);
    });

    test('5. Zwieńcz. E600 plyta_din + zwienczenieE600=20 → 300*0.8 = 240', () => {
        setDiscounts({ zwienczenieE600: 20 });
        const well = makeWell({
            klasaNosnosci_zwienczenie: 'E600',
            config: [{ productId: 'plyta-1000', quantity: 1 }]
        });
        const p = product('plyta-1000');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(240);
    });

    test('6. Zwieńcz. F900 konus + zwienczenieF900=7 → 450*0.93 = 418.5', () => {
        setDiscounts({ zwienczenieF900: 7 });
        const well = makeWell({
            klasaNosnosci_zwienczenie: 'F900',
            config: [{ productId: 'konus-1000', quantity: 1 }]
        });
        const p = product('konus-1000');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(418.5);
    });

    test('7. Zwieńcz. E600 bez zwienczenieE600 → fallback nadbudowa=6 → 300*0.94 = 282', () => {
        setDiscounts({ nadbudowa: 6 });
        const well = makeWell({
            klasaNosnosci_zwienczenie: 'E600',
            config: [{ productId: 'plyta-1000', quantity: 1 }]
        });
        const p = product('plyta-1000');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(282);
    });

    test('8. Korpus F900 bez dennicaF900 → fallback dennica=10 → 666', () => {
        setDiscounts({ dennica: 10, dennicaE600: 15 });
        const well = makeWell({ klasaNosnosci_korpus: 'F900' });
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(666);
    });

    test('9. Brak ustawionych rabatów → pełna cena 740', () => {
        setDiscounts({});
        const well = makeWell();
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(740);
    });

    test('10. Przejście w studni E600 → rabat nadbudowaE600 (calcWellStats)', () => {
        setDiscounts({ nadbudowa: 5, nadbudowaE600: 8 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            przejscia: [
                { productId: 'przejscie-1000', quantity: 1, rzednaWlaczenia: '1', dn: '1000' }
            ]
        });
        const stats = ctx.calcWellStats(well);
        expect(stats.priceNadbudowa).toBe(200 * 0.92);
    });

    test('11. Przejście w studni F900 → fallback bazowy nadbudowa (calcWellStats)', () => {
        setDiscounts({ nadbudowa: 5, nadbudowaE600: 8 });
        const well = makeWell({
            klasaNosnosci_korpus: 'F900',
            przejscia: [
                { productId: 'przejscie-1000', quantity: 1, rzednaWlaczenia: '1', dn: '1000' }
            ]
        });
        const stats = ctx.calcWellStats(well);
        expect(stats.priceNadbudowa).toBe(200 * 0.95);
    });

    test('12. getWellNadbudowaPct: E600 → nadbudowaE600, F900/D400 → baza', () => {
        const disc = { nadbudowa: 5, nadbudowaE600: 8 };
        expect(ctx.getWellNadbudowaPct(makeWell({ klasaNosnosci_korpus: 'E600' }), disc)).toBe(8);
        expect(ctx.getWellNadbudowaPct(makeWell({ klasaNosnosci_korpus: 'F900' }), disc)).toBe(5);
        expect(ctx.getWellNadbudowaPct(makeWell(), disc)).toBe(5);
    });
});
