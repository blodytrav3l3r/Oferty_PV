import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Render przy corrupt stored (legacy/draft/localStorage): nie rzuca,
// fallback cena bez rabatu (0%) + logger.warn + widoczny badge/flaga.
// Kontrakt throw getterów/kalkulatora nietknięty (asercja: direct nadal throw).
describe('Render przy corrupt rabat stored: fallback 0% + sygnał błędu', () => {
    let ctx: any;

    const studnieProducts = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            category: 'Dennice',
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
            category: 'Kręgi',
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
            isFrozenPriceCtx: () => false,
            getOrderForWellId: () => null,
            resolveEffectiveProduct: (_well: any, productId: string, _item: any) =>
                studnieProducts.find((pr) => pr.id === productId),
            getPehdTypeForComponent: () => 'brak',
            calculatePrecoAllocationForItem: () => ({
                hasPreco: false,
                error: null,
                allocatedCost: 0,
                fraction: 0,
                isBottomMostDennica: false
            }),
            getWellZwienczenieName: () => '—',
            escapeHtml: (s: unknown) => String(s),
            escapeHtmlAttr: (s: unknown) => String(s),
            escapeJsStr: (s: unknown) => String(s),
            fmt: (n: unknown) => String(n),
            fmtInt: (n: unknown) => String(Math.round(Number(n) || 0)),
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            expandedWellIndices: new Set([0]),
            wells: [],
            logger: { warn: jest.fn() },
            RangeError: RangeError,
            window: {}
        };
        context.window.isPreviewMode = false;
        // globals.js deklaruje `let studnieProducts = []` (shadowuje prop kontekstu
        // we wszystkich skryptach vm) — podepnij hostową tablicę jak produkcja.
        context.__hostProducts = studnieProducts;
        vm.createContext(context);
        for (const f of [
            'actionsWellPainting.js',
            'transitionRenderer.js',
            'diagramComponents.js',
            'actionsWellPricing.js',
            'actionsWellDiscounts.js',
            'globals.js',
            'offerWellComponentsHelpers.js',
            'offerHelpers.js',
            'offerPricingCalc.js',
            'pricingCalculator.js',
            'offerWellComponents.js'
        ]) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
                context,
                { filename: f }
            );
        }
        vm.runInContext(
            'studnieProducts = __hostProducts; invalidateStudnieProductsMap();',
            context
        );
        vm.runInContext('getStudnieProductById("DDD-1000-300")', context);
        return context;
    }

    function makeWell(overrides: Record<string, unknown> = {}): any {
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

    function setCorrupt(v: unknown) {
        ctx.__tmp = v;
        vm.runInContext(
            `wellDiscounts = {'1000': {dennica: 0, nadbudowa: 0, preco: 0, pehd: 0}}; wellDiscounts['1000'].dennica = __tmp;`,
            ctx
        );
    }

    function setValid(pct: number) {
        vm.runInContext(
            `wellDiscounts = {'1000': {dennica: ${pct}, nadbudowa: 0, preco: 0, pehd: 0}}`,
            ctx
        );
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    beforeEach(() => {
        vm.runInContext('wellDiscounts = {}', ctx);
        ctx.logger.warn.mockClear();
    });

    test('kontrakt nietknięty: direct getWellDiscountPct/calcWellStats nadal throw', () => {
        setCorrupt(150);
        const well = makeWell();
        expect(() =>
            ctx.getWellDiscountPct(well, product('DDD-1000-300'), { dennica: 150 })
        ).toThrow(RangeError);
        expect(() => ctx.calcWellStats(well)).toThrow(RangeError);
    });

    test('getDiscountStr corrupt → nie rzuca, badge warn-glyph + flaga + warn', () => {
        setCorrupt(150);
        const well = makeWell();
        let html: string = '';
        expect(() => {
            html = ctx.getDiscountStr(well, product('DDD-1000-300'), { dennica: 150 });
        }).not.toThrow();
        expect(html).toContain('warn-glyph');
        expect(well._discountCorrupt).toBe(true);
        expect(ctx.logger.warn).toHaveBeenCalled();
    });

    test('getItemAssessedPriceSafe corrupt → fallback baza (740), direct nadal throw', () => {
        setCorrupt(150);
        const well = makeWell();
        expect(() =>
            ctx.getItemAssessedPrice(well, product('DDD-1000-300'), true, well.config[0])
        ).toThrow(RangeError);
        const safe = ctx.getItemAssessedPriceSafe(
            well,
            product('DDD-1000-300'),
            true,
            well.config[0]
        );
        const base = ctx.getItemAssessedPrice(well, product('DDD-1000-300'), false, well.config[0]);
        expect(safe).toBe(base);
        expect(safe).toBe(740);
        expect(well._discountCorrupt).toBe(true);
    });

    test('safeCalcWellStats corrupt (150 i NaN) → cena 0%-fallback + discountError + waga jak valid', () => {
        for (const v of [150, NaN]) {
            setCorrupt(v);
            const well = makeWell();
            setValid(0);
            const valid = ctx.calcWellStats(makeWell());
            setCorrupt(v);
            let stats: any = null;
            expect(() => {
                stats = ctx.safeCalcWellStats(well);
            }).not.toThrow();
            expect(stats.price).toBe(valid.price);
            expect(stats.weight).toBe(valid.weight);
            expect(stats.discountError).toBe(true);
            expect(well._discountCorrupt).toBe(true);
        }
        expect(ctx.logger.warn).toHaveBeenCalled();
    });

    test('calculateLinePricing + calculateOfferPricing corrupt → nie rzucają, total = baza', () => {
        setCorrupt(150);
        const well = makeWell();
        const p = product('DDD-1000-300');
        const disc = { dennica: 150, nadbudowa: 0, preco: 0 };
        expect(() =>
            ctx.calculateLinePricing(well, p, well.config[0], 0, disc, null, 0)
        ).not.toThrow();
        const line = ctx.calculateLinePricing(well, p, well.config[0], 0, disc, null, 0);
        expect(line.totalLinePrice).toBe(740);
        expect(() => ctx.calculateOfferPricing([well], 0, 0, 'full')).not.toThrow();
        const offer = ctx.calculateOfferPricing([well], 0, 0, 'full');
        expect(offer.totalNetto).toBe(740);
        // Oznaczenie per pozycja (razem z _xp/_xd), nie ciche 0.
        expect(offer.wellsForExport[0].config[0]._xp).toBe(740);
        expect(offer.wellsForExport[0].config[0]._xd).toBe(0);
        expect(offer.wellsForExport[0].config[0]._discountError).toBe(true);
    });

    test('renderComponentSubItems (kineta) corrupt → nie rzuca, badge warn-glyph', () => {
        setCorrupt(150);
        const well = makeWell({
            config: [
                { productId: 'DDD-1000-300', quantity: 1 },
                { productId: 'krag-1000-500', quantity: 1 }
            ]
        });
        const disc = { dennica: 150, nadbudowa: 0 };
        const p = product('DDD-1000-300');
        let html: string = '';
        expect(() => {
            html = ctx.renderComponentSubItems(well, p, well.config[0], null, disc, 0, 0);
        }).not.toThrow();
        void html;
        // Kineta dopięta do dennicy → wiersz kinety z fallback 0% + badge błędu.
        const wellK = makeWell({
            config: [
                { productId: 'DDD-1000-300', quantity: 1 },
                { productId: 'krag-1000-500', quantity: 1 }
            ]
        });
        const kinetaProd = {
            id: 'kin-1000',
            componentType: 'kineta',
            dn: '1000',
            price: 120,
            name: 'Kineta DN1000'
        };
        (wellK.config as any[]).push({ productId: 'kin-1000', quantity: 1 });
        ctx.studnieProducts.push(kinetaProd);
        try {
            let htmlK: string = '';
            expect(() => {
                htmlK = ctx.renderComponentSubItems(wellK, p, wellK.config[0], null, disc, 0, 0);
            }).not.toThrow();
            expect(htmlK).toContain('warn-glyph');
        } finally {
            ctx.studnieProducts.pop();
        }
    });

    test('renderWellHeaderRow corrupt → nagłówek z badge RABAT (nie cicha cena)', () => {
        setCorrupt(150);
        const well = makeWell();
        const stats = ctx.safeCalcWellStats(well);
        let html: string = '';
        expect(() => {
            html = ctx.renderWellHeaderRow(
                well,
                0,
                stats,
                null,
                false,
                false,
                1,
                null,
                false,
                null
            );
        }).not.toThrow();
        expect(html).toContain('RABAT');
        expect(html).toContain(String(stats.price));
    });
});
