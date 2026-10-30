// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Draft > DRAFT_SYNC_MAX_BYTES: localStorage ma sufit przeglądarki (zmierzone
 * ~50 MB → QuotaExceededError), więc duże szkice idą do IndexedDB (cap 200 MB).
 * Backend IDB jest wstrzykiwany przez `window.draftIdb`, więc testy używają
 * mapy w pamięci zamiast prawdziwego IndexedDB.
 */

function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function memStorage() {
    const m = new Map<string, string>();
    return {
        getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
        setItem: (k: string, v: string) => void m.set(k, String(v)),
        removeItem: (k: string) => void m.delete(k),
        key: (i: number) => Array.from(m.keys())[i] ?? null,
        get length() {
            return m.size;
        },
        keys: () => Array.from(m.keys())
    };
}

function fakeIdb(opts: any = {}) {
    const map = new Map<string, string>();
    const calls = { put: 0, get: 0, del: 0, delPrefix: 0, keys: 0 };
    return {
        map,
        calls,
        put: (k: string, v: string) => {
            calls.put++;
            if (opts.putError) return Promise.reject(opts.putError);
            map.set(k, v);
            return Promise.resolve();
        },
        get: (k: string) => {
            calls.get++;
            if (opts.getError) return Promise.reject(opts.getError);
            return Promise.resolve(map.has(k) ? map.get(k)! : null);
        },
        keys: () => {
            calls.keys++;
            return Promise.resolve(Array.from(map.keys()));
        },
        del: (k: string) => {
            calls.del++;
            map.delete(k);
            return Promise.resolve();
        },
        delPrefix: (prefix: string) => {
            calls.delPrefix++;
            let n = 0;
            for (const k of Array.from(map.keys())) {
                if (k.indexOf(prefix) === 0) {
                    map.delete(k);
                    n++;
                }
            }
            return Promise.resolve(n);
        }
    };
}

function loadStore(idb?: any) {
    const sandbox: any = { window: {}, console, URL, Promise };
    if (idb) sandbox.window.draftIdb = idb;
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    return sandbox.window.draftStore;
}

/** Koperta z payloadem ponad limit localStorage (items kopiowane w całości). */
function bigDraft(ds: any, bytes = 4200000) {
    const chunk = 'x'.repeat(1000);
    const count = Math.ceil(bytes / chunk.length);
    const items = [];
    for (let i = 0; i < count; i++) items.push({ name: chunk });
    return ds.buildDraft({
        userId: 'u1',
        kind: 'offer_rury',
        docId: 'o1',
        payload: { items: items }
    });
}

