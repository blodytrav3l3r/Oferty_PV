// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* =============================================================
   P1: cicha cena 0 za wiercenie.
   Przejście w kręgu (krag/krag_ot) bez produktu "Wiercenie" DN>=X
   w cenniku => widoczny WARNING (nie tylko cichy 0 w wycenie).
   Pomocnik wyboru produktu jest SSoT współdzielonym z actionsWellPricing.
   ============================================================= */

const SRC = path.join(__dirname, '../../public/js/studnie');

function readSrc(name: string) {
    return fs.readFileSync(path.join(SRC, name), 'utf8');
}

const KRAG = {
    id: 'krag-1000-500',
    componentType: 'krag',
    dn: '1000',
    height: 500,
    name: 'Krąg DN1000 H=500'
};
const DENNICA = {
    id: 'dennica-1000-300',
    componentType: 'dennica',
    dn: '1000',
    height: 300,
    name: 'Dennica DN1000'
};
const PRZEJSCIE = {
    id: 'prz-160',
    componentType: 'przejscie',
    dn: '160',
    name: 'Przejście DN160'
};
function drilling(dn: number, price = 250) {
    return {
        id: `Wiercenie-${dn}`,
        category: 'Wiercenie',
        componentType: 'wiercenie',
        dn: String(dn),
        price,
        name: `Wiercenie DN${dn}`
    };
}

function loadSandbox(products: any[], overrides: Record<string, any> = {}) {
    const context: any = {
        studnieProducts: products,
        FLOW_TYPES: Object.freeze({ WYLOT: 'wylot', WLOT: 'wlot', DOLOT: 'dolot' }),
        resolveStudnieProduct: (id: string) => products.find((p) => p.id === id) || null,
        isDennicaLikeProduct: (p: any) =>
            !!p && (p.componentType === 'dennica' || p.componentType === 'styczna'),
        dennicaHeightPenalty: () => 0,
        getPehdTypeForComponent: () => 'brak',
        ...overrides
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['transitionZones.js', 'actionsWellPricing.js', 'solverValidation.js']) {
        vm.runInContext(readSrc(file), context);
    }
    return context;
}

/** Przejście w krawędzi dolnej kręgu: bottom-most (dół bez zapasu),
 *  góra ma pełne 300 mm → brak błędów luzów i brak notki minimalnej. */
function makeWell(config: any[], przejscia: any[], extra: Record<string, any> = {}) {
    return {
        config,
        configSource: 'MANUAL',
        rzednaDna: 0,
        przejscia,
        configErrors: [],
        ...extra
    };
}

const PRZYSTANIE_KRAG = [
    { productId: 'prz-160', rzednaWlaczenia: '0.04', flowType: 'wylot', angle: 0 }
];

describe('findDrillingProductForDn — SSoT wyboru produktu Wiercenie', () => {
    test('wybiera najmniejszy DN >= DN przejścia', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, drilling(110), drilling(160), drilling(200)]);
        expect(ctx.findDrillingProductForDn(150).drill.id).toBe('Wiercenie-160');
        expect(ctx.findDrillingProductForDn(160).drill.id).toBe('Wiercenie-160');
        expect(ctx.findDrillingProductForDn(200).drill.id).toBe('Wiercenie-200');
    });

    test('brak wystarczającego DN → null (cicha cena 0)', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, drilling(110)]);
        expect(ctx.findDrillingProductForDn(160)).toBeNull();
    });

    test('DN z id, gdy brak pola dn', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, { id: 'Wiercenie-250', category: 'Wiercenie' }]);
        expect(ctx.findDrillingProductForDn(200).drill.id).toBe('Wiercenie-250');
    });
});

describe('recalculateWellErrors — ostrzeżenie o braku produktu Wiercenie', () => {
    test('host krag + brak Wiercenia → WARNING z DN przejścia', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, drilling(110)]);
        const well = makeWell([{ productId: KRAG.id, quantity: 1 }], PRZYSTANIE_KRAG);
        ctx.recalculateWellErrors(well);
        const warn = well.configErrors.find((e: string) => e.includes('Brak produktu "Wiercenie"'));
        expect(warn).toBeDefined();
        expect(warn).toContain('DN≥160');
        expect(well.configStatus).toBe('WARNING');
    });

    test('host krag + Wiercenie w cenniku → brak ostrzeżenia, status OK', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, drilling(160)]);
        const well = makeWell([{ productId: KRAG.id, quantity: 1 }], PRZYSTANIE_KRAG);
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('Wiercenie'))).toBe(false);
        expect(well.configStatus).toBe('OK');
    });

    test('host dennicy → wiercenie nie dotyczy, brak ostrzeżenia', () => {
        const ctx = loadSandbox([DENNICA, KRAG, PRZEJSCIE, drilling(110)]);
        const well = makeWell(
            [
                { productId: KRAG.id, quantity: 1 },
                { productId: DENNICA.id, quantity: 1 }
            ],
            PRZYSTANIE_KRAG
        );
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('Wiercenie'))).toBe(false);
    });

    test('przejście INSITU → wiercenie w gruncie, brak ostrzeżenia', () => {
        const insitu = { ...PRZEJSCIE, id: 'prz-insitu', name: 'Przejście INSITU DN160' };
        const ctx = loadSandbox([KRAG, insitu, drilling(110)]);
        const well = makeWell(
            [{ productId: KRAG.id, quantity: 1 }],
            [{ productId: 'prz-insitu', rzednaWlaczenia: '0.04', flowType: 'wylot', angle: 0 }]
        );
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('Wiercenie'))).toBe(false);
    });

    test('dodanie produktu do cennika usuwa wcześniejsze ostrzeżenie', () => {
        const products = [KRAG, PRZEJSCIE, drilling(110)];
        const ctx = loadSandbox(products);
        const well = makeWell([{ productId: KRAG.id, quantity: 1 }], PRZYSTANIE_KRAG);
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('Wiercenie'))).toBe(true);

        products.push(drilling(160));
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('Wiercenie'))).toBe(false);
    });
});

describe('recalculateWellErrors — klasyfikacja PEHD przez SOFT_WARNING_MARKERS', () => {
    test('samo ostrzeżenie o braku dopłaty PEHD → WARNING, nie ERROR', () => {
        const ctx = loadSandbox([KRAG, PRZEJSCIE, drilling(160)], {
            getPehdTypeForComponent: () => 'PEHD'
        });
        const well = makeWell([{ productId: KRAG.id, quantity: 1 }], PRZYSTANIE_KRAG);
        ctx.recalculateWellErrors(well);
        expect(well.configErrors.some((e: string) => e.includes('brak dopłaty PEHD'))).toBe(true);
        expect(well.configStatus).toBe('WARNING');
    });
});
