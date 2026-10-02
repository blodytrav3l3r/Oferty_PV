// @ts-nocheck
/* A1: fetchWithRetry429 — kontrakt retry (vm, transform ESM→classic w teście).
 * Plik public/js/shared/fetchJson.js nietknięty — transform tylko tutaj.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

function loadHelper() {
    const raw = fs.readFileSync(path.join(ROOT, 'public', 'js', 'shared', 'fetchJson.js'), 'utf8');
    // Test-only: ESM export nie działa w vm — odkomentuj do classic scope.
    const code = raw.replace(/^export /gm, '');
    const seen: Array<{ url: string; options: any }> = [];
    const queue: Array<any> = [];
    const sandbox: any = {
        window: {},
        setTimeout,
        clearTimeout,
        fetch: async (url: string, options: any) => {
            seen.push({ url, options });
            const next = queue.shift();
            if (next instanceof Error) throw next;
            return next;
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'fetchJson.js' });
    return { fetchWithRetry429: sandbox.fetchWithRetry429, seen, queue };
}

function resp(status: number, retryAfter?: string) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: (k: string) => (k === 'Retry-After' ? (retryAfter ?? null) : null) },
        json: async () => ({})
    };
}

describe('A1 fetchWithRetry429', () => {
    test('200 za pierwszym razem → 1 próba, bez czekania', async () => {
        const { fetchWithRetry429, queue } = loadHelper();
        queue.push(resp(200));
        const out = await fetchWithRetry429('/x', {}, { baseDelayMs: 5 });
        expect(out.res.status).toBe(200);
        expect(out.attempts).toBe(1);
    });

    test('429 → retry z Retry-After (cap w teście), potem 200', async () => {
        const { fetchWithRetry429, queue } = loadHelper();
        queue.push(resp(429, '5'), resp(200));
        const delays: number[] = [];
        const out = await fetchWithRetry429(
            '/x',
            {},
            {
                baseDelayMs: 5,
                capMs: 20,
                onRetry: (_a: number, _s: number, d: number) => delays.push(d)
            }
        );
        expect(out.res.status).toBe(200);
        expect(out.attempts).toBe(2);
        // Retry-After 5s wygrywa z backoffem, cap 20ms ucina w teście.
        expect(delays).toEqual([20]);
    });

    test('ciągły 429 → 3 próby i zwrot ostatniego 429 (nie throw)', async () => {
        const { fetchWithRetry429, queue } = loadHelper();
        queue.push(resp(429), resp(429), resp(429));
        const out = await fetchWithRetry429('/x', {}, { baseDelayMs: 5 });
        expect(out.res.status).toBe(429);
        expect(out.attempts).toBe(3);
    });

    test('500/400 → brak retry (permanentne)', async () => {
        for (const st of [500, 400, 403]) {
            const { fetchWithRetry429, queue, seen } = loadHelper();
            queue.push(resp(st));
            const out = await fetchWithRetry429('/x', {}, { baseDelayMs: 5 });
            expect(out.res.status).toBe(st);
            expect(out.attempts).toBe(1);
            expect(seen).toHaveLength(1);
        }
    });

    test('błąd sieci na GET → retry (bezpieczny)', async () => {
        const { fetchWithRetry429, queue } = loadHelper();
        queue.push(new Error('net down'), resp(200));
        const out = await fetchWithRetry429('/x', { method: 'GET' }, { baseDelayMs: 5 });
        expect(out.res.status).toBe(200);
        expect(out.attempts).toBe(2);
    });

    test('błąd sieci na POST bez klucza → throw od razu (niebezpieczny)', async () => {
        const { fetchWithRetry429, queue } = loadHelper();
        queue.push(new Error('net down'), resp(200));
        await expect(
            fetchWithRetry429('/x', { method: 'POST' }, { baseDelayMs: 5 })
        ).rejects.toThrow('net down');
    });

    test('błąd sieci na POST z Idempotency-Key → retry tym samym body i kluczem', async () => {
        const { fetchWithRetry429, queue, seen } = loadHelper();
        queue.push(new Error('net down'), resp(200));
        const opts = {
            method: 'POST',
            headers: { 'Idempotency-Key': 'k1', 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 200 })
        };
        const out = await fetchWithRetry429('/x', opts, { baseDelayMs: 5 });
        expect(out.res.status).toBe(200);
        expect(out.attempts).toBe(2);
        expect(seen).toHaveLength(2);
        // Opcje BEZ ZMIAN między próbami — ten sam klucz, ten sam payload.
        expect(seen[0].options).toEqual(seen[1].options);
        expect(seen[1].options.body).toBe(JSON.stringify({ count: 200 }));
    });

    test('abort w trakcie backoffu → reject, brak kolejnych prób', async () => {
        const { fetchWithRetry429, queue, seen } = loadHelper();
        queue.push(resp(429), resp(200));
        const ctl = new AbortController();
        setTimeout(() => ctl.abort(), 5);
        await expect(
            fetchWithRetry429('/x', {}, { baseDelayMs: 5000, signal: ctl.signal })
        ).rejects.toThrow();
        expect(seen).toHaveLength(1);
    });
});
