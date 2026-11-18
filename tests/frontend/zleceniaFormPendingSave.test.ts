// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

/**
 * Regresja: „Zapisz i zamknij” ma utrwalić też edycje, których nikt nie
 * zapisał wcześniej „Zapisz” — kafelki i pola formularza modyfikują tylko
 * wpis PZ w RAM, więc muszą trafić do kolejki zapisu.
 */
function loadLayers(inputValues: Record<string, string>, order: Record<string, any>) {
    const requests: Array<{ url: string; options: RequestInit }> = [];
    const context: any = {
        console,
        structuredClone: (value: unknown) => JSON.parse(JSON.stringify(value)),
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        showToast: () => {},
        productionOrders: [order],
        zleceniaSelectedIdx: 0,
        zleceniaElementsList: [
            {
                well: { id: 'w1', dn: '1000', config: [] },
                product: { id: 'p1', name: 'Krąg', category: 'KRĄG' },
                elementIndex: 0,
                wellIndex: 0,
                configItem: { _elemId: 'elem-1' }
            }
        ],
        pzGuard: { findPzForElement: () => order },
        document: {
            getElementById: (id: string) =>
                Object.prototype.hasOwnProperty.call(inputValues, id)
                    ? { value: inputValues[id] }
                    : null,
            querySelectorAll: () => [],
            addEventListener: () => {}
        }
    };
    context.fetch = async (url: string, options: RequestInit) => {
        requests.push({ url, options });
        return { ok: true, json: async () => ({ saved: [{ id: order.id, version: 3 }] }) };
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    for (const file of ['orderZleceniaData.js', 'orderZleceniaForm.js']) {
        vm.runInContext(fs.readFileSync(path.join(JS_DIR, file), 'utf8'), context, {
            filename: file
        });
    }
    return { context, requests };
}

function savedOrders(request: { options: RequestInit }) {
    return JSON.parse(String(request.options.body)).data as Array<Record<string, unknown>>;
}

describe('Zapisz i zamknij — utrwalanie niezapisanych edycji PZ', () => {
    test('formularz (kąt, uwagi) trafia do PZ i do zapisu', async () => {
        const order = { id: 'pz-1', version: 2, katStopni: '45', uwagi: '' };
        const { context, requests } = loadLayers(
            { 'zl-kat-stopni': '90', 'zl-uwagi': 'nowe uwagi' },
            order
        );

        context.syncZleceniaFormToPz();
        await context.saveProductionOrdersData(context.productionOrders, { onlyPending: true });

        expect(order.katStopni).toBe('90');
        expect(order.uwagi).toBe('nowe uwagi');
        expect(requests).toHaveLength(1);
        expect(savedOrders(requests[0])).toEqual([
            expect.objectContaining({ id: 'pz-1', katStopni: '90', uwagi: 'nowe uwagi' })
        ]);
    });

    test('bez zmian nie ma zapisu przy zamknięciu', async () => {
        const order = { id: 'pz-1', version: 2, katStopni: '90' };
        const { context, requests } = loadLayers({ 'zl-kat-stopni': '90' }, order);

        context.syncZleceniaFormToPz();
        await context.saveProductionOrdersData(context.productionOrders, { onlyPending: true });

        expect(requests).toHaveLength(0);
    });

    test('zaakceptowany PZ nie jest modyfikowany ani zapisywany', async () => {
        const order = { id: 'pz-acc', version: 2, status: 'accepted', katStopni: '45' };
        const { context, requests } = loadLayers({ 'zl-kat-stopni': '90' }, order);

        context.syncZleceniaFormToPz();
        await context.saveProductionOrdersData(context.productionOrders, { onlyPending: true });

        expect(order.katStopni).toBe('45');
        expect(requests).toHaveLength(0);
    });
});
