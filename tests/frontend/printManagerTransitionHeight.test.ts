import fs from 'fs';
import path from 'path';
import vm from 'vm';

const PRINT_MANAGER = path.join(process.cwd(), 'public/js/studnie/printManager.js');

describe('wydruk z edytora zlecenia — wysokość przejścia', () => {
    test('używa wysokości względem dołu przypisanego elementu', () => {
        const configMap = [{ index: 7, start: 1000, end: 2000 }];
        const context = {
            window: {},
            FLOW_TYPES: { WYLOT: 'wylot' },
            ensureDisplayIndices: () => {},
            buildConfigMap: () => configMap,
            findAssignedElement: (_heightMm: number) => ({
                assignedIndex: 7,
                entry: configMap[0]
            }),
            getStudnieProductById: () => ({ category: 'PVC SN8', dn: 300 }),
            studnieProducts: []
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(PRINT_MANAGER, 'utf8'), context);

        const rows = (context as any).buildPrzejsciaRows({
            well: {
                rzednaDna: 152,
                przejscia: [
                    { productId: 'p1', rzednaWlaczenia: 153.2, angle: 0, flowType: 'wylot' }
                ]
            },
            product: { componentType: 'dennica' },
            elementIndex: 7
        });

        expect(rows[0].uwagi).toBe('+ 200 mm');
    });
});
