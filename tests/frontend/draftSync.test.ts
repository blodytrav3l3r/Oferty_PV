// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L2: klient synchronizacji draftu z serwerem.
 *
 * Testy pilnują kontraktu, którego złamanie = cicha utrata pracy:
 * - brak `If-Match` tylko przy pierwszym zapisie (nadpisanie wymaga CAS),
 * - 409/412 NIE nadpisują serwera i nie ruszają meta,
 * - payload > 256 KB nie leci do sieci (jawny status, nie fałszywe ok),
 * - wyjście z karty > 64 KB jest jawnie pomijane (keepalive),
 * - błąd sieci nie zmienia meta ani payloadu (offline-first).
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
        _map: m
    };
}

function loadSync() {
    const sandbox: any = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftSync.js'), sandbox, { filename: 'draftSync.js' });
    return sandbox.window.draftSync;
}

function loadStore() {
    const sandbox: any = { window: {}, console, URL };
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    return sandbox.window.draftStore;
}

/** Kolejka odpowiedzi: każdy wpis = {status, body} albo Error (błąd sieci). */
function fakeFetch(queue: any[]) {
    const calls: any[] = [];
    const fn = async (url: string, opts: any) => {
        calls.push({ url, opts });
        const next = queue.shift();
        if (next instanceof Error) throw next;
        if (!next) throw new Error('brak zaplanowanej odpowiedzi');
        return {
            status: next.status,
            ok: next.status >= 200 && next.status < 300,
            json: async () => next.body
        };
    };
    return { fn, calls };
}

const USER = 'user-a';
const KIND = 'offer_rury';
const DOC = 'LR2';

describe('draftSync — rozmiar payloadu', () => {
    test('liczy bajty UTF-8 tak samo jak Buffer (polskie znaki i emoji)', () => {
        const sync = loadSync();
        const samples = ['ascii', 'zażółć gęślą jaźń', '😀 studnia', 'a'.repeat(1000)];
        for (const s of samples) {
            expect(sync.payloadBytes({ s })).toBe(Buffer.byteLength(JSON.stringify({ s }), 'utf8'));
        }
    });

    test('payload nieserializowalny → null (nie fałszywe 0)', () => {
        const sync = loadSync();
        const cyclic: any = {};
        cyclic.self = cyclic;
        expect(sync.payloadBytes(cyclic)).toBeNull();
    });
});

