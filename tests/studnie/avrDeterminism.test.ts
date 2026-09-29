// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * avrDeterminism.test.ts — gate determinizmu sciezki AVR (findBestAvrFill/solve).
 *
 * findBestAvrFill/solve sa zagniezdzone w runJsAutoSelection (nie sa dostepne
 * bezposrednio z zewnatrz), wiec test cwiczy je przez runJsAutoSelection —
 * ten sam input 3x daje IDENTYCZNY output (JSON equal), takze pod sztucznym
 * load. Budzet AVR jest deterministyczny (AVR_MAX_ITERATIONS, bez Date.now):
 * wynik nie zalezy od obciazenia CPU ani skokow zegara.
 *
 * AI celowo odpiete (brak window.rankCandidates) — sciezka deterministyczna.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const JS_DIR = path.join(__dirname, '../../public/js/studnie');

function canonical(v: any): string {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v !== null && typeof v === 'object') {
        return (
            '{' +
            Object.keys(v)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
                .join(',') +
            '}'
        );
    }
    if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 1e6) / 1e6);
    return JSON.stringify(v);
}

function loadCatalog(): any[] {
    const raw = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../data/seed_studnie.json'), 'utf8')
    );
    const arr = Array.isArray(raw) ? raw : raw.products || raw.data || [];
    return arr.map((p: any) => ({
        ...p,
        magazynWL: p.magazynWL === undefined ? undefined : p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB === undefined ? undefined : p.magazynKLB ? 1 : 0
    }));
}

function makeCtx(catalog: any[]) {
    const sb: any = {
        console,
        structuredClone: (o: any) => JSON.parse(JSON.stringify(o)),
        performance: { now: () => Date.now() },
        requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
        setInterval: () => 0,
        clearInterval: () => {},
        setTimeout,
        clearTimeout,
        localStorage: {
            _m: new Map(),
            getItem(k: string) {
                return this._m.has(k) ? this._m.get(k) : null;
            },
            setItem(k: string, v: string) {
                this._m.set(k, v);
            }
        },
        location: { search: '' },
        fetch: async () => ({ ok: false, json: async () => ({}) }),
        document: {
            getElementById: () => null,
            createElement: () => ({ style: {} }),
            querySelector: () => null,
            querySelectorAll: () => []
        },
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        showToast: () => {},
        getCurrentWell: () => null,
        fmtInt: (v: any) => String(v),
        FLOW_TYPES: {}
    };
    sb.window = sb;
    sb.globalThis = sb;
    vm.createContext(sb);
    for (const f of [
        'globals.js',
        'transitionZones.js',
        'ruleEngine.js',
        'wellConfigRules.js',
        'ringOptimizer.js',
        'solverAutoSelect.js'
    ]) {
        vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sb, { filename: f });
    }
    sb.window.studnieProducts = catalog;
    return sb;
}

function mkWell(over: any = {}) {
    return {
        id: 'well-avr-det',
        dn: 1000,
        type: 'standard',
        magazyn: 'Kluczbork',
        nadbudowa: 'betonowa',
        stopnie: 'drabinka',
        dennicaMaterial: 'beton',
        wkladkaDennica: 'brak',
        zakonczenie: null,
        wkladkaZwienczenie: 'brak',
        redukcjaDN1000: false,
        redukcjaMinH: 0,
        redukcjaZakonczenie: null,
        redukcjaTargetDN: 1000,
        stycznaNadbudowa1200: false,
        stycznaDn: null,
        rzednaWlazu: 3.0,
        rzednaDna: 0,
        wellHeight: 3000,
        przejscia: [],
        config: [],
        uszczelka: 'brak',
        kineta: 'beton',
        psiaBuda: false,
        ...over
    };
}

async function solveSnapshot(sb: any, well: any): Promise<string> {
    const w = JSON.parse(JSON.stringify(well));
    const avail = sb.getAvailableProducts(w).filter((p: any) => sb.filterByWellParams(p, w));
    const requiredMm = Math.round((w.rzednaWlazu - (w.rzednaDna || 0)) * 1000);
    // runJsAutoSelection w srodku wywoluje solve -> findBestAvrFill (linie 59,769,777).
    const res = await sb.runJsAutoSelection(w, requiredMm, avail);
    return canonical(res);
}

