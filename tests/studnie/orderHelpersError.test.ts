import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * A-13: loadOrdersStudnie (public/js/studnie/orderHelpers.js) — przy !res.ok
 * (500/403) musi rzucić i wrócić [] z logiem, a nie cicho parsować błędu.
 */
describe('loadOrdersStudnie() — brak silent fail przy !res.ok (A-13)', () => {
    function runLoad(fetchImpl: any) {
        const sandbox: any = {
            window: {},
            console: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            setTimeout,
            clearTimeout,
            fetchWithTimeout: fetchImpl,
            authHeaders: () => ({ 'X-Auth-Token': 'test-token-123' }),
            showToast: jest.fn(),
            Array,
            JSON,
            Math,
            Promise,
            Set
        };
        vm.createContext(sandbox);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
            'utf8'
        );
        vm.runInContext(code, sandbox);
        return vm.runInContext('loadOrdersStudnie()', sandbox, { timeout: 5000 });
    }

    it('przy HTTP 500 zwraca [] i loguje błąd (zamiast cicho parsować)', () => {
        const loggerError = jest.fn();
        const sandbox: any = {
            window: {},
            console: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() },
            logger: {
                error: (...a: unknown[]) => loggerError(...a),
                warn: jest.fn(),
                info: jest.fn()
            },
            setTimeout,
            clearTimeout,
            fetchWithTimeout: () => Promise.resolve({ ok: false, status: 500 }),
            authHeaders: () => ({ 'X-Auth-Token': 'x' }),
            showToast: jest.fn(),
            Array,
            JSON,
            Math,
            Promise,
            Set
        };
        vm.createContext(sandbox);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderHelpers.js'),
            'utf8'
        );
        vm.runInContext(code, sandbox);
        const p = vm.runInContext('loadOrdersStudnie()', sandbox, { timeout: 5000 });

        return p.then((orders: any) => {
            expect(orders).toEqual([]);
            expect(loggerError).toHaveBeenCalled();
        });
    });

    it('przy 200 zwraca dane (normalna ścieżka)', () => {
        const p = runLoad(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: 'o1' }] }) })
        );
        return p.then((orders: any) => {
            expect(orders).toEqual([{ id: 'o1' }]);
        });
    });
});
