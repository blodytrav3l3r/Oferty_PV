// @ts-nocheck -- vm sandbox for vanilla frontend scripts
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const PRINT_MANAGER = path.join(process.cwd(), 'public/js/studnie/printManager.js');
const ORDER_ZLECENIA_HELPERS = path.join(
    process.cwd(),
    'public/js/studnie/orderZleceniaHelpers.js'
);
const ORDER_PRINT_HELPERS = path.join(process.cwd(), 'public/js/spa/zleceniaHelpers.js');

const configMap = [
    { index: 4, start: 0, end: 750, componentType: 'dennica' },
    { index: 5, start: 750, end: 1250, componentType: 'dennica' },
    { index: 6, start: 1250, end: 2250, componentType: 'krag_ot' },
    { index: 7, start: 2250, end: 2500, componentType: 'właz' },
    { index: 8, start: 0, end: 0, componentType: 'kineta' }
];

function findAssignedElement(mmFromBottom: number, entries: any[]) {
    const entry = entries.find((item) => mmFromBottom >= item.start && mmFromBottom < item.end);
    return entry ? { assignedIndex: entry.index, entry } : { assignedIndex: -1, entry: null };
}

function loadPrintManager() {
    const context: any = {
        window: {},
        FLOW_TYPES: { WYLOT: 'wylot', WLOT: 'wlot' },
        ensureDisplayIndices: (items: any[]) =>
            items.forEach((item, index) => {
                item.displayIndex = index;
            }),
        buildConfigMap: () => configMap,
        findAssignedElement,
        hasKinetaItem: (well: any) => (well.config || []).some((item) => item.productId === 'k'),
        getStudnieProductById: (id: string) =>
            id === 'k' ? { componentType: 'kineta', dn: 1000 } : { category: 'PVC SN8', dn: 300 },
        studnieProducts: []
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(ORDER_ZLECENIA_HELPERS, 'utf8'), context);
    vm.runInContext(fs.readFileSync(PRINT_MANAGER, 'utf8'), context);
    return context;
}

function createWell(overrides: Record<string, any> = {}) {
    return {
        rzednaDna: 0,
        dn: 1000,
        kineta: 'beton',
        config: [{ productId: 'k' }],
        przejscia: [{ productId: 'pipe', rzednaWlaczenia: 1.8, angle: 90, flowType: 'wlot' }],
        ...overrides
    };
}

describe('ślepe kinety w PZ', () => {
    test('wydruk PZ opisuje zakres powłoki tylko na ścianach dennicy', () => {
        const context = loadPrintManager();

        expect(context.getPowlokaString({ malowanieW: 'dennica', powlokaNameW: 'Bergolin' })).toBe(
            'Wew: Dennica (Bergolin)'
        );
    });

    test('grafika zapisanego PZ nie buduje mapy z nieobecnej konfiguracji całej studni', () => {
        const context = loadPrintManager();
        context.buildConfigMap = () => {
            throw new Error('buildConfigMap nie powinien działać dla zapisanego PZ');
        };

        const svg = context.generateWellSvg({
            well: { przejscia: [] },
            product: { componentType: 'krag_ot' },
            elementIndex: 6,
            isSavedProductionOrder: true
        });

        expect(svg).toBe('');
    });

    test('dodaje ślepą kinetę z przejścia kręgu na najniższej dennicy z kinetą', () => {
        const context = loadPrintManager();
        const rows = context.buildPrzejsciaRows({
            well: createWell(),
            product: { componentType: 'dennica' },
            elementIndex: 4
        });

        expect(rows).toContainEqual(
            expect.objectContaining({
                rodzaj: 'Ślepa kineta',
                katStopien: '90°',
                srednica: '300'
            })
        );
    });

    test('zachowuje DN przejścia własnego dla ślepej kinety', () => {
        const context = loadPrintManager();
        const rows = context.buildPrzejsciaRows({
            well: createWell({
                przejscia: [
                    {
                        isCustom: true,
                        dn: 250,
                        rzednaWlaczenia: 1.8,
                        angle: 90,
                        flowType: 'wlot'
                    }
                ]
            }),
            product: { componentType: 'dennica' },
            elementIndex: 4
        });

        expect(rows).toContainEqual(
            expect.objectContaining({ rodzaj: 'Ślepa kineta', katStopien: '90°', srednica: '250' })
        );
    });

    test('nie dodaje ślepej kinety do górnej dennicy ani gdy dolna nie ma kinety', () => {
        const context = loadPrintManager();
        const upperRows = context.buildPrzejsciaRows({
            well: createWell(),
            product: { componentType: 'dennica' },
            elementIndex: 5
        });
        const noKinetaRows = context.buildPrzejsciaRows({
            well: createWell({ kineta: 'brak', config: [] }),
            product: { componentType: 'dennica' },
            elementIndex: 4
        });

        expect(upperRows.some((row: any) => row.rodzaj === 'Ślepa kineta')).toBe(false);
        expect(noKinetaRows.some((row: any) => row.rodzaj === 'Ślepa kineta')).toBe(false);
    });

    test('nie dodaje ślepej kinety, gdy dennica ma już przejście pod tym kątem', () => {
        const context = loadPrintManager();
        const rows = context.buildPrzejsciaRows({
            well: createWell({
                przejscia: [
                    { productId: 'pipe', rzednaWlaczenia: 0.5, angle: 450, flowType: 'wlot' },
                    { productId: 'pipe', rzednaWlaczenia: 1.8, angle: 90, flowType: 'wlot' }
                ]
            }),
            product: { componentType: 'dennica' },
            elementIndex: 4
        });

        expect(rows.filter((row: any) => row.rodzaj === 'Ślepa kineta')).toHaveLength(0);
    });

    test('wydruk zapisany z jednego buildera pokazuje zapisaną ślepą kinetę w tabeli i diagramie', () => {
        const printContext = loadPrintManager();
        const blindSnapshot = [
            {
                isBlindKineta: true,
                angle: 90,
                displayIndex: 1,
                productCategory: 'Ślepa kineta',
                productDn: '1000'
            }
        ];
        const printRows = printContext.buildPrzejsciaRows({
            well: { przejscia: [] },
            product: { componentType: 'dennica' },
            isSavedProductionOrder: true,
            blindKinetaPrzejscia: blindSnapshot
        });
        const window: any = {};
        const context: any = {
            window,
            ensureDisplayIndices: () => {},
            escapeHtml: (value: any) => value
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(ORDER_PRINT_HELPERS, 'utf8'), context);
        const po = {
            componentType: 'dennica',
            kineta: 'beton',
            przejscia: [],
            blindKinetaPrzejscia: [
                {
                    isBlindKineta: true,
                    angle: 90,
                    displayIndex: 1,
                    productCategory: 'Ślepa kineta',
                    productDn: '1000'
                }
            ]
        };

        const rows = window.buildPrzejsciaRowsFromPO(po);
        const svg = window.generateSvgFromPO(po);

        expect(rows[0]).toMatchObject({
            rodzaj: 'Ślepa kineta',
            srednica: '1000',
            katStopien: '90°'
        });
        expect(printRows[0]).toMatchObject({
            rodzaj: 'Ślepa kineta',
            srednica: '1000',
            katStopien: '90°'
        });
        expect(svg).toContain('ŚLEPA');
        expect(svg).toContain('90°');
        expect(svg).toContain('stroke-dasharray="4,3"');
    });
});
