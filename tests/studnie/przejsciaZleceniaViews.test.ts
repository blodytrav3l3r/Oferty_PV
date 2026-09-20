// @ts-nocheck -- wzorzec vm (rzednaClamp.test.ts)
// Regresja: ołówek (editPrzejscie) w zleceniach musi odświeżać listę
// zl-przejscia-list, nie tylko konfigurator (well-przejscia-tiles).
// Root cause: gołe renderWellPrzejscia() rysuje wyłącznie domyślny kontener.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function loadCrud(stubs: any = {}) {
    const calls: any = { helper: 0, render: 0, refreshModal: 0 };
    const well: any = {
        rzednaWlazu: 3.0,
        rzednaDna: 1.5,
        przejscia: [{ id: 'prz-1', productId: 'prz-160', rzednaWlaczenia: 2.0, angle: 0 }]
    };
    const context: any = {
        window: {
            refreshZleceniaModalIfActive: () => {
                calls.refreshModal++;
            },
            ...(stubs.window || {})
        },
        getCurrentWell: () => well,
        getStudnieProductById: () => ({ id: 'prz-160', category: 'PVC SN8' }),
        studnieProducts: [],
        renderWellPrzejscia: () => {
            calls.render++;
        }
    };
    Object.keys(stubs).forEach((k) => {
        if (k !== 'window') context[k] = stubs[k];
    });
    vm.createContext(context);
    vm.runInContext(readStudnie('wellTransitionsState.js'), context);
    vm.runInContext(readStudnie('wellTransitionsCrud.js'), context);
    return { context, well, calls };
}

describe('editPrzejscie w zleceniach (ołówek)', () => {
    it('używa refreshPrzejsciaViews gdy dostępny (dual-render konfigurator + zl)', () => {
        const helper = jest.fn();
        const { context, calls } = loadCrud({ window: { refreshPrzejsciaViews: helper } });
        context.editPrzejscie(0);
        expect(helper).toHaveBeenCalledTimes(1);
        expect(calls.render).toBe(0);
        expect(calls.refreshModal).toBe(1);
    });

    it('fallback do renderWellPrzejscia gdy helpera brak (stare testy vm)', () => {
        const { context, calls } = loadCrud();
        context.editPrzejscie(0);
        expect(calls.render).toBe(1);
    });
});

describe('refreshPrzejsciaViews (definicja)', () => {
    it('renderuje oba kontenery z filtrem elementu zlecenia', () => {
        const src = readStudnie('wellTransitions.js');
        expect(src).toContain('window.refreshPrzejsciaViews');
        expect(src).toContain('zl-przejscia-list');
        expect(src).toContain('filterElementIndex');
    });
});
