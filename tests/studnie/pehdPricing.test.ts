// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('PeHD — cena wkładki (getItemAssessedPrice / getItemPriceBreakdown / getPehdEffectiveArea / getPehdTypeForComponent)', () => {
    let ctx: any;

    const studnieProducts = [
        {
            id: 'DDD-1000-300',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            area: 1.732,
            price: 740,
            doplataPEHD: 500,
            name: 'Dennica DN1000'
        },
        {
            id: 'DDD-1000-300-nopehd',
            componentType: 'dennica',
            dn: '1000',
            height: 300,
            area: 1.732,
            price: 740,
            doplataPEHD: null,
            name: 'Dennica bez dopłaty PEHD'
        },
        {
            id: 'krag-1000-500',
            componentType: 'krag',
            dn: '1000',
            height: 500,
            area: 1.57,
            price: 400,
            doplataPEHD: 350,
            name: 'Krąg DN1000'
        },
        {
            id: 'plyta-1000',
            componentType: 'plyta_din',
            dn: '1000',
            area: 0.785,
            price: 300,
            doplataPEHD: 220,
            name: 'Płyta DN1000'
        },
        {
            id: 'konus-1000',
            componentType: 'konus',
            dn: '1000',
            area: 1.1,
            price: 450,
            doplataPEHD: 200,
            name: 'Konus DN1000'
        }
    ];

    // Ładuje DO TEGO SAMEGO kontekstu vm oba pliki: najpierw helpers malowania/PEHD,
    // potem pricing (wykorzystuje getPehdSurcharge/getPehdTypeForComponent z painting).
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
            ...overrides
        };
    }

    function product(id: string) {
        return studnieProducts.find((pr) => pr.id === id);
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    test('1. dennicy + wkladkaDennica=3mm + doplataPEHD=500 → 740 + 500 = 1240', () => {
        const well = makeWell({ wkladkaDennica: '3mm' });
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(1240);
    });

    test('2. wkladkaDennica=brak → 740 (bez dopłaty)', () => {
        const well = makeWell();
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(740);
    });

    test('3. doplataPEHD=null + wkladka=3mm → 740 (brak dopłaty; WARNING zgłaszany przez solverValidation)', () => {
        const well = makeWell({
            config: [{ productId: 'DDD-1000-300-nopehd', quantity: 1 }],
            wkladkaDennica: '3mm'
        });
        const p = product('DDD-1000-300-nopehd');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(740);
    });

    test('4. item.disablePehd=true + wkladka=3mm + doplataPEHD=500 → 740', () => {
        const well = makeWell({ wkladkaDennica: '3mm' });
        const p = product('DDD-1000-300');
        const item = { productId: 'DDD-1000-300', quantity: 1, disablePehd: true };
        expect(ctx.getItemAssessedPrice(well, p, true, item)).toBe(740);
    });

    test('5. well.pehdDiscount=10 + wkladka=3mm → 740 + 500*0.9 = 1190', () => {
        const well = makeWell({ wkladkaDennica: '3mm', pehdDiscount: 10 });
        const p = product('DDD-1000-300');
        expect(ctx.getItemAssessedPrice(well, p, true, well.config[0])).toBe(1190);
    });

    test('6. getItemPriceBreakdown → { pehd: 500, total: 1240 }', () => {
        const well = makeWell({ wkladkaDennica: '3mm' });
        const p = product('DDD-1000-300');
        const b = ctx.getItemPriceBreakdown(well, p, true, well.config[0]);
        expect(b.pehd).toBe(500);
        expect(b.total).toBe(1240);
    });

    test('7. mapowanie typów: krag→wkladkaNadbudowa +350, plyta_din→wkladkaZwienczenie +220, konus→bez dopłaty 450', () => {
        const kragWell = makeWell({
            config: [{ productId: 'krag-1000-500', quantity: 1 }],
            wkladkaNadbudowa: '4mm'
        });
        expect(
            ctx.getItemAssessedPrice(kragWell, product('krag-1000-500'), true, kragWell.config[0])
        ).toBe(400 + 350);

        const plytaWell = makeWell({
            config: [{ productId: 'plyta-1000', quantity: 1 }],
            wkladkaZwienczenie: '3mm'
        });
        expect(
            ctx.getItemAssessedPrice(plytaWell, product('plyta-1000'), true, plytaWell.config[0])
        ).toBe(300 + 220);

        // konus: wkładka zabroniona — getPehdTypeForComponent zwraca null, brak dopłaty
        const konusWell = makeWell({
            config: [{ productId: 'konus-1000', quantity: 1 }],
            wkladkaZwienczenie: '3mm'
        });
        expect(
            ctx.getItemAssessedPrice(konusWell, product('konus-1000'), true, konusWell.config[0])
        ).toBe(450);
    });

    test('8. getPehdEffectiveArea dla dennicy DN1000 (area 1.732) ≈ 1.9466', () => {
        const p = product('DDD-1000-300');
        // bottom = π*(1000/2000)² = π*0.25 ≈ 0.7854; wallArea = 1.732 - 0.7854 ≈ 0.9466
        // eff = wallArea + bottom*(4/π) ≈ 0.9466 + 1.0 = 1.9466
        expect(ctx.getPehdEffectiveArea(p)).toBeCloseTo(1.9466, 3);
    });

    test('9. getPehdTypeForComponent: konus → null, dennica → well.wkladkaDennica', () => {
        const well = makeWell({ wkladkaDennica: '3mm', wkladkaZwienczenie: '3mm' });
        expect(ctx.getPehdTypeForComponent(well, 'konus')).toBeNull();
        expect(ctx.getPehdTypeForComponent(well, 'dennica')).toBe('3mm');
    });
});
