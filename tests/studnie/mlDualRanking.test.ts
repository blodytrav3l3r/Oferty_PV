import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Testy regresyjne rankingu AI (public/js/studnie/mlDualRanking.js).
 * Ładują prawdziwy plik w sandboxie vm (konwencja jak aiSelection.test.ts)
 * i testują realną funkcję rankCandidates/buildFeatureVector z zamockowanym
 * window.fetch. Weryfikują: min-max normalizację aiCost, neutralność przy
 * szumie/zdegenerowanym modelu, brak kary dla pojedynczego kandydata online
 * oraz realne cechy kandydatów (ringCount / totalPrice / totalWeight).
 */

const FEATURE_VERSION = 'v6';

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
        dn: '1000',
        wellHeight: 2000,
        magazyn: 'Kluczbork',
        type: 'standard',
        uszczelka: 'brak',
        kineta: ''
    };
}

function loadModule() {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/mlDualRanking.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {
            location: { search: '' },
            localStorage: { getItem: () => null }
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        console: { warn: () => {}, log: () => {} },
        authHeaders: () => ({ 'Content-Type': 'application/json', 'X-Auth-Token': 'test-token' }),
        fetch: null as any,
        AbortController,
        setTimeout,
        clearTimeout,
        // Stub — moduł tworzy 5-min interval czyszczenia cache, który inaczej
        // trzymałby event loop otwarty i zawieszał zakończenie Jest.
        setInterval: () => 0,
        Map,
        Set,
        Math,
        Date,
        JSON
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

describe('mlDualRanking.rankCandidates (min-max normalizacja aiCost)', () => {
    let sandbox: any;
    let rankCandidates: any;

    // candidates: posortowane rosnąco wg technicalScore (c0 = technical best)
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

    function mockBatchScores(scoresById: Record<number, number>) {
        sandbox.fetch = (url: string, opts: any) => {
            if (url.includes('/feature-schema')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ version: FEATURE_VERSION })
                });
            }
            const body = JSON.parse(opts.body);
            const scores = body.candidates.map((c: any) => ({
                id: c.id,
                score: scoresById[c.id] ?? 0.9994,
                version: 'v1'
            }));
            // Backend nigdy nie zwraca -1 — przy braku aktywnego modelu odpowiada 503.
            // Wszystkie score < 0 symuluje więc offline jak realny serwer.
            if (scores.every((s: any) => s.score < 0)) {
                return Promise.resolve({
                    ok: false,
                    status: 503,
                    json: () => Promise.resolve({ error: 'No active model', scores: [] })
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ scores })
            });
        };
    }

    // scoreCache jest modułowy (współdzielony w obrębie jednej instancji sandboxa),
    // a klucz zależy tylko od cech — świeży moduł per test zapobiega przedawnieniu
    // score'ów między testami o tych samych rozwiązaniach.
    beforeEach(async () => {
        sandbox = loadModule();
        sandbox.window.studnieProducts = PRODUCTS;
        rankCandidates = sandbox.window.rankCandidates;
        expect(typeof rankCandidates).toBe('function');
    });

    test('model zdegenerowany (stałe score) → ranking czysto techniczny, bez flips', async () => {
        mockBatchScores({ 0: 0.9994, 1: 0.9994, 2: 0.9994 });
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });
        expect(result.ranked[0].solution).toBe(result.technicalWinner);
        expect(result.ranked[0].id).toBe(0);
        expect(result.ranked.every((r: any) => r.aiScore === 0.9994)).toBe(true);
    });

    test('pojedynczy kandydat online → neutralny, bez kary 0.5 (kolejność techniczna)', async () => {
        mockBatchScores({ 0: -1, 1: 0.8, 2: -1 });
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });
        expect(result.ranked[0].id).toBe(0);
        expect(result.ranked[0].solution).toBe(result.technicalWinner);
    });

    test('realny rozrzut score → AI re-rankuje (flip technicznego zwycięzcy)', async () => {
        mockBatchScores({ 0: 0.3, 1: 0.8, 2: 0.9 });
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });
        // aiCost: c0=0.7, c1=0.2, c2=0.1; normalized: c0=1.0, c1≈0.167, c2=0
        // finalScore(tech=0.2, ai=0.8): c0=0.8, c1≈0.233, c2=0.2 → zwycięzca c2
        expect(result.ranked[0].id).toBe(2);
        expect(result.ranked[0].solution).not.toBe(result.technicalWinner);
    });

    test('zwraca token serwerowy dla zwyciezcy do uzycia przy feedbacku', async () => {
        sandbox.fetch = (url: string, opts: any) => {
            if (url.includes('/feature-schema')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ version: FEATURE_VERSION })
                });
            }
            const body = JSON.parse(opts.body);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        scores: body.candidates.map((candidate: any) => ({
                            id: candidate.id,
                            score: [0.3, 0.8, 0.9][candidate.id],
                            version: 'v1',
                            predictionToken: `server-token-${candidate.id}`
                        }))
                    })
            });
        };

        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });

        expect(result.ranked[0].id).toBe(2);
        expect(result.predictionTokens.get(result.ranked[0].id)).toBe('server-token-2');
    });

    test('odświeża dowód predykcji mimo lokalnego cache wyniku dla studni', async () => {
        let predictionRequests = 0;
        sandbox.fetch = (url: string, opts: any) => {
            if (url.includes('/feature-schema')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ version: FEATURE_VERSION })
                });
            }
            predictionRequests += 1;
            const body = JSON.parse(opts.body);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        scores: body.candidates.map((candidate: any) => ({
                            id: candidate.id,
                            score: 0.9,
                            version: 'v1',
                            predictionToken: `fresh-${predictionRequests}-${candidate.id}`
                        }))
                    })
            });
        };
        const well = { ...makeWell(), id: 'well-1' };

        const first = await rankCandidates({
            candidates: makeCandidates(),
            well,
            aiInfluencePct: 80
        });
        const second = await rankCandidates({
            candidates: makeCandidates(),
            well,
            aiInfluencePct: 80
        });

        expect(predictionRequests).toBe(2);
        expect(second.predictionTokens.get(second.ranked[0].id)).toMatch(/^fresh-2-/);
        expect(first.predictionTokens.get(first.ranked[0].id)).toMatch(/^fresh-1-/);
    });

    test('ML całkowicie offline (wszystkie aiScore=-1) → technicalNormalized, porządek techniczny', async () => {
        mockBatchScores({ 0: -1, 1: -1, 2: -1 });
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 80
        });
        expect(result.ranked[0].id).toBe(0);
        expect(result.mlOnline).toBe(false);
    });

    test('zapisuje anonimowy outcome fallback po timeout bez zmiany rankingu technicznego', async () => {
        const events: any[] = [];
        const activeTimers = new Set<ReturnType<typeof setTimeout>>();
        sandbox.setTimeout = (callback: (...args: any[]) => void, delay?: number) => {
            const timer = setTimeout(callback, delay);
            activeTimers.add(timer);
            return timer;
        };
        sandbox.clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
            activeTimers.delete(timer);
            clearTimeout(timer);
        };
        sandbox.window.telemetryRecordEvent = (event: any) => events.push(event);
        sandbox.fetch = (url: string) => {
            if (url.includes('/feature-schema')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ version: FEATURE_VERSION })
                });
            }
            return Promise.reject(
                Object.assign(new Error('private-well-123'), { name: 'AbortError' })
            );
        };

        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: { ...makeWell(), id: 'private-well-123' },
            aiInfluencePct: 80
        });

        expect(result.ranked[0].id).toBe(0);
        expect(result.mlOnline).toBe(false);
        expect(events).toEqual([{ eventType: 'fallback_triggered', changeReason: 'timeout' }]);
        expect(activeTimers.size).toBe(0);
    });

    test('aiInfluencePct=0 (shadow) → niezależnie od rozrzutu porządek techniczny', async () => {
        mockBatchScores({ 0: 0.3, 1: 0.8, 2: 0.9 });
        const result = await rankCandidates({
            candidates: makeCandidates(),
            well: makeWell(),
            aiInfluencePct: 0
        });
        expect(result.ranked[0].id).toBe(0);
        expect(result.ranked[0].solution).toBe(result.technicalWinner);
    });
});

