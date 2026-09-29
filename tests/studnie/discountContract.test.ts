import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Kontrakt: discountPct ∈ [0,100], invalid → throw RangeError, nigdy cichy
// clamp ani NaN w cenie. Ingestia blokuje zapis, kalkulator fail-loud.
describe('Kontrakt rabatu studni: discountPct ∈ [0,100], invalid → throw', () => {
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
        }
    ];

    function loadContext() {
        const context: any = {
            studnieProducts,
            wellDiscounts: {},
            precoPricing: {},
            FLOW_TYPES: { WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolut' },
            calcPrecoPricingPure: () => ({ suma: 0, error: null }),
            showToast: () => {},
            isWellOrdered: () => false,
            getOrderForWellId: () => null,
            resolveEffectiveProduct: (_well: any, productId: string, _item: any) =>
                studnieProducts.find((pr) => pr.id === productId),
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            renderDiscountPanel: () => {},
            updateSummary: () => {},
            renderOfferSummary: () => {},
            renderWellConfig: () => {},
            // Hostowy RangeError w vm: throwy kodu są instanceof hosta
            // (vm ma własne builtins — bez tego toThrow(RangeError) pada).
            RangeError: RangeError,
            window: {}
        };
        context.window.isPreviewMode = false;
        vm.createContext(context);
        for (const f of [
            'actionsWellPainting.js',
            'transitionRenderer.js',
            'actionsWellPricing.js',
            'actionsWellDiscounts.js',
            'globals.js'
        ]) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
                context,
                { filename: f }
            );
        }
        context.window.studnieProducts = studnieProducts;
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

    // Bezpośredni zapis stored (omija ingestię — symuluje legacy/corrupt).
    // Przez __tmp (nie JSON — JSON gubi NaN/±Inf/undefined, a jawny klucz
    // z null/undefined musi zostać kluczem, nie brakiem klucza).
    function setStoredKey(key: string, v: unknown) {
        ctx.__tmp = v;
        vm.runInContext(
            `wellDiscounts = {'1000': {dennica: 0, nadbudowa: 0, preco: 0, pehd: 0}}; wellDiscounts['1000']['${key}'] = __tmp;`,
            ctx
        );
    }

    function setStored(disc: Record<string, unknown>) {
        vm.runInContext(`wellDiscounts = ${JSON.stringify({ '1000': disc })}`, ctx);
    }

    function storedJson(): string {
        return vm.runInContext('JSON.stringify(wellDiscounts)', ctx);
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    beforeEach(() => {
        vm.runInContext('wellDiscounts = {}', ctx);
    });

    const BASE = 740;
    const VALID: Array<[string, number, number]> = [
        ['0 → pełna baza', 0, 740],
        ['50 → połowa', 50, 370],
        ['100 → zero', 100, 0]
    ];

    test.each(VALID)('valid stored %s liczy poprawnie', (_label, pct, expected) => {
        setStored({ dennica: pct });
        const well = makeWell();
        expect(ctx.getItemAssessedPrice(well, product('DDD-1000-300'), true, well.config[0])).toBe(
            expected
        );
    });

    // Matrix invalid: poza zakresem, nie-finite, nie-number.
    const INVALID: Array<[string, any]> = [
        ['100.000001', 100.000001],
        ['-0.000001', -0.000001],
        ['NaN', NaN],
        ['+Inf', Infinity],
        ['-Inf', -Infinity],
        ['null', null],
        ['undefined', undefined],
        ['string "50"', '50'],
        ['string "NaN"', 'NaN']
    ];

    test.each(INVALID)('invalid stored %s → getWellDiscountPct throw RangeError', (_label, v) => {
        setStored({ dennica: v });
        const well = makeWell();
        expect(() => ctx.getWellDiscountPct(well, product('DDD-1000-300'), { dennica: v })).toThrow(
            RangeError
        );
    });

    test.each(INVALID)(
        'invalid stored %s → getItemAssessedPrice throw (brak NaN w cenie)',
        (_label, v) => {
            setStoredKey('dennica', v);
            const well = makeWell();
            expect(() =>
                ctx.getItemAssessedPrice(well, product('DDD-1000-300'), true, well.config[0])
            ).toThrow(RangeError);
        }
    );

    test.each(INVALID)('invalid stored %s → getItemPriceBreakdown throw', (_label, v) => {
        setStoredKey('dennica', v);
        const well = makeWell();
        expect(() =>
            ctx.getItemPriceBreakdown(well, product('DDD-1000-300'), true, well.config[0])
        ).toThrow(RangeError);
    });

    test.each(INVALID)('invalid stored %s → calcWellStats throw', (_label, v) => {
        setStoredKey('dennica', v);
        expect(() => ctx.calcWellStats(makeWell())).toThrow(RangeError);
    });

    test.each(INVALID)('invalid stored preco %s → calcWellStats throw', (_label, v) => {
        setStoredKey('preco', v);
        expect(() => ctx.calcWellStats(makeWell({ kineta: 'preco' }))).toThrow(RangeError);
    });

    test.each(INVALID)('applyDiscount odrzuca %s (throw, brak zapisu)', (_label, v) => {
        const before = storedJson();
        expect(() => ctx.applyDiscount('1000', 'dennica', v)).toThrow(RangeError);
        expect(storedJson()).toBe(before);
    });

    test('applyDiscount zapisuje valid (0/50/100)', () => {
        for (const v of [0, 50, 100]) {
            ctx.applyDiscount('1000', 'dennica', v);
            expect(vm.runInContext('wellDiscounts["1000"].dennica', ctx)).toBe(v);
        }
    });

    test('updateDiscount: numeryczny string "50" → zapis 50', () => {
        ctx.updateDiscount('1000', 'dennica', '50');
        expect(vm.runInContext('wellDiscounts["1000"].dennica', ctx)).toBe(50);
    });

    test.each([
        ['string "NaN"', 'NaN'],
        ['null', null],
        ['undefined', undefined],
        ['150', '150'],
        ['-5', '-5']
    ])('updateDiscount odrzuca %s (throw, brak zapisu)', (_label, v) => {
        const before = storedJson();
        expect(() => ctx.updateDiscount('1000', 'dennica', v)).toThrow(RangeError);
        expect(storedJson()).toBe(before);
    });

    test('cena valid zawsze finite ∈ [0,baza] (assessed + breakdown + stats)', () => {
        for (const pct of [0, 25, 50, 75, 100]) {
            setStored({ dennica: pct, nadbudowa: pct });
            const well = makeWell();
            const p = product('DDD-1000-300');
            const assessed = ctx.getItemAssessedPrice(well, p, true, well.config[0]);
            expect(Number.isFinite(assessed)).toBe(true);
            expect(assessed).toBeGreaterThanOrEqual(0);
            expect(assessed).toBeLessThanOrEqual(BASE);
            const bd = ctx.getItemPriceBreakdown(well, p, true, well.config[0]);
            expect(Number.isFinite(bd.total)).toBe(true);
            expect(bd.total).toBeGreaterThanOrEqual(0);
            expect(bd.total).toBeLessThanOrEqual(BASE);
            const stats = ctx.calcWellStats(well);
            expect(Number.isFinite(stats.price)).toBe(true);
            expect(stats.price).toBeGreaterThanOrEqual(0);
            expect(stats.price).toBeLessThanOrEqual(BASE);
        }
    });

    test('getTransitionHostPct invalid → throw', () => {
        expect(() => ctx.getTransitionHostPct(makeWell(), { dennica: NaN }, 'dennica')).toThrow(
            RangeError
        );
        expect(() => ctx.getTransitionHostPct(makeWell(), { nadbudowa: 101 }, 'krag')).toThrow(
            RangeError
        );
    });
});
