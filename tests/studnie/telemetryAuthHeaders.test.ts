import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Test regresyjny (H1): wszystkie fetch'e AI/ML muszą wysyłać nagłówki
 * autoryzacji (authHeaders). Bez X-Auth-Token backend zwraca 401 →
 * telemetria/nagrody cicho giną, a ml-status raportuje AI offline
 * (ta sama klasa błędu co loadStudnieProductsAuth).
 */
describe('AI/ML fetch — nagłówki autoryzacji (H1)', () => {
    const readFile = (rel: string) =>
        fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');

    function baseSandbox(captured: any) {
        const sandbox: any = {
            fetch: (url: string, opts: any) => {
                captured.url = url;
                captured.headers = opts && opts.headers;
                return Promise.resolve({ ok: true, status: 200 });
            },
            window: {
                fetch: (url: string, opts: any) => {
                    captured.url = url;
                    captured.headers = opts && opts.headers;
                    return Promise.resolve({ ok: true, status: 200 });
                },
                location: { hostname: 'localhost' }
            },
            console: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
            authHeaders: () => ({
                'Content-Type': 'application/json',
                'X-Auth-Token': 'test-token-456'
            }),
            setTimeout: () => 0,
            clearTimeout: () => undefined,
            AbortController,
            Map,
            JSON,
            Promise
        };
        vm.createContext(sandbox);
        return sandbox;
    }

    it('telemetryBridge.safeFetch (POST /ai/config) wysyła X-Auth-Token', () => {
        const captured: any = {};
        const sandbox = baseSandbox(captured);
        sandbox.window.studnieProducts = [];
        vm.runInContext(readFile('studnie/telemetryBridge.js'), sandbox);

        return Promise.resolve().then(() => {
            vm.runInContext(
                "window.telemetryRecordEvent({ eventType: 'TEST', wellId: 'w1' })",
                sandbox
            );
            expect(captured.url).toBe('/api/telemetry/ai/event');
            expect(captured.headers).toMatchObject({ 'X-Auth-Token': 'test-token-456' });
        });
    });

    it('mlRewardHooks.sendReward (POST /ai/reward) wysyła X-Auth-Token', () => {
        const captured: any = {};
        const sandbox = baseSandbox(captured);
        sandbox.getCurrentWell = () => ({ id: 'w1', dn: '1000', config: [] });
        vm.runInContext(readFile('studnie/mlRewardHooks.js'), sandbox);

        return Promise.resolve().then(() => {
            vm.runInContext("window.mlRewardHooks.sendReward({ action: 'ACCEPT' })", sandbox);
            expect(captured.url).toBe('/api/telemetry/ai/reward');
            expect(captured.headers).toMatchObject({ 'X-Auth-Token': 'test-token-456' });
        });
    });

    it('każdy fetch w 5 plikach H1 zawiera authHeaders()', () => {
        // Stałe URL, których fetch'e muszą wysyłać authHeaders (były bez — bug H1)
        const targets: Array<{ file: string; url: string }> = [
            { file: 'studnie/telemetryBridge.js', url: 'TELEMETRY_URL' },
            { file: 'studnie/telemetryBridge.js', url: 'EVENT_URL' },
            { file: 'studnie/mlDualRanking.js', url: 'ML_STATUS_URL' },
            { file: 'studnie/mlDualRanking.js', url: 'SETTINGS_URL' },
            { file: 'studnie/mlDualRanking.js', url: 'BATCH_PREDICT_URL' },
            { file: 'studnie/mlRewardHooks.js', url: 'REWARD_URL' },
            { file: 'aiStatusIndicator.js', url: 'STATUS_URL' },
            { file: 'aiStatusIndicator.js', url: 'KNOWLEDGE_URL' },
            { file: 'shared/fetchJson.js', url: 'export async function fetchJson' }
        ];
        for (const { file, url } of targets) {
            const src = readFile(file);
            expect(src).toContain(url);
            expect(src).toMatch(/authHeaders/);
        }
    });
});
