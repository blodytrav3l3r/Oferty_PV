import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = path.join(__dirname, '../../public/js/studnie/offerSave.js');
const HELPERS_SRC = path.join(__dirname, '../../public/js/studnie/wellUIHelpers.js');

function loadEmptyOfferCtx() {
    const calls: string[] = [];
    const ctx: any = {
        isSavingOffer: false,
        wells: [],
        currentUser: { id: 'u1', role: 'admin' },
        getOfferFormFields: () => ({ number: 'OS/1/2026', validity: '7 dni' }),
        normalizeValidityValue: (v: string) => v,
        showToast: (msg: string, type: string) => calls.push(type + ':' + msg),
        getStudnieProductById: (id: string) => (id === 'ring' ? { componentType: 'krag' } : null),
        assignOfferSupervisor: async () => {
            calls.push('supervisor');
            return null;
        },
        document: { getElementById: () => null }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(HELPERS_SRC, 'utf8'), ctx, { filename: 'wellUIHelpers.js' });
    vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'offerSave.js' });
    return { ctx, calls };
}

describe('saveOfferStudnie — bramy zapisu przed pytaniem o opiekuna', () => {
    test('pusta oferta: toast, brak wyboru opiekuna', async () => {
        const { ctx, calls } = loadEmptyOfferCtx();
        const ok = await vm.runInContext('saveOfferStudnie()', ctx);
        expect(ok).toBe(false);
        expect(calls).toEqual(['error:Błąd: Nie można zapisać pustej oferty.']);
    });

    test('oferta z samym pustym szkicem nie zapisuje pustej pozycji', async () => {
        const { ctx, calls } = loadEmptyOfferCtx();
        ctx.wells = [{ id: 'empty', config: [], przejscia: [{ productId: 'pipe' }] }];
        ctx.getStudnieProductById = () => null;
        const ok = await vm.runInContext('saveOfferStudnie()', ctx);

        expect(ok).toBe(false);
        expect(calls).toEqual(['error:Błąd: Nie można zapisać pustej oferty.']);
    });

    test('projekcja zapisu pomija szkice i zachowuje indeksy źródłowe produktów', () => {
        const { ctx } = loadEmptyOfferCtx();
        ctx.getStudnieProductById = (id: string) =>
            id === 'ring' ? { componentType: 'krag' } : { componentType: 'uszczelka' };
        const wells = [
            { id: 'draft', config: [] },
            { id: 'accessory-only', config: [{ productId: 'seal' }] },
            { id: 'valid', config: [{ productId: 'ring', quantity: 1 }] }
        ];
        ctx.wells = wells;
        const result = vm.runInContext('_wellsForOfferSave(wells)', ctx);

        expect(result).toEqual([wells[1], wells[2]]);
    });

    test('błędne przejścia: walidacja przed wyborem opiekuna', async () => {
        const { ctx, calls } = loadEmptyOfferCtx();
        ctx.wells = [{ name: 'S1', config: [{ productId: 'ring', quantity: 1 }] }];
        ctx.validatePrzejsciaForSave = () => ({ valid: false, errors: ['błąd przejścia'] });
        ctx.showPrzejsciaValidationPopup = (errors: string[]) => calls.push('popup:' + errors[0]);
        const ok = await vm.runInContext('saveOfferStudnie()', ctx);
        expect(ok).toBe(false);
        expect(calls).toEqual(['popup:błąd przejścia']);
    });
});
