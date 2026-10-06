import fs from 'fs';
import path from 'path';
import vm from 'vm';

// REGRESJA: popup "Pokaż / Ukryj przejścia" pokazywał 0/0 w nowej ofercie,
// mimo że katalog zawierał aktywne przejścia. Przyczyna: guard
// getPrzejsciaCategories() porównywał size mapy z długością posortowanej
// listy (zawsze równe po rebuilcie) zamiast _isStudnieMapStale() —
// nieświeża mapa (np. podmiana in-place / bypass settera) nigdy nie była
// przebudowywana i popup dostawał pustą listę.

function makeCtx(): any {
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
    return context;
}

const PRZ = (id: string, category: string) => ({
    id,
    category,
    componentType: 'przejscie',
    active: 1,
    dn: '160',
    price: 10
});

describe('przejsciaCategories — nieświeża mapa nie daje 0/0', () => {
    test('podmiana katalogu z obejściem settera (let) — kategorie świeże', () => {
        const ctx = makeCtx();
        expect(ctx.getPrzejsciaCategories()).toEqual([]);
        // bypass window.studnieProducts settera: zapis do let wprost
        vm.runInContext(
            'studnieProducts = [{id:"P1",category:"PE",componentType:"przejscie",active:1,dn:"160",price:10},{id:"P2",category:"PVC SN8",componentType:"przejscie",active:1,dn:"160",price:10}];',
            ctx
        );
        expect(ctx.getPrzejsciaCategories()).toEqual(['PE', 'PVC SN8']);
        expect(ctx.getPrzejsciaForCategory('PE').map((p: any) => p.id)).toEqual(['P1']);
    });

    test('mutacja in-place + invalidate — kategorie świeże', () => {
        const ctx = makeCtx();
        ctx.window.studnieProducts = [PRZ('P1', 'PE')];
        expect(ctx.getPrzejsciaCategories()).toEqual(['PE']);
        // edycja cennika w miejscu (jak toggle active w UI) + bump wersji
        vm.runInContext(
            'studnieProducts.push({id:"P2",category:"PVC SN8",componentType:"przejscie",active:1,dn:"160",price:10}); invalidateStudnieProductsMap();',
            ctx
        );
        expect(ctx.getPrzejsciaCategories()).toEqual(['PE', 'PVC SN8']);
    });

    test('dezaktywacja wszystkich przejść — pusta lista (uczciwe 0/0)', () => {
        const ctx = makeCtx();
        ctx.window.studnieProducts = [PRZ('P1', 'PE')];
        expect(ctx.getPrzejsciaCategories()).toEqual(['PE']);
        ctx.window.studnieProducts = [{ ...PRZ('P1', 'PE'), active: 0 }];
        expect(ctx.getPrzejsciaCategories()).toEqual([]);
    });
});
