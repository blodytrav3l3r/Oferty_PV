// @ts-nocheck
/* D-008: single-claim PZ ze stabilnym Idempotency-Key (vm, pliki nietknięte).
 * - retry po błędzie sieci / 429 niesie TEN SAM klucz → 1 reserve, ten sam numer;
 * - double-submit tej samej intencji → 1 numer (ten sam klucz);
 * - klucz deterministyczny ze scopeId+userId, inna intencja = inny klucz.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function resp(status: number) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: (_k: string) => null },
        json: async () => ({})
    };
}

function respNumber(number: string) {
    return {
        status: 200,
        ok: true,
        headers: { get: (_k: string) => null },
        json: async () => ({ number })
    };
}

function respReuse() {
    return {
        status: 409,
        ok: false,
        headers: { get: (_k: string) => null },
        json: async () => ({
            error: 'Klucz idempotencji użyty z innym payloadem',
            code: 'IDEMPOTENCY_KEY_REUSE'
        })
    };
}

function loadClaim() {
    const fetchJsonRaw = fs
        .readFileSync(path.join(ROOT, 'public', 'js', 'shared', 'fetchJson.js'), 'utf8')
        .replace(/^export /gm, '');
    const helpersRaw = fs.readFileSync(
        path.join(ROOT, 'public', 'js', 'studnie', 'orderZleceniaHelpers.js'),
        'utf8'
    );
    const seen: Array<{ url: string; options: any }> = [];
    const failQueue: Array<'net' | number> = [];
    // Idempotentny serwer-mock: 1 reserve per klucz, replay tego samego numeru.
    let reserves = 0;
    const store = new Map<string, { body: unknown; number: string }>();
    const sandbox: any = {
        setTimeout,
        clearTimeout,
        authHeaders: () => ({}),
        fetch: async (url: string, options: any) => {
            seen.push({ url, options });
            const fail = failQueue.shift();
            if (fail === 'net') throw new Error('net down');
            if (typeof fail === 'number') return resp(fail);
            const key = options.headers['Idempotency-Key'];
            const body = options.body ?? '';
            if (store.has(key)) {
                const e = store.get(key)!;
                if (e.body !== body) return respReuse();
                return respNumber(e.number);
            }
            reserves += 1;
            const number = 'TT/L/' + String(reserves).padStart(5, '0') + '/26';
            store.set(key, { body, number });
            return respNumber(number);
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fetchJsonRaw, sandbox, { filename: 'fetchJson.js' });
    vm.runInContext(helpersRaw, sandbox, { filename: 'orderZleceniaHelpers.js' });
    return {
        claimSingleProductionNumber: sandbox.claimSingleProductionNumber,
        singleProductionClaimKey: sandbox.singleProductionClaimKey,
        seen,
        failQueue,
        getReserves: () => reserves
    };
}

describe('D-008 single-claim idempotency (frontend)', () => {
    test('retry po błędzie sieci niesie ten sam klucz → 1 reserve, ten sam numer', async () => {
        const ctx = loadClaim();
        ctx.failQueue.push('net');
        const res = await ctx.claimSingleProductionNumber('u1', 'po-1');
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.number).toBe('TT/L/00001/26');
        expect(ctx.getReserves()).toBe(1);
        expect(ctx.seen).toHaveLength(2);
        const k0 = ctx.seen[0].options.headers['Idempotency-Key'];
        const k1 = ctx.seen[1].options.headers['Idempotency-Key'];
        expect(k0).toBe(ctx.singleProductionClaimKey('po-1', 'u1'));
        // Retry BEZ ZMIAN opcji — ten sam klucz, ten sam (pusty) payload.
        expect(k1).toBe(k0);
        expect(ctx.seen[1].options).toEqual(ctx.seen[0].options);
    });

    test('retry po 429 niesie ten sam klucz → 1 reserve', async () => {
        const ctx = loadClaim();
        ctx.failQueue.push(429);
        const res = await ctx.claimSingleProductionNumber('u1', 'po-2');
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.number).toBe('TT/L/00001/26');
        expect(ctx.getReserves()).toBe(1);
        expect(ctx.seen).toHaveLength(2);
        expect(ctx.seen[1].options.headers['Idempotency-Key']).toBe(
            ctx.seen[0].options.headers['Idempotency-Key']
        );
    });

    test('double-submit tej samej intencji → 1 numer, 1 reserve', async () => {
        const ctx = loadClaim();
        const [r1, r2] = await Promise.all([
            ctx.claimSingleProductionNumber('u1', 'po-9'),
            ctx.claimSingleProductionNumber('u1', 'po-9')
        ]);
        const d1 = await r1.json();
        const d2 = await r2.json();
        expect(d1.number).toBe(d2.number);
        expect(ctx.getReserves()).toBe(1);
    });

    test('klucz deterministyczny: ten sam scope+user, inny scope/user → inny klucz', async () => {
        const ctx = loadClaim();
        expect(ctx.singleProductionClaimKey('po-1', 'u1')).toBe(
            ctx.singleProductionClaimKey('po-1', 'u1')
        );
        expect(ctx.singleProductionClaimKey('po-2', 'u1')).not.toBe(
            ctx.singleProductionClaimKey('po-1', 'u1')
        );
        expect(ctx.singleProductionClaimKey('po-1', 'u2')).not.toBe(
            ctx.singleProductionClaimKey('po-1', 'u1')
        );
        // Limit nagłówka serwera (128 znaków, idempotency.ts).
        expect(ctx.singleProductionClaimKey('x'.repeat(200), 'y'.repeat(200)).length).toBeLessThan(
            128
        );
    });
});
