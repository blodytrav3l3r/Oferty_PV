/**
 * Hang-2000 A/B: REGRESSION (Faza 2 e66f7af) vs PRE_EXISTING.
 * Protokol: fixture 2000 (seed 20260912 + deterministyczny slice 800 z seeda
 * 20260913, re-id perf2-*), S1 hold-Arrow 200x, S2 Tab 100x, S3 paste-2000,
 * liczniki render/preview/autosel via monkey-patch, longtask observer,
 * ?perf=1, 5x na strone z interleavem A/B/A/B, viewport 1600x1000, virtual ON.
 * Bramki (porownanie median A vs B): P95 x1.3+100ms, longtask-max,
 * render-count +2, total x1.5.
 *
 * Zaladowanie oferty: in-memory injection `wells = fixture` (jak
 * excelOpenPerf.cjs) - NAJSZYBSZA droga, zero bulk-POST, determinizm 100%,
 * ten sam obiekt fixture dla A i B. Backend A i B ma identyczny kod
 * (1b12acb..HEAD: zero zmian src/prisma), wiec DB nie jest na sciezce
 * pomiaru - sluzy tylko do auth + serwowania plikow + produktow.
 *
 * BASE z env: BENCH_BASE_URL_A (domyslnie http://localhost:3100),
 * BENCH_BASE_URL_B (domyslnie http://localhost:3101). Brak hardcoded :3000.
 * Login: TEST_ADMIN_PASSWORD, fallback bench-test-pass-2000, potem anim123456.
 * Schowek headless: direct _excelHandlePaste z mock clipboardData
 * (Ctrl+V w headless-shell niestabilny - mock deterministyczny dla A i B).
 *
 * Run:  BENCH_BASE_URL_A=http://localhost:3100 BENCH_BASE_URL_B=http://localhost:3101 \
 *         TEST_ADMIN_PASSWORD=xxx node tests/playwright/excelHang2000.cjs
 * OUT: docs/plans/hang-2000-harness-A-B.json ( medians + verdict ).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPerfWells } = require('./excelPerfFixture.cjs');
const { chromeLaunchOptions, getLaunchArgs } = require('./throttleHelper.cjs');

const BASE_A = process.env.BENCH_BASE_URL_A || 'http://localhost:3100';
const BASE_B = process.env.BENCH_BASE_URL_B || 'http://localhost:3101';
const RUNS = 5;
const S1_STEPS = 200;
const S2_STEPS = 100;
const S3_ROWS = 2000;
const FIXTURE_SEED = 20260912;
const OUT = path.join(__dirname, '../../docs/plans/hang-2000-harness-A-B.json');

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright.');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function stats(arr) {
    const s = (arr || []).slice().sort((a, b) => a - b);
    if (!s.length) return { n: 0, mean: 0, p50: 0, p95: 0, max: 0, sum: 0 };
    const sum = s.reduce((a, b) => a + b, 0);
    const r = (v) => Math.round(v * 10) / 10;
    return {
        n: s.length,
        mean: r(sum / s.length),
        p50: r(quantile(s, 0.5)),
        p95: r(quantile(s, 0.95)),
        max: r(s[s.length - 1]),
        sum: r(sum)
    };
}

function median(arr) {
    return stats(arr).p50;
}

/* Fixture 2000: baza 1200 (seed protokolu) + 800 z seeda+1, re-id perf2-*.
 * Ten sam kod = ten sam fixture dla A i B (determinizm bez zaleznosci). */
function buildHangWells() {
    const base = buildPerfWells(FIXTURE_SEED);
    const extra = buildPerfWells(FIXTURE_SEED + 1).slice(0, S3_ROWS - base.length);
    extra.forEach((w, i) => {
        const n = base.length + i;
        const tag = 'Perf2-' + w.dn + '-' + String(n).padStart(4, '0');
        w.id = 'perf2-well-' + String(n).padStart(4, '0');
        w.name = tag;
        w.numer = tag;
        (w.przejscia || []).forEach((t, ti) => {
            t.id = 'perf2-prz-' + n + '-' + ti;
        });
    });
    return base.concat(extra);
}

function buildPasteTsv() {
    const lines = [];
    for (let i = 0; i < S3_ROWS; i++) {
        lines.push((2 + (i % 50) * 0.01).toFixed(2));
    }
    return lines.join('\n');
}

