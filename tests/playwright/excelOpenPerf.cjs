/**
 * F1a pomiar: open Excela na fixture 1200 (plan 2026-09-12-excel-gates-f1a).
 * Dwa OSOBNE protokoly (nie mieszac wynikow):
 *   cold: 5x swiezy kontekst (start strony, fixture, pierwszy modal, cache miss)
 *   warm: 5x close+reopen modala w tej samej stronie (istniejacy runtime, cache)
 * Mierzy: openMs + stage open-* (?perf=1); cold dodatkowo switch-tab ms x6,
 * scroll-slice stage, keystroke ms, koszt ticku pollingu. Mediany osobno.
 *
 * Definicja openMs: od rozpoczecia openExcelTableModal() do pierwszego
 * spelnienia warunku gotowosci (wiersze > 0); polling obserwacyjny co 200 ms
 * jest mechanizmem detekcji, nie czescia metryki (blad systematyczny do
 * ~200 ms); do porownan miarodajny open-total ze stage'y ?perf=1.
 *
 * Run:   node tests/playwright/excelOpenPerf.cjs
 * Wymaga: backend na localhost:3000
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPerfWells } = require('./excelPerfFixture.cjs');

const BASE = 'http://localhost:3000';
const RUNS_COLD = 5;
const RUNS_WARM = 5;
const OUT = path.join(__dirname, '../../docs/plans/baseline-excel-open-1200-f1.json');

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright.');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();
const CHROME_PATH =
    process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1234\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function median(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

async function measureOpenOnly(frame) {
    return frame.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const rows = () =>
            [...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')].filter(
                (r) => r.style.display !== 'none'
            ).length;
        __excelPerfReset();
        const t0 = performance.now();
        openExcelTableModal();
        for (let i = 0; i < 150; i++) {
            await wait(200);
            if (rows() > 0) break;
        }
        const out = {};
        out.openMs = Math.round(performance.now() - t0);
        out.rows = rows();
        out.openStages = __excelPerfReport();
        return out;
    });
}

async function measureRun(frame, fixture) {
    await frame.evaluate((d) => {
        // eslint-disable-next-line no-global-assign
        wells = d;
    }, fixture);
    const out = await measureOpenOnly(frame);
    const rest = await frame.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const o = {};
        const tabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
        o.tabMs = {};
        for (const t of tabs) {
            const a = performance.now();
            excelSwitchTab(t);
            await wait(300);
            o.tabMs[t] = Math.round(performance.now() - a);
        }
        excelSwitchTab('1000');
        await wait(300);
        __excelPerfReset();
        const cont = document.getElementById('excel-table-container');
        for (const p of [0, 0.25, 0.5, 0.75, 1, 0]) {
            if (cont) cont.scrollTop = cont.scrollHeight * p;
            await wait(400);
        }
        o.scrollStages = __excelPerfReport();
        const row = document.querySelector('#excel-table-container tbody tr[data-widx]');
        const wIdx = row ? parseInt(row.getAttribute('data-widx'), 10) : -1;
        const inp = row ? row.querySelector('input[data-field="rzednaWlazu"]') : null;
        if (inp) inp.value = '7.7';
        const k0 = performance.now();
        excelOnRzednaChange(wIdx);
        await wait(1200);
        o.editMs = Math.round(performance.now() - k0);
        const s0 = performance.now();
        _excelBuildWellsSnapshot();
        o.pollSnapMs = Math.round((performance.now() - s0) * 10) / 10;
        const u0 = performance.now();
        _excelSyncAutoManualUI();
        o.pollSyncMs = Math.round((performance.now() - u0) * 10) / 10;
        return o;
    });
    return Object.assign(out, rest);
}

async function openFrame(browser, token) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.addInitScript((t) => {
        localStorage.setItem('authToken', t);
        window.__EXCEL_PERF__ = true;
    }, token);
    await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'load', timeout: 60000 });
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
    if (!frame) throw new Error('No frame');
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
    return { context, page, frame };
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const loginCtx = await browser.newContext();
        const loginPage = await loginCtx.newPage();
        const loginResp = await loginPage.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const lj = await loginResp.json();
        const token = lj.token || lj.authToken;
        if (!token) throw new Error('Login failed');
        await loginCtx.close();

        const fixture = buildPerfWells();
        // COLD: swiezy kontekst per proba (start strony, fixture, pierwszy modal)
        const cold = [];
        for (let r = 0; r < RUNS_COLD; r++) {
            const { context, frame } = await openFrame(browser, token);
            const m = await measureRun(frame, fixture);
            console.log(`COLD ${r + 1}: openMs=${m.openMs} rows=${m.rows} editMs=${m.editMs}`);
            console.log(`  tabMs=${JSON.stringify(m.tabMs)}`);
            console.log(`  pollSnapMs=${m.pollSnapMs} pollSyncMs=${m.pollSyncMs}`);
            cold.push(m);
            await context.close();
        }
        // WARM: ta sama strona, close+reopen modala (istniejacy runtime, cache)
        const { context: warmCtx, frame: warmFrame } = await openFrame(browser, token);
        await warmFrame.evaluate((d) => {
            // eslint-disable-next-line no-global-assign
            wells = d;
        }, fixture);
        await warmFrame.evaluate(async () => {
            openExcelTableModal();
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < 150; i++) {
                const n = document.querySelectorAll(
                    '#excel-table-container tbody tr[data-widx]'
                ).length;
                if (n > 0) break;
                await wait(200);
            }
        });
        const warm = [];
        for (let r = 0; r < RUNS_WARM; r++) {
            await warmFrame.evaluate(async () => {
                await closeExcelTableModal();
            });
            await sleep(500);
            const m = await measureOpenOnly(warmFrame);
            console.log(`WARM ${r + 1}: openMs=${m.openMs} rows=${m.rows}`);
            warm.push(m);
        }
        await warmCtx.close();
        const med = (arr, f) => median(arr.map(f));
        const medStage = (arr, src, stage, field) =>
            median(arr.map((r) => (r[src][stage] && r[src][stage][field]) || 0));
        const stageMed = (arr, src) => {
            const o = {};
            for (const s of Object.keys(arr[0][src])) {
                o[s] = {
                    avg: medStage(arr, src, s, 'avg'),
                    p50: medStage(arr, src, s, 'p50'),
                    p95: medStage(arr, src, s, 'p95'),
                    max: medStage(arr, src, s, 'max')
                };
            }
            return o;
        };
        const baseline = {
            generated: new Date().toISOString(),
            fixture: { total: fixture.length, seed: 20260912 },
            coldRuns: RUNS_COLD,
            warmRuns: RUNS_WARM,
            cold: {
                openMs: med(cold, (r) => r.openMs),
                openStages: stageMed(cold, 'openStages'),
                tabMs: Object.fromEntries(
                    Object.keys(cold[0].tabMs).map((t) => [t, med(cold, (r) => r.tabMs[t])])
                ),
                scrollStages: stageMed(cold, 'scrollStages'),
                editMs: med(cold, (r) => r.editMs),
                pollSnapMs: med(cold, (r) => r.pollSnapMs),
                pollSyncMs: med(cold, (r) => r.pollSyncMs)
            },
            warm: {
                openMs: med(warm, (r) => r.openMs),
                openStages: stageMed(warm, 'openStages')
            }
        };
        fs.writeFileSync(OUT, JSON.stringify(baseline, null, 2) + '\n');
        console.log('BASELINE zapisany: ' + OUT);
        console.log(
            JSON.stringify(
                { coldOpenMs: baseline.cold.openMs, warmOpenMs: baseline.warm.openMs },
                null,
                1
            )
        );
    } finally {
        await browser.close();
    }
})();
