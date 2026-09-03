import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Testy P0 race (nieblokujący AI ranking).
 * Kontrakt: `slow AI never blocks rankCandidates and cannot mutate committed
 * technical decision` — latency (< budżet+slack) ORAZ brak późniejszego
 * wpływu AI na decyzję (invarianty 1–4 planu P0).
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeProduct(
    id: string,
    price: number,
    weight: number,
    componentType: string,
    dn: string,
    height: number
): any {
    return {
        id,
        name: 'Produkt ' + id,
        price,
        weight,
        componentType,
        dn,
        height
    };
}

const PRODUCTS = [
    makeProduct('KDB-1000-500', 100, 50, 'krag', '1000', 500),
    makeProduct('KDZ-1000-500', 120, 60, 'krag_ot', '1000', 500),
    makeProduct('DDD-1000-500', 200, 100, 'dennica', '1000', 500)
];

function makeSolution(ringIds: string[]): any {
    return {
        kregItems: ringIds.map((id: string) => ({ productId: id, quantity: 1 })),
        topItems: [],
        avrItems: [],
        dennica: { productId: 'DDD-1000-500', quantity: 1 }
    };
}

function makeWell(): any {
    return {
        id: 'well_race_1',
        dn: '1000',
        wellHeight: 2000,
        magazyn: 'Kluczbork',
        warehouse: 'KLB',
        type: 'standard',
        uszczelka: 'brak',
        kineta: ''
    };
}

function makeCandidates() {
    return [
        { id: 0, solution: makeSolution(['KDB-1000-500']), technicalScore: 10 },
        { id: 1, solution: makeSolution(['KDB-1000-500', 'KDZ-1000-500']), technicalScore: 20 },
        {
            id: 2,
            solution: makeSolution(['KDB-1000-500', 'KDZ-1000-500', 'KDB-1000-500']),
            technicalScore: 30
        }
    ];
}

function loadModule(opts?: { telemetrySpy?: (...args: any[]) => void }) {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/mlDualRanking.js'),
        'utf8'
    );
    const events: any[] = [];
    const sandbox: any = {
        window: {
            location: { search: '' },
            localStorage: { getItem: () => null },
            studnieProducts: PRODUCTS,
            telemetryRecordEvent: (e: any) => {
                events.push(e);
                if (opts?.telemetrySpy) opts.telemetrySpy(e);
            }
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        console: { warn: () => {}, log: () => {} },
        authHeaders: () => ({ 'Content-Type': 'application/json', 'X-Auth-Token': 't' }),
        fetch: null as any,
        AbortController,
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        Map,
        Set,
        Math,
        Date,
        JSON,
        Promise
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { sandbox, events };
}

/** Mock fetch z kontrolowanymi opóźnieniami per endpoint. */
function mockFetch(
    sandbox: any,
    delays: { settings?: number; mlStatus?: number; predict?: number },
    scoresById: Record<number, number> = { 0: 0.3, 1: 0.8, 2: 0.9 }
) {
    const delayed = (ms: number, fn: () => any) =>
        new Promise((resolve) => setTimeout(() => resolve(fn()), ms));
    sandbox.fetch = (url: string, fOpts: any) => {
        if (url.includes('/ai/settings')) {
            return delayed(delays.settings ?? 0, () => ({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ value: '80' })
            }));
        }
        if (url.includes('/ml-status')) {
            return delayed(delays.mlStatus ?? 0, () => ({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ featureVersion: 'v7' })
            }));
        }
        return delayed(delays.predict ?? 0, () => {
            const body = JSON.parse(fOpts.body);
            const scores = body.candidates.map((c: any) => ({
                id: c.id,
                score: scoresById[c.id] ?? 0.9,
                version: 'v1'
            }));
            return {
                ok: true,
                status: 200,
                json: () => Promise.resolve({ scores })
            };
        });
    };
}

describe('mlDualRanking P0 race', () => {
    test('slow AI never blocks rankCandidates and cannot mutate committed technical decision', async () => {
        const { sandbox, events } = loadModule();
        // AI path: meta wolne + predict 1,2 s (łącznie grubo ponad budżet 800 ms).
        mockFetch(sandbox, { settings: 300, mlStatus: 300, predict: 1200 });
        const rankCandidates = sandbox.window.rankCandidates;

        const well = makeWell();
        const wellBefore = JSON.stringify(well);

        const t0 = Date.now();
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well,
            aiInfluencePct: 80
        });
        const elapsed = Date.now() - t0;

        // Kontrakt 1 (latency): resolve daleko przed końcem AI path (~1,5 s+),
        // w okolicy budżetu 800 ms (luźny próg anty-flake).
        expect(elapsed).toBeLessThan(1500);

        // Decyzja = czysty technical (c0), brak śladu AI.
        expect(result.ranked[0].id).toBe(0);
        expect(result.ranked[0].solution).toBe(result.technicalWinner);
        expect(result.ranked.every((r: any) => r.aiScore === -1)).toBe(true);

        // Kontrakt 2 (brak mutacji): poczekaj na dogranie AI w tle...
        await sleep(1500);

        // ...studnia i decyzja nietknięte (żadnego _aiRankInfo ani zmian pól).
        expect(JSON.stringify(well)).toBe(wellBefore);
        expect((well as any)._aiRankInfo).toBeUndefined();
        expect(result.ranked[0].id).toBe(0);

        // ...a background dopisał wyłącznie event telemetrii z flagą background.
        expect(events.length).toBe(1);
        expect(events[0].eventType).toBe('ai_rank_decision');
        const reason = JSON.parse(events[0].changeReason);
        expect(reason.background).toBe(true);
        expect(reason.candidateCount).toBe(3);
    }, 15000);

    test('fast backend → AI jak dotychczas (flip działa, brak regresji race)', async () => {
        const { sandbox } = loadModule();
        mockFetch(sandbox, {});
        const result = await sandbox.window.rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });
        // aiCost: c0=0.7, c1=0.2, c2=0.1 → zwycięzca c2 (flip jak w mlDualRanking.test.ts).
        expect(result.ranked[0].id).toBe(2);
        expect(result.mlOnline).toBe(true);
    });

    test('influence backend cache TTL: 2× rankCandidates bez explicit influence = 1× fetch settings', async () => {
        const { sandbox } = loadModule();
        let settingsHits = 0;
        const origDelayed = (ms: number, fn: () => any) =>
            new Promise((resolve) => setTimeout(() => resolve(fn()), ms));
        sandbox.fetch = (url: string, fOpts: any) => {
            if (url.includes('/ai/settings')) {
                settingsHits++;
                return origDelayed(0, () => ({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ value: '80' })
                }));
            }
            if (url.includes('/ml-status')) {
                return origDelayed(0, () => ({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ featureVersion: 'v7' })
                }));
            }
            const body = JSON.parse(fOpts.body);
            return origDelayed(0, () => ({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        scores: body.candidates.map((c: any) => ({
                            id: c.id,
                            score: 0.5,
                            version: 'v1'
                        }))
                    })
            }));
        };
        const rankCandidates = sandbox.window.rankCandidates;
        await rankCandidates({ candidates: makeCandidates(), well: makeWell() });
        await rankCandidates({ candidates: makeCandidates(), well: makeWell() });
        expect(settingsHits).toBe(1);
    });
});
