#!/usr/bin/env node
// benchmark-autoselect.mjs — audyt wydajności auto-doboru studni (JS + AI).
// Pomiar, nie optymalizacja: instrumentacja wyłącznie w harnessie (vm),
// kod produkcyjny ładowany bez modyfikacji (wyjątek: liczniki wstrzykiwane
// string-replace w kopii źródła w pamięci — plik na dysku nietknięty).
//
// Serie:
//   A. DP scaling sweep: optimizeRingsForDistance (real) — cap × heights,
//      liczniki solveDPRings / findAlternativeDPSolution / validateRingJoints.
//   B. AVR sweep: findBestAvrFill (wierna replika algorytmu z solverAutoSelect.js
//      + liczniki visitedStates/timeoutHit) — funkcja zagnieżdżona w prod,
//      niedostępna z zewnątrz bez modyfikacji pliku.
//   C. Filtrowanie katalogu: getAvailableProducts + filterByWellParams (real)
//      na seed_studnie.json (685) + katalog syntetyczny.
//   D. AI frontend: buildFeatureVector + rankCandidates (real, stub fetch
//      z programowalną latencją) — warianty OFF/cache-hit/cache-miss/timeout.
//   E. Solver-per-well proxy: pełny łańcuch filtr→dennica→top→DP→AVR→layout
//      z realnych funkcji (bez DOM/renderu).
//   F. Full-solve fingerprint (P0-1): prawdziwy runJsAutoSelection w vm —
//      dpCalls, uniqueDPInputs, redundantPct i winning stage per przypadek.
//      Metryka sukcesu grupowania: uniqueDPInputs/totalDPCalls.
//
// Metryki per funkcja: calls, total, avg, P50/P95/P99, max, perCall, udział%.
// Tryby cache: cold = świeży kontekst vm na iterację, warm = reużyty kontekst.
// Warm-up: 5 przebiegów przed 20 pomiarowymi.
//
// Użycie: node scripts/benchmark-autoselect.mjs [--repeats=20] [--warmup=5] [--json=path] [--quick]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const ARGV = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const m = a.match(/^--([^=]+)(=(.*))?$/);
        return m ? [m[1], m[3] ?? true] : [a, true];
    })
);
const REPEATS = parseInt(ARGV.repeats || '20', 10);
const WARMUP = parseInt(ARGV.warmup || '5', 10);
const QUICK = ARGV.quick === true || ARGV.quick === 'true';
const JSON_OUT = ARGV.json || 'docs/plans/benchmark-autoselect-results.json';
const ROOT = process.cwd();
const JS_DIR = path.join(ROOT, 'public/js/studnie');

// ---------- statystyki ----------
function pct(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
}

// Kolektor: nazwa -> { calls, samples[] }. samples = czasy per call (ms, hrtime).
const STATS = new Map();
function statSample(name, ms) {
    let s = STATS.get(name);
    if (!s) {
        s = { calls: 0, samples: [] };
        STATS.set(name, s);
    }
    s.calls++;
    s.samples.push(ms);
}
function timed(name, fn) {
    return (...args) => {
        const t0 = process.hrtime.bigint();
        try {
            return fn(...args);
        } finally {
            statSample(name, Number(process.hrtime.bigint() - t0) / 1e6);
        }
    };
}
function summarize(totalSolverMs) {
    const out = {};
    for (const [name, s] of STATS) {
        const sorted = [...s.samples].sort((a, b) => a - b);
        const total = s.samples.reduce((a, b) => a + b, 0);
        out[name] = {
            calls: s.calls,
            totalMs: round3(total),
            avgMs: round3(total / s.calls),
            p50Ms: round3(pct(sorted, 50)),
            p95Ms: round3(pct(sorted, 95)),
            p99Ms: round3(pct(sorted, 99)),
            maxMs: round3(sorted[sorted.length - 1]),
            perCallMs: round3(total / s.calls),
            sharePct: totalSolverMs > 0 ? round3((total / totalSolverMs) * 100) : 0
        };
    }
    return out;
}
function round3(v) {
    return Math.round(v * 1000) / 1000;
}

// ---------- kontekst vm z produkcyjnymi modułami (bez modyfikacji plików) ----------
function readJs(name) {
    return fs.readFileSync(path.join(JS_DIR, name), 'utf8');
}

