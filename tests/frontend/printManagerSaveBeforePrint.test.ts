// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import vm from 'vm';

const SCRIPT = 'public/js/studnie/printManager.js';

function loadPrintManager() {
    const calls: string[] = [];
    const toasts: string[] = [];
    const context: Record<string, any> = {
        window: {},
        Map,
        showToast: (message: string) => toasts.push(message),
        logger: { error() {}, warn() {}, info() {} }
    };

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), context);

    context.saveProductionOrder = async () => {
        calls.push('save');
        return 'saved-id';
    };
    context.collectPrintData = () => {
        calls.push('collect');
        return { productionOrderNumber: 'N/1' };
    };
    context.getTemplate = async () => {
        calls.push('template');
        return '<html></html>';
    };
    context.buildZlecenieHtml = () => '<html>zlecenie</html>';
    context.buildEtykietaHtml = () => '<html>etykieta</html>';
    context.confirmEditorPrint = async () => true;
    context.silentPrint = () => calls.push('print');
    context.recordEditorPrint = async () => calls.push('count');

    return { context, calls, toasts };
}

describe('druk z edytora zapisuje zlecenie przed odczytem danych do wydruku', () => {
    test.each([
        ['zlecenia', 'printZlecenie'],
        ['etykiety', 'printEtykieta']
    ])('druk %s czeka na zapis przed zebraniem danych', async (_name, method) => {
        const { context, calls } = loadPrintManager();
        await context.window[method]();

        expect(calls).toEqual(['save', 'collect', 'template', 'print', 'count']);
    });

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
});
