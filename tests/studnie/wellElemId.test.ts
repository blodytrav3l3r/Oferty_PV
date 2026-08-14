import vm from 'vm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Testy vm dla wellElemId.js — stabilne identyfikatory elementów (Faza 3, krok 3.0).
 *
 * ensureElemIds jest idempotentna: nadaje _elemId tylko elementom bez niego,
 * nigdy nie zmienia istniejących (stabilność wskazań PZ).
 */

function loadWellElemId() {
    const code = readFileSync(
        join(__dirname, '..', '..', 'public', 'js', 'studnie', 'wellElemId.js'),
        'utf8'
    );
    const sandbox: any = { window: {}, crypto: { randomUUID: () => `uuid-${Math.random()}` } };
    sandbox.window.crypto = sandbox.crypto;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window;
}

describe('wellElemId.js — ensureElemIds', () => {
    let api: any;
    beforeEach(() => {
        api = loadWellElemId();
    });

    test('nadaje _elemId elementom bez identyfikatora', () => {
        const config: any[] = [
            { productId: 'A', quantity: 1 },
            { productId: 'B', quantity: 2 }
        ];
        api.ensureElemIds(config);
        expect(config[0]._elemId).toBeDefined();
        expect(config[1]._elemId).toBeDefined();
        expect(config[0]._elemId).not.toBe(config[1]._elemId);
    });

    test('jest idempotentna — nie zmienia istniejących _elemId', () => {
        const config: any[] = [{ productId: 'A', quantity: 1, _elemId: 'fixed-id' }];
        api.ensureElemIds(config);
        expect(config[0]._elemId).toBe('fixed-id');
    });

    test('nadaje _elemId tylko brakującym elementom', () => {
        const config: any[] = [
            { productId: 'A', quantity: 1, _elemId: 'fixed-id' },
            { productId: 'B', quantity: 1 }
        ];
        api.ensureElemIds(config);
        expect(config[0]._elemId).toBe('fixed-id');
        expect(config[1]._elemId).toBeDefined();
        expect(config[1]._elemId).not.toBe('fixed-id');
    });

    test('obsługuje pustą tablicę i brak configu', () => {
        expect(api.ensureElemIds([])).toEqual([]);
        expect(api.ensureElemIds(undefined)).toBeUndefined();
        expect(api.ensureElemIds(null)).toBeNull();
    });

    test('pomija wpisy, które nie są obiektami', () => {
        const config: any[] = [null, 'text', 42, { productId: 'A' }];
        api.ensureElemIds(config);
        expect(config[0]).toBeNull();
        expect(config[1]).toBe('text');
        expect(config[2]).toBe(42);
        expect(config[3]._elemId).toBeDefined();
    });

    test('newElemId generuje unikalne identyfikatory', () => {
        const a = api.newElemId();
        const b = api.newElemId();
        expect(a).toBeDefined();
        expect(a).not.toBe(b);
    });

    test('K8: przestawienie elementów zachowuje _elemId przy obiekcie (stabilność PZ)', () => {
        const config: any[] = [
            { productId: 'dennica', quantity: 1 },
            { productId: 'krag', quantity: 1 },
            { productId: 'wlaz', quantity: 1 }
        ];
        api.ensureElemIds(config);
        const idsBefore = config.map((c) => c._elemId);
        expect(new Set(idsBefore).size).toBe(config.length);

        const reordered = [...config].reverse();
        reordered.forEach((item, i) => {
            expect(item._elemId).toBe(idsBefore[2 - i]);
        });

        api.ensureElemIds(reordered);
        expect(reordered.map((c) => c._elemId)).toEqual(idsBefore.reverse());
    });
});
