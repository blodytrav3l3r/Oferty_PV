import fs from 'fs';
import path from 'path';
import vm from 'vm';

// E8-MINIMAL: guard showToast na sciezkach bledu — brak showToast ma dawac
// cisze, nie ReferenceError. Wzorzec: typeof window.showToast === 'function'.
const BASE = path.join(__dirname, '../../public/js/studnie');
function load(ctx: any, files: string[]) {
    for (const f of files) {
        vm.runInContext(fs.readFileSync(path.join(BASE, f), 'utf8'), ctx, { filename: f });
    }
}

describe('toastGuards E8: brak showToast = cisza, nie ReferenceError', () => {
    test('offerDiscountsPopup save-fallback bez showToast nie rzuca', async () => {
        const context: any = {
            wells: [],
            wellDiscounts: {},
            document: { getElementById: () => null, addEventListener: () => {} },
            appConfirm: async () => true
        };
        context.window = context;
        vm.createContext(context);
        load(context, ['offerDiscountsPopup.js']);
        // Celowo brak showToast (globalnie i na window) + brak saveOfferStudnie
        // → else z toastem bledu. Bez guarda: ReferenceError, z guardem: cisza.
        await expect(
            vm.runInContext('handleOfferDiscountsSave()', context)
        ).resolves.toBeUndefined();
    });

    test('actionsWellDiscounts globalne rabaty bez showToast nie rzucaja, stan zapisany', () => {
        const context: any = {
            wells: [{ pehdDiscount: 0, malowanieWewCena: 0, malowanieZewCena: 0 }],
            document: { getElementById: () => null },
            renderDiscountPanel: () => {},
            updateSummary: () => {},
            renderOfferSummary: () => {},
            renderWellConfig: () => {},
            renderWellParams: () => {}
        };
        context.window = context;
        vm.createContext(context);
        load(context, ['actionsWellDiscounts.js']);
        expect(() => vm.runInContext(`updateGlobalPehdDiscount('10')`, context)).not.toThrow();
        expect(context.wells[0].pehdDiscount).toBe(10);
        expect(() =>
            vm.runInContext(`updateGlobalPaintingCost('malowanieWewCena', '5')`, context)
        ).not.toThrow();
        expect(context.wells[0].malowanieWewCena).toBe(5);
    });
});
