/**
 * Test vm: printManager.recordEditorPrint scala świeżą wersję dokumentu.
 * Regresja: wydruk podbija version w DB, a edytor trzymał starą → następny
 * zapis dostawał fałszywy 409 VERSION_CONFLICT.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

interface PrintManagerCtx {
    window: { productionOrders: Array<{ id: string; version?: number }> };
    recordEditorPrint: (orderId: string, kind: 'zlecenie' | 'etykieta') => Promise<void>;
}

function loadPrintManager(fetchImpl: unknown): PrintManagerCtx {
    const sandbox: Record<string, unknown> = {
        window: { productionOrders: [{ id: 'p1', version: 5 }] },
        fetch: fetchImpl,
        logger: { error: jest.fn() },
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(process.cwd(), 'public/js/studnie/printManager.js'), 'utf-8'),
        sandbox,
        { filename: 'printManager.js' }
    );
    return sandbox as unknown as PrintManagerCtx;
}

describe('frontend vm: printManager.recordEditorPrint', () => {
    it('scala version z odpowiedzi serwera do wpisu PZ', async () => {
        const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ version: 6 }) }));
        const ctx = loadPrintManager(fetchImpl);

        await ctx.recordEditorPrint('p1', 'zlecenie');

        expect(ctx.window.productionOrders[0].version).toBe(6);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('brak version w odpowiedzi nie zmienia wpisu', async () => {
        const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
        const ctx = loadPrintManager(fetchImpl);

        await ctx.recordEditorPrint('p1', 'etykieta');

        expect(ctx.window.productionOrders[0].version).toBe(5);
    });

    it('HTTP 409 nie rusza wersji (konflikt licznika)', async () => {
        const fetchImpl = jest.fn(async () => ({ ok: false, status: 409 }));
        const ctx = loadPrintManager(fetchImpl);

        await ctx.recordEditorPrint('p1', 'zlecenie');

        expect(ctx.window.productionOrders[0].version).toBe(5);
    });

    it('nieznany orderId nie tworzy wpisu', async () => {
        const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ version: 9 }) }));
        const ctx = loadPrintManager(fetchImpl);

        await ctx.recordEditorPrint('other', 'zlecenie');

        expect(ctx.window.productionOrders).toHaveLength(1);
    });
});
