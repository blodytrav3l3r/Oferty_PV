// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L2: wpięcie synchronizacji draftu w autosave.
 *
 * Pilnuje dwóch rzeczy, których złamanie kosztuje pracę użytkownika:
 * 1. zapis lokalny jest NIEZALEŻNY od sieci (błąd pushu nie zmienia wyniku),
 * 2. konflikt i odzysk cross-device są JAWNE (modal, żadnego auto-nadpisania).
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

const RURY_FIELDS = { clientName: 'K', validity: '7 dni', transportKm: 100, transportRate: 10 };
const RURY_ITEMS = [{ uid: 'rur_1', productId: 'p', quantity: 2 }];

function fakeDom() {
    const byId = new Map<string, any>();
    const body = {
        appendChild(el: any) {
            el.parentNode = body;
            byId.set(el.id, el);
        },
        removeChild(el: any) {
            byId.delete(el.id);
            el.parentNode = null;
        }
    };
    return {
        body,
        createElement() {
            return {
                id: '',
                className: '',
                textContent: '',
                attrs: {} as Record<string, string>,
                parentNode: null,
                children: [] as any[],
                handlers: {} as Record<string, any>,
                appendChild(child: any) {
                    this.children.push(child);
                },
                setAttribute(k: string, v: string) {
                    this.attrs[k] = v;
                },
                addEventListener(evt: string, fn: any) {
                    this.handlers[evt] = fn;
                },
                getAttribute(k: string) {
                    return this.attrs[k] ?? null;
                }
            };
        },
        getElementById(id: string) {
            return byId.get(id) || null;
        },
        addEventListener() {},
        querySelector() {
            return null;
        }
    };
}

function loadCtx() {
    const store = new Map<string, string>();
    const storage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
            return store.size;
        }
    };
    const net = { queue: [] as any[], calls: [] as any[] };
    const sandbox: any = {
        console,
        currentUser: { id: 'u1' },
        showToast: () => {},
        document: fakeDom(),
        addEventListener: () => {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
        setOfferFormFields: () => {},
        getOfferFormFields: () => ({ ...RURY_FIELDS }),
        fetch: async (url: string, opts: any) => {
            net.calls.push({ url, opts });
            const next = net.queue.shift();
            if (next instanceof Error) throw next;
            if (!next) throw new Error('brak zaplanowanej odpowiedzi');
            return {
                status: next.status,
                ok: next.status >= 200 && next.status < 300,
                json: async () => next.body
            };
        },
        window: {} as any
    };
    sandbox.window.localStorage = storage;
    sandbox.window.currentUser = { id: 'u1' };
    sandbox.window.currentRuryTransportMode = 'full';
    sandbox.currentOfferItems = JSON.parse(JSON.stringify(RURY_ITEMS));
    sandbox.showModal = (o: any) => {
        const el = sandbox.document.createElement();
        el.id = o.id;
        sandbox.document.body.appendChild(el);
        return el;
    };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftSync.js'), sandbox, { filename: 'draftSync.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return { sandbox, store, net, storage };
}

