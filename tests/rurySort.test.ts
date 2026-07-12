import fs from 'fs';
import path from 'path';
import vm from 'vm';

interface RuryItem {
    productId: string;
    name?: string;
    lengthM?: number;
    [key: string]: unknown;
}

interface FlatEntry {
    cat: string;
    dk: string;
    entries: Array<{ item: RuryItem; originalIndex: number }>;
}

function loadProductHelpers() {
    const helpersPath = path.join(__dirname, '..', 'public', 'js', 'rury', 'productHelpers.js');
    const metaPath = path.join(__dirname, '..', 'public', 'js', 'rury', 'productMetadata.js');
    const helpersSource = fs.readFileSync(helpersPath, 'utf8');
    const metaSource = fs.readFileSync(metaPath, 'utf8');

    const products: Array<{ id: string; category: string; name?: string }> = [];
    const sandbox: any = {
        console,
        products: products,
        window: {} as any
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    vm.runInContext(metaSource, sandbox, { filename: 'productMetadata.js' });
    vm.runInContext(helpersSource, sandbox, { filename: 'productHelpers.js' });

    return {
        getSortedRuryItems: sandbox.window.getSortedRuryItems as (items: RuryItem[]) => {
            grouped: unknown;
            sortedCategories: string[];
            flat: FlatEntry[];
        },
        getProductDiameter: sandbox.window.getProductDiameter as (id: string) => number | null,
        getProductLength: sandbox.window.getProductLength as (id: string) => number | null,
        CATEGORIES: sandbox.window.CATEGORIES as string[],
        products: sandbox.products as Array<{ id: string; category: string; name?: string }>
    };
}

describe('getSortedRuryItems — sortowanie oferty rur', () => {
    const ctx = loadProductHelpers();

    beforeEach(() => {
        ctx.products.length = 0;
    });

    function addProduct(id: string, category: string, name?: string) {
        ctx.products.push({ id, category, name: name || id });
    }

    it('kategorie są sortowane według kolejności CATEGORIES', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe');
        addProduct('YZ-0-01-10-K00', 'Uszczelki');
        addProduct('RZP-0-03-25-K00', 'Żelbetowe KL. S (I)');
        addProduct('PE-0-01-10-K00', 'Akcesoria PEHD');

        const result = ctx.getSortedRuryItems([
            { productId: 'RTB-0-03-25-K00' },
            { productId: 'YZ-0-01-10-K00' },
            { productId: 'RZP-0-03-25-K00' },
            { productId: 'PE-0-01-10-K00' }
        ]);

        const catOrder = result.flat.map((e) => e.cat);
        expect(catOrder).toEqual([
            'Akcesoria PEHD',
            'Rury Betonowe',
            'Żelbetowe KL. S (I)',
            'Uszczelki'
        ]);
    });

    it('średnice są sortowane numerycznie rosnąco', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe'); // DN 300
        addProduct('RTB-0-01-25-K00', 'Rury Betonowe'); // DN 100
        addProduct('RTB-0-05-25-K00', 'Rury Betonowe'); // DN 500

        const result = ctx.getSortedRuryItems([
            { productId: 'RTB-0-03-25-K00' },
            { productId: 'RTB-0-01-25-K00' },
            { productId: 'RTB-0-05-25-K00' }
        ]);

        const sortedDks = result.flat.map((e) => e.dk);
        expect(sortedDks).toEqual(['DN 100', 'DN 300', 'DN 500']);
    });

    it('produkty Bosy-Bosy są pierwsze w obrębie kategorii i średnicy, potem według długości', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe', 'Rura betonowa Bosy-Bosy DN 300');
        addProduct('RTB-0-03-25-K01', 'Rury Betonowe', 'Rura betonowa DN 300');

        const result = ctx.getSortedRuryItems([
            { productId: 'RTB-0-03-25-K01', name: 'Rura betonowa DN 300', lengthM: 2.5 },
            { productId: 'RTB-0-03-25-K00', name: 'Rura betonowa Bosy-Bosy DN 300', lengthM: 1.0 }
        ]);

        expect(result.flat.length).toBe(1);
        expect(result.flat[0].entries.length).toBe(2);
        expect(result.flat[0].entries[0].item.productId).toBe('RTB-0-03-25-K00');
    });

    it('produkt z końcówką -B00 jest traktowany jako Bosy-Bosy', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe', 'Rura betonowa DN 300');
        addProduct('RTB-0-03-25-B00', 'Rury Betonowe', 'Rura betonowa DN 300');

        const result = ctx.getSortedRuryItems([
            { productId: 'RTB-0-03-25-K00', name: 'Rura betonowa DN 300' },
            { productId: 'RTB-0-03-25-B00', name: 'Rura betonowa DN 300' }
        ]);

        expect(result.flat[0].entries[0].item.productId).toBe('RTB-0-03-25-B00');
    });

    it('nie mutuje oryginalnej tablicy wejściowej', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe');
        addProduct('RTB-0-01-25-K00', 'Rury Betonowe');

        const original = [{ productId: 'RTB-0-03-25-K00' }, { productId: 'RTB-0-01-25-K00' }];
        const copy = [...original];

        ctx.getSortedRuryItems(original);
        expect(original).toEqual(copy);
    });

    it('produkty z tej samej kategorii i średnicy są sortowane rosnąco po długości', () => {
        addProduct('RTB-0-03-25-K00', 'Rury Betonowe');
        addProduct('RTB-0-03-25-K01', 'Rury Betonowe');

        const result = ctx.getSortedRuryItems([
            { productId: 'RTB-0-03-25-K01', name: 'Rura DN 300 2.5m', lengthM: 2.5 },
            { productId: 'RTB-0-03-25-K00', name: 'Rura DN 300 1.0m', lengthM: 1.0 }
        ]);

        expect(result.flat[0].entries[0].item.productId).toBe('RTB-0-03-25-K00');
        expect(result.flat[0].entries[1].item.productId).toBe('RTB-0-03-25-K01');
    });
});