function busyWait(ms: number) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        Math.sqrt(Math.random());
    }
}

describe('avrDeterminism', () => {
    test('findBestAvrFill/solve 3x na tych samych danych daje identyczny wynik', async () => {
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        const well = mkWell({});
        const first = await solveSnapshot(sb, well);
        const second = await solveSnapshot(sb, well);
        const third = await solveSnapshot(sb, well);
        expect(second).toBe(first);
        expect(third).toBe(first);
    });

    test('wynik 3x identyczny pod sztucznym load (busy-loop + skok zegara)', async () => {
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        const well = mkWell({});
        const first = await solveSnapshot(sb, well);
        busyWait(400);
        const second = await solveSnapshot(sb, well);
        // Skok zegara wewnatrz sandboxu (dawna sciezka wall-clock Date.now+10s):
        // przy budzecie iteracji wynik musi byc bez zmian.
        try {
            vm.runInContext(
                'var __realNow = Date.now; Date.now = function () { return __realNow() + 10000; };',
                sb
            );
            const third = await solveSnapshot(sb, well);
            expect(third).toBe(first);
        } finally {
            vm.runInContext('Date.now = __realNow; delete globalThis.__realNow;', sb);
        }
        expect(second).toBe(first);
    });

    test('budzet iteracji deterministyczny (AVR_MAX_ITERATIONS, brak Date.now w AVR)', async () => {
        const src = fs.readFileSync(path.join(JS_DIR, 'solverAutoSelect.js'), 'utf8');
        // Staly budzet istnieje i jest eksportowany do testow.
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        expect(typeof sb.AVR_MAX_ITERATIONS).toBe('number');
        expect(sb.AVR_MAX_ITERATIONS).toBeGreaterThanOrEqual(20);
        // Pelne przeszukanie na seed (3x AVR, maxAvr 260) odwiedza max 20 wezlow,
        // wiec budzet musi je pokryc w calosci.
        const m = src.match(/const AVR_MAX_ITERATIONS\s*=\s*(\d+)/);
        expect(m).not.toBeNull();
        expect(parseInt(m![1], 10)).toBeGreaterThanOrEqual(20);
        // Brak wall-clock w findBestAvrFill: zaden Date.now/performance.now
        // miedzy definicja findBestAvrFill a koncem backtrack.
        const start = src.indexOf('function findBestAvrFill');
        expect(start).toBeGreaterThan(-1);
        const end = src.indexOf('if (deficit >= 30) backtrack');
        expect(end).toBeGreaterThan(start);
        const avrBlock = src.slice(start, end);
        expect(avrBlock).not.toMatch(/Date\.now/);
        expect(avrBlock).not.toMatch(/performance\.now/);
        expect(avrBlock).not.toMatch(/AVR_TIMEOUT_MS/);
        expect(src).not.toMatch(/const AVR_TIMEOUT_MS/);
        // DP_MEMO_MAX_ENTRIES zachowane (brak regresji limitu memo).
        expect(src).toMatch(/const DP_MEMO_MAX_ENTRIES\s*=\s*5000/);
    });

    test('explorationSeed odtwarzalny: ten sam seed daje te sama decyzje', async () => {
        const catalog = loadCatalog();
        const sb = makeCtx(catalog);
        vm.runInContext(fs.readFileSync(path.join(JS_DIR, 'mlDualRanking.js'), 'utf8'), sb, {
            filename: 'mlDualRanking.js'
        });
        expect(typeof sb.selectWithExploration).toBe('function');
        const ranked = [0, 1, 2, 3, 4].map((i) => ({
            finalScore: i * 0.001,
            solution: { id: 'sol-' + i }
        }));
        const a = sb.selectWithExploration(ranked, 123456);
        const b = sb.selectWithExploration(ranked, 123456);
        expect(a.explorationSeed).toBe(123456);
        expect(canonical(a)).toBe(canonical(b));
        // Losowosc zachowana: bez wstrzyknietego seeda kazde wywolanie losuje seed.
        const c = sb.selectWithExploration(ranked);
        expect(typeof c.explorationSeed).toBe('number');
    });
});

