/**
 * Testy realnej logiki frontendu — public/js/rury/productHelpers.js (vm pattern,
 * wzorzec tests/studnie/excelDrilledRings.test.ts). Pokrywa getSortedRuryItems:
 * kolejność kategorii wg CATEGORIES, sortowanie średnic numerycznie, Bosy-Bosy
 * najpierw, potem rosnąco po lengthM (konwencja AGENTS.md moduł Rury).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadProductHelpers(products: Array<Record<string, unknown>>) {
    const ctxDir = path.join(process.cwd(), 'public/js/rury');
    // Kolejność jak w rury.html: productMetadata.js (CATEGORIES) przed productHelpers.js
    const files = ['productMetadata.js', 'productHelpers.js'];
    const sandbox = {
        window: {} as Record<string, unknown>,
        products,
        console
    };
    vm.createContext(sandbox);
    for (const f of files) {
        vm.runInContext(fs.readFileSync(path.join(ctxDir, f), 'utf-8'), sandbox, { filename: f });
    }
    return {
        // getSortedRuryItems eksploatuje window; getProductLength/Diameter to
        // deklaracje function top-level → dostępne jako właściwości kontekstu vm
        getSortedRuryItems: (sandbox.window as { getSortedRuryItems: typeof getSortedRuryItemsFn })
            .getSortedRuryItems,
        getProductDiameter: (
            sandbox as unknown as { getProductDiameter: (id: string) => number | null }
        ).getProductDiameter,
        getProductLength: (
            sandbox as unknown as { getProductLength: (id: string) => number | null }
        ).getProductLength
    };
}

type Item = { productId: string; name?: string; lengthM?: number };
type Entry = { item: Item; originalIndex: number };
type FlatGroup = { cat: string; dk: string; entries: Entry[] };
type SortedResult = {
    grouped: Record<string, Record<string, Entry[]>>;
    sortedCategories: string[];
    flat: FlatGroup[];
};
declare function getSortedRuryItemsFn(items: Item[]): SortedResult;

const PRODUCTS = [
    { id: 'RTB-0-03-25-K00', category: 'Rury Betonowe' },
    { id: 'RTB-0-03-10-K00', category: 'Rury Betonowe' },
    { id: 'RTB-0-03-25-B00', category: 'Rury Betonowe' }, // bosy DN300
    { id: 'RTB-0-05-25-B00', category: 'Rury Betonowe' }, // bosy DN500
    { id: 'RZB-0-05-20-K00', category: 'Żelbetowe KL. A (II)' }
];

describe('frontend vm: productHelpers.getSortedRuryItems', () => {
    const w = loadProductHelpers(PRODUCTS);

    it('parsuje długość i średnicę ze wzoru ID', () => {
        expect(w.getProductLength('RTB-0-03-25-K00')).toBe(2500);
        expect(w.getProductDiameter('RTB-0-03-25-K00')).toBe(300);
        expect(w.getProductDiameter('ZT-0300')).toBe(300);
        expect(w.getProductDiameter('X-Y')).toBeNull();
    });

    it('sortuje kategorie wg CATEGORIES, potem średnice numerycznie', () => {
        const items: Item[] = [
            { productId: 'RZB-0-05-20-K00', name: 'Żelbet A' },
            { productId: 'RTB-0-05-25-B00', name: 'Betonowy Bosy' },
            { productId: 'RTB-0-03-25-K00', name: 'Betonowy 2500' },
            { productId: 'RTB-0-03-10-K00', name: 'Betonowy 1000' }
        ];
        const res = w.getSortedRuryItems(items);
        expect(res.sortedCategories[0]).toBe('Rury Betonowe');
        expect(res.sortedCategories[1]).toBe('Żelbetowe KL. A (II)');

        const betonoweGroups = res.flat.filter((g) => g.cat === 'Rury Betonowe').map((g) => g.dk);
        expect(betonoweGroups).toEqual(['DN 300', 'DN 500']); // rosnąco po DN
    });

    it('w obrębie kategorii+średnicy: Bosy-Bosy pierwszy, potem długość rosnąco', () => {
        const items: Item[] = [
            { productId: 'RTB-0-03-25-K00', name: 'Kielichowy 2500', lengthM: 2.5 },
            { productId: 'RTB-0-03-25-B00', name: 'Bosy 2500', lengthM: 2.5 },
            { productId: 'RTB-0-03-10-K00', name: 'Kielichowy 1000', lengthM: 1.0 }
        ];
        const res = w.getSortedRuryItems(items);
        const dn300 = res.flat.find((g) => g.dk === 'DN 300')!;
        const names = dn300.entries.map((e) => e.item.name);
        // Bosy najpierw mimo większej długości; potem 1000 przed 2500
        expect(names[0]).toBe('Bosy 2500');
        expect(names.slice(1)).toEqual(['Kielichowy 1000', 'Kielichowy 2500']);
    });

    it('fallback średnicy z ID gdy produkt nieznany (parts[4]*100)', () => {
        const res = w.getSortedRuryItems([{ productId: 'XXX-X-DD-LL-07', name: 'Nieznany' }]);
        expect(res.flat[0].dk).toBe('DN 700');
    });
});