function makeSandbox(fetchStub) {
    const sandbox = {
        console,
        structuredClone,
        AbortController,
        URL,
        URLSearchParams,
        performance: { now: () => Date.now() },
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
        setInterval: () => 0, // mlDualRanking: okresowe czyszczenie cache — off w harnessie
        clearInterval: () => {},
        clearTimeout,
        setTimeout,
        localStorage: {
            _m: new Map(),
            getItem(k) {
                return this._m.has(k) ? this._m.get(k) : null;
            },
            setItem(k, v) {
                this._m.set(k, v);
            }
        },
        location: { search: '' },
        fetch:
            fetchStub ||
            (async () => {
                throw new Error('fetch stub: no backend');
            }),
        document: {
            getElementById: () => null,
            createElement: () => ({ style: {} }),
            querySelector: () => null,
            querySelectorAll: () => []
        },
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        authHeaders: () => ({}),
        __stats: { dp: { solveCalls: 0, altCalls: 0, validateCalls: 0 } }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    return sandbox;
}

// Wstrzyknięcie liczników do kopii ringOptimizer.js (plik na dysku nietknięty).
function instrumentRingOptimizer(src) {
    return src
        .replace(
            'function solveDPRings(heights, minAllowed, maxAllowed, availableRings) {',
            'function solveDPRings(heights, minAllowed, maxAllowed, availableRings) { __stats.dp.solveCalls++;'
        )
        .replace(
            'function findAlternativeDPSolution(',
            'function __altCount(){ __stats.dp.altCalls++; } function findAlternativeDPSolution('
        )
        .replace(
            'function validateRingJoints(selectedRings, transitions, availableProducts, fixedBelowHeight, mode) {',
            'function validateRingJoints(selectedRings, transitions, availableProducts, fixedBelowHeight, mode) { __stats.dp.validateCalls++;'
        );
}

function loadProd(fetchStub) {
    const sb = makeSandbox(fetchStub);
    vm.runInContext(readJs('globals.js'), sb, { filename: 'globals.js' });
    vm.runInContext(readJs('ruleEngine.js'), sb, { filename: 'ruleEngine.js' });
    vm.runInContext(readJs('wellConfigRules.js'), sb, { filename: 'wellConfigRules.js' });
    vm.runInContext(instrumentRingOptimizer(readJs('ringOptimizer.js')), sb, {
        filename: 'ringOptimizer.js'
    });
    vm.runInContext(readJs('mlDualRanking.js'), sb, { filename: 'mlDualRanking.js' });
    // aliasy liczników: owrapuj exported funkcje timery (harness, nie prod)
    const wrap = (name) => {
        const orig = vm.runInContext(name, sb);
        sb[name + '__orig'] = orig;
        vm.runInContext(
            `${name} = (function(){ const __o = ${name}__orig; return function(){ const t0 = Date.now(); try { return __o.apply(this, arguments); } finally { __harnessStat(${JSON.stringify(name)}, Date.now() - t0); } }; })();`,
            sb
        );
    };
    sb.__harnessStat = (n, ms) => statSample(n, ms);
    for (const fn of [
        'optimizeRingsForDistance',
        'filterByWellParams',
        'getAvailableProducts',
        'getLowestDennicaHybrid',
        'getTopClosure',
        'getKregiList',
        'getReductionPlate',
        'buildCandidateLayouts',
        'buildFeatureVector'
    ]) {
        try {
            wrap(fn);
        } catch {
            /* brak w kontekście */
        }
    }
    return sb;
}

// ---------- katalogi ----------
function loadSeedCatalog() {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seed_studnie.json'), 'utf8'));
    const arr = Array.isArray(raw) ? raw : raw.products || raw.data || [];
    // Normalizacja do kształtu runtime (productsStudnieV2.ts:203-204: boolean -> 1/0).
    // Bez tego getAvailableProducts odrzuciłby cały katalog (val===1||'1'||undefined).
    return arr.map((p) => ({
        ...p,
        magazynWL: p.magazynWL === undefined ? undefined : p.magazynWL ? 1 : 0,
        magazynKLB: p.magazynKLB === undefined ? undefined : p.magazynKLB ? 1 : 0
    }));
}
function synthCatalog({ kragVariants = 8, dennice = 22, extraJunk = 0 } = {}) {
    const arr = [];
    const heights = [250, 500, 750, 1000, 1250, 1500].slice(0, kragVariants);
    let i = 0;
    for (const h of heights) {
        for (const dn of [1000, 1200, 1500]) {
            arr.push({
                id: `SYN-K-${dn}-${h}-${i++}`,
                componentType: 'krag',
                dn: String(dn),
                height: h,
                formaStandardowa: true,
                formaStandardowaKLB: true,
                magazynWL: true,
                magazynKLB: true
            });
        }
    }
    for (let d = 0; d < dennice; d++) {
        arr.push({
            id: `SYN-D-1000-${d}`,
            componentType: 'dennica',
            dn: '1000',
            height: 500 + (d % 5) * 250,
            formaStandardowaKLB: true,
            magazynKLB: true
        });
    }
    for (let j = 0; j < extraJunk; j++) {
        arr.push({ id: `SYN-X-${j}`, componentType: 'przejscie', dn: '160', height: 0 });
    }
    return arr;
}

function makeWell(over = {}) {
    return {
        id: 'well-bench',
        dn: '1000',
        type: 'standard',
        magazyn: 'Kluczbork',
        warehouse: 'KLB',
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
        ...over
    };
}

// ---------- AVR: wierna replika findBestAvrFill (solverAutoSelect.js:642-678) + liczniki ----------
// Oryginał zagnieżdżony w runJsAutoSelection — brak dostępu bez modyfikacji pliku,
// więc replika 1:1 logiki z licznikami (oznaczona w raporcie jako replika).
function avrFillReplica(deficit, avrRings, stats) {
    let bestAvrCombo = [];
    let bestAvrDiff = deficit;
    let bestAvrH = 0;
    const avrStartTime = Date.now();
    const AVR_TIMEOUT_MS = 100;
    let visited = 0;
    let timedOut = false;
    let timeToFirst = null;
    let solutions = 0;
    function backtrack(combo, sum, idx) {
        if (Date.now() - avrStartTime > AVR_TIMEOUT_MS) {
            timedOut = true;
            return;
        }
        visited++;
        const d = Math.abs(deficit - sum);
        if (d < bestAvrDiff) {
            bestAvrDiff = d;
            bestAvrCombo = [...combo];
            bestAvrH = sum;
            solutions++;
            if (timeToFirst === null) timeToFirst = Date.now() - avrStartTime;
        } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
            bestAvrCombo = [...combo];
            bestAvrH = sum;
            solutions++;
        }
        for (let i = idx; i < avrRings.length; i++) {
            if (sum + avrRings[i].height <= 260) {
                combo.push(avrRings[i]);
                backtrack(combo, sum + avrRings[i].height, i);
                combo.pop();
            }
        }
    }
    if (deficit >= 30) backtrack([], 0, 0);
    if (stats) {
        stats.visited.push(visited);
        stats.solutions.push(solutions);
        if (timedOut) stats.timeouts++;
        stats.timeToFirst.push(timeToFirst === null ? -1 : timeToFirst);
    }
    return { avrH: bestAvrH, visited, timedOut };
}

