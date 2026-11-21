// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/studnie/printManager.js';

function loadPrintManager() {
    const calls: string[] = [];
    const toasts: string[] = [];
    const printedData: any[] = [];
    const savedOrder = {
        id: 'saved-id',
        productionOrderNumber: 'N/1',
        productionOrderPrintNumber: 'LK/1',
        productName: 'Dennica DN1000 H=750/600',
        productId: 'DDD-10-075',
        componentType: 'dennica',
        dn: 1000,
        rzednaDna: 10,
        przejscia: [
            {
                productId: 'PVC-SN8-300',
                productCategory: 'PVC SN8',
                productDn: '300',
                heightFromElementMm: 1000,
                rzednaWlaczenia: 12,
                angle: 90
            }
        ],
        etykietaElementy: [{ ilosc: '1 szt.', indeks: 'DDD-10-075', nazwa: 'Dennica DN1000' }]
    };
    const context: Record<string, any> = {
        window: {},
        Map,
        FLOW_TYPES: { WYLOT: 'wylot' },
        studnieProducts: [{ id: 'PVC-SN8-300', category: 'PVC LITE', dn: '250' }],
        ensureDisplayIndices: (items: any[]) =>
            items.forEach((item, index) => (item.displayIndex = index)),
        authHeaders: () => ({}),
        fetch: async () => {
            calls.push('fetch');
            return { ok: true, json: async () => ({ data: savedOrder }) };
        },
        showToast: (message: string) => toasts.push(message),
        logger: { error() {}, warn() {}, info() {} }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), context);

    context.saveProductionOrder = async () => {
        calls.push('save');
        return 'saved-id';
    };
    context.getTemplate = async () => {
        calls.push('template');
        return '<html></html>';
    };
    context.buildZlecenieHtml = (_template: string, data: any) => {
        printedData.push(data);
        return '<html>zlecenie</html>';
    };
    context.buildEtykietaHtml = (_template: string, data: any) => {
        printedData.push(data);
        return '<html>etykieta</html>';
    };
    context.confirmEditorPrint = async () => true;
    context.silentPrint = () => calls.push('print');
    context.recordEditorPrint = async () => calls.push('count');

    return { context, calls, toasts, printedData, savedOrder };
}

describe('druk z edytora zapisuje zlecenie przed odczytem danych do wydruku', () => {
    test.each([
        ['zlecenia', 'printZlecenie'],
        ['etykiety', 'printEtykieta']
    ])(
        'druk %s pobiera dokładnie zapisany rekord przed budową dokumentu',
        async (_name, method) => {
            const { context, calls, printedData, savedOrder } = loadPrintManager();
            await context.window[method]();

            expect(calls).toEqual(['save', 'fetch', 'template', 'print', 'count']);
            expect(printedData[0]).toMatchObject({
                productionOrderNumber: savedOrder.productionOrderNumber,
                productName: savedOrder.productName,
                etykietaElementy: savedOrder.etykietaElementy,
                isSavedProductionOrder: true
            });
            expect(printedData[0]).not.toHaveProperty('productionOrderPrintNumber');
            const rows = context.buildPrzejsciaRows(printedData[0]);
            expect(rows[0]).toMatchObject({
                rodzaj: 'PVC SN8',
                srednica: '300',
                uwagi: '+ 1000 mm'
            });
            const svg = context.generateWellSvg(printedData[0]);
            expect(svg).toContain('(+1000mm)');
            expect(svg).not.toContain('(+2000mm)');
            expect(svg).toContain('SN8');
            expect(svg).toContain('DN300');
            expect(svg).not.toContain('PVC LITE');
            expect(svg).not.toContain('DN250');
        }
    );

    test.each([
        ['zlecenia', 'printZlecenie'],
        ['etykiety', 'printEtykieta']
    ])('druk %s zatrzymuje się, gdy zapis się nie powiedzie', async (_name, method) => {
        const { context, calls, toasts } = loadPrintManager();
        context.saveProductionOrder = async () => {
            calls.push('save');
            return null;
        };

        await context.window[method]();

        expect(calls).toEqual(['save']);
        expect(toasts.join(' ')).toContain('Wydruk wstrzymany');
    });

    test.each([
        ['zlecenia', 'printZlecenie'],
        ['etykiety', 'printEtykieta']
    ])('druk %s zatrzymuje się, gdy zapisany rekord nie jest dostępny', async (_name, method) => {
        const { context, calls, toasts } = loadPrintManager();
        context.fetch = async () => {
            calls.push('fetch');
            return { ok: false, status: 503 };
        };

        await context.window[method]();

        expect(calls).toEqual(['save', 'fetch']);
        expect(toasts.join(' ')).toContain('Nie udało się pobrać zapisanego zlecenia');
    });
});