describe('draftSync.push — CAS', () => {
    test('pierwszy zapis bez meta → brak If-Match, meta zapisana z wersji odpowiedzi', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const { fn, calls } = fakeFetch([
            { status: 200, body: { version: 1, updatedAt: '2026-10-25T10:00:00.000Z', bytes: 20 } }
        ]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { number: '1' } },
            baseVersion: 7,
            fetchImpl: fn
        });
        expect(res.status).toBe('ok');
        expect(res.version).toBe(1);
        expect(calls).toHaveLength(1);
        expect(calls[0].opts.method).toBe('PUT');
        expect(calls[0].opts.headers['If-Match']).toBeUndefined();
        expect(calls[0].url).toBe('/api/drafts/offer_rury/LR2');
        expect(JSON.parse(calls[0].opts.body).baseVersion).toBe(7);
        expect(sync.loadMeta(storage, USER, KIND, DOC)).toEqual({
            version: 1,
            updatedAt: '2026-10-25T10:00:00.000Z'
        });
    });

    test('kolejny zapis wysyła If-Match z wersji meta i podbija meta', async () => {
        const sync = loadSync();
        const storage = memStorage();
        sync.saveMeta(storage, USER, KIND, DOC, { version: 4, updatedAt: null });
        const { fn, calls } = fakeFetch([
            { status: 200, body: { version: 5, updatedAt: '2026-10-25T11:00:00.000Z', bytes: 20 } }
        ]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('ok');
        expect(calls[0].opts.headers['If-Match']).toBe('"4"');
        expect(sync.loadMeta(storage, USER, KIND, DOC)?.version).toBe(5);
    });

    test('409 DRAFT_CONFLICT → status conflict, meta nietknięta (brak cichego nadpisania)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        sync.saveMeta(storage, USER, KIND, DOC, { version: 2 });
        const { fn } = fakeFetch([
            {
                status: 409,
                body: {
                    code: 'DRAFT_CONFLICT',
                    serverVersion: 3,
                    serverUpdatedAt: '2026-10-25T12:00:00.000Z'
                }
            }
        ]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('conflict');
        expect(res.serverVersion).toBe(3);
        expect(res.serverUpdatedAt).toBe('2026-10-25T12:00:00.000Z');
        expect(sync.loadMeta(storage, USER, KIND, DOC)?.version).toBe(2);
    });

    test('412 (draft istnieje, brak meta) → conflict precondition_required', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const { fn } = fakeFetch([
            { status: 412, body: { code: 'DRAFT_PRECONDITION_REQUIRED', serverVersion: 6 } }
        ]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('conflict');
        expect(res.reason).toBe('precondition_required');
        expect(res.serverVersion).toBe(6);
        expect(sync.loadMeta(storage, USER, KIND, DOC)).toBeNull();
    });

    test('413 → too_large z limitem serwera', async () => {
        const sync = loadSync();
        const { fn } = fakeFetch([
            { status: 413, body: { code: 'DRAFT_TOO_LARGE', bytes: 300000, limit: 262144 } }
        ]);
        const res = await sync.push({
            storage: memStorage(),
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('too_large');
        expect(res.limit).toBe(262144);
    });

    test('409 DRAFT_LIMIT → limit z licznikiem', async () => {
        const sync = loadSync();
        const { fn } = fakeFetch([
            { status: 409, body: { code: 'DRAFT_LIMIT', count: 50, limit: 50 } }
        ]);
        const res = await sync.push({
            storage: memStorage(),
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('limit');
        expect(res.count).toBe(50);
    });

    test('401 → forbidden (sesja wygasła, bez retry i bez zmiany meta)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const { fn } = fakeFetch([{ status: 401, body: { error: 'x' } }]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('forbidden');
        expect(sync.loadMeta(storage, USER, KIND, DOC)).toBeNull();
    });

    test('błąd sieci → offline, meta nietknięta (zapis lokalny rządzi)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        sync.saveMeta(storage, USER, KIND, DOC, { version: 9 });
        const { fn } = fakeFetch([new Error('ECONNRESET')]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('offline');
        expect(sync.loadMeta(storage, USER, KIND, DOC)?.version).toBe(9);
    });
});

describe('draftSync.push — limity i wyjście z karty', () => {
    test('payload > 256 KB nie leci do sieci (jawny too_large)', async () => {
        const sync = loadSync();
        const { fn, calls } = fakeFetch([]);
        const res = await sync.push({
            storage: memStorage(),
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { filler: 'x'.repeat(257 * 1024) } },
            fetchImpl: fn
        });
        expect(res.status).toBe('too_large');
        expect(calls).toHaveLength(0);
    });

    test('keepalive: payload > 64 KB jawnie pominięty, bez żądania', async () => {
        const sync = loadSync();
        const { fn, calls } = fakeFetch([]);
        const res = await sync.push({
            storage: memStorage(),
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { filler: 'x'.repeat(70 * 1024) } },
            fetchImpl: fn,
            keepalive: true
        });
        expect(res.status).toBe('skipped_keepalive');
        expect(calls).toHaveLength(0);
    });

    test('keepalive: payload ≤ 64 KB leci z keepalive i CAS', async () => {
        const sync = loadSync();
        const storage = memStorage();
        sync.saveMeta(storage, USER, KIND, DOC, { version: 3 });
        const { fn, calls } = fakeFetch([
            { status: 200, body: { version: 4, updatedAt: '2026-10-25T13:00:00.000Z' } }
        ]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { filler: 'x'.repeat(1000) } },
            fetchImpl: fn,
            keepalive: true
        });
        expect(res.status).toBe('ok');
        expect(calls[0].opts.keepalive).toBe(true);
        expect(calls[0].opts.headers['If-Match']).toBe('"3"');
    });

    test('uszkodzone meta traktowane jak brak meta (bez If-Match, nie ciche nadpisanie)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const key = sync.metaKey(USER, KIND, DOC);
        storage.setItem(key, '{nie-json');
        const { fn, calls } = fakeFetch([{ status: 412, body: { serverVersion: 2 } }]);
        const res = await sync.push({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(calls[0].opts.headers['If-Match']).toBeUndefined();
        expect(res.status).toBe('conflict');
    });
});

