import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = path.join(__dirname, '../../public/js/studnie/offerSave.js');

function loadEmptyOfferCtx() {
    const calls: string[] = [];
    const ctx: any = {
        isSavingOffer: false,
        wells: [],
        currentUser: { id: 'u1', role: 'admin' },
        getOfferFormFields: () => ({ number: 'OS/1/2026', validity: '7 dni' }),
        normalizeValidityValue: (v: string) => v,
        showToast: (msg: string, type: string) => calls.push(type + ':' + msg),
        assignOfferSupervisor: async () => {
            calls.push('supervisor');
            return null;
        },
        document: { getElementById: () => null }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
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

    test('błędne przejścia: walidacja przed wyborem opiekuna', async () => {
        const { ctx, calls } = loadEmptyOfferCtx();
        ctx.wells = [{ name: 'S1' }];
        ctx.validatePrzejsciaForSave = () => ({ valid: false, errors: ['błąd przejścia'] });
        ctx.showPrzejsciaValidationPopup = (errors: string[]) => calls.push('popup:' + errors[0]);
        const ok = await vm.runInContext('saveOfferStudnie()', ctx);
        expect(ok).toBe(false);
        expect(calls).toEqual(['popup:błąd przejścia']);
    });
});