// ---------- serie ----------
async function seriesDP(ctx, results) {
    const caps = QUICK ? [1000, 3000, 6000] : [500, 1000, 2000, 4000, 6000, 10000];
    const heightSets = QUICK
        ? [[250, 500, 1000]]
        : [
              [250, 500, 1000],
              [250, 500, 750, 1000],
              [250, 500, 750, 1000, 1250, 1500]
          ];
    const seed = loadSeedCatalog();
    const kregi1000 = seed.filter((p) => p.componentType === 'krag' && String(p.dn) === '1000');
    for (const heights of heightSets) {
        const rings = kregi1000.filter((p) => heights.includes(Number(p.height)));
        const list =
            rings.length > 0 ? rings : heights.map((h, i) => ({ id: `H-${h}-${i}`, height: h }));
        for (const cap of caps) {
            const target = cap;
            const tolBelow = 260;
            const tolAbove = 20;
            // warm-up
            for (let w = 0; w < WARMUP; w++) {
                ctx.sb.optimizeRingsForDistance(target, list, tolBelow, tolAbove, null, null, 0);
            }
            ctx.sb.__stats.dp.solveCalls = 0;
            ctx.sb.__stats.dp.altCalls = 0;
            const times = [];
            for (let r = 0; r < REPEATS; r++) {
                const t0 = process.hrtime.bigint();
                ctx.sb.optimizeRingsForDistance(target, list, tolBelow, tolAbove, null, null, 0);
                times.push(Number(process.hrtime.bigint() - t0) / 1e6);
            }
            const sorted = [...times].sort((a, b) => a - b);
            results.dpScaling.push({
                cap,
                heights: heights.length,
                ringListSize: list.length,
                solveCallsPerRun: ctx.sb.__stats.dp.solveCalls / REPEATS,
                p50Ms: round3(pct(sorted, 50)),
                p95Ms: round3(pct(sorted, 95)),
                p99Ms: round3(pct(sorted, 99)),
                maxMs: round3(sorted[sorted.length - 1])
            });
            // wariant z przejściami (koszt findAlternativeDPSolution)
            const transitions = [
                { productId: 'T1', height_from_bottom_mm: Math.round(cap * 0.4) },
                { productId: 'T2', height_from_bottom_mm: Math.round(cap * 0.7) }
            ];
            const avail = [
                {
                    id: 'T1',
                    dn: '160',
                    zapasDol: 300,
                    zapasGora: 300,
                    zapasDolMin: 150,
                    zapasGoraMin: 150
                },
                {
                    id: 'T2',
                    dn: '200',
                    zapasDol: 300,
                    zapasGora: 300,
                    zapasDolMin: 150,
                    zapasGoraMin: 150
                }
            ];
            ctx.sb.__stats.dp.altCalls = 0;
            const timesT = [];
            for (let r = 0; r < REPEATS; r++) {
                const t0 = process.hrtime.bigint();
                ctx.sb.optimizeRingsForDistance(
                    target,
                    list,
                    tolBelow,
                    tolAbove,
                    transitions,
                    avail,
                    500
                );
                timesT.push(Number(process.hrtime.bigint() - t0) / 1e6);
            }
            const sortedT = [...timesT].sort((a, b) => a - b);
            results.dpWithTransitions.push({
                cap,
                heights: heights.length,
                altCallsPerRun: round3(ctx.sb.__stats.dp.altCalls / REPEATS),
                p50Ms: round3(pct(sortedT, 50)),
                p95Ms: round3(pct(sortedT, 95)),
                maxMs: round3(sortedT[sortedT.length - 1])
            });
        }
    }
}

