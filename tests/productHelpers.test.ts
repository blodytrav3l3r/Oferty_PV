import vm from 'vm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Testy vm dla productHelpers.js (rury) — SSoT sortowania oferty rur (Faza 4.2).
 * getSortedRuryItems jest jedynym źródłem prawdy sortowania (AGENTS.md) — testy logiki
 * chronią przed regresją kolejności kategorii, średnic i pozycji Bosy-Bosy.
 */

function loadProductHelpers(products: any[]) {
    const code = readFileSync(
        join(__dirname, '..', 'public', 'js', 'rury', 'productHelpers.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {},
        products,
        CATEGORIES: [
            'Rury Betonowe',
            'Żelbetowe KL.A',
            'Żelbetowe KL.S',
            'Duże Żelbetowe II',
            'Rury Jajowe Betonowe',
            'Rury Jajowe Żelbetowe',
            'Akcesoria PEHD',
            'Uszczelki',
            'Zabezpieczenie transportu'
        ]
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window;
}

describe('productHelpers.js — wymiary produktu (przez getPipeInnerArea)', () => {
    const api = loadProductHelpers([]);

    test('pole powierzchni wewnętrznej z ID (PI × D × L)', () => {
        // RTB-0-03-25-K00: D=300mm, L=2500mm → PI×0.3×2.5 ≈ 2.356
        const area = api.getPipeInnerArea('RTB-0-03-25-K00');
        expect(area).toBeCloseTo(Math.PI * 0.3 * 2.5, 6);
    });

    test('null-ish dla niepoprawnych ID (brak wymiarów → 0)', () => {
        expect(api.getPipeInnerArea('XYZ')).toBe(0);
    });

    test('rury jajowe (RJB) używają przybliżonego obwodu elipsy', () => {
        const area = api.getPipeInnerArea('RJB-0-06-25-K00');
        // h = 1.5×D, perimeter = PI×((D+h)/2)/1000, ×(L/1000)
        const d = 600;
        const l = 2500;
        const h = d * 1.5;
        const expected = ((Math.PI * ((d + h) / 2)) / 1000) * (l / 1000);
        expect(area).toBeCloseTo(expected, 6);
    });

    test('isOneMetrePipe rozpoznaje rurę 1m', () => {
        expect(api.isOneMetrePipe('RTB-0-03-10-K00')).toBe(true);
        expect(api.isOneMetrePipe('RTB-0-03-25-K00')).toBe(false);
    });
});

describe('productHelpers.js — getSortedRuryItems (SSoT sortowania)', () => {
    const products = [
        { id: 'RTB-0-03-25-K00', category: 'Rury Betonowe' },
        { id: 'RTB-0-06-25-K00', category: 'Rury Betonowe' },
        { id: 'RTB-0-03-10-K00', category: 'Rury Betonowe' },
        { id: 'ZAB-1', category: 'Zabezpieczenie transportu' },
        { id: 'USZ-1', category: 'Uszczelki' }
    ];
    const api = loadProductHelpers(products);

    const items = [
        { productId: 'RTB-0-06-25-K00', name: 'Rura DN600 2.5m', lengthM: 2.5 },
        { productId: 'ZAB-1', name: 'Zabezpieczenie', lengthM: 0 },
        { productId: 'RTB-0-03-10-K00', name: 'Rura DN300 Bosy 1m', lengthM: 1 },
        { productId: 'USZ-1', name: 'Uszczelka', lengthM: 0 },
        { productId: 'RTB-0-03-25-K00', name: 'Rura DN300 Bosy 2.5m', lengthM: 2.5 }
    ];

    test('kolejność kategorii wg CATEGORIES', () => {
        const { sortedCategories } = api.getSortedRuryItems(items);
        expect(sortedCategories[0]).toBe('Rury Betonowe');
        expect(sortedCategories[sortedCategories.length - 1]).toBe('Zabezpieczenie transportu');
    });

    test('średnice sortowane numerycznie (DN300 przed DN600)', () => {
        const { flat } = api.getSortedRuryItems(items);
        const betonowe = flat.filter((f: { cat: string }) => f.cat === 'Rury Betonowe');
        expect(betonowe[0].dk).toBe('DN 300');
        expect(betonowe[1].dk).toBe('DN 600');
    });

    test('Bosy-Bosy pierwsze, potem rosnąco po długości', () => {
        const { flat } = api.getSortedRuryItems(items);
        const dn300 = flat.find(
            (f: { cat: string; dk: string }) => f.cat === 'Rury Betonowe' && f.dk === 'DN 300'
        );
        expect(dn300.entries[0].item.productId).toBe('RTB-0-03-10-K00');
        expect(dn300.entries[1].item.productId).toBe('RTB-0-03-25-K00');
    });

    test('nie mutuje wejściowej tablicy (baza błędów #15)', () => {
        const snapshot = JSON.stringify(items);
        api.getSortedRuryItems(items);
        expect(JSON.stringify(items)).toBe(snapshot);
    });

    test('produkt bez średnicy trafia do grupy Inne bez błędu', () => {
        const { flat } = api.getSortedRuryItems([
            { productId: 'NOSREDNICY', name: 'X', lengthM: 1 }
        ]);
        const inny = flat.find(
            (f: { dk: string; cat: string }) => f.dk === 'Inne' || f.cat === 'Inne'
        );
        expect(inny).toBeDefined();
    });
});
