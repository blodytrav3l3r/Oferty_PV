// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L2: ograniczony self-heal konfliktu draftu.
 *
 * Zasada nadrzędna: integralność treści oferty > ukrycie modala.
 * Meta serwera może dogonić lokalną WYŁĄCZNIE przy identycznym payloadzie,
 * tej samej tożsamości dokumentu i wciąż aktualnej próbie zapisu.
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
        el.html = o.html;
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

/** Payload, który autosave zapisze i wyśle (po allowliście i zdjęciu PII). */
function storedPayload(sandbox: any, overrides: any = {}) {
    const live = sandbox._draftCollectLive('offer_rury');
    return sandbox.window.draftStore.buildDraft({
        userId: 'u1',
        kind: 'offer_rury',
        docId: 'o1',
        payload: { ...live, ...overrides }
    }).payload;
}

function serverDraft(payload: any, version: number, extra: any = {}) {
    return {
        status: 200,
        body: {
            data: {
                kind: 'offer_rury',
                docId: 'o1',
                payload,
                version,
                updatedAt: '2026-10-25T09:00:00.000Z',
                baseVersion: null,
                ...extra
            }
        }
    };
}

function conflict(serverVersion: number, code = 'DRAFT_CONFLICT') {
    return {
        status: code === 'DRAFT_CONFLICT' ? 409 : 428,
        body:
            code === 'DRAFT_CONFLICT'
                ? {
                      code,
                      serverVersion,
                      serverUpdatedAt: '2026-10-25T09:00:00.000Z'
                  }
                : { code: 'DRAFT_PRECONDITION_REQUIRED', serverVersion }
    };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function flushTicks(n = 8) {
    for (let i = 0; i < n; i++) await tick();
}

function modal(sandbox: any) {
    return sandbox.document.getElementById('sok-draft-sync-modal');
}

describe('L2 draftSync — ograniczony self-heal konfliktu', () => {
    it('409 + identyczny payload → meta dogania serwer, push ponowiony, bez modala', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        const payload = storedPayload(sandbox);

        net.queue.push(conflict(5));
        net.queue.push(serverDraft(payload, 5));
        net.queue.push({
            status: 200,
            body: { version: 6, updatedAt: '2026-10-25T11:00:00.000Z' }
        });

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        const methods = net.calls.map((c: any) => c.opts.method);
        expect(methods).toEqual(['PUT', 'GET', 'PUT']);
        expect(net.calls[2].opts.headers['If-Match']).toBe('"5"');
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(6);
        expect(modal(sandbox)).toBeNull();
    });

    it('428 (brak meta) + identyczny payload → meta ustawiona z serwera, bez modala', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        const payload = storedPayload(sandbox);

        net.queue.push(conflict(4, 'DRAFT_PRECONDITION_REQUIRED'));
        net.queue.push(serverDraft(payload, 4));
        net.queue.push({
            status: 200,
            body: { version: 5, updatedAt: '2026-10-25T11:00:00.000Z' }
        });

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        const puts = net.calls.filter((c: any) => c.opts.method === 'PUT');
        expect(puts).toHaveLength(2);
        expect(puts[0].opts.headers['If-Match']).toBeUndefined();
        expect(puts[1].opts.headers['If-Match']).toBe('"4"');
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(5);
        expect(modal(sandbox)).toBeNull();
    });

    it('409 + inna treść serwera → żadnego dogonienia meta, modal, bez nadpisania', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });

        net.queue.push(conflict(5));
        net.queue.push(serverDraft({ fields: { clientName: 'OBCO' }, items: [] }, 5));

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        expect(net.calls.map((c: any) => c.opts.method)).toEqual(['PUT', 'GET']);
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(2);
        expect(modal(sandbox)).not.toBeNull();
        // Modal 409: przyczyna to wersja, nie brak znacznika.
        const html = modal(sandbox).html;
        expect(html).toContain('Draft ma nowszą wersję na serwerze');
    });

    it.each(['server', 'both'])(
        '%s zatrzymuje oczekujący autosave lokalnej treści',
        async (act) => {
            const { sandbox, net, storage, store } = loadCtx();
            dirtyRury(sandbox);
            const sync = sandbox.window.draftSync;
            sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 8 });
            const remote = storedPayload(sandbox, { items: [{ uid: 'rur_1', quantity: 9 }] });
            net.queue.push(conflict(1), serverDraft(remote, 1), serverDraft(remote, 1));
            sandbox._draftWriteKind('offer_rury', true);
            await flushTicks();

            let pendingPush: () => void;
            sandbox.setTimeout = (fn: () => void) => {
                pendingPush = fn;
                return 1;
            };
            sandbox.currentOfferItems = [{ uid: 'rur_1', quantity: 7 }];
            sandbox._draftWriteKind('offer_rury', false);
            const queuedBeforeChoice = pendingPush!;
            const choice = { getAttribute: () => act };
            modal(sandbox).handlers.click({ target: { closest: () => choice } });
            await flushTicks();
            queuedBeforeChoice();
            await flushTicks();

            expect(net.calls.map((call) => call.opts.method)).toEqual(['PUT', 'GET', 'GET']);
            expect(sandbox.currentOfferItems[0].quantity).toBe(9);
            expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(1);
            if (act === 'both') {
                const key = [...store.keys()].find((k) => k.includes('-konflikt-'))!;
                expect(JSON.parse(store.get(key)!).payload.items[0].quantity).toBe(7);
            }
        }
    );

    it('zmiana lokalnego draftu w trakcie pull() → brak dogonienia meta, modal', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        const payload = storedPayload(sandbox);
        const key = sandbox.window.draftStore.buildDraftKey('u1', 'offer_rury', 'o1');

        let releaseGet: any = null;
        const originalFetch = sandbox.fetch;
        sandbox.fetch = async (url: string, opts: any) => {
            if (opts && opts.method === 'GET') {
                net.calls.push({ url, opts });
                return new Promise((resolve) => {
                    releaseGet = () =>
                        resolve({
                            status: 200,
                            ok: true,
                            json: async () => serverDraft(payload, 5).body
                        });
                });
            }
            return originalFetch(url, opts);
        };

        net.queue.push(conflict(5));
        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks(4);
        expect(typeof releaseGet).toBe('function');

        // Użytkownik edytuje dalej, zanim pull wróci: lokalna kopia się zmienia.
        const changed = storedPayload(sandbox, { fields: { clientName: 'ZMIANA' } });
        const envelope = sandbox.window.draftStore.buildDraft({
            userId: 'u1',
            kind: 'offer_rury',
            docId: 'o1',
            payload: changed
        });
        sandbox.window.draftStore.saveDraft(sandbox.window.localStorage, envelope);

        releaseGet();
        await flushTicks();

        const meta = sync.loadMeta(storage, 'u1', 'offer_rury', 'o1');
        expect(meta?.version).toBe(2);
        expect(net.calls.filter((c: any) => c.opts.method === 'PUT')).toHaveLength(1);
        expect(modal(sandbox)).not.toBeNull();
        // Klucz nietknięty przez nieaktualny pull.
        expect(sandbox.window.draftStore.loadDraft(sandbox.window.localStorage, key).status).toBe(
            'ok'
        );
    });

    it('równoległy nowszy zapis w trakcie pull() → meta bez zmian (stara próba)', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        const payload = storedPayload(sandbox);
        const key = sandbox.window.draftStore.buildDraftKey('u1', 'offer_rury', 'o1');

        let releaseGet: any = null;
        const originalFetch = sandbox.fetch;
        sandbox.fetch = async (url: string, opts: any) => {
            if (opts && opts.method === 'GET') {
                net.calls.push({ url, opts });
                return new Promise((resolve) => {
                    releaseGet = () =>
                        resolve({
                            status: 200,
                            ok: true,
                            json: async () => serverDraft(payload, 5).body
                        });
                });
            }
            return originalFetch(url, opts);
        };

        net.queue.push(conflict(5));
        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks(4);
        expect(typeof releaseGet).toBe('function');

        // Nowa próba zapisu trafia do kolejki w trakcie pullu.
        sandbox._draftSyncPending[key] = {
            kind: 'offer_rury',
            docId: 'o1',
            payload: storedPayload(sandbox, { fields: { clientName: 'NOWSZE' } }),
            baseVersion: null
        };

        releaseGet();
        await flushTicks();

        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(2);
        expect(modal(sandbox)).not.toBeNull();
    });

    it('ponowny konflikt po udanym self-heal → tylko jeden pull, modal, bez pętli', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        const payload = storedPayload(sandbox);

        net.queue.push(conflict(5));
        net.queue.push(serverDraft(payload, 5));
        net.queue.push(conflict(7));

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        const methods = net.calls.map((c: any) => c.opts.method);
        expect(methods).toEqual(['PUT', 'GET', 'PUT']);
        expect(methods.filter((m: string) => m === 'GET')).toHaveLength(1);
        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(5);
        expect(modal(sandbox)).not.toBeNull();
    });

    it('serwer zwraca inny docId → brak dogonienia meta (tożsamość dokumentu)', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });
        const payload = storedPayload(sandbox);

        net.queue.push(conflict(5));
        net.queue.push(serverDraft(payload, 5, { docId: 'o2' }));

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(2);
        expect(modal(sandbox)).not.toBeNull();
    });

    it('serwer nie ma draftu w trakcie pull() (404) → brak dogonienia meta', async () => {
        const { sandbox, net, storage } = loadCtx();
        dirtyRury(sandbox);
        const sync = sandbox.window.draftSync;
        sync.saveMeta(storage, 'u1', 'offer_rury', 'o1', { version: 2, updatedAt: null });

        net.queue.push(conflict(5));
        net.queue.push({ status: 404, body: { code: 'DRAFT_NOT_FOUND' } });

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        expect(sync.loadMeta(storage, 'u1', 'offer_rury', 'o1')?.version).toBe(2);
        expect(modal(sandbox)).not.toBeNull();
    });

    it('428 ma własny komunikat (brak znacznika), nie „nowsza wersja"', async () => {
        const { sandbox, net } = loadCtx();
        dirtyRury(sandbox);

        net.queue.push(conflict(4, 'DRAFT_PRECONDITION_REQUIRED'));
        net.queue.push({ status: 404, body: { code: 'DRAFT_NOT_FOUND' } });

        sandbox._draftWriteKind('offer_rury', true);
        await flushTicks();

        const html = modal(sandbox).html;
        expect(html).toContain('Brak znacznika wersji draftu');
        expect(html).not.toContain('Draft ma nowszą wersję na serwerze');
    });
});