function seriesAVR(results) {
    const seed = loadSeedCatalog();
    const avrRings = seed
        .filter((p) => p.componentType === 'avr')
        .map((p) => ({ id: p.id, height: Number(p.height) }));
    const deficits = QUICK ? [60, 150, 260] : [30, 60, 100, 150, 200, 260];
    const scales = QUICK ? [1] : [1, 3]; // ×3 typy AVR (syntetyczne klony wysokości)
    for (const s of scales) {
        const rings =
            s === 1
                ? avrRings
                : avrRings.flatMap((r, i) =>
                      [0, 1, 2].map((k) => ({ id: `${r.id}-c${k}-${i}`, height: r.height }))
                  );
        for (const deficit of deficits) {
            const stats = { visited: [], solutions: [], timeouts: 0, timeToFirst: [] };
            for (let w = 0; w < WARMUP; w++) avrFillReplica(deficit, rings, null);
            const times = [];
            for (let r = 0; r < REPEATS; r++) {
                const t0 = process.hrtime.bigint();
                avrFillReplica(deficit, rings, stats);
                times.push(Number(process.hrtime.bigint() - t0) / 1e6);
            }
            const sorted = [...times].sort((a, b) => a - b);
            const vv = [...stats.visited].sort((a, b) => a - b);
            results.avr.push({
                deficit,
                avrTypes: rings.length,
                visitedP50: pct(vv, 50),
                visitedP95: pct(vv, 95),
                visitedMax: vv[vv.length - 1],
                timeoutHits: stats.timeouts,
                timeoutRate: round3(stats.timeouts / REPEATS),
                timeToFirstP50Ms: round3(
                    pct(
                        [...stats.timeToFirst].sort((a, b) => a - b),
                        50
                    )
                ),
                p50Ms: round3(pct(sorted, 50)),
                p95Ms: round3(pct(sorted, 95)),
                maxMs: round3(sorted[sorted.length - 1])
            });
        }
    }
}

function seriesFilter(ctx, results) {
    const seed = loadSeedCatalog();
    const synth = synthCatalog({ kragVariants: 4, dennice: 22, extraJunk: 0 });
    const large = synthCatalog({ kragVariants: 6, dennice: 40, extraJunk: 2000 });
    const wells = [
        ['beton+drabinka', makeWell({})],
        ['zelbet+brak', makeWell({ nadbudowa: 'zelbetowa', stopnie: 'brak' })],
        ['redukcja', makeWell({ redukcjaDN1000: true })]
    ];
    for (const [cname, cat] of [
        ['seed-685', seed],
        ['synth-small', synth],
        ['synth-large-2k', large]
    ]) {
        for (const [wname, well] of wells) {
            ctx.setProducts(cat);
            for (let w = 0; w < WARMUP; w++) {
                const avail = ctx.sb.getAvailableProducts(well);
                avail.filter((p) => ctx.sb.filterByWellParams(p, well));
            }
            const times = [];
            let availSize = 0;
            for (let r = 0; r < REPEATS; r++) {
                const t0 = process.hrtime.bigint();
                const avail = ctx.sb.getAvailableProducts(well);
                const filtered = avail.filter((p) => ctx.sb.filterByWellParams(p, well));
                times.push(Number(process.hrtime.bigint() - t0) / 1e6);
                availSize = avail.length;
            }
            const sorted = [...times].sort((a, b) => a - b);
            results.filter.push({
                catalog: cname,
                catalogSize: cat.length,
                well: wname,
                availSize,
                p50Ms: round3(pct(sorted, 50)),
                p95Ms: round3(pct(sorted, 95)),
                maxMs: round3(sorted[sorted.length - 1])
            });
        }
    }
}