describe('mlDualRanking.buildFeatureVector (realne cechy kandydatów)', () => {
    let sandbox: any;
    let buildFeatureVector: any;

    beforeAll(() => {
        sandbox = loadModule();
        sandbox.window.studnieProducts = PRODUCTS;
        buildFeatureVector = sandbox.window.buildFeatureVector;
    });

    test('ringCount = liczba elementów kregowych (nie 1)', () => {
        const well = makeWell();
        const sol = makeSolution(['KDB-1000-500', 'KDZ-1000-500', 'KDB-1000-500']);
        const fv = buildFeatureVector(sol, well);
        expect(fv[9]).toBe(3); // ringCount
    });

    test('totalPrice/totalWeight liczone z komponentów (koszt ≠ 0)', () => {
        const well = makeWell();
        const sol = makeSolution(['KDB-1000-500', 'KDZ-1000-500']);
        const fv = buildFeatureVector(sol, well);
        // KDB=100 + KDZ=120 + dennica=200 = 420; wagi: 50+60+100 = 210
        expect(fv[12]).toBe(420); // totalPrice
        expect(fv[13]).toBe(210); // totalWeight
    });

    test('uzupełnia brakującą cenę lub wagę bez podwajania obecnej wartości', () => {
        const well = makeWell();
        const priceOnly = { ...makeSolution(['KDB-1000-500', 'KDZ-1000-500']), totalPrice: 999 };
        const weightOnly = { ...makeSolution(['KDB-1000-500', 'KDZ-1000-500']), totalWeight: 777 };

        const priceFeatures = buildFeatureVector(priceOnly, well);
        const weightFeatures = buildFeatureVector(weightOnly, well);

        expect(priceFeatures[12]).toBe(999);
        expect(priceFeatures[13]).toBe(210);
        expect(weightFeatures[12]).toBe(420);
        expect(weightFeatures[13]).toBe(777);
    });
});
