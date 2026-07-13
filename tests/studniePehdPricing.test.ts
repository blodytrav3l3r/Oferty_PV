import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { readStudnieSeedProducts } from '../src/services/studnieSeedUtils';

/* =============================================================
   Testy: Dopłata PEHD w module studni
   =============================================================
   Sprawdzają:
   1. Poprawność danych seed (które produkty mają doplataPEHD)
   2. Logikę getItemAssessedPrice() dla różnych warunków PEHD
   3. Poprawność recalculatePEHD()
   ============================================================= */

/* ===== 1. SEED DATA VALIDATION ===== */

describe('Seed data — doplataPEHD', () => {
    let seedData: any[];

    beforeAll(() => {
        seedData = readStudnieSeedProducts() as any[];
    });

    it('seed JSON zawiera wszystkie wymagane produkty', () => {
        expect(seedData.length).toBeGreaterThan(600);
    });

    it('dennica produkty NIE MAJĄ pola doplataPEHD w seed JSON', () => {
        const dennicaItems = seedData.filter((p: any) => p.componentType === 'dennica');
        expect(dennicaItems.length).toBeGreaterThan(80);
        const withPehd = dennicaItems.filter((p: any) => p.doplataPEHD !== undefined);
        expect(withPehd.length).toBe(0);
    });

    it('krag produkty NIE MAJĄ pola doplataPEHD w seed JSON', () => {
        const kragItems = seedData.filter((p: any) => p.componentType === 'krag');
        expect(kragItems.length).toBeGreaterThan(80);
        const withPehd = kragItems.filter((p: any) => p.doplataPEHD !== undefined);
        expect(withPehd.length).toBe(0);
    });

    it('WIĘKSZOŚĆ plyta NIE MA pola doplataPEHD, ale 3 plyta_redukcyjna TAK (DN1500/2000/2500)', () => {
        const plytaItems = seedData.filter(
            (p: any) => p.componentType && p.componentType.startsWith('plyta')
        );
        expect(plytaItems.length).toBeGreaterThan(10);
        const withPehd = plytaItems.filter((p: any) => p.doplataPEHD !== undefined);
        // 3 plyta_redukcyjna (DN1500/2000/2500) mają doplataPEHD ustawione
        expect(withPehd.length).toBe(3);
        withPehd.forEach((p: any) => {
            expect(p.componentType).toBe('plyta_redukcyjna');
            expect(p.doplataPEHD).toBeGreaterThan(0);
        });
    });

    it('tylko krag_ot i nieliczne plyta_redukcyjna mają doplataPEHD > 0; uszczelki/przejścia mają null', () => {
        const withPositive = seedData.filter(
            (p: any) => typeof p.doplataPEHD === 'number' && p.doplataPEHD > 0
        );
        const hasOnlyExpectedTypes = withPositive.every(
            (p: any) => p.componentType === 'krag_ot' || p.componentType === 'plyta_redukcyjna'
        );
        expect(hasOnlyExpectedTypes).toBe(true);

        const withNull = seedData.filter((p: any) => p.doplataPEHD === null);
        const allNullOrUszczelka = withNull.every(
            (p: any) => p.componentType === 'uszczelka' || p.componentType === 'przejscie'
        );
        expect(allNullOrUszczelka).toBe(true);
    });

    it('krag_ot — NIEKTÓRE mają numeryczne doplataPEHD, inne nie (niekonsekwentne dane seed)', () => {
        const kragOtItems = seedData.filter((p: any) => p.componentType === 'krag_ot');
        expect(kragOtItems.length).toBeGreaterThan(5);
        const withNumber = kragOtItems.filter(
            (p: any) => typeof p.doplataPEHD === 'number' && p.doplataPEHD > 0
        );
        const without = kragOtItems.filter((p: any) => p.doplataPEHD === undefined);
        expect(withNumber.length).toBeGreaterThan(0);
        expect(without.length).toBeGreaterThan(0); // 13 krag_ot nie ma doplataPEHD
    });

    it('po naprawie WSZYSTKIE dennicy/kręgi/płyty mają area > 0', () => {
        const criticalTypes = [
            'dennica',
            'krag',
            'plyta',
            'plyta_din',
            'plyta_redukcyjna',
            'plyta_nastudzienna',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'konus',
            'stozek',
            'zwienczenie',
            'pierscien_odciazajacy'
        ];
        const criticalItems = seedData.filter((p: any) => criticalTypes.includes(p.componentType));
        const withoutArea = criticalItems.filter((p: any) => !p.area || p.area <= 0);
        // Naprawiono skryptem fix-studnie-seed-area.mjs
        expect(withoutArea.length).toBe(0);
    });
});