/** Aktywna oferta rury z niezapisaną zmianą (dirty wobec SAVED). */
function dirtyRury(sandbox: any) {
    sandbox.editingOfferId = 'o1';
    sandbox.offers = [
        {
            id: 'o1',
            version: 3,
            ...RURY_FIELDS,
            items: JSON.parse(JSON.stringify(RURY_ITEMS)),
            transportMode: 'full'
        }
    ];
    sandbox.getOfferFormFields = () => ({ ...RURY_FIELDS, clientName: 'INNA' });
    sandbox.currentOfferItems = [{ uid: 'rur_1', productId: 'p', quantity: 5 }];
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('L2 draftSync — wpięcie w autosave', () => {
    it('błąd sieci nie blokuje zapisu lokalnego (offline-first)', async () => {
        const { sandbox, store, net } = loadCtx();
        dirtyRury(sandbox);
        net.queue.push(new Error('ECONNRESET'));
        expect(sandbox._draftWriteKind('offer_rury', true)).toBe(true);
        await tick();
        expect(store.size).toBeGreaterThan(0);
        expect(sandbox.window.draftAutosave.saveState()).toBe('ok');
    });

    it('flush wysyła If-Match z meta i aktualizuje meta po 200', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        net.queue.push({
            status: 200,
            body: { version: 3, updatedAt: '2026-10-25T10:00:00.000Z' }
        });
        sandbox._draftWriteKind('offer_rury', true);
        await tick();
        expect(net.calls).toHaveLength(1);
        expect(net.calls[0].opts.method).toBe('PUT');
        expect(net.calls[0].opts.headers['If-Match']).toBe('"2"');
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(3);
    });

    it('409 → modal z trzema wyborami; „Użyj lokalnego" wysyła CAS na wersję serwera', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 1, updatedAt: null });
        net.queue.push({
            status: 409,
            body: {
                code: 'DRAFT_CONFLICT',
                serverVersion: 5,
                serverUpdatedAt: '2026-10-25T09:00:00.000Z'
            }
        });
        net.queue.push({
            status: 200,
            body: { version: 6, updatedAt: '2026-10-25T11:00:00.000Z' }
        });
        sandbox._draftWriteKind('offer_rury', true);
        await tick();

        const overlay = sandbox.document.getElementById('sok-draft-sync-modal');
        expect(overlay).not.toBeNull();
        expect(typeof overlay.handlers.click).toBe('function');

        const btn = {
            getAttribute: (k: string) => (k === 'data-draft-sync-act' ? 'local' : null)
        };
        overlay.handlers.click({ target: { closest: () => btn } });
        await tick();

        expect(net.calls).toHaveLength(2);
        expect(net.calls[1].opts.headers['If-Match']).toBe('"5"');
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(6);
    });

    it('brak lokalnego draftu + inna kopia serwerowa → modal odzysku z serwera', async () => {
        const { sandbox, net } = loadCtx();
        dirtyRury(sandbox);
        net.queue.push({
            status: 200,
            body: {
                data: {
                    kind: 'offer_rury',
                    docId: 'o1',
                    payload: { fields: { clientName: 'Z SERWERA' }, items: [] },
                    version: 4,
                    updatedAt: '2026-10-24T08:00:00.000Z',
                    baseVersion: 3
                }
            }
        });
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        await tick();
        expect(sandbox.document.getElementById('sok-draft-modal')).not.toBeNull();
    });

    it('kopia serwerowa równa SAVED → usuwana po cichu, bez modala', async () => {
        const { sandbox, net } = loadCtx();
        dirtyRury(sandbox);
        // SAVED = RURY_FIELDS + RURY_ITEMS; serwer zwraca dokładnie ten stan.
        net.queue.push({
            status: 200,
            body: {
                data: {
                    kind: 'offer_rury',
                    docId: 'o1',
                    payload: {
                        fields: { ...RURY_FIELDS },
                        items: JSON.parse(JSON.stringify(RURY_ITEMS)),
                        transportMode: 'full'
                    },
                    version: 2,
                    updatedAt: '2026-10-24T08:00:00.000Z',
                    baseVersion: 3
                }
            }
        });
        net.queue.push({ status: 204, body: null });
        sandbox.window.draftAutosave.checkRecovery('offer_rury');
        await tick();
        await tick();
        expect(sandbox.document.getElementById('sok-draft-modal')).toBeNull();
        const del = net.calls.find((c) => c.opts.method === 'DELETE');
        expect(del).toBeTruthy();
    });

    it('drugi 409 tego samego klucza nie otwiera modala ponownie (latch)', () => {
        const { sandbox } = loadCtx();
        dirtyRury(sandbox);
        const shown: any[] = [];
        const origShow = sandbox.showModal;
        sandbox.showModal = (o: any) => {
            shown.push(o);
            return origShow(o);
        };
        const key = sandbox.window.draftStore.buildDraftKey('u1', 'offer_rury', 'o1');
        const pending = { kind: 'offer_rury', docId: 'o1', payload: {}, baseVersion: null };
        const conflict = {
            status: 'conflict',
            reason: 'version_mismatch',
            serverVersion: 5,
            serverUpdatedAt: '2026-10-25T09:00:00.000Z'
        };
        sandbox._draftSyncFinish(key, pending, conflict);
        sandbox._draftSyncFinish(key, pending, conflict);
        const modals = shown.filter((o) => o.id === 'sok-draft-sync-modal');
        expect(modals).toHaveLength(1);
        // Copy nie twierdzi już, że to na pewno inne urządzenie.
        expect(modals[0].html).toContain('Draft ma nowszą wersję na serwerze');
        expect(modals[0].html).not.toContain('Draft zmieniony na innym urządzeniu');
        expect(modals[0].html).toContain('innej karcie lub na innym urządzeniu');
    });

    it('SAVED czyści kopię serwerową i meta (brak martwego draftu)', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 4, updatedAt: null });
        net.queue.push({ status: 204, body: null });
        sandbox._draftClearContext('offer_rury', 'o1');
        await tick();
        const del = net.calls.find((c) => c.opts.method === 'DELETE');
        expect(del).toBeTruthy();
        expect(del.url).toContain('/api/drafts/offer_rury/o1');
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')).toBeNull();
    });
});