describe('dpDeterminism (wzorzec E4a: staly budzet iteracji, bez Date.now)', () => {
    function synthRings(): any[] {
        return [1000, 500, 250].map((h) => ({
            id: 'K-' + h,
            name: 'Krag ' + h,
            componentType: 'krag',
            dn: 1000,
            height: h
        }));
    }

    test('staly budzet DP_MAX_ITERATIONS pokrywa pelne przeszukanie, brak wall-clock', () => {
        const src = fs.readFileSync(path.join(JS_DIR, 'ringOptimizer.js'), 'utf8');
        const sb = makeCtx([]);
        // Budzet istnieje, eksportowany, pokrywa duzy cap testowy (20020*3=60k).
        expect(typeof sb.DP_MAX_ITERATIONS).toBe('number');
        expect(sb.DP_MAX_ITERATIONS).toBeGreaterThanOrEqual(20020 * 3);
        const m = src.match(/const DP_MAX_ITERATIONS\s*=\s*(\d+)/);
        expect(m).not.toBeNull();
        expect(parseInt(m![1], 10)).toBeGreaterThanOrEqual(20020 * 3);
        // Brak wall-clock w solveDPRings i brak dawnego DP_TIMEOUT_MS.
        const start = src.indexOf('function solveDPRings');
        expect(start).toBeGreaterThan(-1);
        const end = src.indexOf('function mapHeightsToProducts');
        expect(end).toBeGreaterThan(start);
        const dpBlock = src.slice(start, end);
        expect(dpBlock).not.toMatch(/Date\.now/);
        expect(dpBlock).not.toMatch(/performance\.now/);
        expect(dpBlock).not.toMatch(/DP_TIMEOUT_MS/);
        expect(src).not.toMatch(/DP_TIMEOUT_MS/);
        // Greedy fallback istnieje i jest deterministyczny (bez zegara).
        expect(typeof sb.solveGreedyRings).toBe('function');
        const gStart = src.indexOf('function solveGreedyRings');
        expect(gStart).toBeGreaterThan(-1);
        const gEnd = src.indexOf('function solveDPRings');
        const greedyBlock = src.slice(gStart, gEnd);
        expect(greedyBlock).not.toMatch(/Date\.now/);
        expect(greedyBlock).not.toMatch(/Math\.random/);
    });

    test('duzy cap + wymuszony wolny zegar daje deterministyczny wynik', () => {
        const sb = makeCtx([]);
        const rings = synthRings();
        const run = () => sb.optimizeRingsForDistance(20000, rings, 50, 20);
        const first = canonical(run());
        expect(run().success).toBe(true);
        busyWait(200);
        try {
            vm.runInContext(
                'var __realNowDp = Date.now; Date.now = function () { return __realNowDp() + 10000; };',
                sb
            );
            expect(canonical(run())).toBe(first);
        } finally {
            vm.runInContext('Date.now = __realNowDp; delete globalThis.__realNowDp;', sb);
        }
        expect(canonical(run())).toBe(first);
    });

    test('przekroczony budzet → deterministyczny greedy (nie ciche success:false)', () => {
        const sb = makeCtx([]);
        const rings = synthRings();
        // cap 300020 x 3 heights = 900k iteracji > DP_MAX_ITERATIONS → greedy.
        const run = () => sb.optimizeRingsForDistance(300000, rings, 50, 20);
        const first = canonical(run());
        expect(run().success).toBe(true);
        try {
            vm.runInContext(
                'var __realNowDp2 = Date.now; Date.now = function () { return __realNowDp2() + 60000; };',
                sb
            );
            expect(canonical(run())).toBe(first);
        } finally {
            vm.runInContext('Date.now = __realNowDp2; delete globalThis.__realNowDp2;', sb);
        }
    });
});