async function loginToken(browser, base) {
    const pw = process.env.TEST_ADMIN_PASSWORD;
    if (!pw) throw new Error('Brak TEST_ADMIN_PASSWORD w env (fail-fast, bez fallbacku)');
    const passwords = [pw];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let token = null;
    let used = null;
    for (const pw of passwords) {
        const resp = await page.request.post(base + '/api/auth/login', {
            data: { username: 'admin', password: pw }
        });
        if (resp.status() === 200) {
            const sc = resp.headers()['set-cookie'] || '';
            const m = /authToken=([^;]+)/.exec(sc);
            if (m) {
                token = m[1];
                used = pw === process.env.TEST_ADMIN_PASSWORD ? 'env' : 'fallback';
                break;
            }
        }
    }
    await ctx.close();
    if (!token) throw new Error('Login failed on ' + base);
    return { token, used };
}

async function openSample(browser, base, token, fixture) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await context.addCookies([{ name: 'authToken', value: token, domain: 'localhost', path: '/' }]);
    /* ?perf=1 w hashu -> router propaguje do iframe studnie.html?perf=1 (SOT perf). */
    await page.goto(base + '/app.html#/studnie?perf=1', { waitUntil: 'load', timeout: 60000 });
    await sleep(2500);
    const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
        timeout: 60000,
        state: 'attached'
    });
    await sleep(2500);
    let frame = await iframeEl.contentFrame();
    for (let i = 0; i < 20 && !frame; i++) {
        await sleep(1000);
        frame = await iframeEl.contentFrame();
    }
    if (!frame) throw new Error('No frame on ' + base);
    for (let i = 0; i < 15; i++) {
        const c = await frame.evaluate(() => {
            try {
                return studnieProducts.length;
            } catch (_) {
                return -1;
            }
        });
        if (c > 0) break;
        await sleep(2000);
    }
    await frame.evaluate((d) => {
        // eslint-disable-next-line no-global-assign
        wells = d;
    }, fixture);
    await frame.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        openExcelTableModal();
        for (let i = 0; i < 150; i++) {
            const n = document.querySelectorAll(
                '#excel-table-container tbody tr[data-widx]'
            ).length;
            if (n > 0) break;
            await wait(200);
        }
    });
    const info = await frame.evaluate(() => {
        const rows = document.querySelectorAll(
            '#excel-table-container tbody tr[data-widx]'
        ).length;
        let perfOn = false;
        try {
            perfOn = typeof _excelPerfOn === 'function' ? _excelPerfOn() : !!window.__EXCEL_PERF__;
        } catch (_) {}
        return { rows, perfOn, virtual: typeof _excelVirtualIsEnabled === 'function' ? _excelVirtualIsEnabled() : null };
    });
    if (info.rows === 0) throw new Error('Excel opened with 0 rows on ' + base);
    return { context, page, frame, openInfo: info };
}

async function installProbes(frame) {
    return frame.evaluate(() => {
        window.__hangCounters = { render: 0, preview: 0, autosel: 0 };
        const wrapped = { render: false, preview: false, autosel: false };
        try {
            if (typeof window._excelRenderTable === 'function') {
                const orig = window._excelRenderTable;
                window._excelRenderTable = function () {
                    window.__hangCounters.render++;
                    return orig.apply(this, arguments);
                };
                wrapped.render = true;
            }
        } catch (_) {}
        try {
            if (typeof window._excelSyncMainPreview === 'function') {
                const orig = window._excelSyncMainPreview;
                window._excelSyncMainPreview = function () {
                    window.__hangCounters.preview++;
                    return orig.apply(this, arguments);
                };
                wrapped.preview = true;
            }
        } catch (_) {}
        try {
            if (typeof window._excelAutoSelectForWell === 'function') {
                const orig = window._excelAutoSelectForWell;
                window._excelAutoSelectForWell = function () {
                    window.__hangCounters.autosel++;
                    return orig.apply(this, arguments);
                };
                wrapped.autosel = true;
            }
        } catch (_) {}
        window.__hangLT = [];
        window.__hangLTSupported = false;
        try {
            if (typeof PerformanceObserver === 'function') {
                const obs = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    for (let i = 0; i < entries.length; i++) {
                        window.__hangLT.push(Math.round(entries[i].duration * 10) / 10);
                    }
                });
                obs.observe({ entryTypes: ['longtask'] });
                window.__hangLTSupported = true;
            }
        } catch (_) {}
        return { wrapped, ltSupported: window.__hangLTSupported };
    });
}