/* ===== 2. JEDNOSTKOWE TESTY getItemAssessedPrice (VM) ===== */

function loadPricingFunctions() {
    const pricingPath = path.join(
        __dirname,
        '..',
        'public',
        'js',
        'studnie',
        'wellManager',
        'wellStats',
        'wellStatsPricing.js'
    );
    const source = fs.readFileSync(pricingPath, 'utf8');

    const studnieProducts: any[] = [];
    const wellDiscounts: Record<string, any> = {};

    const sandbox: any = {
        console,
        studnieProducts,
        wellDiscounts,
        isWellOrdered: () => false,
        editingOfferIdStudnie: null,
        getOrderForWellId: () => null,
        calcKinetaPaintingArea: () => 0,
        window: {} as any
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'wellStatsPricing.js' });

    return {
        getItemAssessedPrice: sandbox.getItemAssessedPrice as (
            well: any,
            p: any,
            applyDiscount: boolean,
            item: any
        ) => number,
        getItemPriceBreakdown: sandbox.getItemPriceBreakdown as (
            well: any,
            p: any,
            applyDiscount: boolean,
            item: any
        ) => any,
        studnieProducts: sandbox.studnieProducts as any[],
        wellDiscounts: sandbox.wellDiscounts as Record<string, any>
    };
}

function makeWell(overrides?: Record<string, any>) {
    return {
        dn: '1000',
        wkladkaDennica: 'brak',
        wkladkaNadbudowa: 'brak',
        wkladkaZwienczenie: 'brak',
        pehdDiscount: 0,
        malowanieW: 'brak',
        malowanieZ: 'brak',
        ...overrides
    };
}

function makeProduct(overrides?: Record<string, any>) {
    return {
        id: 'TEST-001',
        name: 'Test Product',
        componentType: 'dennica',
        dn: 1000,
        price: 500,
        height: 300,
        weight: 770,
        area: 1.732,
        doplataPEHD: null,
        ...overrides
    };
}

function makeItem(overrides?: Record<string, any>) {
    return {
        productId: 'TEST-001',
        quantity: 1,
        disablePehd: false,
        ...overrides
    };
}

