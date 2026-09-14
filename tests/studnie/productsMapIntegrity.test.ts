// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// P0.4 (korekta #3): test integralności cache, nie tylko ceny.
// mutacja -> invalidate/version -> rebuild -> każdy konsument widzi świeże dane.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadStudnieGlobals() {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/globals.js'),
        'utf8'
    );
    const context: any = { window: {}, console };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

function loadRuryHelpers(products: any[]) {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/rury/productHelpers.js'),
        'utf8'
    );
    const context: any = { window: {}, products, console };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

describe('P0.4 studnie Map: podmiana 1:1 bez zmiany długości', () => {
    it('lookup zwraca NOWĄ cenę po wymianie tablicy same-length', () => {
        const ctx = loadStudnieGlobals();
        ctx.window.studnieProducts = [{ id: 'A', price: 100, componentType: 'krag' }];
        expect(ctx.getStudnieProductById('A').price).toBe(100);
        // mutacja: nowa tablica, ta sama długość, nowa cena
        ctx.window.studnieProducts = [{ id: 'A', price: 250, componentType: 'krag' }];
        expect(ctx.getStudnieProductById('A').price).toBe(250);
        expect(ctx.__assertStudnieMapFresh()).toBe(true);
    });

    it('in-place push + invalidate jest widoczny w lookup', () => {
        const ctx = loadStudnieGlobals();
        ctx.window.studnieProducts = [{ id: 'A', price: 100, componentType: 'krag' }];
        expect(ctx.getStudnieProductById('A').price).toBe(100);
        // bypass settera: mutacja w miejscu (jak splice w pricelistProductCrud)
        const arr = ctx.window.studnieProducts;
        arr.push({ id: 'B', price: 50, componentType: 'krag' });
        ctx.invalidateStudnieProductsMap();
        expect(ctx.getStudnieProductById('B').price).toBe(50);
        expect(ctx.__assertStudnieMapFresh()).toBe(true);
    });
});

describe('P0.4 rury Map: podmiana 1:1 bez zmiany długości', () => {
    it('lookup zwraca NOWĄ cenę po reassignment same-length', () => {
        const ctx = loadRuryHelpers([{ id: 'R1', price: 10 }]);
        expect(ctx.getRuryProductById('R1').price).toBe(10);
        ctx.products = [{ id: 'R1', price: 99 }];
        expect(ctx.getRuryProductById('R1').price).toBe(99);
    });

    it('in-place push + invalidate jest widoczny w lookup', () => {
        const ctx = loadRuryHelpers([{ id: 'R1', price: 10 }]);
        expect(ctx.getRuryProductById('R1').price).toBe(10);
        ctx.products.push({ id: 'R2', price: 20 });
        ctx.invalidateRuryProductsMap();
        expect(ctx.getRuryProductById('R2').price).toBe(20);
        // stara pozycja nadal świeża
        expect(ctx.getRuryProductById('R1').price).toBe(10);
    });
});
