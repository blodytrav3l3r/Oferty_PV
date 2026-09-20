// @ts-nocheck
/* =============================================================
   Regresja: skakanie edycji dennica → krąg w Zleceniu Produkcyjnym.
   1) resolvePrzejscieIndex preferuje stabilne data-prz-id nad data-i
      (re-sort well.przejscia między render a klik nie trafia w złe przejście).
   2) carryOverConfigElemIds przenosi _elemId przez rebuild solvera
      (numer PZ nie spada do "— nowy —" po zmianie przejścia).
   3) ensurePrzejsciaIds backfilluje brakujące id (dane legacy).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function runContext() {
    const docStub = {
        getElementById: () => null,
        createElement: () => ({
            style: {},
            setAttribute() {},
            appendChild() {},
            addEventListener() {},
            remove() {},
            innerHTML: ''
        }),
        body: { appendChild: () => {} },
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const context = {
        window: {},
        document: docStub,
        escapeHtml: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    };
    context.window.escapeHtmlAttr = (s) => String(s).replace(/"/g, '&quot;');
    vm.createContext(context);
    vm.runInContext(readStudnie('wellElemId.js'), context);
    vm.runInContext(readStudnie('transitionRenderer.js'), context);
    return context;
}

function elStub(attrs) {
    return {
        getAttribute: (k) => (k in attrs ? attrs[k] : null)
    };
}

describe('Stabilne id przejść i elementów (zlecenia)', () => {
    test('TEST 1: resolver preferuje data-prz-id nad nieaktualne data-i', () => {
        const ctx = runContext();
        const well = {
            przejscia: [{ id: 'prz-den-1' }, { id: 'prz-krag-9' }, { id: 'prz-den-2' }]
        };
        // Re-sort przeniósł 'prz-den-2' z pozycji 2 na 0 — DOM ma stare data-i=2.
        const reordered = {
            przejscia: [{ id: 'prz-den-2' }, { id: 'prz-den-1' }, { id: 'prz-krag-9' }]
        };
        const idx = ctx.resolvePrzejscieIndex(
            reordered,
            elStub({ 'data-prz-id': 'prz-den-2', 'data-i': '2' }),
            2
        );
        expect(idx).toBe(0);
        expect(reordered.przejscia[idx].id).toBe('prz-den-2');
        expect(well.przejscia[2].id).toBe('prz-den-2');
    });

    test('TEST 2: resolver fallback na data-i gdy brak data-prz-id (legacy)', () => {
        const ctx = runContext();
        const well = { przejscia: [{ id: 'prz-a' }, { id: 'prz-b' }] };
        expect(ctx.resolvePrzejscieIndex(well, elStub({ 'data-i': '1' }), 1)).toBe(1);
    });

    test('TEST 3: carryOverConfigElemIds zachowuje _elemId i nie duplikuje', () => {
        const ctx = runContext();
        const oldConfig = [
            { productId: 'den-1000', quantity: 1, _elemId: 'elem-den' },
            { productId: 'krag-1000', quantity: 2, _elemId: 'elem-krag' }
        ];
        const newConfig = [
            { productId: 'krag-1000', quantity: 2 },
            { productId: 'den-1000', quantity: 1 },
            { productId: 'właz-nowy', quantity: 1 }
        ];
        ctx.carryOverConfigElemIds(oldConfig, newConfig);
        expect(newConfig[0]._elemId).toBe('elem-krag');
        expect(newConfig[1]._elemId).toBe('elem-den');
        expect(typeof newConfig[2]._elemId).toBe('string');
        expect(newConfig[2]._elemId.length).toBeGreaterThan(0);
        const ids = newConfig.map((c) => c._elemId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('TEST 4: ensurePrzejsciaIds backfilluje braki, nie rusza istniejących', () => {
        const ctx = runContext();
        const list = [{ id: 'prz-stale' }, { productId: 'x' }, {}];
        ctx.ensurePrzejsciaIds(list);
        expect(list[0].id).toBe('prz-stale');
        expect(typeof list[1].id).toBe('string');
        expect(typeof list[2].id).toBe('string');
        expect(list[1].id).not.toBe(list[2].id);
    });
});
