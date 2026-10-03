// @ts-nocheck
/* D-015: _saveProductionChunk przez wspólny fetchWithRetry429 (vm, pliki nietknięte).
 * - 429 → retry tym samym body → 200 (kontrakt zwrotu: body.saved);
 * - 500/400 → brak retry (throw z body.error, kontrakt jak dotąd);
 * - ciągły 429 → granice helpera (3 próby, potem throw kontraktu — helper
 *   zwraca ostatni 429 bez throw, chunk rzuca jak przy każdym !ok);
 * - noRetry → 1 próba (maxAttempts: 1).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function resp(status: number, payload: any = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: (_k: string) => null },
        json: async () => payload
    };
}

function loadChunk() {
    const fetchJsonRaw = fs
        .readFileSync(path.join(ROOT, 'public', 'js', 'shared', 'fetchJson.js'), 'utf8')
        .replace(/^export /gm, '');
    const dataRaw = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'studnie', 'orderZleceniaData.js'),
        'utf8'
    );
    const seen: Array<{ url: string; options: any }> = [];
    const delays: number[] = [];
    const queue: Array<any> = [];
    const errors: any[] = [];
    const sandbox: any = {
        console,
        // Natychmiastowy timer: backlog helpera (1s→2s) to kontrakt fetchJson
        // (kryty w fetchRetry429.test.ts) — tu liczą się próby i payload.
        setTimeout: (fn: any, ms: number) => {
            delays.push(ms);
            fn();
            return 0;
        },
        clearTimeout: () => {},
        authHeaders: () => ({ 'Content-Type': 'application/json' }),
        logger: {
            debug() {},
            info() {},
            warn() {},
            error: (a: any, b: any, e: any) => errors.push(e)
        },
        productionOrders: [],
        fetch: async (url: string, options: any) => {
            seen.push({ url, options });
            const next = queue.shift();
            if (next instanceof Error) throw next;
            return next;
        }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fetchJsonRaw, sandbox, { filename: 'fetchJson.js' });
    vm.runInContext(dataRaw, sandbox, { filename: 'orderZleceniaData.js' });
    return { saveChunk: sandbox._saveProductionChunk, seen, delays, queue, errors };
}

const CHUNK = [{ id: 'po-1', wellId: 'w1' }];
const SAVED = [{ id: 'po-1', version: 7 }];

describe('D-015 _saveProductionChunk przez fetchWithRetry429', () => {
    test('429 → 1 retry tym samym body → 200 (zwrot body.saved)', async () => {
        const ctx = loadChunk();
        ctx.queue.push(resp(429), resp(200, { saved: SAVED }));
        const out = await ctx.saveChunk(CHUNK);
        expect(out).toEqual(SAVED);
        expect(ctx.seen).toHaveLength(2);
        expect(ctx.seen[0].url).toBe('/api/orders-studnie/production');
        expect(ctx.seen[0].options.method).toBe('PUT');
        // Retry BEZ ZMIAN opcji — ten sam payload (klucz: brak, jak dotąd).
        expect(ctx.seen[1].options.body).toBe(ctx.seen[0].options.body);
        expect(JSON.parse(ctx.seen[0].options.body)).toEqual({ data: CHUNK });
        expect(ctx.delays).toHaveLength(1);
    });

    test('500/400 → brak retry (throw z body.error)', async () => {
        for (const st of [500, 400]) {
            const ctx = loadChunk();
            ctx.queue.push(resp(st, { error: 'boom-' + st }));
            await expect(ctx.saveChunk(CHUNK)).rejects.toThrow('boom-' + st);
            expect(ctx.seen).toHaveLength(1);
        }
    });

    test('ciągły 429 → 3 próby (granica helpera), potem throw kontraktu', async () => {
        const ctx = loadChunk();
        ctx.queue.push(resp(429), resp(429), resp(429, { error: 'limit' }));
        await expect(ctx.saveChunk(CHUNK)).rejects.toThrow('limit');
        expect(ctx.seen).toHaveLength(3);
        expect(ctx.delays).toHaveLength(2);
    });

    test('noRetry → 429 bez retry (1 próba)', async () => {
        const ctx = loadChunk();
        ctx.queue.push(resp(429, { error: 'limit' }), resp(200, { saved: SAVED }));
        await expect(ctx.saveChunk(CHUNK, true)).rejects.toThrow('limit');
        expect(ctx.seen).toHaveLength(1);
    });
});
