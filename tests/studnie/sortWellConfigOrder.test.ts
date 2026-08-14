// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny K8 (Faza 3): sortWellConfigByOrder() NIE zmienia wskazań PZ.
 *
 * Po nadaniu _elemId (wellElemId.js, Faza 3.0) elementy studni mają stabilny
 * identyfikator. Sortowanie konfiguracji przesuwa obiekty (referencje), więc
 * _elemId pozostaje przy elemencie — PZ wskazujący po _elemId (elementKey)
 * musi nadal trafiać w ten sam element po sortowaniu (błąd #23).
 */
describe('sortWellConfigByOrder — stabilność PZ (K8)', () => {
    function runScript(well, products) {
        const context = {
            studnieProducts: products,
            getCurrentWell: () => well,
            currentWellIndex: 0,
            showToast: jest.fn(),
            window: {
                ensureReliefRingPair: jest.fn(),
                showKonusPehdResolverModal: jest.fn()
            }
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/actionsConfigSort.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context.window;
    }

    const products = [
        { id: 'K1', componentType: 'krag', dn: '1000' },
        { id: 'K2', componentType: 'krag', dn: '1000' },
        { id: 'W1', componentType: 'wlaz', dn: '600' },
        { id: 'D1', componentType: 'dennica', dn: '1000' },
        { id: 'P1', componentType: 'plyta_din', dn: '1000' },
        { id: 'R1', componentType: 'pierscien_odciazajacy', dn: '1000' }
    ];

    test('sortowanie zachowuje _elemId przy elementach (PZ wskazuje ten sam element)', () => {
        // Konfiguracja w kolejności "złej" (dennica na początku, wlaz na końcu),
        // każdy element z unikalnym _elemId (symulacja ensureElemIds z Fazy 3.0).
        const dennica = { productId: 'D1', quantity: 1, _elemId: 'elem-den' };
        const wlaz = { productId: 'W1', quantity: 1, _elemId: 'elem-wlaz' };
        const kragA = { productId: 'K1', quantity: 1, _elemId: 'elem-krag-a' };
        const kragB = { productId: 'K2', quantity: 1, _elemId: 'elem-krag-b' };
        const plyta = { productId: 'P1', quantity: 1, _elemId: 'elem-plyta' };
        const pierscien = { productId: 'R1', quantity: 1, _elemId: 'elem-pierscien' };

        const well = {
            config: [dennica, kragB, plyta, wlaz, pierscien, kragA],
            redukcjaDN1000: false
        };

        const api = runScript(well, products);
        api.sortWellConfigByOrder();

        // Po sortowaniu PZ wskazujący 'elem-krag-b' nadal wskazuje kragB (ten sam obiekt)
        const byId = (id) => well.config.find((c) => c._elemId === id);
        expect(byId('elem-den')).toBe(dennica);
        expect(byId('elem-wlaz')).toBe(wlaz);
        expect(byId('elem-krag-a')).toBe(kragA);
        expect(byId('elem-krag-b')).toBe(kragB);
        expect(byId('elem-plyta')).toBe(plyta);
        expect(byId('elem-pierscien')).toBe(pierscien);

        // Kolejność fizyczna (od góry do dołu): wlaz, plyta_din, pierscien, krag, dennica
        expect(well.config.map((c) => c._elemId)).toEqual([
            'elem-wlaz',
            'elem-plyta',
            'elem-pierscien',
            'elem-krag-b',
            'elem-krag-a',
            'elem-den'
        ]);
    });

    test('nie mutuje wejściowej tablicy referencji (zawsze kopia, baza #15)', () => {
        const kragA = { productId: 'K1', quantity: 1, _elemId: 'elem-krag-a' };
        const dennica = { productId: 'D1', quantity: 1, _elemId: 'elem-den' };
        const well = { config: [kragA, dennica], redukcjaDN1000: false };

        const api = runScript(well, products);
        const original = [...well.config];
        api.sortWellConfigByOrder();

        // Obiekty są te same (referencje), kolejność posortowana — ale _elemId nietknięte
        expect(well.config).toHaveLength(2);
        expect(well.config[0]).toBe(kragA);
        expect(well.config[1]).toBe(dennica);
        expect(kragA._elemId).toBe('elem-krag-a');
        expect(dennica._elemId).toBe('elem-den');
        expect(original.map((o) => o._elemId)).toEqual(['elem-krag-a', 'elem-den']);
    });

    test('brak current well — bezpieczny (guard)', () => {
        const api = runScript(null, products);
        expect(() => api.sortWellConfigByOrder()).not.toThrow();
    });
});