async function seriesAI(ctxFactory, results) {
    const seed = loadSeedCatalog();
    const well = makeWell({
        uszczelka: 'GSG',
        przejscia: [
            {
                productId: seed.find((p) => p.componentType === 'przejscie')?.id || 'X',
                rzednaWlaczenia: 1.2
            }
        ]
    });
    const mkCandidates = (n) =>
        Array.from({ length: n }, (_, i) => ({
            id: i,
            solution: {
                kregItems: [{ productId: 'KDB-10-02-B', quantity: 2 + (i % 3) }],
                topItems: [{ productId: 'WLAZ-150', quantity: 1 }],
                avrItems: [],
                dennica: { productId: 'DDD-1000-500', quantity: 1 },
                ringCount: 2 + (i % 3)
            },
            technicalScore: 100 + i * 37
        }));
    // D1: buildFeatureVector CPU (real, 10 kandydatów)
    {
        const sb = ctxFactory();
        sb.window.studnieProducts = seed;
        const cands = mkCandidates(10);
        for (let w = 0; w < WARMUP; w++)
            for (const c of cands) sb.buildFeatureVector(c.solution, { ...well });
        const times = [];
        for (let r = 0; r < REPEATS; r++) {
            const t0 = process.hrtime.bigint();
            for (const c of cands) sb.buildFeatureVector(c.solution, { ...well });
            times.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        const sorted = [...times].sort((a, b) => a - b);
        results.ai.buildFeatureVector10 = {
            p50Ms: round3(pct(sorted, 50)),
            p95Ms: round3(pct(sorted, 95)),
            maxMs: round3(sorted[sorted.length - 1]),
            perCandidateP50Ms: round3(pct(sorted, 50) / 10)
        };
    }
    // D2: rankCandidates warianty sieciowe (realna logika race 800ms + cache front)
    const variants = QUICK
        ? [
              ['cache-miss-0ms', 0, false],
              ['real-50ms', 50, false]
          ]
        : [
              ['ai-off', null, true],
              ['cache-miss-0ms', 0, false],
              ['real-50ms', 50, false],
              ['real-200ms', 200, false],
              ['timeout-1200ms', 1200, false]
          ];
    for (const [vname, latency, aiOff] of variants) {
        const fetchStub = async (url) => {
            if (String(url).includes('/ai/settings')) {
                return { ok: true, json: async () => ({ value: aiOff ? '0' : '50' }) };
            }
            if (String(url).includes('/ai/ml-status')) {
                return { ok: true, json: async () => ({ featureVersion: 'v7' }) };
            }
            if (String(url).includes('/ai/predict/batch')) {
                if (latency > 0) await new Promise((res) => setTimeout(res, latency));
                return {
                    ok: true,
                    json: async () => ({
                        scores: mkCandidates(5).map((c) => ({
                            id: c.id,
                            score: 0.5 + c.id * 0.01,
                            version: 'bench'
                        }))
                    })
                };
            }
            return { ok: false, json: async () => ({}) };
        };
        const mkCtx = () => {
            const sb = ctxFactory(fetchStub);
            sb.window.studnieProducts = seed;
            sb.window.aiMlEnabled = async () => !aiOff;
            sb.window.telemetryRecordEvent = () => {};
            return sb;
        };
        const cands = mkCandidates(5);
        // cold: świeży kontekst co iterację (cache front pusty, resolveFeatureVersion z fetch)
        const coldTimes = [];
        let mlOnlineSeen = null;
        const coldN = QUICK ? 4 : 8;
        for (let r = 0; r < coldN; r++) {
            const sb = mkCtx();
            const t0 = process.hrtime.bigint();
            const res = await sb.rankCandidates({ candidates: cands, well: { ...well } });
            coldTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
            mlOnlineSeen = res.mlOnline;
        }
        // warm: ten sam kontekst (scoreCache + influenceCache trafiają)
        const sb = mkCtx();
        for (let w = 0; w < Math.min(WARMUP, 3); w++) {
            try {
                await sb.rankCandidates({ candidates: cands, well: { ...well } });
            } catch {}
        }
        const warmTimes = [];
        for (let r = 0; r < (QUICK ? 8 : REPEATS); r++) {
            const t0 = process.hrtime.bigint();
            await sb.rankCandidates({ candidates: cands, well: { ...well } });
            warmTimes.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        const sc = [...coldTimes].sort((a, b) => a - b);
        const sw = [...warmTimes].sort((a, b) => a - b);
        results.ai.variants.push({
            variant: vname,
            stubLatencyMs: latency,
            mlOnline: mlOnlineSeen,
            coldP50Ms: round3(pct(sc, 50)),
            coldP95Ms: round3(pct(sc, 95)),
            warmP50Ms: round3(pct(sw, 50)),
            warmP95Ms: round3(pct(sw, 95)),
            warmMaxMs: round3(sw[sw.length - 1]),
            raceBudgetMs: 800
        });
    }
}

function seriesCallBounds(ctx, results) {
    // F: ile razy solve() woła DP per jeden auto-dobór (struktura pętli
    // solverAutoSelect.js: solve(): dennice × topConfigs × stages(5);
    // gałąź redukcji: lift ≤40 × dennice × 2× fillKregiDP).
    // Mierzone realnymi listami (filtr prod), koszt 1 DP z serii A.
    const seed = loadSeedCatalog();
    const cases = [
        ['DN1000-3m-0prz', makeWell({})],
        [
            'DN1500-5m-red',
            makeWell({ dn: '1500', redukcjaDN1000: true, rzednaWlazu: 5.0, wellHeight: 5000 })
        ],
        [
            'DN2000-6m-3prz',
            makeWell({
                dn: '2000',
                rzednaWlazu: 6.0,
                wellHeight: 6000,
                przejscia: [
                    { productId: 'x', rzednaWlaczenia: 1 },
                    { productId: 'x', rzednaWlaczenia: 2 },
                    { productId: 'x', rzednaWlaczenia: 3 }
                ]
            })
        ]
    ];
    const dpRef =
        results.dpScaling.find((r) => r.cap === 2000 && r.heights === 3) || results.dpScaling[0];
    const singleDpP50 = dpRef ? dpRef.p50Ms : 1;
    for (const [cname, well] of cases) {
        ctx.setProducts(seed);
        const avail = ctx.sb.getAvailableProducts(well);
        const filt = avail.filter((p) => ctx.sb.filterByWellParams(p, well));
        const dn = well.dn;
        const dennice = filt.filter(
            (p) => p.componentType === 'dennica' && parseInt(String(p.dn)) === parseInt(String(dn))
        );
        const kregi = ctx.sb.getKregiList(filt, dn === 'styczna' ? 1000 : dn, well.magazyn);
        const canReduce =
            well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(parseInt(String(dn)));
        const topConfigs = 2; // konus + fallback DIN (solverAutoSelect.js:398-415)
        const stages = 5;
        const bestCase = dennice.length * 1; // stage Standard, 1 top
        const worstCase = dennice.length * topConfigs * stages;
        const redWorst = canReduce ? 40 * dennice.length * 2 : 0;
        results.callBounds.push({
            case: cname,
            denniceCount: dennice.length,
            kregiCount: kregi.length,
            topConfigs,
            stages,
            dpCallsBest: bestCase,
            dpCallsWorstNoRed: worstCase,
            dpCallsWorstRed: redWorst,
            singleDpP50Ms: singleDpP50,
            projectedBestMs: round3(bestCase * singleDpP50),
            projectedWorstNoRedMs: round3(worstCase * singleDpP50),
            projectedWorstRedMs: round3((worstCase + redWorst) * singleDpP50)
        });
    }
}

function makeSolveCtx(seed) {
    // Kontekst z zaladowanym solverAutoSelect.js + fingerprint DP (harness only).
    const lines = [];
    const sb = makeSandbox(null);
    sb.logger = {
        debug() {},
        info(...a) {
            lines.push(a.join(' '));
        },
        warn() {},
        error() {}
    };
    sb.showToast = () => {};
    sb.getCurrentWell = () => null;
    sb.fmtInt = (v) => String(v);
    sb.FLOW_TYPES = {};
    for (const f of [
        'globals.js',
        'ruleEngine.js',
        'wellConfigRules.js',
        'ringOptimizer.js',
        'solverAutoSelect.js'
    ]) {
        vm.runInContext(readJs(f), sb, { filename: f });
    }
    const keys = [];
    sb.optimizeRingsForDistance__orig = vm.runInContext('optimizeRingsForDistance', sb);
    sb.__dpKeys = keys;
    vm.runInContext(
        `optimizeRingsForDistance = (function(){ const __o = optimizeRingsForDistance__orig; return function(target, rings, tolB, tolA, trans, avail, fixedH){ const hs=[...new Set((rings||[]).map(r=>Number(r.height)))].sort((a,b)=>a-b); __dpKeys.push([target,tolB,tolA,hs.join('+'),(trans||[]).length,fixedH].join('|')); return __o.apply(this, arguments); }; })();`,
        sb
    );
    sb.window.studnieProducts = seed;
    return { sb, keys, lines };
}

async function seriesFullSolve(results) {
    // F: 3 przypadki x [warmup + repeats] na swiezym kontekscie per iteracja.
    const seed = loadSeedCatalog();
    const transProd = seed.find((p) => p.componentType === 'przejscie');
    const cases = QUICK
        ? [['DN1000-3m-0prz', makeWell({})]]
        : [
              ['DN1000-3m-0prz', makeWell({})],
              [
                  'DN1000-4m-2prz',
                  makeWell({
                      rzednaWlazu: 4.0,
                      wellHeight: 4000,
                      przejscia: [
                          { productId: transProd.id, rzednaWlaczenia: 1.0 },
                          { productId: transProd.id, rzednaWlaczenia: 1.8 }
                      ]
                  })
              ],
              [
                  'DN1500-5m-red',
                  makeWell({ dn: 1500, redukcjaDN1000: true, rzednaWlazu: 5.0, wellHeight: 5000 })
              ]
          ];
    for (const [cname, well] of cases) {
        const stats = [];
        const totalIters = WARMUP + REPEATS;
        // Jeden kontekst per case (load vm poza pomiarem); reset kluczy per iteracja.
        const ctx = makeSolveCtx(seed);
        for (let i = 0; i < totalIters; i++) {
            const w = JSON.parse(JSON.stringify(well));
            // Prod well.dn to number (createNewWell(name, dn=1000)); string psuje KROK 4.
            if (w.dn !== 'styczna' && typeof w.dn !== 'number') w.dn = parseInt(w.dn);
            const avail = ctx.sb
                .getAvailableProducts(w)
                .filter((p) => ctx.sb.filterByWellParams(p, w));
            const requiredMm = Math.round((w.rzednaWlazu - (w.rzednaDna || 0)) * 1000);
            ctx.keys.length = 0;
            ctx.lines.length = 0;
            const t0 = process.hrtime.bigint();
            await ctx.sb.runJsAutoSelection(w, requiredMm, avail);
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            if (i >= WARMUP) {
                const uniq = new Set(ctx.keys).size;
                const stage =
                    (ctx.lines.find((l) => l.includes('Rozwiązanie znalezione w stage:')) || '')
                        .split('stage:')[1]
                        ?.trim() || '?';
                stats.push({ calls: ctx.keys.length, uniq, ms, stage });
            }
        }
        const calls = stats.map((s) => s.calls);
        const uniqs = stats.map((s) => s.uniq);
        const mss = stats.map((s) => s.ms).sort((a, b) => a - b);
        const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        results.fullSolve.push({
            case: cname,
            dpCallsAvg: round3(avg(calls)),
            uniqueDpAvg: round3(avg(uniqs)),
            redundantPct: round3((1 - avg(uniqs) / Math.max(1, avg(calls))) * 100),
            wallP50Ms: round3(pct(mss, 50)),
            wallP95Ms: round3(pct(mss, 95)),
            stage: stats[stats.length - 1].stage
        });
    }
}

function seriesSolverProxy(ctx, results) {
    // E: pełny łańcuch bez DOM: filtr → dennica → top → kregi → DP → AVR → layout.
    const seed = loadSeedCatalog();
    const cases = QUICK
        ? [['DN1000-3m-0prz', makeWell({})]]
        : [
              ['DN1000-3m-0prz', makeWell({})],
              [
                  'DN1000-3m-2prz',
                  makeWell({
                      przejscia: [
                          {
                              productId: seed.find((p) => p.componentType === 'przejscie')?.id,
                              rzednaWlaczenia: 1.0
                          },
                          {
                              productId: seed.find((p) => p.componentType === 'przejscie')?.id,
                              rzednaWlaczenia: 1.8
                          }
                      ],
                      rzednaWlazu: 4.0,
                      wellHeight: 4000
                  })
              ],
              [
                  'DN1500-5m-red',
                  makeWell({ dn: '1500', redukcjaDN1000: true, rzednaWlazu: 5.0, wellHeight: 5000 })
              ]
          ];
    for (const [cname, well] of cases) {
        ctx.setProducts(seed);
        const runOnce = () => {
            const t0 = process.hrtime.bigint();
            const avail = ctx.sb.getAvailableProducts(well);
            const filt = avail.filter((p) => ctx.sb.filterByWellParams(p, well));
            const den = ctx.sb.getLowestDennicaHybrid(
                filt,
                well.dn,
                well.magazyn,
                well.przejscia,
                well.rzednaDna,
                well.stycznaDn
            );
            const top = ctx.sb.getTopClosure(filt, 1000, null, false, well.magazyn);
            const kregi = ctx.sb.getKregiList(filt, 1000, well.magazyn);
            const dp = ctx.sb.optimizeRingsForDistance(1500, kregi, 260, 20, null, null, 0);
            const avr = avrFillReplica(
                120,
                [
                    { id: 'a', height: 60 },
                    { id: 'b', height: 80 },
                    { id: 'c', height: 100 }
                ],
                null
            );
            if (den.dennica && dp.selectedRings) {
                ctx.sb.buildCandidateLayouts(
                    den.dennica,
                    dp.selectedRings.map((r) => ({
                        productId: r.id,
                        quantity: 1,
                        _h: Number(r.height)
                    })),
                    well,
                    filt
                );
            }
            return { ms: Number(process.hrtime.bigint() - t0) / 1e6, top: !!top, avr };
        };
        for (let w = 0; w < WARMUP; w++) runOnce();
        const times = [];
        for (let r = 0; r < REPEATS; r++) times.push(runOnce().ms);
        const sorted = [...times].sort((a, b) => a - b);
        results.solverProxy.push({
            case: cname,
            p50Ms: round3(pct(sorted, 50)),
            p95Ms: round3(pct(sorted, 95)),
            maxMs: round3(sorted[sorted.length - 1])
        });
    }
}

// ---------- main ----------
async function main() {
    const tStart = Date.now();
    const seed = loadSeedCatalog();
    const results = {
        meta: {
            node: process.version,
            v8: process.versions.v8,
            cpu: os.cpus()[0]?.model || 'unknown',
            cpuCount: os.cpus().length,
            platform: `${os.platform()} ${os.arch()}`,
            totalMemMb: Math.round(os.totalmem() / 1048576),
            date: new Date().toISOString(),
            repeats: REPEATS,
            warmup: WARMUP,
            quick: QUICK,
            catalogs: {
                seedSize: seed.length,
                seedByType: seed.reduce((m, p) => {
                    m[p.componentType] = (m[p.componentType] || 0) + 1;
                    return m;
                }, {}),
                kragHeights: [
                    ...new Set(
                        seed.filter((p) => p.componentType === 'krag').map((p) => String(p.height))
                    )
                ],
                avrHeights: seed
                    .filter((p) => p.componentType === 'avr')
                    .map((p) => Number(p.height))
            },
            stages: [
                'DP scaling (optimizeRingsForDistance, real)',
                'AVR (replica + counters)',
                'filter (real)',
                'AI (real logic, stub net)',
                'solver proxy (real chain, no DOM)'
            ],
            notes: [
                'Kod prod ładowany bez modyfikacji; liczniki DP wstrzyknięte string-replace w kopii w pamięci.',
                'findBestAvrFill zagnieżdżona w runJsAutoSelection — mierzona wierna replika (serie B).',
                'Excel _excelRenderTable/DOM/layout/paint: brak headless DOM w harnessie — krok manualny w raporcie.',
                'Backend /ai/predict/batch: model.predict O(29x10) ~ us; dominuje getActiveModel(DB)+zod — live-probe opcjonalny.'
            ]
        },
        dpScaling: [],
        dpWithTransitions: [],
        avr: [],
        filter: [],
        ai: { buildFeatureVector10: null, variants: [] },
        callBounds: [],
        solverProxy: [],
        fullSolve: [],
        perFunction: null
    };

    // cold vs warm: cold = nowy kontekst co iterację dla serii DP-rep
    const sbWarm = loadProd();
    const ctx = {
        sb: sbWarm,
        setProducts(arr) {
            sbWarm.window.studnieProducts = arr;
        }
    };
    await seriesDP(ctx, results);
    seriesAVR(results);
    seriesFilter(ctx, results);
    await seriesAI((stub) => loadProd(stub), results);
    seriesCallBounds(ctx, results);
    seriesSolverProxy(ctx, results);
    await seriesFullSolve(results);

    // cold-cache sanity: 1× świeży kontekst, seria DP cap=3000
    {
        const times = [];
        for (let r = 0; r < Math.min(REPEATS, 10); r++) {
            const fresh = loadProd();
            fresh.window.studnieProducts = seed;
            const kregi = seed.filter((p) => p.componentType === 'krag' && String(p.dn) === '1000');
            const t0 = process.hrtime.bigint();
            fresh.optimizeRingsForDistance(3000, kregi, 260, 20, null, null, 0);
            times.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        const sorted = [...times].sort((a, b) => a - b);
        results.coldCacheDP3000 = {
            p50Ms: round3(pct(sorted, 50)),
            p95Ms: round3(pct(sorted, 95)),
            maxMs: round3(sorted[sorted.length - 1])
        };
    }

    results.perFunction = summarize(Object.values(results.perFunction || {}).length ? 0 : 1);
    // udział% względem sumy totali (nie wall-clock): przelicz
    {
        const total = Object.values(results.perFunction).reduce((a, s) => a + s.totalMs, 0);
        for (const k of Object.keys(results.perFunction)) {
            results.perFunction[k].sharePct =
                total > 0 ? round3((results.perFunction[k].totalMs / total) * 100) : 0;
        }
    }
    results.meta.wallClockSec = round3((Date.now() - tStart) / 1000);

    fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
    fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2), 'utf8');

    // konsola: skrót
    console.log(
        `== benchmark-autoselect (${QUICK ? 'quick' : 'full'}): repeats=${REPEATS} warmup=${WARMUP} ==`
    );
    console.log(
        `node ${process.version} v8 ${process.versions.v8} | ${results.meta.cpu} x${results.meta.cpuCount}`
    );
    console.log(`seed: ${seed.length} produktów`);
    console.log('\n-- DP scaling (bez przejść) --');
    for (const r of results.dpScaling) {
        console.log(
            `cap=${r.cap} h=${r.heights}: p50=${r.p50Ms}ms p95=${r.p95Ms}ms max=${r.maxMs}ms`
        );
    }
    console.log('\n-- DP z przejściami (alt-rebuild) --');
    for (const r of results.dpWithTransitions) {
        console.log(
            `cap=${r.cap} h=${r.heights}: alt/run=${r.altCallsPerRun} p95=${r.p95Ms}ms max=${r.maxMs}ms`
        );
    }
    console.log('\n-- AVR (replika) --');
    for (const r of results.avr) {
        console.log(
            `def=${r.deficit} typy=${r.avrTypes}: visited p95=${r.visitedP95} timeout=${r.timeoutRate} p95=${r.p95Ms}ms`
        );
    }
    console.log('\n-- filtr katalogu --');
    for (const r of results.filter) {
        console.log(`${r.catalog}/${r.well}: p95=${r.p95Ms}ms`);
    }
    console.log('\n-- AI --');
    console.log(`buildFeatureVector x10: p95=${results.ai.buildFeatureVector10.p95Ms}ms`);
    for (const v of results.ai.variants) {
        console.log(
            `${v.variant}: cold p95=${v.coldP95Ms}ms | warm p50=${v.warmP50Ms}ms p95=${v.warmP95Ms}ms online=${v.mlOnline}`
        );
    }
    console.log('\n-- call bounds (DP wywołań per auto-dobór) --');
    for (const r of results.callBounds) {
        console.log(
            `${r.case}: dennice=${r.denniceCount} best=${r.dpCallsBest} worst=${r.dpCallsWorstNoRed} red=${r.dpCallsWorstRed} projBest=${r.projectedBestMs}ms projWorst=${r.projectedWorstNoRedMs}ms projRed=${r.projectedWorstRedMs}ms`
        );
    }
    console.log('\n-- full-solve fingerprint (P0-1) --');
    for (const r of results.fullSolve) {
        console.log(
            `${r.case}: dp=${r.dpCallsAvg} unique=${r.uniqueDpAvg} redundant=${r.redundantPct}% wall p95=${r.wallP95Ms}ms stage=${r.stage}`
        );
    }
    console.log('\n-- solver proxy --');
    for (const r of results.solverProxy) {
        console.log(`${r.case}: p50=${r.p50Ms}ms p95=${r.p95Ms}ms max=${r.maxMs}ms`);
    }
    console.log('\n-- per-function top (total) --');
    const top = Object.entries(results.perFunction)
        .sort((a, b) => b[1].totalMs - a[1].totalMs)
        .slice(0, 10);
    for (const [n, s] of top) {
        console.log(
            `${n}: calls=${s.calls} total=${s.totalMs}ms/call=${s.perCallMs}ms p95=${s.p95Ms}ms share=${s.sharePct}%`
        );
    }
    console.log(`\nJSON: ${JSON_OUT}`);
}

main().catch((e) => {
    console.error('[benchmark-autoselect] Błąd:', e);
    process.exit(1);
});
