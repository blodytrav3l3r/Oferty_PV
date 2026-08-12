import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny (A1): reward ACCEPT musi być wysyłany PER STUDNIA.
 *
 * Dwa sprzężone błędy:
 * 1. Globalny single-flight (`_rewardInFlight`) gasił legalne nagrody przy
 *    pętlach przez wiele studni (zapis oferty/zamówienia) — tylko 1. studnia
 *    dostawała reward. Naprawa: dedup per wellId (`_rewardInFlightByWell`).
 * 2. `sendReward` brał studnię z `getCurrentWell()` zamiast tej z pętli —
 *    payload wellId/configSnapshot dotyczył złej studni. Naprawa: jawny
 *    `params.well` ma priorytet, `getCurrentWell()` to fallback.
 */
describe('mlRewardHooks — reward ACCEPT per studnia (A1)', () => {
    const readFile = (rel: string) =>
        fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');

    function makeSandbox(captured: Array<{ url: string; body: any }>, currentWell: any) {
        const sandbox: any = {
            fetch: (url: string, opts: any) => {
                captured.push({ url, body: JSON.parse(opts.body) });
                return Promise.resolve({ ok: true, status: 200 });
            },
            window: {
                fetch: (url: string, opts: any) => {
                    captured.push({ url, body: JSON.parse(opts.body) });
                    return Promise.resolve({ ok: true, status: 200 });
                },
                location: { hostname: 'localhost' }
            },
            console: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
            authHeaders: () => ({ 'Content-Type': 'application/json' }),
            getCurrentWell: () => currentWell,
            setTimeout: () => 0,
            clearTimeout: () => undefined,
            AbortController,
            JSON,
            Promise
        };
        vm.createContext(sandbox);
        return sandbox;
    }

    const well = (id: string) => ({
        id,
        dn: '1000',
        wellHeight: 3000,
        type: 'betonowa',
        magazyn: 'M1',
        configSource: 'AUTO_AI',
        config: [{ productId: 'p1', quantity: 2 }]
    });

    const flush = () => Promise.resolve().then(() => Promise.resolve());

    it('payload wellId = studnia z params.well, nie z getCurrentWell', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured, well('wB'));
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wA', dn: '1000' } })",
            sandbox
        );
        await flush();

        expect(captured).toHaveLength(1);
        expect(captured[0].url).toBe('/api/telemetry/ai/reward');
        expect(captured[0].body.wellId).toBe('wA');
    });

    it('dwie studnie pod rząd → 2 requesty o różnych wellId (regresja globalnego single-flight)', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured, well('wB'));
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wA', dn: '1000' } })",
            sandbox
        );
        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wC', dn: '1200' } })",
            sandbox
        );
        await flush();

        expect(captured).toHaveLength(2);
        const wellIds = captured.map((c) => c.body.wellId).sort();
        expect(wellIds).toEqual(['wA', 'wC']);
    });

    it('ta sama studnia dwukrotnie w locie → tylko 1 request (dedup per wellId)', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured, well('wB'));
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wD', dn: '1000' } })",
            sandbox
        );
        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wD', dn: '1000' } })",
            sandbox
        );
        await flush();

        expect(captured).toHaveLength(1);
        expect(captured[0].body.wellId).toBe('wD');
    });

    it('wasAiRanked jawnie przekazane do payloadu', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured, well('wB'));
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        vm.runInContext(
            "window.mlRewardHooks.onWellAccepted({ well: { id: 'wE', dn: '1000' }, wasAiRanked: false })",
            sandbox
        );
        await flush();

        expect(captured).toHaveLength(1);
        expect(captured[0].body.wasAiRanked).toBe(false);
    });

    it('bez params.well → fallback do getCurrentWell (regresja)', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured, well('wB'));
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        vm.runInContext('window.mlRewardHooks.sendReward({ action: "ACCEPT" })', sandbox);
        await flush();

        expect(captured).toHaveLength(1);
        expect(captured[0].body.wellId).toBe('wB');
    });
});
