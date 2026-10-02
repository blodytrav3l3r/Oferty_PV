import fs from 'fs';
import path from 'path';
import vm from 'vm';

// UX-safety: confirm przed destrukcją, guard double-submit, popup przez kontrakt E2.
const BASE = path.join(__dirname, '../../public/js/studnie');
function loadFiles(ctx: any, files: string[]) {
    for (const f of files) {
        vm.runInContext(fs.readFileSync(path.join(BASE, f), 'utf8'), ctx, { filename: f });
    }
}

describe('uxSafety: confirm przed destrukcją (actionsCrud)', () => {
    let ctx: any;
    let order: string[];
    let confirmQueue: boolean[];
    let well: any;

    function makeCtx() {
        order = [];
        confirmQueue = [];
        well = {
            id: 'w1',
            name: 'S1',
            config: [{ productId: 'p1', quantity: 1 }],
            configSource: 'AUTO',
            autoLocked: false,
            autoSelect: false
        };
        const origSplice = well.config.splice.bind(well.config);
        well.config.splice = (...args: any[]) => {
            order.push('splice');
            return (origSplice as any)(...args);
        };
        const context: any = {
            OFFER_LOCKED_MSG: 'offer locked',
            WELL_LOCKED_MSG: 'well locked',
            studnieProducts: [],
            isOfferLocked: () => false,
            isWellLocked: () => false,
            getCurrentWell: () => well,
            appConfirm: async () => {
                order.push('confirm');
                return confirmQueue.shift() ?? true;
            },
            showToast: () => {},
            recalcGaskets: () => {},
            renderWellConfig: () => {},
            renderWellDiagram: () => {},
            updateSummary: () => {},
            renderWellsList: () => {},
            renderTiles: () => {},
            updateHeightIndicator: () => {},
            refreshAll: () => {},
            document: { getElementById: () => null },
            RangeError
        };
        context.window = context;
        vm.createContext(context);
        loadFiles(context, ['actionsCrud.js']);
        return context;
    }

    beforeEach(() => {
        ctx = makeCtx();
    });

    test('removeWellComponent: bez confirm — od razu splice (szybka praca z podglądu)', async () => {
        await vm.runInContext('removeWellComponent(0)', ctx);
        expect(order).toEqual(['splice']);
        expect(well.config.length).toBe(0);
    });

    test('clearWellConfig: cancel → config kept; OK → pusta', async () => {
        confirmQueue.push(false);
        await vm.runInContext('clearWellConfig()', ctx);
        expect(order).toEqual(['confirm']);
        expect(well.config.length).toBe(1);

        order.length = 0;
        confirmQueue.push(true);
        await vm.runInContext('clearWellConfig()', ctx);
        expect(order).toEqual(['confirm']);
        expect(well.config.length).toBe(0);
    });

    test('updateWellQuantity qty<=0 deleguje do remove (bez confirma)', async () => {
        await vm.runInContext('updateWellQuantity(0, 0)', ctx);
        expect(order).toEqual(['splice']);
        expect(well.config.length).toBe(0);
    });
});

describe('uxSafety: wellNotesModal double-submit guard', () => {
    test('double-click = 1 zapis', async () => {
        let saves = 0;
        const listeners: Record<string, ((...a: any[]) => any)[]> = {};
        const saveBtn: any = {
            disabled: false,
            addEventListener: (t: string, fn: (...a: any[]) => any) => {
                (listeners[t] = listeners[t] || []).push(fn);
            }
        };
        const ta: any = {
            value: '  hello  ',
            focus: () => {},
            setSelectionRange: () => {},
            addEventListener: () => {}
        };
        const overlay: any = { style: {}, addEventListener: () => {} };
        const context: any = {
            wells: [{ name: 'S1', dn: '1000', uwagi: '' }],
            document: {
                getElementById: (id: string) => {
                    if (id === 'well-uwagi-save') return saveBtn;
                    if (id === 'well-uwagi-input') return ta;
                    return null;
                },
                createElement: () => ({ textContent: '', innerHTML: '' }),
                querySelector: () => null,
                querySelectorAll: () => [],
                body: { style: {}, appendChild: () => {} }
            },
            showModal: () => overlay,
            closeModal: () => {},
            renderWellsList: () => {
                saves++;
            },
            showToast: () => {},
            console
        };
        context.window = context;
        vm.createContext(context);
        loadFiles(context, ['wellNotesModal.js']);
        vm.runInContext('openWellNotesModal(0)', context);
        expect((listeners['click'] || []).length).toBe(1);
        const handler = listeners['click'][0];
        const p1 = handler();
        const p2 = handler();
        await Promise.all([p1, p2]);
        expect(saves).toBe(1);
        expect(context.wells[0].uwagi).toBe('hello');
        expect(saveBtn.disabled).toBe(false);
    });
});

describe('uxSafety: offerDiscountsPopup przez kontrakt E2', () => {
    let ctx: any;
    let toasts: { msg: string; type: string }[];

    function makeCtx() {
        toasts = [];
        const context: any = {
            wells: [],
            wellDiscounts: {},
            showToast: (msg: string, type: string) => {
                toasts.push({ msg, type });
            },
            renderDiscountPanel: () => {},
            updateSummary: () => {},
            renderOfferSummary: () => {},
            renderWellConfig: () => {},
            calcWellStats: () => ({ price: 0, weight: 0 }),
            document: { getElementById: () => null, addEventListener: () => {} },
            RangeError
        };
        context.window = context;
        vm.createContext(context);
        loadFiles(context, [
            'actionsWellPainting.js',
            'transitionRenderer.js',
            'actionsWellPricing.js',
            'actionsWellDiscounts.js',
            'globals.js',
            'offerDiscountsPopup.js'
        ]);
        return context;
    }

    beforeEach(() => {
        ctx = makeCtx();
    });

    test.each([['150'], ['-5'], ['NaN'], ['abc']])(
        'popup invalid %s → brak zapisu + komunikat, bez throw',
        (v) => {
            const before = vm.runInContext('JSON.stringify(wellDiscounts)', ctx);
            expect(() =>
                vm.runInContext(`handleOfferDiscountChange('1000', 'dennica', '${v}')`, ctx)
            ).not.toThrow();
            expect(vm.runInContext('JSON.stringify(wellDiscounts)', ctx)).toBe(before);
            expect(toasts.some((t) => t.type === 'error')).toBe(true);
        }
    );

    test('popup valid "50" → zapis 50', () => {
        vm.runInContext(`handleOfferDiscountChange('1000', 'dennica', '50')`, ctx);
        expect(vm.runInContext('wellDiscounts["1000"].dennica', ctx)).toBe(50);
    });
});
