import vm from 'vm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Testy vm dla pzGuard.js — dopasowanie PZ do elementu studni (Faza 3, krok 3.4/3.5).
 *
 * findPzForElement dopasowuje PZ po elementKey (stabilny _elemId), z fallbackiem na
 * elementIndex (legacy PZ sprzed wprowadzenia elementKey).
 */

function loadPzGuard(productionOrders: any[]) {
    const code = readFileSync(
        join(__dirname, '..', '..', 'public', 'js', 'studnie', 'pzGuard.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {},
        productionOrders
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.pzGuard;
}

describe('pzGuard.js — findPzForElement', () => {
    const wellId = 'well-1';
    const elemKey = 'uuid-abc';
    const legacy = [
        { wellId, elementIndex: 0, status: 'draft' },
        { wellId: 'other', elementKey: 'uuid-xyz', elementIndex: 5, status: 'draft' }
    ];

    test('dopasowuje po elementKey, ignorując zmieniony elementIndex', () => {
        const guard = loadPzGuard([...legacy]);
        // element przesunięty po sortowaniu: ten sam key, inny index
        const found = guard.findPzForElement(
            [...legacy, { wellId, elementKey: elemKey, elementIndex: 7, status: 'draft' }],
            wellId,
            elemKey,
            3
        );
        expect(found).toBeDefined();
        expect(found.elementKey).toBe(elemKey);
    });

    test('fallback na elementIndex dla legacy PZ bez elementKey', () => {
        const guard = loadPzGuard(legacy);
        const found = guard.findPzForElement(legacy, wellId, '', 0);
        expect(found).toBeDefined();
        expect(found.elementIndex).toBe(0);
    });

    test('zwraca undefined, gdy brak dopasowania po key i po index', () => {
        const guard = loadPzGuard(legacy);
        const found = guard.findPzForElement(legacy, wellId, 'uuid-nope', 99);
        expect(found).toBeUndefined();
    });

    test('key ma priorytet nad index, gdy oba dopasowane', () => {
        const list = [
            { wellId, elementKey: elemKey, elementIndex: 0, status: 'draft' },
            { wellId, elementKey: 'uuid-other', elementIndex: 0, status: 'accepted' }
        ];
        const guard = loadPzGuard(list);
        const found = guard.findPzForElement(list, wellId, elemKey, 0);
        expect(found.elementKey).toBe(elemKey);
        expect(found.status).toBe('draft');
    });

    test('ignoruje PZ innych studni', () => {
        const guard = loadPzGuard(legacy);
        const found = guard.findPzForElement(legacy, 'well-999', elemKey, 0);
        expect(found).toBeUndefined();
    });

    test('hasPzForElementAtOrAfter niezmienione (ochrona reindeksacji)', () => {
        const guard = loadPzGuard([{ wellId, elementIndex: 4, status: 'draft' }]);
        expect(guard.hasPzForElementAtOrAfter(wellId, 3)).toBe(true);
        expect(guard.hasPzForElementAtOrAfter(wellId, 5)).toBe(false);
        expect(guard.hasPzForElementAtOrAfter('other', 0)).toBe(false);
    });

    test('flaga wyłączona przywraca dopasowanie po elementIndex (stary kod)', () => {
        const list = [{ wellId, elementKey: elemKey, elementIndex: 0, status: 'draft' }];
        const guard = loadPzGuard(list);
        guard.setPzStableIdEnabled(false);
        const found = guard.findPzForElement(list, wellId, elemKey, 0);
        expect(found).toBeDefined();
        expect(found.elementKey).toBe(elemKey);
        // gdy index nie pasuje, nie dopasuje mimo zgadzającego się key
        expect(guard.findPzForElement(list, wellId, elemKey, 99)).toBeUndefined();
        expect(guard.findPzForElement(list, wellId, '', 0)).toBeDefined();
    });

    test('domyślnie flaga włączona (dopasowanie po key)', () => {
        const list = [{ wellId, elementKey: elemKey, elementIndex: 0, status: 'draft' }];
        const guard = loadPzGuard(list);
        const found = guard.findPzForElement(list, wellId, elemKey, 99);
        expect(found).toBeDefined();
        expect(found.elementKey).toBe(elemKey);
    });
});
