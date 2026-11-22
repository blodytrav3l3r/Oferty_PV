import fs from 'fs';
import path from 'path';
import vm from 'vm';

const BASE = path.join(__dirname, '../../public/js/studnie');

function loadContext() {
    const context: any = {
        wells: [
            { id: 'draft', config: [] },
            { id: 'valid', config: [{ productId: 'ring', quantity: 1 }] },
            { id: 'passage-only', config: [], przejscia: [{ productId: 'pipe' }] }
        ],
        document: {
            querySelectorAll: () => [
                { dataset: { wellIndex: '0' } },
                { dataset: { wellIndex: '1' } },
                { dataset: { wellIndex: '2' } }
            ]
        },
        getStudnieProductById: (id: string) => (id === 'ring' ? { componentType: 'krag' } : null)
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ['wellUIHelpers.js', 'orderCrud.js']) {
        vm.runInContext(fs.readFileSync(path.join(BASE, file), 'utf8'), context, {
            filename: file
        });
    }
    return context;
}

describe('collectSelectedWellsForOrder', () => {
    test('returns only selected product-bearing wells', () => {
        const context = loadContext();

        const selected = vm.runInContext('collectSelectedWellsForOrder()', context);

        expect(selected.map((well: any) => well.id)).toEqual(['valid']);
    });
});