describe('getItemAssessedPrice — PEHD surcharge logic', () => {
    let ctx: ReturnType<typeof loadPricingFunctions>;

    beforeAll(() => {
        ctx = loadPricingFunctions();
    });

    describe('dennica — PEHD przez wkladkaDennica', () => {
        it('dodaje dopłatę PEHD gdy wkladkaDennica ustawiona i doplataPEHD > 0', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });
            const item = makeItem();

            const price = ctx.getItemAssessedPrice(well, p, false, item);
            expect(price).toBe(500 + 200);
        });

        it('NIE dodaje dopłaty gdy wkladkaDennica = "brak"', () => {
            const well = makeWell({ wkladkaDennica: 'brak' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500);
        });

        it('NIE dodaje dopłaty gdy doplataPEHD = null', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: null });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500);
        });

        it('NIE dodaje dopłaty gdy disablePehd = true', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });
            const item = makeItem({ disablePehd: true });

            const price = ctx.getItemAssessedPrice(well, p, false, item);
            expect(price).toBe(500);
        });
    });

    describe('krag — PEHD przez wkladkaNadbudowa', () => {
        it('dodaje dopłatę PEHD dla kręgu gdy wkladkaNadbudowa ustawiona', () => {
            const well = makeWell({ wkladkaNadbudowa: 'PEHD' });
            const p = makeProduct({ componentType: 'krag', doplataPEHD: 150 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500 + 150);
        });

        it('NIE dodaje dopłaty dla kręgu gdy wkladkaNadbudowa = "brak"', () => {
            const well = makeWell({ wkladkaNadbudowa: 'brak' });
            const p = makeProduct({ componentType: 'krag', doplataPEHD: 150 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500);
        });

        it('dodaje dopłatę dla krag_ot gdy wkladkaNadbudowa ustawiona', () => {
            const well = makeWell({ wkladkaNadbudowa: 'PEHD' });
            const p = makeProduct({ componentType: 'krag_ot', doplataPEHD: 180 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500 + 180);
        });

        it('dodaje dopłatę dla rura gdy wkladkaNadbudowa ustawiona', () => {
            const well = makeWell({ wkladkaNadbudowa: 'PEHD' });
            const p = makeProduct({ componentType: 'rura', doplataPEHD: 120 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500 + 120);
        });
    });

    describe('plyta/konus/zwienczenie — PEHD przez wkladkaZwienczenie', () => {
        const closureTypes = [
            'plyta',
            'plyta_redukcyjna',
            'plyta_nastudzienna',
            'stozek',
            'zwienczenie',
            'konus',
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'pierscien_odciazajacy'
        ];

        closureTypes.forEach((type) => {
            it(`dodaje dopłatę PEHD dla ${type} gdy wkladkaZwienczenie ustawiona`, () => {
                const well = makeWell({ wkladkaZwienczenie: 'PEHD' });
                const p = makeProduct({ componentType: type, doplataPEHD: 100 });

                const price = ctx.getItemAssessedPrice(well, p, false, null);
                expect(price).toBe(500 + 100);
            });

            it(`NIE dodaje dopłaty dla ${type} gdy wkladkaZwienczenie = "brak"`, () => {
                const well = makeWell({ wkladkaZwienczenie: 'brak' });
                const p = makeProduct({ componentType: type, doplataPEHD: 100 });

                const price = ctx.getItemAssessedPrice(well, p, false, null);
                expect(price).toBe(500);
            });
        });
    });

    describe('interakcja z rabatami PEHD', () => {
        it('pehdDiscount zmniejsza dopłatę PEHD gdy applyDiscount = true', () => {
            const well = makeWell({
                wkladkaDennica: 'PEHD',
                pehdDiscount: 20
            });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const price = ctx.getItemAssessedPrice(well, p, true, null);
            expect(price).toBe(500 + 160); // 200 * (1 - 0.20) = 160
        });

        it('pehdDiscount NIE zmniejsza dopłaty gdy applyDiscount = false', () => {
            const well = makeWell({
                wkladkaDennica: 'PEHD',
                pehdDiscount: 20
            });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const price = ctx.getItemAssessedPrice(well, p, false, null);
            expect(price).toBe(500 + 200); // pełna dopłata, bez rabatu
        });

        it('pehdDiscount = 0 nie zmienia dopłaty', () => {
            const well = makeWell({
                wkladkaDennica: 'PEHD',
                pehdDiscount: 0
            });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const price = ctx.getItemAssessedPrice(well, p, true, null);
            expect(price).toBe(500 + 200);
        });
    });

    describe('getItemPriceBreakdown — PEHD pole', () => {
        it('zwraca pole pehd = 0 gdy brak dopłaty', () => {
            const well = makeWell();
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: null });

            const bd = ctx.getItemPriceBreakdown(well, p, false, null);
            expect(bd.pehd).toBe(0);
        });

        it('zwraca pole pehd > 0 gdy dopłata aktywna', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const bd = ctx.getItemPriceBreakdown(well, p, false, null);
            expect(bd.pehd).toBe(200);
        });

        it('zwraca pole pehd = 0 gdy disablePehd = true', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });
            const item = makeItem({ disablePehd: true });

            const bd = ctx.getItemPriceBreakdown(well, p, false, item);
            expect(bd.pehd).toBe(0);
        });

        it('total = base + pehd + inne składniki', () => {
            const well = makeWell({ wkladkaDennica: 'PEHD' });
            const p = makeProduct({ componentType: 'dennica', doplataPEHD: 200 });

            const bd = ctx.getItemPriceBreakdown(well, p, false, null);
            expect(bd.total).toBe(
                bd.base + bd.pehd + bd.malowanieW + bd.malowanieZ + bd.zelbet + bd.nierdzewna
            );
        });
    });
});

