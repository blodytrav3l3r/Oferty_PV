import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadContext() {
    const calls: string[] = [];
    const cancelHandlers: Array<() => Promise<void>> = [];
    let confirmResult = true;
    const items = [{ discount: 0, unitPrice: 100, quantity: 1 }];
    const cancelButton = {
        addEventListener: (_event: string, handler: () => Promise<void>) => {
            cancelHandlers.push(handler);
        }
    };
    const modal = { querySelectorAll: () => [cancelButton, cancelButton] };
    const context: any = {
        currentOfferItems: items,
        orderEditMode: false,
        document: {
            getElementById: (id: string) => (id === 'item-discount-modal' ? modal : null)
        },
        getActiveItemsArray: () => items,
        showModal: () => {},
        closeModal: () => calls.push('close'),
        appConfirm: async (...args: any[]) => {
            calls.push(`confirm:${String(args[1]?.title || '')}`);
            return confirmResult;
        },
        syncGaskets: () => {},
        syncTransportSecurity: () => {},
        renderOfferItems: () => {},
        updateOfferSummary: () => {},
        showToast: () => {},
        saveOfferOrOrder: async () => calls.push('save')
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(path.join(__dirname, '../../public/js/rury/offerExports.js'), 'utf8'),
        context
    );
    return {
        context,
        calls,
        items,
        cancelHandlers,
        setConfirmResult: (value: boolean) => {
            confirmResult = value;
        }
    };
}

describe('rury item discounts persistence', () => {
    test('confirmed apply updates discounts and saves the offer', async () => {
        const { context, calls, items } = loadContext();
        vm.runInContext('showItemDiscountModal(); tempDiscounts[0] = 25;', context);

        await vm.runInContext('applyItemDiscounts()', context);

        expect(items[0].discount).toBe(25);
        expect(calls).toContain('save');
    });

    test('declining apply confirmation leaves the modal open and does not save', async () => {
        const { context, calls, items, setConfirmResult } = loadContext();
        setConfirmResult(false);
        vm.runInContext('showItemDiscountModal(); tempDiscounts[0] = 25;', context);

        await vm.runInContext('applyItemDiscounts()', context);

        expect(items[0].discount).toBe(0);
        expect(calls).not.toContain('close');
        expect(calls).not.toContain('save');
    });

    test('cancel asks before discarding changed discounts and saves nothing', async () => {
        const { context, calls, cancelHandlers } = loadContext();
        vm.runInContext('showItemDiscountModal(); tempDiscounts[0] = 25;', context);

        await cancelHandlers[0]();

        expect(calls.some((call) => call.startsWith('confirm:'))).toBe(true);
        expect(calls).toContain('close');
        expect(calls).not.toContain('save');
    });

    test('declining cancel confirmation keeps the discount modal open', async () => {
        const { context, calls, cancelHandlers, setConfirmResult } = loadContext();
        setConfirmResult(false);
        vm.runInContext('showItemDiscountModal(); tempDiscounts[0] = 25;', context);

        await cancelHandlers[0]();

        expect(calls.some((call) => call.startsWith('confirm:'))).toBe(true);
        expect(calls).not.toContain('close');
        expect(calls).not.toContain('save');
    });
});
