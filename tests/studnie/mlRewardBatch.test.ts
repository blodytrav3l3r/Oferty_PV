import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * sendRewardBatch: O(N/500) sekwencyjnych requestów, filtr _lastAutoTelemetryId,
 * parzystość payloadu ze single sendReward.
 */
describe('mlRewardHooks.sendRewardBatch', () => {
    const readFile = (rel: string) =>
        fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');

    function makeSandbox(captured: Array<{ url: string; body: any }>, reply: any = {}) {
        const sandbox: any = {
            fetch: (url: string, opts: any) => {
                const body = JSON.parse(opts.body);
                captured.push({ url, body });
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        applied: (body.items || []).map((i: any) => i.wellId),
                        duplicates: [],
                        rejected: [],
                        ...reply
                    })
                });
            },
            window: {
                fetch: undefined as any,
                location: { hostname: 'localhost' }
            },
            console: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
            authHeaders: () => ({ 'Content-Type': 'application/json' }),
            getCurrentWell: () => null,
            setTimeout: (fn: any) => {
                if (typeof fn === 'function') fn();
                return 0;
            },
            clearTimeout: () => undefined,
            AbortController,
            JSON,
            Promise
        };
        sandbox.window.fetch = sandbox.fetch;
        vm.createContext(sandbox);
        return sandbox;
    }

    const well = (id: string, withTelemetry = true) => ({
        id,
        dn: '1000',
        configSource: 'AUTO_AI',
        config: [{ productId: 'p1', quantity: 1 }],
        ...(withTelemetry ? { _lastAutoTelemetryId: `tel-${id}` } : {})
    });

    const flush = () => new Promise((r) => setTimeout(r, 10));

    it('1200 studni → 3 requesty; 500 → 1; 501 → 2; 0 → 0', async () => {
        for (const [n, expected] of [
            [1200, 3],
            [500, 1],
            [501, 2]
        ] as Array<[number, number]>) {
            const captured: any[] = [];
            const sandbox = makeSandbox(captured);
            vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);
            const wells = Array.from({ length: n }, (_, i) => well(`w${i}`));
            (sandbox as any).wells = wells;
            vm.runInContext(
                'window.mlRewardHooks.sendRewardBatch(wells, { action: "ACCEPT", eventType: "ORDER_CONFIRMED" })',
                sandbox
            );
            // vm.runInContext nie czeka na Promise cross-context — odczytaj przez flush
            await flush();
            expect(captured.length).toBe(expected);
            expect(captured.every((c) => c.url === '/api/telemetry/ai/reward-batch')).toBe(true);
            expect(captured.every((c) => c.body.items.length <= 500)).toBe(true);
        }

        const captured: any[] = [];
        const sandbox = makeSandbox(captured);
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);
        vm.runInContext('window.mlRewardHooks.sendRewardBatch([], {})', sandbox);
        await flush();
        expect(captured).toHaveLength(0);
    });

    it('filtruje studnie bez _lastAutoTelemetryId (backend i tak dałby 400)', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured);
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);
        const wells = [well('w1'), well('w2', false), well('w3', false)];
        (sandbox as any).wells = wells;
        await vm.runInContext(
            'window.mlRewardHooks.sendRewardBatch(wells, { action: "ACCEPT" })',
            sandbox
        );
        await flush();
        expect(captured).toHaveLength(1);
        expect(captured[0].body.items.map((i: any) => i.wellId)).toEqual(['w1']);
    });

    it('payload batcha parzysty ze single (wellId, action, wasAiRanked)', async () => {
        const captured: any[] = [];
        const sandbox = makeSandbox(captured);
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);
        await vm.runInContext(
            `window.mlRewardHooks.sendRewardBatch(
                [{ id: 'wP', dn: '1200', configSource: 'AUTO_AI', config: [{ productId: 'p1', quantity: 1 }], _lastAutoTelemetryId: 't1' }],
                { action: 'ACCEPT', eventType: 'ORDER_CONFIRMED' }
            )`,
            sandbox
        );
        await flush();
        expect(captured).toHaveLength(1);
        const item = captured[0].body.items[0];
        expect(item).toMatchObject({ action: 'ACCEPT', wellId: 'wP', dn: 1200, wasAiRanked: true });
        expect(item.configSnapshot.eventType).toBe('ORDER_CONFIRMED');
    });
});