async function probeSnapshot(frame) {
    return frame.evaluate(() => {
        const c = window.__hangCounters || { render: 0, preview: 0, autosel: 0 };
        const lt = (window.__hangLT || []).slice();
        let max = 0;
        for (let i = 0; i < lt.length; i++) if (lt[i] > max) max = lt[i];
        return {
            counters: { render: c.render, preview: c.preview, autosel: c.autosel },
            longtask: { count: lt.length, max: max }
        };
    });
}

function diffSnap(after, before) {
    let ltMax = 0;
    return {
        render: after.counters.render - before.counters.render,
        preview: after.counters.preview - before.counters.preview,
        autosel: after.counters.autosel - before.counters.autosel,
        longtaskCount: after.longtask.count - before.longtask.count,
        longtaskMax: after.longtask.max > before.longtask.max ? after.longtask.max : before.longtask.max
    };
}

/* S1: hold-Arrow 200x - prawdziwe KeyboardEvent ArrowDown na aktywnej komorce,
 * key-to-paint: dispatch -> 2x rAF (paint granicy klatki). Sciezka jak user. */
async function runS1(frame) {
    const marks = await frame.evaluate(async (steps) => {
        const wait2raf = () =>
            new Promise((res) =>
                requestAnimationFrame(() => requestAnimationFrame(res))
            );
        const container = document.getElementById('excel-table-container');
        let first = document.querySelector(
            '#excel-table-container tbody tr[data-widx] input'
        );
        if (first) first.focus();
        const out = [];
        for (let i = 0; i < steps; i++) {
            let el = document.activeElement;
            if (!el || !container.contains(el)) {
                first = document.querySelector(
                    '#excel-table-container tbody tr[data-widx] input'
                );
                if (first) first.focus();
                el = document.activeElement;
            }
            const t0 = performance.now();
            el.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
            );
            await wait2raf();
            out.push(Math.round((performance.now() - t0) * 10) / 10);
        }
        return out;
    }, S1_STEPS);
    return stats(marks);
}

/* S2: Tab 100x - rotacja 6 zakladek, switch + 2x rAF per krok. */
async function runS2(frame) {
    const marks = await frame.evaluate(async (steps) => {
        const wait2raf = () =>
            new Promise((res) =>
                requestAnimationFrame(() => requestAnimationFrame(res))
            );
        const tabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
        const out = [];
        for (let i = 0; i < steps; i++) {
            const t0 = performance.now();
            excelSwitchTab(tabs[i % tabs.length]);
            await wait2raf();
            out.push(Math.round((performance.now() - t0) * 10) / 10);
        }
        excelSwitchTab('1000');
        await wait2raf();
        return out;
    }, S2_STEPS);
    return stats(marks);
}

/* S3: paste-2000 - TSV 2000x1 w rzednaWlazu od pierwszego wiersza, mock
 * clipboardData (headless Ctrl+V niestabilny). Total: call -> flaga opada. */
async function runS3(frame, tsv) {
    const t0 = Date.now();
    await frame.evaluate(async (text) => {
        const input = document.querySelector(
            '#excel-table-container tbody tr[data-widx] input[data-field="rzednaWlazu"]'
        );
        if (input) input.focus();
        const mockEvent = {
            clipboardData: { getData: () => text },
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        _excelHandlePaste(mockEvent);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 600; i++) {
            try {
                if (typeof _excelPasteInProgress !== 'undefined' && !_excelPasteInProgress) break;
            } catch (_) {
                break;
            }
            await wait(200);
        }
        await wait(1500);
    }, tsv);
    return { totalMs: Date.now() - t0 };
}

async function runSample(browser, base, token, fixture, tsv) {
    const { context, frame, openInfo } = await openSample(browser, base, token, fixture);
    try {
        const probes = await installProbes(frame);
        let before = await probeSnapshot(frame);
        const s1 = await runS1(frame);
        await sleep(1500);
        let snap = await probeSnapshot(frame);
        const s1x = diffSnap(snap, before);
        before = snap;
        const s2 = await runS2(frame);
        await sleep(1500);
        snap = await probeSnapshot(frame);
        const s2x = diffSnap(snap, before);
        before = snap;
        const s3 = await runS3(frame, tsv);
        snap = await probeSnapshot(frame);
        const s3x = diffSnap(snap, before);
        let perfStages = null;
        try {
            perfStages = await frame.evaluate(() =>
                typeof __excelPerfReport === 'function' ? __excelPerfReport() : null
            );
        } catch (_) {}
        return {
            openInfo, probes, s1: Object.assign(s1, { counters: s1x }),
            s2: Object.assign(s2, { counters: s2x }),
            s3: { totalMs: s3.totalMs, counters: s3x }
        };
    } finally {
        await context.close();
    }
}

