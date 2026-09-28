// @ts-nocheck
/* =============================================================
   P1: ekrany OFERT liczą z wersji ACTIVE (?source=active),
   ekrany CENNIKA zostają na LIVE (plain GET bez source).
   Fallback BE (brak ACTIVE → LIVE + X-Pricelist-Fallback: live)
   → jeden toast warning na załadowanie; bez nagłówka → cisza.
   Wzorzec: vm sandbox jak w loadStudnieProductsAuth.test.ts.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', 'js', rel), 'utf8');

const RURY_CODE = readPub('rury/dataService.js');
const STUDNIE_CODE = readPub('studnie/uiHelpers.js');

function okRes(data, fallback) {
    return {
        ok: true,
        headers: { get: (name) => (name === 'X-Pricelist-Fallback' ? fallback || null : null) },
        json: () => Promise.resolve({ data })
    };
}

function makeSandbox(fetchImpl) {
    const sandbox = {
        window: {},
        console: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
        logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
        setTimeout,
        clearTimeout,
        fetchWithTimeout: fetchImpl,
        authHeaders: () => ({ 'X-Auth-Token': 'test-token' }),
        showToast: jest.fn(),
        Array,
        JSON,
        Math,
        Promise
    };
    vm.createContext(sandbox);
    return sandbox;
}

function run(code, sandbox, expr) {
    vm.runInContext(code, sandbox, { filename: 'loader.js' });
    return vm.runInContext(expr, sandbox, { timeout: 5000 });
}

describe('P1 rury: loadProducts (dataService.js)', () => {
    it("oferta: loadProducts({source:'active'}) woła /api/products?source=active", async () => {
        const urls = [];
        const sandbox = makeSandbox((url) => {
            urls.push(url);
            return Promise.resolve(okRes([{ id: 'R-1', price: 10 }], null));
        });
        const products = await run(RURY_CODE, sandbox, "loadProducts({source:'active'})");
        expect(urls).toEqual(['/api/products?source=active']);
        expect(products).toEqual([{ id: 'R-1', price: 10 }]);
        expect(sandbox.window.__ruryPricingSource).toBe('active');
    });

    it('cennik: loadProducts() woła plain GET bez source', async () => {
        const urls = [];
        const sandbox = makeSandbox((url) => {
            urls.push(url);
            return Promise.resolve(okRes([{ id: 'R-1', price: 10 }], null));
        });
        await run(RURY_CODE, sandbox, 'loadProducts()');
        expect(urls).toEqual(['/api/products']);
        expect(sandbox.window.__ruryPricingSource).toBe('live');
    });

    it('fallback header → toast warning RAZ (polski komunikat), bez nagłówka → cisza', async () => {
        const sandbox = makeSandbox(() =>
            Promise.resolve(okRes([{ id: 'R-1', price: 10 }], 'live'))
        );
        vm.runInContext(RURY_CODE, sandbox, { filename: 'loader.js' });
        await vm.runInContext("loadProducts({source:'active'})", sandbox, { timeout: 5000 });
        await vm.runInContext("loadProducts({source:'active'})", sandbox, { timeout: 5000 });
        expect(sandbox.showToast).toHaveBeenCalledTimes(1);
        expect(sandbox.showToast).toHaveBeenCalledWith(
            'Brak aktywnej wersji — oferta liczy z cennika roboczego (LIVE)',
            'warning'
        );
        expect(sandbox.window.__ruryPricingSource).toBe('live-fallback');

        const quiet = makeSandbox(() => Promise.resolve(okRes([{ id: 'R-1', price: 10 }], null)));
        await run(RURY_CODE, quiet, "loadProducts({source:'active'})");
        expect(quiet.showToast).not.toHaveBeenCalled();
    });

    it('cennik plain ignoruje nagłówek fallback (cisza)', async () => {
        const sandbox = makeSandbox(() =>
            Promise.resolve(okRes([{ id: 'R-1', price: 10 }], 'live'))
        );
        await run(RURY_CODE, sandbox, 'loadProducts()');
        expect(sandbox.showToast).not.toHaveBeenCalled();
    });
});

describe('P1 studnie: loadStudnieProducts / loadPrecoPricing (uiHelpers.js)', () => {
    it('oferta: loader studni woła URL z ?source=active (z authHeaders)', async () => {
        let capturedUrl = null;
        let capturedHeaders = null;
        const sandbox = makeSandbox((url, opts) => {
            capturedUrl = url;
            capturedHeaders = opts && opts.headers;
            return Promise.resolve(okRes([{ id: 'KDB-1', price: 100 }], null));
        });
        const products = await run(STUDNIE_CODE, sandbox, "loadStudnieProducts({source:'active'})");
        expect(capturedUrl).toBe('/api/products-studnie?source=active');
        expect(capturedHeaders).toEqual({ 'X-Auth-Token': 'test-token' });
        expect(products).toEqual([{ id: 'KDB-1', price: 100 }]);
        expect(sandbox.window.__studniePricingSource).toBe('active');
    });

    it('cennik: loader studni bez source woła plain GET', async () => {
        let capturedUrl = null;
        const sandbox = makeSandbox((url) => {
            capturedUrl = url;
            return Promise.resolve(okRes([{ id: 'KDB-1', price: 100 }], null));
        });
        await run(STUDNIE_CODE, sandbox, 'loadStudnieProducts()');
        expect(capturedUrl).toBe('/api/products-studnie');
    });

    it("oferta: loadPrecoPricing({source:'active'}) woła URL z ?source=active", async () => {
        let capturedUrl = null;
        const sandbox = makeSandbox((url) => {
            capturedUrl = url;
            return Promise.resolve(okRes([{ 1000: { kinety: [] } }], null));
        });
        await run(STUDNIE_CODE, sandbox, "loadPrecoPricing({source:'active'})");
        expect(capturedUrl).toBe('/api/preco-pricing?source=active');
    });

    it('cennik: loadPrecoPricing() woła plain GET', async () => {
        let capturedUrl = null;
        const sandbox = makeSandbox((url) => {
            capturedUrl = url;
            return Promise.resolve(okRes([{ 1000: { kinety: [] } }], null));
        });
        await run(STUDNIE_CODE, sandbox, 'loadPrecoPricing()');
        expect(capturedUrl).toBe('/api/preco-pricing');
    });

    it('fallback header → toast RAZ na stronę (produkty + PRECO razem), brak → cisza', async () => {
        const sandbox = makeSandbox(() =>
            Promise.resolve(okRes([{ id: 'KDB-1', price: 100 }], 'live'))
        );
        vm.runInContext(STUDNIE_CODE, sandbox, { filename: 'loader.js' });
        await vm.runInContext("loadStudnieProducts({source:'active'})", sandbox, {
            timeout: 5000
        });
        await vm.runInContext("loadPrecoPricing({source:'active'})", sandbox, {
            timeout: 5000
        });
        expect(sandbox.showToast).toHaveBeenCalledTimes(1);
        expect(sandbox.showToast).toHaveBeenCalledWith(
            'Brak aktywnej wersji — oferta liczy z cennika roboczego (LIVE)',
            'warning'
        );

        const quiet = makeSandbox(() =>
            Promise.resolve(okRes([{ id: 'KDB-1', price: 100 }], null))
        );
        vm.runInContext(STUDNIE_CODE, quiet, { filename: 'loader.js' });
        await vm.runInContext("loadStudnieProducts({source:'active'})", quiet, {
            timeout: 5000
        });
        expect(quiet.showToast).not.toHaveBeenCalled();
    });
});
