import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('globals Map stale — hybrid guard', () => {
    let ctx: any;
    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            window: null as any,
            console,
            document: { addEventListener: () => {} },
            localStorage: { getItem: () => null, setItem: () => {} },
            location: { search: '' }
        };
        context.window = context;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(base, 'globals.js'), 'utf8');
        vm.runInContext(code, context);
        ctx = context;
    });

    test('direct let assignment bypass — lazy guard self-heals', () => {
        // symulacja appStudnie.js:209 direct studnieProducts = [...]
        ctx.studnieProducts = [{ id: 'A', price: 10, componentType: 'krag' }];
        // bez window.* Map stale
        expect(ctx.getStudnieProductById('A')).not.toBeNull();
        expect(ctx.getStudnieProductById('A')?.price).toBe(10);
        expect(ctx.__assertStudnieMapFresh()).toBe(true);
    });

    test('ten sam length, inny produkt — invariant wykrywa', () => {
        ctx.window.studnieProducts = [{ id: 'A', price: 10, componentType: 'krag' }];
        expect(ctx.getStudnieProductById('A')?.price).toBe(10);
        // direct mutation bez zmiany length
        ctx.studnieProducts[0] = { id: 'A', price: 20, componentType: 'krag' };
        // lazy size guard nie wykryje, ale formalny invariant tak
        expect(ctx.__assertStudnieMapFresh()).toBe(false);
        // poprawny window.* przywraca
        ctx.window.studnieProducts = [{ id: 'A', price: 20, componentType: 'krag' }];
        expect(ctx.getStudnieProductById('A')?.price).toBe(20);
        expect(ctx.__assertStudnieMapFresh()).toBe(true);
    });

    test('duplikat ID — invariant false, Map last-write-wins', () => {
        ctx.window.studnieProducts = [
            { id: 'A', price: 10, componentType: 'krag' },
            { id: 'A', price: 20, componentType: 'krag' }
        ];
        expect(ctx.__assertStudnieMapFresh()).toBe(false);
        // find first-match vs Map last-write
        const viaMap = ctx.getStudnieProductById('A');
        const viaFind = ctx.studnieProducts.find((p: any) => String(p.id) === 'A');
        expect(viaMap.price).toBe(20);
        expect(viaFind.price).toBe(10);
    });

    test('precedence wlaz/kineta — predicate zwraca boolean', () => {
        ctx.window.studnieProducts = [
            { id: 'K1', componentType: 'krag', price: 10 },
            { id: 'W1', componentType: 'wlaz', price: 20 }
        ];
        const well = { config: [{ productId: 'K1' }, { productId: 'W1' }] };
        const wlaz = well.config.find(
            (c: any) => (ctx.getStudnieProductById(c.productId) as any)?.componentType === 'wlaz'
        );
        expect(wlaz?.productId).toBe('W1');
        const kineta = well.config.find(
            (c: any) => (ctx.getStudnieProductById(c.productId) as any)?.componentType === 'kineta'
        );
        expect(kineta).toBeUndefined();
    });
});