describe('draftStore — limit i routing backendów', () => {
    it('cap to 200 MB, a localStorage dostaje drafty do 4 MB', () => {
        const ds = loadStore();
        expect(ds.MAX_BYTES).toBe(200 * 1024 * 1024);
        expect(ds.SYNC_MAX_BYTES).toBe(4000000);
    });

    it('mały draft: localStorage, bez dotykania IndexedDB', () => {
        const ds = loadStore();
        const idb = fakeIdb();
        const sandbox: any = { window: { draftIdb: idb }, console, URL, Promise };
        vm.createContext(sandbox);
        vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
        const store = sandbox.window.draftStore;
        const storage = memStorage();
        const draft = store.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'o1',
            payload: { items: [{ name: 'rura' }] }
        });
        const res = store.saveDraftAuto(storage, draft);
        expect(res).toMatchObject({ ok: true, storage: 'local' });
        expect(storage.keys().length).toBe(1);
        expect(idb.calls.put).toBe(0);
        expect(ds.MAX_BYTES).toBeGreaterThan(store.SYNC_MAX_BYTES);
    });

    it('duży draft: IndexedDB, bez kopii w localStorage', async () => {
        const idb = fakeIdb();
        const store = loadStore(idb);
        const storage = memStorage();
        const draft = bigDraft(store);
        expect(store.draftByteSize(draft)).toBeGreaterThan(store.SYNC_MAX_BYTES);

        const res = store.saveDraftAuto(storage, draft);
        expect(res).toMatchObject({ ok: true, storage: 'idb' });
        expect(await res.write).toEqual({ ok: true });
        expect(storage.keys()).toEqual([]);
        const key = store.buildDraftKey('u1', 'offer_rury', 'o1');
        expect(idb.map.has(key)).toBe(true);
    });

    it('odczyt dużego draftu idzie z IndexedDB (loadDraftAuto)', async () => {
        const idb = fakeIdb();
        const store = loadStore(idb);
        const storage = memStorage();
        const draft = bigDraft(store);
        const res = store.saveDraftAuto(storage, draft);
        await res.write;
        const key = store.buildDraftKey('u1', 'offer_rury', 'o1');

        expect(store.loadDraft(storage, key).status).toBe('missing');
        const loaded = await store.loadDraftAuto(storage, key);
        expect(loaded.status).toBe('ok');
        expect(loaded.draft.payload.items.length).toBe(draft.payload.items.length);
    });

    it('kopia lokalna wygrywa nad IndexedDB przy tym samym kluczu', async () => {
        const idb = fakeIdb();
        const store = loadStore(idb);
        const storage = memStorage();
        const key = store.buildDraftKey('u1', 'offer_rury', 'o1');
        const oldBig = bigDraft(store);
        await store.saveDraftAuto(storage, oldBig).write;
        // Nowszy, mniejszy szkic: localStorage (stara kopia w IDB zostaje).
        const newer = store.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'o1',
            payload: { items: [{ name: 'nowszy' }] }
        });
        expect(store.saveDraftAuto(storage, newer)).toMatchObject({ ok: true, storage: 'local' });
        expect(idb.map.has(key)).toBe(true);

        const loaded = await store.loadDraftAuto(storage, key);
        expect(loaded.status).toBe('ok');
        expect(loaded.draft.payload.items[0].name).toBe('nowszy');
    });

    it('duży draft bez backendu IDB → oversize (bez cichego zapisu lokalnego)', () => {
        const store = loadStore(null);
        const storage = memStorage();
        const big = bigDraft(store);
        expect(store.saveDraftAuto(storage, big)).toMatchObject({
            ok: false,
            reason: 'oversize'
        });
        expect(storage.keys()).toEqual([]);
    });

    it('błąd zapisu IDB → {ok:false}; quota → reason quota', async () => {
        const errIb = new Error('boom');
        const store1 = loadStore(fakeIdb({ putError: errIb }));
        expect(await store1.saveDraftAuto(memStorage(), bigDraft(store1)).write).toEqual({
            ok: false,
            reason: 'error'
        });
        const quotaErr: any = new Error('quota');
        quotaErr.name = 'QuotaExceededError';
        const store2 = loadStore(fakeIdb({ putError: quotaErr }));
        expect(await store2.saveDraftAuto(memStorage(), bigDraft(store2)).write).toEqual({
            ok: false,
            reason: 'quota'
        });
    });

    it('lista i usuwanie obejmują oba backendy', async () => {
        const idb = fakeIdb();
        const store = loadStore(idb);
        const storage = memStorage();
        const small = store.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'small',
            payload: { items: [{ name: 'mały' }] }
        });
        store.saveDraftAuto(storage, small);
        await store.saveDraftAuto(storage, bigDraft(store)).write;

        const localOnly = store.listUserDrafts(storage, 'u1');
        expect(localOnly.length).toBe(1);
        const merged = await store.listUserDraftsAuto(storage, 'u1');
        expect(merged.length).toBe(2);
        expect(merged.map((d: any) => d.docId).sort()).toEqual(['o1', 'small']);

        const bigKey = store.buildDraftKey('u1', 'offer_rury', 'o1');
        store.removeDraft(storage, bigKey);
        expect(idb.map.has(bigKey)).toBe(false);

        await store.saveDraftAuto(storage, bigDraft(store)).write;
        expect(idb.map.size).toBe(1);
        store.removeUserDrafts(storage, 'u1');
        await new Promise((r) => setTimeout(r, 0));
        expect(idb.map.size).toBe(0);
        expect(storage.keys()).toEqual([]);
    });

    it('wygasły draft w IndexedDB jest kasowany przy odczycie', async () => {
        const idb = fakeIdb();
        const store = loadStore(idb);
        const storage = memStorage();
        const key = store.buildDraftKey('u1', 'offer_rury', 'o1');
        const draft = bigDraft(store);
        draft.expiresAt = new Date(Date.now() - 1000).toISOString();
        idb.map.set(key, JSON.stringify(draft));
        const loaded = await store.loadDraftAuto(storage, key);
        expect(loaded.status).toBe('expired');
        // Kasowanie jest best-effort (bez blokowania odczytu) — czekamy na mikrotask.
        await new Promise((r) => setTimeout(r, 0));
        expect(idb.map.has(key)).toBe(false);
    });

    it('awaria IndexedDB przy odczycie nie wywraca loadDraftAuto', async () => {
        const store = loadStore(fakeIdb({ getError: new Error('offline') }));
        const storage = memStorage();
        const key = store.buildDraftKey('u1', 'offer_rury', 'o1');
        const loaded = await store.loadDraftAuto(storage, key);
        expect(loaded.status).toBe('missing');
    });
});

describe('draftIdb.js — wpięcie w strony', () => {
    const pages = ['public/index.html', 'public/studnie.html', 'public/rury.html'];
    it.each(pages)('%s ładuje draftIdb.js przed draftStore.js', (rel) => {
        const html = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
        const idb = html.indexOf('js/shared/draftIdb.js');
        const store = html.indexOf('js/shared/draftStore.js');
        expect(idb).toBeGreaterThan(-1);
        expect(store).toBeGreaterThan(idb);
    });

    it('backend używa jednej bazy i magazynu klucz-wartość', () => {
        const src = readJs('shared/draftIdb.js');
        expect(src).toContain("var DB_NAME = 'sok_drafts';");
        expect(src).toContain("var STORE_NAME = 'drafts';");
        expect(src).toContain('.draftIdb = {');
    });
});