/* Bramki median A vs B (§12): g1 P95 x1.3+100ms, g2 longtask-max (A>B),
 * g3 render-count +2 (A>B+2), g4 total x1.5. Werdykt: REGRESSION gdy g1/g4
 * (silne) lub >=2 sygnaly; PRE_EXISTING gdy hang na obu (S3>2000ms oba lub
 * S1.P95>50 oba lub longtaski oba); inaczej INCONCLUSIVE. */
function gate(value) {
    return value ? 'TRIP' : 'ok';
}

function buildVerdict(m) {
    const trips = [];
    const check = (id, cond) => {
        const t = !!cond;
        trips.push({ gate: id, trip: t });
        return t;
    };
    let strong = 0;
    let count = 0;
    const scenarios = ['s1', 's2'];
    scenarios.forEach((s) => {
        if (check('g1-p95-' + s, m.A[s].p95 > m.B[s].p95 * 1.3 + 100)) { count++; strong++; }
        if (check('g2-ltmax-' + s, m.A[s].counters.longtaskMax > m.B[s].counters.longtaskMax)) count++;
        if (check('g3-render-' + s, m.A[s].counters.render > m.B[s].counters.render + 2)) count++;
        if (check('g4-total-' + s, m.A[s].sum > m.B[s].sum * 1.5)) { count++; strong++; }
    });
    if (check('g1-total-s3', m.A.s3.totalMs > m.B.s3.totalMs * 1.3 + 100)) { count++; strong++; }
    if (check('g2-ltmax-s3', m.A.s3.counters.longtaskMax > m.B.s3.counters.longtaskMax)) count++;
    if (check('g3-render-s3', m.A.s3.counters.render > m.B.s3.counters.render + 2)) count++;
    if (check('g4-totalx-s3', m.A.s3.totalMs > m.B.s3.totalMs * 1.5)) { count++; strong++; }
    const hangBoth =
        (m.A.s3.totalMs > 2000 && m.B.s3.totalMs > 2000) ||
        (m.A.s1.p95 > 50 && m.B.s1.p95 > 50) ||
        (m.A.s1.counters.longtaskCount > 0 && m.B.s1.counters.longtaskCount > 0);
    let verdict = 'INCONCLUSIVE';
    if (strong >= 1 || count >= 2) verdict = 'REGRESSION';
    else if (hangBoth) verdict = 'PRE_EXISTING';
    return { trips, tripsFired: count, strongFired: strong, hangBoth, verdict };
}

