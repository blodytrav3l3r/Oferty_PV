// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Opcja A: „ostatnia trasa". Zapis lokalny per-user, normalizacja hasha
 * (bez parametrów przejściowych), TTL, odrzucanie uszkodzonych rekordów.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadCtx() {
    const store = new Map<string, string>();
    const listeners: Record<string, Array<() => void>> = {};
    const sandbox: any = {
        console,
        URLSearchParams,
        location: { hash: '#/rury' },
        document: {
            body: {},
            getElementById: () => null,
            querySelector: () => null,
            createElement: () => ({ id: '', className: '', innerHTML: '' })
        },
        window: {} as any
    };
    sandbox.window.addEventListener = (evt: string, fn: () => void) => {
        (listeners[evt] = listeners[evt] || []).push(fn);
    };
    sandbox.window.location = sandbox.location;
    sandbox.window.localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k)
    };
    sandbox.window.sessionStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
    sandbox.window.currentUser = { id: 'u1' };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/lastRoute.js'), sandbox, { filename: 'lastRoute.js' });
    return { sandbox, store, lr: sandbox.window.lastRoute, listeners };
}

describe('Opcja A lastRoute — ostatnia trasa', () => {
    it('zapis i odczyt trasy z dokumentem', () => {
        const { lr, store } = loadCtx();
        expect(lr.save('#/rury?edit=o42')).toBe(true);
        expect(store.has('sok_last_route_v1_u1')).toBe(true);
        const rec = lr.get({ id: 'u1' });
        expect(rec.hash).toBe('#/rury?edit=o42');
        expect(rec.label).toBe('Oferty Rury — ostatni dokument');
        expect(typeof rec.updatedAt).toBe('string');
    });

    it('parametry przejściowe i tab nie trafiają do trasy', () => {
        const { lr } = loadCtx();
        lr.save('#/studnie?order=z1&panel=discounts&tab=offer&pvtype=pdf&version=2');
        expect(lr.get({ id: 'u1' }).hash).toBe('#/studnie?order=z1');
    });

    it('nieznany moduł i zły format hasha odrzucone', () => {
        const { lr, store } = loadCtx();
        expect(lr.save('#/nieznany')).toBe(false);
        expect(lr.save('rury')).toBe(false);
        expect(lr.save('')).toBe(false);
        expect(store.size).toBe(0);
    });

    it('TTL: wygasły rekord usuwany, get zwraca null', () => {
        const { lr, store } = loadCtx();
        const now = Date.now();
        store.set(
            'sok_last_route_v1_u1',
            JSON.stringify({
                v: 1,
                hash: '#/rury',
                updatedAt: new Date(now - 1000).toISOString(),
                expiresAt: new Date(now - 500).toISOString()
            })
        );
        expect(lr.get({ id: 'u1' })).toBeNull();
        expect(store.has('sok_last_route_v1_u1')).toBe(false);
    });

    it('uszkodzony JSON i zła wersja formatu → null bez wyjątku', () => {
        const { lr, store } = loadCtx();
        store.set('sok_last_route_v1_u1', '{nie-json');
        expect(() => lr.get({ id: 'u1' })).not.toThrow();
        expect(lr.get({ id: 'u1' })).toBeNull();
        store.set(
            'sok_last_route_v1_u1',
            JSON.stringify({
                v: 99,
                hash: '#/rury',
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60000).toISOString()
            })
        );
        expect(lr.get({ id: 'u1' })).toBeNull();
    });

    it('izolacja per-user: cudza trasa nie jest widoczna', () => {
        const { lr } = loadCtx();
        lr.save('#/kartoteka');
        expect(lr.get({ id: 'u2' })).toBeNull();
        expect(lr.get({ id: 'u1' }).hash).toBe('#/kartoteka');
    });

    it('brak użytkownika → brak zapisu', () => {
        const { sandbox, lr, store } = loadCtx();
        sandbox.window.currentUser = null;
        expect(lr.save('#/rury')).toBe(false);
        expect(store.size).toBe(0);
    });

    it('clear usuwa rekord użytkownika', () => {
        const { lr, store } = loadCtx();
        lr.save('#/rury');
        lr.clear({ id: 'u1' });
        expect(store.size).toBe(0);
        expect(lr.get({ id: 'u1' })).toBeNull();
    });

    it('awaria magazynu nie rzuca (best-effort)', () => {
        const { sandbox, lr } = loadCtx();
        sandbox.window.localStorage.setItem = () => {
            throw new Error('denied');
        };
        expect(() => lr.save('#/rury')).not.toThrow();
        expect(lr.save('#/rury')).toBe(false);
    });

    it('render: brak rekordu → brak karty, rekord → karta z linkiem', () => {
        const { sandbox, lr } = loadCtx();
        const created: any[] = [];
        const parent = {
            children: [] as any[],
            insertBefore(node: any) {
                this.children.push(node);
                node.parentNode = parent;
            }
        };
        const host = { parentNode: parent };
        sandbox.document.querySelector = (sel: string) => (sel === '.launch-grid' ? host : null);
        sandbox.document.createElement = () => {
            const el: any = { id: '', className: '', innerHTML: '', parentNode: null };
            created.push(el);
            return el;
        };
        sandbox.document.getElementById = (id: string) =>
            created.find((el) => el.id === id) || null;

        lr.render({ id: 'u1' });
        expect(created.length).toBe(0);

        lr.save('#/rury?edit=o7');
        lr.render({ id: 'u1' });
        expect(created.length).toBe(1);
        expect(created[0].id).toBe('last-route');
        expect(created[0].innerHTML).toContain('app.html#/rury?edit=o7');
        expect(created[0].innerHTML).toContain('Oferty Rury');
        expect(created[0].innerHTML).toContain('Otwórz');
        expect(parent.children.length).toBe(1);
    });

    it('render: uszkodzony rekord nie tworzy karty', () => {
        const { sandbox, store, lr } = loadCtx();
        const created: any[] = [];
        sandbox.document.createElement = () => {
            const el: any = { id: '', className: '', innerHTML: '', parentNode: null };
            created.push(el);
            return el;
        };
        sandbox.document.querySelector = () => ({ parentNode: { insertBefore() {} } });
        sandbox.document.getElementById = () => null;
        store.set('sok_last_route_v1_u1', '{"v":1}');
        expect(() => lr.render({ id: 'u1' })).not.toThrow();
        expect(created.length).toBe(0);
    });

    it('pagehide zapisuje bieżącą trasę (pojedyncza wizyta w module)', () => {
        const { sandbox, store, listeners } = loadCtx();
        expect(Array.isArray(listeners.pagehide)).toBe(true);
        expect(store.size).toBe(0);
        sandbox.location.hash = '#/zlecenia';
        listeners.pagehide[0]();
        expect(store.has('sok_last_route_v1_u1')).toBe(true);
        expect(JSON.parse(store.get('sok_last_route_v1_u1')!).hash).toBe('#/zlecenia');
    });
});
