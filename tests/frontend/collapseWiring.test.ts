// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* ===== COLLAPSE WIRING =====
 * Toggleri wołają collapseSet (SSoT persystencji zwinięć) i nie rzucają
 * bez collapseState (typeof-guard, wzorzec bazy #29):
 * - studnie/globals.js toggleCard: persist + data-open-display
 * - rury/transport.js toggleTransportBreakdown: persist flagi
 * - studnie/pricelistPreco.js togglePrecoAccordion: persist per-DN
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function makeSandbox(extra: any = {}) {
    const sandbox: any = { console, window: {} as any, ...extra };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return sandbox;
}

describe('globals.js toggleCard', () => {
    function load(collapseStub: any = {}) {
        const calls: any[] = [];
        const sandbox = makeSandbox({
            collapseSet: (id: string, open: boolean) => {
                calls.push([id, open]);
                if (collapseStub.store) collapseStub.store[id] = open;
            }
        });
        if (collapseStub.omitCollapseSet) delete sandbox.collapseSet;
        vm.runInContext(readJs('studnie/globals.js'), sandbox, { filename: 'globals.js' });
        return { sandbox, calls };
    }

    function fakeEls(display: string, openDisplay?: string) {
        const content: any = { style: { display }, dataset: {} };
        if (openDisplay) content.dataset.openDisplay = openDisplay;
        const icon: any = { innerHTML: '' };
        return { content, icon };
    }

    test('zamknięcie woła collapseSet(id, false)', () => {
        const { sandbox, calls } = load();
        const { content, icon } = fakeEls('block');
        sandbox.document = {
            getElementById: (id: string) => (id === 'tiles-content' ? content : icon)
        };
        sandbox.toggleCard('tiles-content', 'tiles-icon');
        expect(content.style.display).toBe('none');
        expect(icon.innerHTML).toContain('chevron-down');
        expect(calls).toEqual([['tiles-content', false]]);
    });

    test('otwarcie honoruje data-open-display (flex/grid zamiast block)', () => {
        const { sandbox, calls } = load();
        const { content, icon } = fakeEls('none', 'flex');
        sandbox.document = {
            getElementById: (id: string) => (id === 'zl-przejscia-list' ? content : icon)
        };
        sandbox.toggleCard('zl-przejscia-list', 'zl-przejscia-icon');
        expect(content.style.display).toBe('flex');
        expect(icon.innerHTML).toContain('chevron-up');
        expect(calls).toEqual([['zl-przejscia-list', true]]);
    });

    test('bez collapseState nie rzuca (guard), toggle działa', () => {
        const { sandbox, calls } = load({ omitCollapseSet: true });
        const { content, icon } = fakeEls('block');
        sandbox.document = { getElementById: (id: string) => (id === 'c' ? content : icon) };
        expect(() => sandbox.toggleCard('c', 'i')).not.toThrow();
        expect(content.style.display).toBe('none');
        expect(calls).toEqual([]);
    });

    test('brak contentu → no-op', () => {
        const { sandbox, calls } = load();
        sandbox.document = { getElementById: () => null };
        expect(() => sandbox.toggleCard('brak', 'brak-icon')).not.toThrow();
        expect(calls).toEqual([]);
    });
});

describe('rury/transport.js toggleTransportBreakdown', () => {
    function load(collapseStub: any = {}) {
        const calls: any[] = [];
        const contents: any[] = [{ style: { display: 'none' } }];
        const icons: any[] = [{ innerHTML: '' }];
        const sandbox = makeSandbox({
            document: {
                querySelectorAll: (sel: string) => (sel.includes('toggle-icon') ? icons : contents)
            },
            ...collapseStub
        });
        vm.runInContext(readJs('rury/transport.js'), sandbox, { filename: 'transport.js' });
        return { sandbox, calls, contents, icons };
    }

    test('init czyta collapseGet (np. true → rozwinięta)', () => {
        const { sandbox } = load({ collapseGet: () => true });
        expect(sandbox.isTransportBreakdownExpanded).toBe(true);
    });

    test('bez collapseGet default false, toggle zapisuje collapseSet', () => {
        const calls: any[] = [];
        const { sandbox, contents, icons } = load({
            collapseSet: (id: string, open: boolean) => void calls.push([id, open])
        });
        expect(sandbox.isTransportBreakdownExpanded).toBeFalsy();
        sandbox.toggleTransportBreakdown();
        expect(sandbox.isTransportBreakdownExpanded).toBe(true);
        expect(calls).toEqual([['rury-transport-breakdown', true]]);
        expect(contents[0].style.display).toBe('block');
        expect(icons[0].innerHTML).toContain('chevron-up');
        sandbox.toggleTransportBreakdown();
        expect(calls[1]).toEqual(['rury-transport-breakdown', false]);
    });

    test('bez collapseSet nie rzuca', () => {
        const { sandbox } = load();
        expect(() => sandbox.toggleTransportBreakdown()).not.toThrow();
    });
});

describe('studnie/pricelistPreco.js togglePrecoAccordion', () => {
    function load() {
        const calls: any[] = [];
        const sandbox = makeSandbox({
            collapseSet: (id: string, open: boolean) => void calls.push([id, open])
        });
        vm.runInContext(readJs('studnie/pricelistPreco.js'), sandbox, {
            filename: 'pricelistPreco.js'
        });
        return { sandbox, calls };
    }

    function fakeHeader(open: boolean) {
        return {
            nextElementSibling: { style: { display: open ? 'block' : 'none' } },
            querySelector: () => null
        };
    }

    test('zwinięcie DN usuwa z Set i woła collapseSet(preco:DN, false)', () => {
        const { sandbox, calls } = load();
        sandbox.openPrecoAccordions = new Set(['1000']);
        sandbox.togglePrecoAccordion(fakeHeader(true), '1000');
        expect(sandbox.openPrecoAccordions.has('1000')).toBe(false);
        expect(calls).toEqual([['preco:1000', false]]);
    });

    test('rozwinięcie DN dodaje do Set i woła collapseSet(preco:DN, true)', () => {
        const { sandbox, calls } = load();
        sandbox.openPrecoAccordions = new Set();
        sandbox.togglePrecoAccordion(fakeHeader(false), '1200');
        expect(sandbox.openPrecoAccordions.has('1200')).toBe(true);
        expect(calls).toEqual([['preco:1200', true]]);
    });

    test('bez collapseSet nie rzuca (guard)', () => {
        const sandbox = makeSandbox();
        vm.runInContext(readJs('studnie/pricelistPreco.js'), sandbox, {
            filename: 'pricelistPreco.js'
        });
        delete sandbox.collapseSet;
        sandbox.openPrecoAccordions = new Set();
        expect(() => sandbox.togglePrecoAccordion(fakeHeader(false), '800')).not.toThrow();
        expect(sandbox.openPrecoAccordions.has('800')).toBe(true);
    });
});