(async () => {
    const tStart = Date.now();
    const browser = await chromium.launch(
        chromeLaunchOptions({
            headless: true,
            args: getLaunchArgs(['--no-sandbox', '--disable-setuid-sandbox'])
        })
    );
    try {
        const loginA = await loginToken(browser, BASE_A);
        const loginB = await loginToken(browser, BASE_B);
        console.log('login A(' + BASE_A + '):' + loginA.used + ' login B(' + BASE_B + '):' + loginB.used);
        const fixture = buildHangWells();
        console.log('fixture: ' + fixture.length + ' wells (seed ' + FIXTURE_SEED + ' + slice800 seed ' + (FIXTURE_SEED + 1) + ')');
        const tsv = buildPasteTsv();
        const samples = [];
        for (let r = 0; r < RUNS; r++) {
            const a = await runSample(browser, BASE_A, loginA.token, fixture, tsv);
            a.side = 'A';
            a.run = r + 1;
            console.log(
                'A run' + (r + 1) + ': s1p50=' + a.s1.p50 + ' p95=' + a.s1.p95 + ' max=' + a.s1.max +
                ' | s2p50=' + a.s2.p50 + ' p95=' + a.s2.p95 +
                ' | s3total=' + a.s3.totalMs + 'ms lt=' + a.s3.counters.longtaskCount + '/' + a.s3.counters.longtaskMax +
                ' render=' + a.s1.counters.render + '/' + a.s2.counters.render + '/' + a.s3.counters.render
            );
            const b = await runSample(browser, BASE_B, loginB.token, fixture, tsv);
            b.side = 'B';
            b.run = r + 1;
            console.log(
                'B run' + (r + 1) + ': s1p50=' + b.s1.p50 + ' p95=' + b.s1.p95 + ' max=' + b.s1.max +
                ' | s2p50=' + b.s2.p50 + ' p95=' + b.s2.p95 +
                ' | s3total=' + b.s3.totalMs + 'ms lt=' + b.s3.counters.longtaskCount + '/' + b.s3.counters.longtaskMax +
                ' render=' + b.s1.counters.render + '/' + b.s2.counters.render + '/' + b.s3.counters.render
            );
            samples.push(a, b);
        }
        const side = (s) => samples.filter((x) => x.side === s);
        const med = (arr, f) => median(arr.map(f));
        const mediansFor = (s) => {
            const arr = side(s);
            const cmed = (sc, f) => median(arr.map((x) => x[sc].counters[f]));
            const ltmed = (sc, f) => median(arr.map((x) => x[sc].counters[f]));
            return {
                s1: {
                    mean: med(arr, (x) => x.s1.mean), p50: med(arr, (x) => x.s1.p50),
                    p95: med(arr, (x) => x.s1.p95), max: med(arr, (x) => x.s1.max),
                    sum: med(arr, (x) => x.s1.sum),
                    counters: {
                        render: cmed('s1', 'render'), preview: cmed('s1', 'preview'),
                        autosel: cmed('s1', 'autosel'),
                        longtaskCount: ltmed('s1', 'longtaskCount'),
                        longtaskMax: ltmed('s1', 'longtaskMax')
                    }
                },
                s2: {
                    mean: med(arr, (x) => x.s2.mean), p50: med(arr, (x) => x.s2.p50),
                    p95: med(arr, (x) => x.s2.p95), max: med(arr, (x) => x.s2.max),
                    sum: med(arr, (x) => x.s2.sum),
                    counters: {
                        render: cmed('s2', 'render'), preview: cmed('s2', 'preview'),
                        autosel: cmed('s2', 'autosel'),
                        longtaskCount: ltmed('s2', 'longtaskCount'),
                        longtaskMax: ltmed('s2', 'longtaskMax')
                    }
                },
                s3: {
                    totalMs: med(arr, (x) => x.s3.totalMs),
                    counters: {
                        render: cmed('s3', 'render'), preview: cmed('s3', 'preview'),
                        autosel: cmed('s3', 'autosel'),
                        longtaskCount: ltmed('s3', 'longtaskCount'),
                        longtaskMax: ltmed('s3', 'longtaskMax')
                    }
                }
            };
        };
        const medians = { A: mediansFor('A'), B: mediansFor('B') };
        const v = buildVerdict(medians);
        const out = {
            generated: new Date().toISOString(),
            durationSec: Math.round((Date.now() - tStart) / 1000),
            protocol: {
                fixture: { total: fixture.length, seeds: [FIXTURE_SEED, FIXTURE_SEED + 1] },
                loadMethod: 'in-memory wells injection (identical object A/B, no bulk POST)',
                runs: RUNS, interleave: 'A/B/A/B per run, fresh context per sample',
                viewport: '1600x1000', virtual: 'ON default', perf: '?perf=1',
                s1: 'hold-Arrow 200x real KeyboardEvent, key-to-paint via 2x rAF',
                s2: 'Tab 100x excelSwitchTab rotation x6 + 2x rAF',
                s3: 'paste-2000 TSV 2000x1 via direct _excelHandlePaste mock clipboardData',
                gates: 'g1 P95 A>B*1.3+100ms; g2 longtask-max A>B; g3 render-count A>B+2; g4 total A>B*1.5',
                verdictRule: 'REGRESSION if >=1 strong (g1/g4) or >=2 trips; else PRE_EXISTING if hang on both (S3>2000ms both or S1.P95>50 both or longtasks both); else INCONCLUSIVE'
            },
            bases: { A: BASE_A, B: BASE_B },
            revisions: { A: 'main HEAD (Faza 2 e66f7af incl.)', B: '1b12acb pre-F2' },
            samples: samples,
            medians: medians,
            gates: v.trips,
            verdict: v.verdict,
            verdictDetail: { tripsFired: v.tripsFired, strongFired: v.strongFired, hangBoth: v.hangBoth }
        };
        fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
        console.log('OUT: ' + OUT);
        console.log('VERDICT: ' + v.verdict + ' (trips=' + v.tripsFired + ' strong=' + v.strongFired + ' hangBoth=' + v.hangBoth + ')');
        console.log('DURATION: ' + out.durationSec + 's');
    } finally {
        await browser.close();
    }
})();
