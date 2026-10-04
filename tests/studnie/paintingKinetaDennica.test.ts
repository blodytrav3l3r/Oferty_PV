import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Malowanie wew. kineta_dennica — ściany dennicy na wierszu dennicy', () => {
    let ctx: any;

    const studnieProducts = [
        {
            id: 'DDD-10-115',
            componentType: 'dennica',
            dn: '1000',
            height: 1000,
            area: 3.93,
            price: 1000,
            name: 'Dennica DN1000 h1000'
        },
        {
            id: 'KIN-10',
            componentType: 'kineta',
            dn: '1000',
            price: 500,
            hMin1: 0,
            hMax1: 2000,
            cena1: 500,
            name: 'Kineta DN1000'
        },
        {
            id: 'KDB-10-10',
            componentType: 'krag',
            dn: '1000',
            height: 1000,
            area: 3.14,
            price: 400,
            name: 'Krąg DN1000 h1000'
        },
        {
            id: 'PZE-16-10',
            componentType: 'plyta_zamykajaca',
            dn: '1000',
            height: 150,
            area: 1.33,
            price: 300,
            name: 'Płyta DN1000'
        },
        {
            id: 'STY-10',
            componentType: 'styczna',
            dn: '1000',
            height: 1350,
            area: 4.08,
            price: 4750,
            name: 'Styczna DN1000'
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
            structuredClone: (v: unknown) => JSON.parse(JSON.stringify(v)),
            window: {}
        };
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

    // Dennica DN1000 h=1m, 2×DN200 przy dnie (przelot 0°/180°), C=200 PLN/m².
    function makeWell(overrides: Record<string, unknown> = {}) {
        return {
            dn: '1000',
            spocznikH: '1/2',
            malowanieW: 'kineta_dennica',
            malowanieWewCena: 200,
            malowanieZ: 'brak',
            config: [
                { productId: 'DDD-10-115', quantity: 1 },
                { productId: 'KIN-10', quantity: 1 }
            ],
            przejscia: [
                { dn: '200', angle: 0, productId: 'RURA-200' },
                { dn: '200', angle: 180, productId: 'RURA-200' }
            ],
            ...overrides
        };
    }

    function product(id: string) {
        return studnieProducts.find((pr) => pr.id === id);
    }

    beforeAll(() => {
        ctx = loadContext();
    });

    test('1. ściany dennicy 1/2: 2π·0.5·(1−0.05) ≈ 2.9845 m²', () => {
        const well = makeWell();
        expect(ctx.calcDennicaWallsArea(well, product('DDD-10-115'))).toBeCloseTo(2.9845, 3);
    });

    test('2. ściany dennicy 1/1: 2π·0.5·(1−0.1) ≈ 2.8274 m²', () => {
        const well = makeWell({ spocznikH: '1/1' });
        expect(ctx.calcDennicaWallsArea(well, product('DDD-10-115'))).toBeCloseTo(2.8274, 3);
    });

    test('3. brak: dennica i kineta bez dopłaty', () => {
        const well = makeWell({ malowanieW: 'brak' });
        expect(ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])).toBe(
            1000
        );
        expect(ctx.getItemAssessedPrice(well, product('KIN-10'), false, well.config[0])).toBe(500);
    });

    test('4. kineta: dopłata tylko na kinecie (≈207 zł), dennica 1000 bez zmian', () => {
        const well = makeWell({ malowanieW: 'kineta' });
        expect(ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])).toBe(
            1000
        );
        expect(
            ctx.getItemAssessedPrice(well, product('KIN-10'), false, well.config[0])
        ).toBeCloseTo(500 + 1.0366 * 200, 1);
    });

    test('5. kineta_dennica: dennica ≈596.9 zł, kineta ≈207.3 zł (RED przed fixem: dennica 0)', () => {
        const well = makeWell();
        expect(
            ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])
        ).toBeCloseTo(1000 + 2.9845 * 200, 0);
        expect(
            ctx.getItemAssessedPrice(well, product('KIN-10'), false, well.config[0])
        ).toBeCloseTo(500 + 1.0366 * 200, 1);
        const b = ctx.getItemPriceBreakdown(well, product('DDD-10-115'), false, well.config[0]);
        expect(b.malowanieW).toBeCloseTo(2.9845 * 200, 0);
    });

    test('6. cale: dennica = ściany (jak kineta_dennica), krąg i płyta po area×C', () => {
        const well = makeWell({ malowanieW: 'cale' });
        expect(
            ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])
        ).toBeCloseTo(1000 + 2.9845 * 200, 0);
        expect(
            ctx.getItemAssessedPrice(well, product('KDB-10-10'), false, well.config[0])
        ).toBeCloseTo(400 + 3.14 * 200, 2);
        expect(
            ctx.getItemAssessedPrice(well, product('PZE-16-10'), false, well.config[0])
        ).toBeCloseTo(300 + 1.33 * 200, 2);
    });

    test('7. styczna bez dopłaty w kineta_dennica (decyzja: tylko dennica)', () => {
        const well = makeWell();
        expect(ctx.calcDennicaWallsArea(well, product('STY-10'))).toBe(0);
        expect(ctx.getItemAssessedPrice(well, product('STY-10'), false, well.config[0])).toBe(4750);
    });

    test('8. osadnik: ściany powyżej H_os (H_os=500 → 2π·0.5·0.5 ≈ 1.5708 m²); brak rur standard → 0', () => {
        const osadnikWell = makeWell({ wkladkaOsadnikPreco: 'tak', wkladkaOsadnikH: 500 });
        expect(ctx.calcDennicaWallsArea(osadnikWell, product('DDD-10-115'))).toBeCloseTo(1.5708, 3);
        expect(
            ctx.getItemAssessedPrice(
                osadnikWell,
                product('DDD-10-115'),
                false,
                osadnikWell.config[0]
            )
        ).toBeCloseTo(1000 + 1.5708 * 200, 0);
        const fullWell = makeWell({ wkladkaOsadnikPreco: 'tak', wkladkaOsadnikH: 1000 });
        expect(ctx.calcDennicaWallsArea(fullWell, product('DDD-10-115'))).toBe(0);
        const noPipesWell = makeWell({ przejscia: [] });
        expect(ctx.calcDennicaWallsArea(noPipesWell, product('DDD-10-115'))).toBe(0);
        expect(
            ctx.getItemAssessedPrice(
                noPipesWell,
                product('DDD-10-115'),
                false,
                noPipesWell.config[0]
            )
        ).toBe(1000);
    });

    test('9. ryczałt bez C: dennica bierze p.malowanieWewnetrzne w kineta_dennica', () => {
        const well = makeWell({ malowanieWewCena: 0 });
        const p = { ...product('DDD-10-115'), malowanieWewnetrzne: 150 };
        expect(ctx.getItemAssessedPrice(well, p, false, well.config[0])).toBe(1150);
    });

    test('10. osadnik 3m bez kinety (H_os=1000): wkładka ≈3.8956 m² na wierszu dennicy', () => {
        const well = makeWell({
            malowanieW: 'cale',
            wkladkaOsadnikPreco: 'tak',
            wkladkaOsadnikH: 1000,
            config: [{ productId: 'DDD-10-115', quantity: 1 }]
        });
        // wkładka: π·0.25 + 2π·0.5·1 − 2·(π·0.1²/2) ≈ 3.8956 m²
        expect(ctx.calcKinetaPaintingArea(well)).toBeCloseTo(3.8956, 3);
        expect(ctx.calcDennicaWallsArea(well, product('DDD-10-115'))).toBe(0);
        expect(
            ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])
        ).toBeCloseTo(1000 + 3.8956 * 200, 0);
        expect(
            ctx.getItemAssessedPrice(well, product('KDB-10-10'), false, well.config[0])
        ).toBeCloseTo(400 + 3.14 * 200, 2);
    });

    test("11. spocznikH='brak': h=0 (kanały+płaskie ≈0.8996 m²), ściany dennicy pełne ≈3.1416 m²", () => {
        const well = makeWell({ spocznik: 'brak', spocznikH: 'brak' });
        expect(ctx.calcKinetaPaintingArea(well)).toBeCloseTo(0.8996, 3);
        expect(ctx.calcDennicaWallsArea(well, product('DDD-10-115'))).toBeCloseTo(3.1416, 3);
        expect(
            ctx.getItemAssessedPrice(well, product('KIN-10'), false, well.config[0])
        ).toBeCloseTo(500 + 0.8996 * 200, 1);
    });

    test('12. goła dennica 1m bez rur i kinety: A_kin ≈3.927 m² na dennicy we wszystkich wariantach', () => {
        const bare = (malowanieW: string) =>
            makeWell({
                malowanieW,
                przejscia: [],
                config: [{ productId: 'DDD-10-115', quantity: 1 }]
            });
        for (const mode of ['kineta', 'kineta_dennica', 'cale']) {
            const well = bare(mode);
            expect(
                ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])
            ).toBeCloseTo(1000 + 3.927 * 200, 0);
        }
    });

    test('13. osadnik H_os=500 bez kinety: dennica = wkładka + ściany powyżej (razem dno+pełne ściany)', () => {
        const well = makeWell({
            wkladkaOsadnikPreco: 'tak',
            wkladkaOsadnikH: 500,
            config: [{ productId: 'DDD-10-115', quantity: 1 }]
        });
        // wkładka ≈2.3248 + ściany powyżej ≈1.5708 = dno + pełne ściany ≈3.8956 m²
        expect(
            ctx.getItemAssessedPrice(well, product('DDD-10-115'), false, well.config[0])
        ).toBeCloseTo(1000 + 3.8956 * 200, 0);
    });
});

describe('Malowanie — etykiety dopłat w ofercie (offerWellComponents)', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/offerWellComponents.js'),
        'utf8'
    );

    test('wiersz kinety: malowanie kinety', () => {
        expect(src).toContain('w cenie: malowanie kinety');
    });

    test('wiersz dennicy: malowanie dennicy (gałąź componentType)', () => {
        expect(src).toContain("p.componentType === 'dennica'");
        expect(src).toContain('w cenie: malowanie dennicy');
    });

    test('reszta elementów: generyczne malowanie wewnątrz', () => {
        expect(src).toContain('w cenie: malowanie wewnątrz');
    });

    test('kolejność: malowanie kinety → malowanie dennicy → przejścia', () => {
        const idxKinety = src.indexOf('w cenie: malowanie kinety');
        const idxDennicy = src.indexOf('w cenie: malowanie dennicy');
        const idxPrzejsc = src.indexOf('if (itemPrzejscia)');
        expect(idxKinety).toBeGreaterThan(-1);
        expect(idxDennicy).toBeGreaterThan(idxKinety);
        expect(idxPrzejsc).toBeGreaterThan(idxDennicy);
    });
});
