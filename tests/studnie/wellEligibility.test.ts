import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = path.join(__dirname, '../../public/js/studnie/wellUIHelpers.js');

function loadEligibilityContext() {
    const context: any = {};
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SRC, 'utf8'), context, { filename: 'wellUIHelpers.js' });
    return context;
}

describe('isWellProductBearing', () => {
    test('requires a configured catalog product with positive quantity', () => {
        const context = loadEligibilityContext();
        const products = [
            { id: 'ring', componentType: 'krag' },
            { id: 'seal', componentType: 'uszczelka' },
            { id: 'outlet', componentType: 'przejscie' },
            { id: 'lid', componentType: 'wlaz' }
        ];
        const byId = (id: string) => products.find((product) => product.id === id);

        expect(
            context.isWellProductBearing({ config: [], przejscia: [{ id: 'outlet' }] }, byId)
        ).toBe(false);
        expect(context.isWellProductBearing({ config: [{ productId: 'seal' }] }, byId)).toBe(true);
        expect(context.isWellProductBearing({ config: [{ productId: 'lid' }] }, byId)).toBe(true);
        expect(context.isWellProductBearing({ config: [{ productId: 'ring' }] }, byId)).toBe(true);
        expect(
            context.isWellProductBearing(
                { config: [{ productId: 'ring', quantity: 0 }], przejscia: [] },
                byId
            )
        ).toBe(false);
    });

    test('does not qualify unknown product ids or malformed configuration', () => {
        const context = loadEligibilityContext();
        const byId = () => null;

        expect(context.isWellProductBearing({ config: [{ productId: 'missing' }] }, byId)).toBe(
            false
        );
        expect(context.isWellProductBearing({ config: null }, byId)).toBe(false);
        expect(context.isWellProductBearing(null, byId)).toBe(false);
    });

    test('keeps an empty legacy position linked to the active order visible', () => {
        const context = loadEligibilityContext();
        const well = { id: 'legacy-empty', config: [] };
        context.orderEditMode = { order: { wells: [{ id: 'legacy-empty' }] } };

        expect(context.isWellLinkedToActiveOrder(well)).toBe(true);
        expect(context.isWellLinkedToActiveOrder({ id: 'unlinked', config: [] })).toBe(false);
    });
});
