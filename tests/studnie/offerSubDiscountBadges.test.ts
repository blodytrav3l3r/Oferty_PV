import fs from 'fs';
import path from 'path';
import vm from 'vm';

// Badge (-X%) przy podwierszach oferty: przejścia (live/frozen), wiercenia, kineta.
describe('Badge rabatów podpozycji oferty (offerWellComponents)', () => {
    let ctx: any;

    const studnieProducts = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            category: 'Dennice',
            dn: '1000',
            height: 300,
            price: 740,
            name: 'Dennica DN1000 H=1050/900'
        },
        {
            id: 'krag-1000-500',
            componentType: 'krag',
            category: 'Kręgi',
            dn: '1000',
            height: 500,
            price: 400,
            name: 'Krąg DN1000/1000'
        },
        {
            id: 'przejscie-500',
            componentType: 'przejscie',
            category: 'PVC SN8',
            dn: '500',
            price: 520,
            name: 'Przejście PVC SN8 500'
        },
        {
            id: 'kineta-1000',
            componentType: 'kineta',
            category: 'Kinety',
            dn: '1000',
            price: 120,
            name: 'Kineta DN1000 wys. 1/1'
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
            getStudnieProductById: (id: string) => studnieProducts.find((pr) => pr.id === id),
            getPehdTypeForComponent: () => 'brak',
            calculatePrecoAllocationForItem: () => ({
                hasPreco: false,
                error: null,
                allocatedCost: 0,
                fraction: 0,
                isBottomMostDennica: false
            }),
            escapeHtml: (s: unknown) => String(s),
            fmt: (n: unknown) => String(n),
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            window: {}
        };
        context.window.isPreviewMode = false;
        vm.createContext(context);
        for (const rel of [
            '../../public/js/studnie/actionsWellPainting.js',
            '../../public/js/studnie/actionsWellPricing.js',
            '../../public/js/studnie/offerWellComponents.js'
        ]) {
            vm.runInContext(fs.readFileSync(path.join(__dirname, rel), 'utf8'), context);
        }
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

    function renderSub(well: any, disc: Record<string, unknown>, itemPrzejscia: any[]) {
        const p = studnieProducts.find((x) => x.id === 'DDD-1000-300');
        return ctx.renderComponentSubItems(well, p, well.config[0], itemPrzejscia, disc, 0, 0);
    }

    function product(id: string) {
        return studnieProducts.find((pr) => pr.id === id);
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    test('1. Przejście w dennicy (dennica 50%) → badge (-50%)', () => {
        const disc = { dennica: 50, nadbudowa: 40 };
        const well = makeWell();
        const html = renderSub(well, disc, [
            { productId: 'przejscie-500', angle: 0, _hostType: 'dennica' }
        ]);
        expect(html).toContain('(-50%)');
        expect(html).toContain('260');
    });

    test('2. Przejście w kręgu (nadbudowa 40%) → badge (-40%)', () => {
        const disc = { dennica: 50, nadbudowa: 40 };
        const well = makeWell({
            config: [{ productId: 'krag-1000-500', quantity: 1 }]
        });
        const html = renderSub(well, disc, [
            { productId: 'przejscie-500', angle: 0, _hostType: 'krag' }
        ]);
        expect(html).toContain('(-40%)');
    });

    test('3. Przejście frozen (520 → 260) → badge (-50%) z cen zamrożonych', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell();
        vm.runInContext('window.isPreviewMode = true;', ctx);
        try {
            const html = renderSub(well, disc, [
                {
                    productId: 'przejscie-500',
                    angle: 0,
                    _hostType: 'dennica',
                    frozenPrice: 260,
                    frozenPriceBase: 520,
                    frozenTransitionPrice: 260,
                    frozenName: 'PVC SN8'
                }
            ]);
            expect(html).toContain('(-50%)');
        } finally {
            vm.runInContext('window.isPreviewMode = false;', ctx);
        }
    });

    test('4. Kineta (dennica 50%) → badge (-50%)', () => {
        const disc = { dennica: 50, nadbudowa: 40 };
        const well = makeWell({
            config: [
                { productId: 'DDD-1000-300', quantity: 1 },
                { productId: 'kineta-1000', quantity: 1 }
            ]
        });
        const html = renderSub(well, disc, []);
        expect(html).toContain('Kineta DN1000 wys. 1/1');
        expect(html).toContain('(-50%)');
    });

    test('5. Brak rabatu → brak badge', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell();
        const html = renderSub(well, disc, [
            { productId: 'przejscie-500', angle: 0, _hostType: 'dennica' }
        ]);
        expect(html).not.toContain('(-');
    });

    function withPrecoStubs(preco: number, fn: () => void) {
        vm.runInContext(
            `wellDiscounts = ${JSON.stringify({ 1000: { dennica: 0, nadbudowa: 0, preco } })}`,
            ctx
        );
        vm.runInContext(
            `calculatePrecoAllocationForItem = () => ({ hasPreco: true, allocatedCost: 800, fraction: 1, isBottomMostDennica: true })`,
            ctx
        );
        vm.runInContext(
            `calcPrecoPricing = () => ({ suma: 1000, bazowa: 600, kinetaGlowna: { dn: ['400'], etykiety: ['A'] }, uniesienie: 100 })`,
            ctx
        );
        try {
            fn();
        } finally {
            vm.runInContext(
                `calculatePrecoAllocationForItem = () => ({ hasPreco: false, error: null, allocatedCost: 0, fraction: 0, isBottomMostDennica: false })`,
                ctx
            );
            vm.runInContext('wellDiscounts = {}', ctx);
        }
    }

    test('6. Rozbicie PRECO (preco 10%) → badge (-10%) na każdej pozycji', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell();
        withPrecoStubs(10, () => {
            const html = renderSub(well, disc, []);
            expect(html).toContain('Kineta bazowa');
            expect(html).toContain('uniesienie');
            const hits = html.match(/\(-10%\)/g) || [];
            // Wiersz alokacji + kineta bazowa + uniesienie.
            expect(hits.length).toBeGreaterThanOrEqual(3);
        });
    });

    test('7. PRECO bez rabatu → brak badge na rozbiciu', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell();
        withPrecoStubs(0, () => {
            const html = renderSub(well, disc, []);
            expect(html).toContain('Kineta bazowa');
            expect(html).not.toContain('(-');
        });
    });

    test('8. Wkładka PEHD (rabat PEHD 20%) → badge (-20%)', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell({ wkladkaDennica: '3mm', pehdDiscount: 20 });
        const p = { ...product('DDD-1000-300'), doplataPEHD: 500 };
        const html = ctx.renderComponentSubItems(
            well,
            p,
            { productId: 'DDD-1000-300', quantity: 1 },
            [],
            disc,
            0,
            0
        );
        expect(html).toContain('wkładka PEHD');
        expect(html).toContain('(-20%)');
        expect(html).toContain('400'); // 500 × 0.8
    });

    test('9. Wkładka PEHD bez rabatu → brak badge', () => {
        const disc = { dennica: 0, nadbudowa: 0 };
        const well = makeWell({ wkladkaDennica: '3mm' });
        const p = { ...product('DDD-1000-300'), doplataPEHD: 500 };
        const html = ctx.renderComponentSubItems(
            well,
            p,
            { productId: 'DDD-1000-300', quantity: 1 },
            [],
            disc,
            0,
            0
        );
        expect(html).toContain('wkładka PEHD');
        // Uwaga: styl wiersza zawiera "var(--...)", więc matchujemy badge liczbowy.
        expect(html).not.toMatch(/\(-\d/);
    });
});
