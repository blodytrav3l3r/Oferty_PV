// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/* Batch telemetry FE: 1 POST config-batch zamiast N singli + fallback 404. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let calls: { url: string; body: any }[] = [];
let fetchMode: 'ok' | '404' | 'badbody' = 'ok';
let store: Record<string, string> = {};

function fetchMock(url: string, opts: any) {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    if (String(url).endsWith('/ai/config-batch')) {
        if (fetchMode === '404') {
            return Promise.resolve({ status: 404, json: () => Promise.reject(new Error('html')) });
        }
        if (fetchMode === 'badbody') {
            return Promise.resolve({ status: 200, json: () => Promise.resolve({ error: 'x' }) });
        }
        return Promise.resolve({
            status: 200,
            json: () =>
                Promise.resolve({
                    created: body.items.map((_: any, i: number) => ({
                        index: i,
                        telemetryId: 't' + i
                    })),
                    duplicates: [],
                    rejected: []
                })
        });
    }
    return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ telemetryId: 'single-1' })
    });
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
            studnieProducts: [
                {
                    id: 'P1',
                    name: 'Krag',
                    componentType: 'krag',
                    dn: '1000',
                    height: 500,
                    price: '540',
                    weight: '100'
                }
            ]
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

function well(id: string, src: string) {
    return {
        id,
        dn: '1000',
        rzednaWlazu: 5,
        rzednaDna: 0,
        mag: 'Kluczbork',
        config: [{ productId: 'P1', quantity: 1 }],
        configSource: src
    };
}

function opts(w: any) {
    return { well: w, configItems: w.config, solverSource: w.configSource };
}

function flush(ms = 20) {
    return new Promise((r) => setTimeout(r, ms));
}

describe('telemetry config-batch (FE)', () => {
    test('batch: 1 POST z N items + chain _lastAutoTelemetryId', async () => {
        const sb = loadBridge();
        const w1 = well('w1', 'AUTO_JS');
        const w2 = well('w2', 'MANUAL');
        sb.window.telemetryRecordConfigBatch([opts(w1), opts(w2)]);
        await flush();
        const posts = calls.filter(
            (c) => c.url.endsWith('/ai/config-batch') && c.body.items.length > 0
        );
        expect(posts).toHaveLength(1);
        expect(posts[0].body.items).toHaveLength(2);
        expect(calls.filter((c) => c.url.endsWith('/ai/config'))).toHaveLength(0);
        expect(w1._lastAutoTelemetryId).toBe('t0');
        expect(w2._lastAutoTelemetryId).toBeUndefined();
    });

    test('404 → fallback na single (chain z singla)', async () => {
        const sb = loadBridge();
        fetchMode = '404';
        const w1 = well('w1', 'AUTO_JS');
        sb.window.telemetryRecordConfigBatch([opts(w1)]);
        await flush();
        expect(calls.filter((c) => c.url.endsWith('/ai/config-batch'))).toHaveLength(1);
        expect(calls.filter((c) => c.url.endsWith('/ai/config'))).toHaveLength(1);
        expect(w1._lastAutoTelemetryId).toBe('single-1');
    });

    test('odpowiedź bez created/duplicates → fallback na single', async () => {
        const sb = loadBridge();
        fetchMode = 'badbody';
        const w1 = well('w1', 'AUTO_JS');
        sb.window.telemetryRecordConfigBatch([opts(w1)]);
        await flush();
        expect(calls.filter((c) => c.url.endsWith('/ai/config-batch'))).toHaveLength(1);
        expect(calls.filter((c) => c.url.endsWith('/ai/config'))).toHaveLength(1);
    });

    test('pusto → zero fetchy', async () => {
        const sb = loadBridge();
        sb.window.telemetryRecordConfigBatch([]);
        await flush();
        expect(calls).toHaveLength(0);
    });

    test('single telemetryRecordConfig działa jak dotąd (chain + payload)', async () => {
        const sb = loadBridge();
        const w1 = well('w1', 'AUTO_JS');
        sb.window.telemetryRecordConfig(opts(w1));
        await flush();
        const posts = calls.filter((c) => c.url.endsWith('/ai/config'));
        expect(posts).toHaveLength(1);
        expect(posts[0].body.solverSource).toBe('AUTO_JS');
        expect(posts[0].body.wellId).toBe('w1');
        expect(w1._lastAutoTelemetryId).toBe('single-1');
    });
});
