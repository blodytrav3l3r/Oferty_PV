// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* Batch acceptance FE: 1 POST acceptance-batch zamiast N singli + fallback 404. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let calls: { url: string; body: any }[] = [];
let fetchMode: 'ok' | '404' = 'ok';
let store: Record<string, string> = {};

function fetchMock(url: string, opts: any) {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    if (String(url).endsWith('/ai/acceptance-batch')) {
        if (fetchMode === '404') {
            return Promise.resolve({ status: 404, json: () => Promise.reject(new Error('html')) });
        }
        return Promise.resolve({
            status: 200,
            json: () =>
                Promise.resolve({
                    updated: body.items.map((_: any, i: number) => ({
                        index: i,
                        telemetryId: 'u' + i
                    })),
                    duplicates: [],
                    manual: [],
                    eventsCreated: body.items.length,
                    rejected: []
                })
        });
    }
    return Promise.resolve({ status: 200, json: () => Promise.resolve({ success: true }) });
}

function AbortControllerStub(this: any) {
    this.signal = {};
    this.abort = function () {};
}

function loadBridge() {
    calls = [];
    fetchMode = 'ok';
    store = {};
    const sandbox: any = {
        console,
        fetch: fetchMock,
        AbortController: AbortControllerStub,
        setTimeout,
        clearTimeout,
        sessionStorage: {
            getItem: (k: string) => (k in store ? store[k] : null),
            setItem: (k: string, v: string) => {
                store[k] = String(v);
            },
            removeItem: (k: string) => {
                delete store[k];
            }
        },
        window: {
            fetch: fetchMock,
            location: { hostname: 'test' },
            studnieProducts: []
        }
    };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(process.cwd(), 'public/js/studnie/telemetryBridge.js'), 'utf-8'),
        sandbox,
        { filename: 'telemetryBridge.js' }
    );
    return sandbox;
}

function acc(i: number) {
    return {
        telemetryId: 'well_' + i,
        accepted: true,
        offerId: 'o1',
        wellId: 'w' + i,
        warehouse: 'Kluczbork',
        configSnapshot: { dn: '1000', ringCount: 2, warehouse: 'Kluczbork' }
    };
}

function flush(ms = 20) {
    return new Promise((r) => setTimeout(r, ms));
}

describe('telemetry acceptance-batch (FE)', () => {
    test('batch: 1 POST z N items, zero singli', async () => {
        const sb = loadBridge();
        sb.window.telemetryRecordAcceptanceFullBatch([acc(1), acc(2), acc(3)]);
        await flush();
        const posts = calls.filter(
            (c) => c.url.endsWith('/ai/acceptance-batch') && c.body.items.length > 0
        );
        expect(posts).toHaveLength(1);
        expect(posts[0].body.items).toHaveLength(3);
        expect(posts[0].body.items[0].telemetryId).toBe('well_1');
        expect(calls.filter((c) => c.url.endsWith('/ai/acceptance-full'))).toHaveLength(0);
    });

    test('404 na probe → fallback na single', async () => {
        const sb = loadBridge();
        fetchMode = '404';
        sb.window.telemetryRecordAcceptanceFullBatch([acc(1), acc(2)]);
        await flush();
        expect(calls.filter((c) => c.url.endsWith('/ai/acceptance-full'))).toHaveLength(2);
        expect(store['telemetry_acceptbatch_off']).toBe('1');
    });

    test('flaga off → od razu single, bez probe', async () => {
        const sb = loadBridge();
        store['telemetry_acceptbatch_off'] = '1';
        sb.window.telemetryRecordAcceptanceFullBatch([acc(1)]);
        await flush();
        expect(calls.filter((c) => c.url.endsWith('/ai/acceptance-batch'))).toHaveLength(0);
        expect(calls.filter((c) => c.url.endsWith('/ai/acceptance-full'))).toHaveLength(1);
    });

    test('pusto i bez telemetryId → zero fetchy', async () => {
        const sb = loadBridge();
        sb.window.telemetryRecordAcceptanceFullBatch([]);
        sb.window.telemetryRecordAcceptanceFullBatch([{ accepted: true }]);
        await flush();
        expect(calls).toHaveLength(0);
    });

    test('single telemetryRecordAcceptanceFull działa jak dotąd', async () => {
        const sb = loadBridge();
        sb.window.telemetryRecordAcceptanceFull(acc(7));
        await flush();
        const posts = calls.filter((c) => c.url.endsWith('/ai/acceptance-full'));
        expect(posts).toHaveLength(1);
        expect(posts[0].body.telemetryId).toBe('well_7');
        expect(posts[0].body.accepted).toBe(true);
    });
});