describe('draftSync.resolveConflict — trzy jawne wybory', () => {
    test('server: pobiera payload serwera i ustawia meta na jego wersję', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const { fn } = fakeFetch([
            {
                status: 200,
                body: {
                    data: {
                        kind: KIND,
                        docId: DOC,
                        payload: { fields: { number: 'S' } },
                        version: 8,
                        updatedAt: '2026-10-25T14:00:00.000Z',
                        baseVersion: 2
                    }
                }
            }
        ]);
        const res = await sync.resolveConflict({
            choice: 'server',
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            fetchImpl: fn
        });
        expect(res.status).toBe('ok');
        expect(res.payload.fields.number).toBe('S');
        expect(sync.loadMeta(storage, USER, KIND, DOC)?.version).toBe(8);
    });

    test('local: wysyła lokalny z If-Match na wersję serwera (nadpisanie świadome)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        const { fn, calls } = fakeFetch([
            { status: 200, body: { version: 9, updatedAt: '2026-10-25T15:00:00.000Z' } }
        ]);
        const res = await sync.resolveConflict({
            choice: 'local',
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { number: 'L' } },
            serverVersion: 8,
            fetchImpl: fn
        });
        expect(res.status).toBe('ok');
        expect(calls[0].opts.headers['If-Match']).toBe('"8"');
        expect(JSON.parse(calls[0].opts.body).payload.fields.number).toBe('L');
    });

    test('both: zapisuje kopię konfliktu lokalnie i oddaje payload serwera', async () => {
        const sync = loadSync();
        const store = loadStore();
        const storage = memStorage();
        const { fn } = fakeFetch([
            {
                status: 200,
                body: {
                    data: {
                        kind: KIND,
                        docId: DOC,
                        payload: { fields: { number: 'S' } },
                        version: 3,
                        updatedAt: '2026-10-25T16:00:00.000Z'
                    }
                }
            }
        ]);
        const res = await sync.resolveConflict({
            choice: 'both',
            storage,
            draftStore: store,
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: { number: 'L' } },
            fetchImpl: fn,
            now: 1700000000000
        });
        expect(res.status).toBe('ok');
        expect(res.payload.fields.number).toBe('S');
        expect(res.conflictCopyDocId).toBe('LR2-konflikt-1700000000000');
        const copy = store.loadDraft(storage, res.conflictCopyKey, { now: 1700000000000 });
        expect(copy.status).toBe('ok');
        expect(copy.draft.payload.fields.number).toBe('L');
        // Kopia nie jest draftem dokumentu → brak meta serwerowej dla kopii.
        expect(sync.loadMeta(storage, USER, KIND, 'LR2-konflikt-1700000000000')).toBeNull();
    });

    test('brak wersji serwera przy wyborze local → jawny błąd, zero żądań', async () => {
        const sync = loadSync();
        const { fn, calls } = fakeFetch([]);
        const res = await sync.resolveConflict({
            choice: 'local',
            storage: memStorage(),
            userId: USER,
            kind: KIND,
            docId: DOC,
            payload: { fields: {} },
            fetchImpl: fn
        });
        expect(res.status).toBe('error');
        expect(res.reason).toBe('no_server_version');
        expect(calls).toHaveLength(0);
    });

    test('nieznany wybór → invalid_choice (żadnego domyślnego zachowania)', async () => {
        const sync = loadSync();
        const res = await sync.resolveConflict({ choice: 'auto-merge' });
        expect(res.status).toBe('invalid_choice');
    });
});

describe('draftSync — list, remove, meta', () => {
    test('list zwraca metadane draftów', async () => {
        const sync = loadSync();
        const { fn } = fakeFetch([
            {
                status: 200,
                body: {
                    data: [
                        {
                            kind: KIND,
                            docId: 'A',
                            version: 2,
                            bytes: 10,
                            updatedAt: '2026-10-25T10:00:00.000Z',
                            expiresAt: '2026-11-24T10:00:00.000Z',
                            baseVersion: null
                        }
                    ]
                }
            }
        ]);
        const res = await sync.list({ fetchImpl: fn });
        expect(res.status).toBe('ok');
        expect(res.items).toHaveLength(1);
        expect(res.items[0].docId).toBe('A');
    });

    test('remove czyści meta także przy błędzie sieci (draft i tak ma zniknąć lokalnie)', async () => {
        const sync = loadSync();
        const storage = memStorage();
        sync.saveMeta(storage, USER, KIND, DOC, { version: 1 });
        const { fn } = fakeFetch([new Error('offline')]);
        const ok = await sync.remove({
            storage,
            userId: USER,
            kind: KIND,
            docId: DOC,
            fetchImpl: fn
        });
        expect(ok).toBe(false);
        expect(sync.loadMeta(storage, USER, KIND, DOC)).toBeNull();
    });

    test('metaKey normalizuje niebezpieczne znaki i nie koliduje między userami', () => {
        const sync = loadSync();
        const a = sync.metaKey('user/a', KIND, 'x y');
        const b = sync.metaKey('user_a', KIND, 'x_y');
        expect(a).toBe(b);
        expect(sync.metaKey('', KIND, DOC)).toBeNull();
    });
});