/* ===== 3. TEST: recalculatePEHD (odczyt kodu źródłowego) ===== */

describe('recalculatePEHD — analiza wzoru', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'js', 'studnie', 'pricelistManager', 'categories.js'),
        'utf8'
    );

    it('kod zawiera funkcję recalculatePEHD', () => {
        expect(src).toContain('window.recalculatePEHD');
    });

    it('używa wzoru Math.round(p.area * price)', () => {
        expect(src).toContain('Math.round(p.area * price)');
    });

    it('pomija przejscia i kinety', () => {
        expect(src).toContain("p.componentType !== 'przejscie'");
        expect(src).toContain("p.componentType !== 'kineta'");
    });

    it('wymaga area > 0', () => {
        expect(src).toContain('p.area > 0');
    });
});

describe('PEHD — kompletny flow: seed → DB → API → frontend', () => {
    let seedData: any[];

    beforeAll(() => {
        seedData = readStudnieSeedProducts() as any[];
    });

    it('po reseedzie dennicy i kręgi NIE MAJĄ doplataPEHD, ale 3 plyta_redukcyjna TAK', () => {
        const dennicaKrag = seedData.filter((p: any) =>
            ['dennica', 'krag'].includes(p.componentType)
        );
        dennicaKrag.forEach((p: any) => {
            expect(p.doplataPEHD).toBeUndefined();
        });

        const plyta = seedData.filter(
            (p: any) => p.componentType && p.componentType.startsWith('plyta')
        );
        const plytaWithPehd = plyta.filter((p: any) => p.doplataPEHD !== undefined);
        expect(plytaWithPehd.length).toBe(3); // tylko plyta_redukcyjna DN1500/2000/2500
    });

    it('recalculatePEHD może ustawić doplataPEHD = Math.round(area * price)', () => {
        const pricePerM2 = 270;
        const dennica = seedData.find((p: any) => p.componentType === 'dennica' && p.area > 0);
        expect(dennica).toBeDefined();

        const expectedPehd = Math.round(dennica!.area * pricePerM2);
        expect(expectedPehd).toBeGreaterThan(0);
    });

    it('przejścia mają doplataPEHD: null (a nie undefined), kinety nie mają pola', () => {
        const przejscia = seedData.filter((p: any) => p.componentType === 'przejscie');
        const kinety = seedData.filter((p: any) => p.componentType === 'kineta');

        przejscia.forEach((p: any) => {
            if (p.doplataPEHD !== undefined) {
                expect(p.doplataPEHD).toBeNull();
            }
        });
        kinety.forEach((p: any) => expect(p.doplataPEHD).toBeUndefined());
    });
});

/* ===== 4. TEST: recalculatePEHDInternal (VM) ===== */

function loadCategoriesFunctions() {
    const categoriesPath = path.join(
        __dirname,
        '..',
        'public',
        'js',
        'studnie',
        'pricelistManager',
        'categories.js'
    );
    const source = fs.readFileSync(categoriesPath, 'utf8');

    const studnieProducts: any[] = [];

    const sandbox: any = {
        console,
        studnieProducts,
        _studniePricelistDirty: false,
        showToast: () => {},
        appConfirm: async () => true,
        updateStudnieSaveBtn: () => {},
        renderStudniePriceList: () => {},
        CENNIK_TAB_FILTERS: {},
        currentCennikTab: 'dn1000',
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        pehdPricePerM2: 270,
        window: {} as any
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'categories.js' });

    return {
        recalculatePEHDInternal: sandbox.recalculatePEHDInternal as (price: number) => number,
        studnieProducts: sandbox.studnieProducts as any[]
    };
}

