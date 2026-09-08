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
            id: 'wlaz-150',
            componentType: 'wlaz',
            dn: '1000',
            area: 0.5,
            price: 400,
            doplataPEHD: null,
            name: 'Właz żeliwny D400 (H=150)'
        },
        {
            id: 'avr-80',
            componentType: 'avr',
            dn: '1000',
            area: 0.3,
            price: 110,
            doplataPEHD: null,
            name: 'Pierścień AVR 80mm'
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
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            window: {}
        };
        context.window.isPreviewMode = false;
        vm.createContext(context);
        const paintingCode = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellPainting.js'),
            'utf8'
        );
        const transitionsCode = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/transitionRenderer.js'),
            'utf8'
        );
        const pricingCode = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsWellPricing.js'),
            'utf8'
        );
        vm.runInContext(paintingCode, context);
        vm.runInContext(transitionsCode, context);
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

    function setDiscountsFor(key: string, disc: Record<string, unknown>) {
        vm.runInContext(
            `wellDiscounts = Object.assign({}, wellDiscounts, ${JSON.stringify({ [key]: disc })})`,
            ctx
        );
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

    test('7. Zwieńcz. E600 bez zwienczenieE600 → 0% (bez fallbacku do bazy)', () => {
        setDiscounts({ nadbudowa: 6 });
        const well = makeWell({
            klasaNosnosci_zwienczenie: 'E600',
            config: [{ productId: 'plyta-1000', quantity: 1 }]
        });
        const p = product('plyta-1000');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(300);
    });

    test('8. Korpus F900 bez dennicaF900 → 0% (bez fallbacku do bazy)', () => {
        setDiscounts({ dennica: 10, dennicaE600: 15 });
        const well = makeWell({ klasaNosnosci_korpus: 'F900' });
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(740);
    });

    test('8a. Korpus E600, tylko baza ustawiona → 0% na dennicy i kręgu', () => {
        setDiscounts({ dennica: 50, nadbudowa: 40 });
        const wellD = makeWell({ klasaNosnosci_korpus: 'E600' });
        expect(
            ctx.getItemAssessedPrice(wellD, product('DDD-1000-300'), true, wellD.config[0])
        ).toBe(740);
        const wellK = makeWell({
            klasaNosnosci_korpus: 'E600',
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        });
        expect(
            ctx.getItemAssessedPrice(wellK, product('krag-1000-500'), true, wellK.config[0])
        ).toBe(400);
    });

    test('8b. Korpus E600 + zwieńczenie D400 → dół 0%, właz z bazy', () => {
        setDiscounts({ dennica: 50, nadbudowa: 40 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            klasaNosnosci_zwienczenie: 'D400',
            config: [{ productId: 'wlaz-150', quantity: 1 }]
        });
        // właz to element D400 → baza nadbudowy
        expect(ctx.getItemAssessedPrice(well, product('wlaz-150'), true, well.config[0])).toBe(240);
        const wellD = makeWell({ klasaNosnosci_korpus: 'E600' });
        // dennica to element E600 bez rabatu klasowego → 0%
        expect(
            ctx.getItemAssessedPrice(wellD, product('DDD-1000-300'), true, wellD.config[0])
        ).toBe(740);
    });

    test('9. Brak ustawionych rabatów → pełna cena 740', () => {
        setDiscounts({});
        const well = makeWell();
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(740);
    });

    test('10. Przejście w dennicy (E600) → rabat dennicaE600, kubełek dennica', () => {
        setDiscounts({ dennica: 10, dennicaE600: 15, nadbudowa: 5, nadbudowaE600: 8 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            przejscia: [
                { productId: 'przejscie-1000', quantity: 1, rzednaWlaczenia: '1', dn: '1000' }
            ]
        });
        const stats = ctx.calcWellStats(well);
        // dennica 740*0.85=629 + przejście 200*0.85=170 → wszystko w dennicy
        expect(stats.priceDennica).toBe(629 + 170);
        expect(stats.priceNadbudowa).toBe(0);
    });

    test('11. Przejście w kręgu (E600) → rabat nadbudowaE600, kubełek nadbudowa', () => {
        setDiscounts({ dennica: 10, dennicaE600: 15, nadbudowa: 5, nadbudowaE600: 8 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            przejscia: [
                { productId: 'przejscie-1000', quantity: 1, rzednaWlaczenia: '1', dn: '1000' }
            ]
        });
        const stats = ctx.calcWellStats(well);
        // krąg 400*0.92=368 + przejście 200*0.92=184 → wszystko w nadbudowie
        expect(stats.priceNadbudowa).toBe(368 + 184);
        expect(stats.priceDennica).toBe(0);
    });

    test('12. getWellNadbudowaPct: E600 → nadbudowaE600, F900 bez klucza → 0, D400 → baza', () => {
        const disc = { nadbudowa: 5, nadbudowaE600: 8 };
        expect(ctx.getWellNadbudowaPct(makeWell({ klasaNosnosci_korpus: 'E600' }), disc)).toBe(8);
        expect(ctx.getWellNadbudowaPct(makeWell({ klasaNosnosci_korpus: 'F900' }), disc)).toBe(0);
        expect(ctx.getWellNadbudowaPct(makeWell(), disc)).toBe(5);
    });

    test('12a. Właz przy zwieńczeniu E600 → zwienczenieE600 (nie nadbudowa)', () => {
        setDiscounts({ nadbudowa: 40, nadbudowaE600: 20, zwienczenieE600: 30 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            klasaNosnosci_zwienczenie: 'E600',
            config: [{ productId: 'wlaz-150', quantity: 1 }]
        });
        const p = product('wlaz-150');
        // 400*0.7=280 (zniżka zwieńczenia, nie nadbudowy)
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(280);
    });

    test('12b. AVR to nadbudowa: korpus F900 + nadbudowaF900 (zwienczenieF900 ignorowane)', () => {
        setDiscounts({ nadbudowa: 40, nadbudowaF900: 25, zwienczenieF900: 99 });
        const well = makeWell({
            klasaNosnosci_korpus: 'F900',
            klasaNosnosci_zwienczenie: 'F900',
            config: [{ productId: 'avr-80', quantity: 1 }]
        });
        const p = product('avr-80');
        // 110*0.75=82.5 — rabat nadbudowy klasowej, nie zakończenia
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(82.5);
    });

    test('12b2. AVR przy zwieńczeniu E600 bez nadbudowaE600 → 0% (nie bierze zakończenia)', () => {
        setDiscounts({ nadbudowa: 40, zwienczenieE600: 30 });
        const well = makeWell({
            klasaNosnosci_korpus: 'E600',
            klasaNosnosci_zwienczenie: 'E600',
            config: [{ productId: 'avr-80', quantity: 1 }]
        });
        const p = product('avr-80');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(110);
    });

    test('12c. Właz przy zwieńczeniu D400 → bazowa nadbudowa (bez zmian)', () => {
        setDiscounts({ nadbudowa: 40, nadbudowaE600: 20, zwienczenieE600: 30 });
        const well = makeWell({ config: [{ productId: 'wlaz-150', quantity: 1 }] });
        const p = product('wlaz-150');
        // 400*0.6=240 — jak przed zmianą (fallback bazowy w obu gałęziach)
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(240);
    });

    test('13. getTransitionHostPct: dennica/styczna → dennica, reszta/brak → nadbudowa', () => {
        const disc = { dennica: 10, dennicaE600: 15, nadbudowa: 5, nadbudowaE600: 8 };
        const wellE600 = makeWell({ klasaNosnosci_korpus: 'E600' });
        expect(ctx.getTransitionHostPct(wellE600, disc, 'dennica')).toBe(15);
        expect(ctx.getTransitionHostPct(wellE600, disc, 'styczna')).toBe(15);
        expect(ctx.getTransitionHostPct(wellE600, disc, 'krag')).toBe(8);
        expect(ctx.getTransitionHostPct(wellE600, disc, 'krag_ot')).toBe(8);
        expect(ctx.getTransitionHostPct(wellE600, disc, null)).toBe(8);
        const wellF900 = makeWell({ klasaNosnosci_korpus: 'F900' });
        expect(ctx.getTransitionHostPct(wellF900, disc, 'dennica')).toBe(0);
        expect(ctx.getTransitionHostPct(wellF900, disc, 'krag')).toBe(0);
    });

    test('14. Przejście w dennicy stycznej → rabat dennica z wiersza styczne', () => {
        setDiscountsFor('styczne', { dennica: 7, nadbudowa: 3 });
        const well = makeWell({
            dn: 'styczna',
            klasaNosnosci_korpus: 'D400',
            przejscia: [
                { productId: 'przejscie-1000', quantity: 1, rzednaWlaczenia: '1', dn: '1000' }
            ]
        });
        const stats = ctx.calcWellStats(well);
        // dennica 740*0.93=688.2 + przejście 200*0.93=186 → kubełek dennica
        expect(stats.priceDennica).toBeCloseTo(688.2 + 186, 10);
        expect(stats.priceNadbudowa).toBe(0);
    });
});
