import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny: loadStudnieProducts() (public/js/studnie/uiHelpers.js)
 * musi wysyłać nagłówki autoryzacji (authHeaders). Bez nich GET /api/products-studnie
 * zwraca 401 → funkcja po 3 próbach zwraca [] → window.studnieProducts zawsze puste
 * → totalPrice/totalWeight w featureSnapshot telemetrii ML = 0 (martwe cechy).
 */
describe('loadStudnieProducts() — nagłówki autoryzacji (uiHelpers.js)', () => {
    it('fetchWithTimeout dostaje nagłówek X-Auth-Token z authHeaders()', () => {
        let capturedHeaders: any = null;
        let capturedUrl: string | null = null;
        const sandbox: any = {
            window: {},
            console: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            setTimeout,
            clearTimeout,
            fetchWithTimeout: (url: string, options: any) => {
                capturedUrl = url;
                capturedHeaders = options && options.headers;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [{ id: 'KDB-1', price: 100 }] })
                });
            },
            authHeaders: () => ({
                'Content-Type': 'application/json',
                'X-Auth-Token': 'test-token-123'
            }),
            showToast: jest.fn(),
            Array,
            JSON,
            Math,
            Promise
        };
        vm.createContext(sandbox);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/uiHelpers.js'),
            'utf8'
        );
        vm.runInContext(code, sandbox);

        const result = vm.runInContext(
            'loadStudnieProducts().then(function (products) { return products; })',
            sandbox,
            { timeout: 5000 }
        );

        return result.then((products: any) => {
            expect(capturedUrl).toBe('/api/products-studnie');
            expect(capturedHeaders).toEqual({
                'Content-Type': 'application/json',
                'X-Auth-Token': 'test-token-123'
            });
            expect(products).toEqual([{ id: 'KDB-1', price: 100 }]);
        });
    });

    it('zwraca [] przy 401 (brak autoryzacji) — nie rzuca', () => {
        const sandbox: any = {
            window: {},
            console: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            setTimeout,
            clearTimeout,
            fetchWithTimeout: () => Promise.resolve({ ok: false, status: 401 }),
            authHeaders: () => ({ 'X-Auth-Token': 'x' }),
            showToast: jest.fn(),
            Array,
            JSON,
            Math,
            Promise
        };
        vm.createContext(sandbox);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/uiHelpers.js'),
            'utf8'
        );
        vm.runInContext(code, sandbox);

        const result = vm.runInContext(
            'loadStudnieProducts().then(function (products) { return products; })',
            sandbox,
            { timeout: 5000 }
        );

        return result.then((products: any) => {
            expect(products).toEqual([]);
        });
    });
});