describe('recalculatePEHDInternal — auto-przeliczanie PEHD', () => {
    it('ustawia doplataPEHD = Math.round(area * price) dla dennicy z area > 0', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'DEN-10-10', componentType: 'dennica', area: 1.732, price: 500 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBe(Math.round(1.732 * 270));
    });

    it('ustawia doplataPEHD dla krega z area > 0', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'KRG-10-25', componentType: 'krag', area: 2.5, price: 300 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBe(Math.round(2.5 * 270));
    });

    it('ustawia doplataPEHD dla plyta/konus z area > 0', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'PLY-10', componentType: 'plyta', area: 1.2, price: 200 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBe(Math.round(1.2 * 270));
    });

    it('pomija przejscia', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'PRZ-1', componentType: 'przejscie', area: 2.0 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBeUndefined();
    });

    it('pomija kinety', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'KIN-1', componentType: 'kineta', area: 1.5 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBeUndefined();
    });

    it('pomija produkty z area = 0', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'DEN-0', componentType: 'dennica', area: 0 };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBeUndefined();
    });

    it('pomija produkty z area = null', () => {
        const ctx = loadCategoriesFunctions();
        const p: any = { id: 'DEN-NULL', componentType: 'dennica', area: null };
        ctx.studnieProducts.push(p);

        ctx.recalculatePEHDInternal(270);

        expect(p.doplataPEHD).toBeUndefined();
    });

    it('zwraca liczbę przeliczonych produktów', () => {
        const ctx = loadCategoriesFunctions();
        ctx.studnieProducts.push(
            { id: 'DEN-1', componentType: 'dennica', area: 1.0 },
            { id: 'KRG-1', componentType: 'krag', area: 2.0 },
            { id: 'PRZ-1', componentType: 'przejscie', area: 3.0 },
            { id: 'KIN-1', componentType: 'kineta', area: 4.0 }
        );

        const count = ctx.recalculatePEHDInternal(270);

        expect(count).toBe(2); // tylko DEN-1 i KRG-1
    });
});

/* ===== 5. REGRESJA: ścieżka SPA (orchestrator) MUSI wywołać recalculatePEHDInternal =====
   Poprzedni błąd: appStudnie.js (ścieżka SPA) ładował studnieProducts, ale NIE
   wywoływał recalculatePEHDInternal → doplataPEHD === null dla ~271 produktów →
   cena wkładki PEHD nie liczyła się dla większości elementów. */

describe('REGRESJA — SPA orchestrator wywołuje recalculatePEHDInternal', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'js', 'appStudnie.js'),
        'utf8'
    );

    it('loadDataInBackground wywołuje recalculatePEHDInternal po przypisaniu studnieProducts', () => {
        const idxAssign = src.indexOf('studnieProducts = productsP.value');
        expect(idxAssign).toBeGreaterThan(-1);

        const idxRecalc = src.indexOf('recalculatePEHDInternal(pehdPricePerM2)', idxAssign);
        expect(idxRecalc).toBeGreaterThan(-1);
        expect(idxRecalc).toBeGreaterThan(idxAssign);
    });

    it('resetStudniePriceList (crud.js) wywołuje recalculatePEHDInternal po structuredClone', () => {
        const crudSrc = fs.readFileSync(
            path.join(__dirname, '..', 'public', 'js', 'studnie', 'pricelistManager', 'crud.js'),
            'utf8'
        );
        const idxClone = crudSrc.indexOf('structuredClone');
        expect(idxClone).toBeGreaterThan(-1);

        const idxRecalc = crudSrc.indexOf('recalculatePEHDInternal(pehdPricePerM2)', idxClone);
        expect(idxRecalc).toBeGreaterThan(-1);
    });
});
