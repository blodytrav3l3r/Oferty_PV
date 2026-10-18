/**
 * F0: baseline heap + longtask + open/switch/edit Excela @ N studni.
 * Protokol: warmup (odrzucony) + RUNS probek per N; heap probkowany PO
 * wymuszonym GC (CDP HeapProfiler.collectGarbage -> Runtime.getHeapUsage).
 * Mediana per metryka. Fixture: realistyczny (buildPerfWells skalowany do N).
 *
 * Run:   node tests/playwright/excelHeapProbe.cjs
 * Env:   HEAP_NS=10,500,2000  HEAP_RUNS=3  BASE_URL=http://localhost:3000
 * Wymaga: backend na localhost:3000 (bez spawnu — wells wstrzykiwane do ramki).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const HOST = new URL(BASE).hostname;
const NS = (process.env.HEAP_NS || '10,500,2000')
    .split(',')
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0);
const RUNS = Number(process.env.HEAP_RUNS || 3);
const TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];

const { buildPerfWells } = require('./excelPerfFixture.cjs');
const {
    resolveChromePath,
    getLaunchArgs,
    resolveOutPath,
    applyThrottle
} = require('./throttleHelper.cjs');

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright.');
    process.exitCode = 1;
    throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();
const CHROME_FALLBACK =
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1234\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const CHROME_PATH = resolveChromePath(CHROME_FALLBACK);
const OUT_DEFAULT = path.join(__dirname, '../../docs/plans/baseline-excel-heap-f0.json');
const OUT = resolveOutPath(OUT_DEFAULT);

// Realistyczny fixture skalowany do N: bazowe 1200 -> cyklicznie z sufiksem id.
function makeWells(n) {
    const base = buildPerfWells();
    const out = [];
    for (let i = 0; i < n; i++) {
        const w = base[i % base.length];
        if (i < base.length) out.push(w);
        else
            out.push({
                ...w,
                id: w.id + '_' + i,
                name: w.name + '_' + i,
                numer: w.numer + '_' + i
            });
    }
    return out;
}

function median(arr) {
    const s = arr
        .filter((v) => Number.isFinite(v))
        .slice()
        .sort((a, b) => a - b);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

async function sampleHeap(cdp) {
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    return usedSize;
}

async function waitFrame(page) {
    const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
        timeout: 60000,
        state: 'attached'
    });
    let frame = await iframeEl.contentFrame();
    for (let i = 0; i < 20 && !frame; i++) {
        await page.waitForTimeout(1000);
        frame = await iframeEl.contentFrame();
    }
    if (!frame) throw new Error('No studnie frame');
    await frame
        .waitForFunction(
            () => {
                try {
                    return studnieProducts.length > 0;
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 30000 }
        )
        .catch(() => {});
    return frame;
}

async function runOnce(browser, token, n) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await applyThrottle(page);
    await context.addCookies([{ name: 'authToken', value: token, domain: HOST, path: '/' }]);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Runtime.enable');
    await cdp.send('HeapProfiler.enable');
    try {
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'load', timeout: 60000 });
        const frame = await waitFrame(page);
        await frame.evaluate((d) => {
            // eslint-disable-next-line no-global-assign
            wells = d;
            window.__lt = [];
            try {
                new PerformanceObserver((l) => {
                    for (const e of l.getEntries()) window.__lt.push(e.duration);
                }).observe({ type: 'longtask', buffered: false });
            } catch (_) {}
        }, makeWells(n));

        const heapBaselineLoaded = await sampleHeap(cdp);

        const opened = await frame.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const rows = () =>
                [...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')].filter(
                    (r) => r.style.display !== 'none'
                ).length;
            window.__lt = [];
            const t0 = performance.now();
            openExcelTableModal();
            for (let i = 0; i < 150; i++) {
                await wait(200);
                if (rows() > 0) break;
            }
            return { openMs: Math.round(performance.now() - t0), rows: rows() };
        });
        const heapAfterOpen = await sampleHeap(cdp);

        const tabRes = await frame.evaluate(async (tabs) => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const measurePass = async () => {
                const out = {};
                for (const t of tabs) {
                    const a = performance.now();
                    excelSwitchTab(t);
                    await wait(300);
                    out[t] = Math.round(performance.now() - a);
                }
                return out;
            };
            const pass1 = await measurePass();
            const pass2 = await measurePass();
            excelSwitchTab('1000');
            return { pass1, pass2 };
        }, TABS);
        const heapAfterSwitch = await sampleHeap(cdp);

        const split = await frame.evaluate(() => {
            const now = () => performance.now();
            const tab = '2000';
            const a = now();
            if (typeof _excelRecalcTabWellErrors === 'function') _excelRecalcTabWellErrors(tab);
            const recalc = Math.round(now() - a);
            _excelActiveTab = tab;
            const b = now();
            _excelRenderTabs();
            _excelRenderTable(tab);
            const render = Math.round(now() - b);
            return { recalcMs: recalc, renderMs: render };
        });

        let profile = null;
        if (process.env.HEAP_PROFILE) {
            profile = await frame.evaluate(() => {
                const names = [
                    '_excelRenderTbody',
                    '_excelApplyColWidths',
                    '_excelAutoFitColumns',
                    '_excelInitColumnResize',
                    '_excelInitColumnSelect',
                    '_excelApplyStickyColumns',
                    '_excelApplyLockedRows',
                    '_excelApplySortIfActive',
                    '_excelUpdateHeaderProdCodes',
                    '_excelVirtualBuildFiltered',
                    '_excelVirtualRenderBody',
                    '_excelGetFilteredIndexes',
                    '_excelRenderTabs',
                    'excelFilterWells'
                ];
                const acc = {};
                const cnt = {};
                const orig = {};
                names.forEach((n) => {
                    if (typeof window[n] === 'function') {
                        orig[n] = window[n];
                        acc[n] = 0;
                        cnt[n] = 0;
                        window[n] = function () {
                            const a = performance.now();
                            cnt[n]++;
                            const r = orig[n].apply(this, arguments);
                            acc[n] += performance.now() - a;
                            return r;
                        };
                    }
                });
                let total = 0;
                try {
                    _excelActiveTab = '1000';
                    const t0 = performance.now();
                    _excelRenderTable('2000');
                    total = performance.now() - t0;
                } catch (_e) {}
                names.forEach((n) => {
                    if (orig[n]) window[n] = orig[n];
                });
                const out = {};
                Object.keys(acc).forEach((k) => (out[k] = Math.round(acc[k])));
                return { total: Math.round(total), acc: out, cnt };
            });
        }

        const edit = await frame.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const row = document.querySelector('#excel-table-container tbody tr[data-widx]');
            const wIdx = row ? parseInt(row.getAttribute('data-widx'), 10) : -1;
            const inp = row ? row.querySelector('input[data-field="rzednaWlazu"]') : null;
            if (inp) inp.value = '7.7';
            const t1 = performance.now();
            excelOnRzednaChange(wIdx);
            let ok = false;
            for (let i = 0; i < 80; i++) {
                await wait(50);
                if (window.wells[wIdx] && wells[wIdx].rzednaWlazu === 7.7) {
                    ok = true;
                    break;
                }
            }
            return { editMs: Math.round(performance.now() - t1), ok };
        });
        const heapAfterEdit = await sampleHeap(cdp);

        const longtask = await frame.evaluate(() => {
            const arr = window.__lt || [];
            return {
                ltCount: arr.length,
                ltMax: arr.length ? Math.round(Math.max(...arr)) : 0,
                ltSum: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0)) : 0
            };
        });

        let serialize = null;
        if (process.env.HEAP_SERIALIZE === '1') {
            serialize = await frame.evaluate(async () => {
                const wait = (ms) => new Promise((r) => setTimeout(r, ms));
                window.__lt = [];
                const t0 = performance.now();
                const pricing = calculateOfferPricing(wells, 0, 0, 'none');
                const clone = structuredClone(wells);
                if (typeof stripWellRuntimeFields === 'function') stripWellRuntimeFields(clone);
                const json = JSON.stringify({
                    wells: clone,
                    wellsExport: pricing.wellsForExport
                });
                const ms = Math.round(performance.now() - t0);
                await wait(150);
                const arr = window.__lt || [];
                return {
                    ms,
                    bytes: json.length,
                    wellsExportLen: Array.isArray(pricing.wellsForExport)
                        ? pricing.wellsForExport.length
                        : -1,
                    ltMax: arr.length ? Math.round(Math.max(...arr)) : 0,
                    ltSum: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0)) : 0
                };
            });
        }

        await frame.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            // ponytail: probe mierzy tylko heap — czyscimy dirty, by close nie czekal na appConfirm
            try {
                _excelDirty = false;
            } catch (_) {}
            const t0 = performance.now();
            await closeExcelTableModal();
            await wait(200);
            return Math.round(performance.now() - t0);
        });
        const heapAfterClose = await sampleHeap(cdp);

        return {
            n,
            rows: opened.rows,
            openMs: opened.openMs,
            tabMedianMs: median(Object.values(tabRes.pass1)),
            tabMedianWarmMs: median(Object.values(tabRes.pass2)),
            tabMs: tabRes.pass1,
            tabMsWarm: tabRes.pass2,
            editMs: edit.editMs,
            editOk: edit.ok,
            ...longtask,
            serialize,
            split,
            profile,
            heap: {
                baselineLoaded: heapBaselineLoaded,
                afterOpen: heapAfterOpen,
                afterSwitch: heapAfterSwitch,
                afterEdit: heapAfterEdit,
                afterClose: heapAfterClose,
                deltaOpen: heapAfterOpen - heapBaselineLoaded,
                retainedAfterClose: heapAfterClose - heapBaselineLoaded
            }
        };
    } finally {
        await context.close();
    }
}

function medianRun(runs) {
    const pick = (fn) => median(runs.map(fn));
    return {
        n: runs[0].n,
        rows: runs[0].rows,
        openMs: pick((r) => r.openMs),
        tabMedianMs: pick((r) => r.tabMedianMs),
        tabMedianWarmMs: pick((r) => r.tabMedianWarmMs),
        split: {
            recalcMs: pick((r) => r.split.recalcMs),
            renderMs: pick((r) => r.split.renderMs)
        },
        profile: runs.map((r) => r.profile).find(Boolean) || null,
        editMs: pick((r) => r.editMs),
        editOk: runs.every((r) => r.editOk),
        ltCount: pick((r) => r.ltCount),
        ltMax: pick((r) => r.ltMax),
        ltSum: pick((r) => r.ltSum),
        serialize: runs[0].serialize
            ? {
                  ms: pick((r) => r.serialize.ms),
                  bytes: pick((r) => r.serialize.bytes),
                  wellsExportLen: runs[0].serialize.wellsExportLen,
                  ltMax: pick((r) => r.serialize.ltMax),
                  ltSum: pick((r) => r.serialize.ltSum)
              }
            : null,
        heap: {
            baselineLoaded: pick((r) => r.heap.baselineLoaded),
            afterOpen: pick((r) => r.heap.afterOpen),
            afterSwitch: pick((r) => r.heap.afterSwitch),
            afterEdit: pick((r) => r.heap.afterEdit),
            afterClose: pick((r) => r.heap.afterClose),
            deltaOpen: pick((r) => r.heap.deltaOpen),
            retainedAfterClose: pick((r) => r.heap.retainedAfterClose)
        }
    };
}

async function runCycles(browser, token, n, cycles) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await applyThrottle(page);
    await context.addCookies([{ name: 'authToken', value: token, domain: HOST, path: '/' }]);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Runtime.enable');
    await cdp.send('HeapProfiler.enable');
    try {
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'load', timeout: 60000 });
        const frame = await waitFrame(page);
        await frame.evaluate((d) => {
            // eslint-disable-next-line no-global-assign
            wells = d;
        }, makeWells(n));
        const baseline = await sampleHeap(cdp);
        const per = [];
        for (let c = 0; c < cycles; c++) {
            await frame.evaluate(async () => {
                const wait = (ms) => new Promise((r) => setTimeout(r, ms));
                const rows = () =>
                    [
                        ...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')
                    ].filter((r) => r.style.display !== 'none').length;
                openExcelTableModal();
                for (let i = 0; i < 150; i++) {
                    await wait(200);
                    if (rows() > 0) break;
                }
                return rows();
            });
            const afterOpen = await sampleHeap(cdp);
            await frame.evaluate(async () => {
                const wait = (ms) => new Promise((r) => setTimeout(r, ms));
                try {
                    _excelDirty = false;
                } catch (_) {}
                await closeExcelTableModal();
                await wait(150);
            });
            const afterClose = await sampleHeap(cdp);
            per.push({ cycle: c, afterOpen, afterClose, retained: afterClose - baseline });
        }
        return { n, cycles, baseline, per };
    } finally {
        await context.close();
    }
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: getLaunchArgs(['--no-sandbox', '--disable-setuid-sandbox'])
    });
    try {
        const loginCtx = await browser.newContext();
        const loginPage = await loginCtx.newPage();
        const loginResp = await loginPage.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const token = (/authToken=([^;]+)/.exec(loginResp.headers()['set-cookie'] || '') || [])[1];
        if (!token) throw new Error('Login failed');
        await loginCtx.close();

        if (process.env.HEAP_CYCLES) {
            const cycles = Number(process.env.HEAP_CYCLES);
            const cyc = [];
            for (const n of NS) {
                process.stdout.write(`cycles n=${n} x${cycles} ... `);
                const r = await runCycles(browser, token, n, cycles);
                cyc.push(r);
                const first = r.per[0].retained;
                const last = r.per[r.per.length - 1].retained;
                console.log(
                    `retained first=${(first / 1048576).toFixed(2)}MB last=${(last / 1048576).toFixed(2)}MB`
                );
            }
            const out = path.join(__dirname, '../../docs/plans/baseline-excel-retention-f0.json');
            fs.writeFileSync(
                out,
                JSON.stringify(
                    { generated: new Date().toISOString(), baseUrl: BASE, cycles, results: cyc },
                    null,
                    2
                ) + '\n'
            );
            console.log('RETENTION zapisany: ' + out);
            return;
        }

        const results = [];
        for (const n of NS) {
            process.stdout.write(`warmup n=${n} ... `);
            await runOnce(browser, token, n); // warmup (odrzucony)
            console.log('ok');
            const runs = [];
            for (let r = 0; r < RUNS; r++) {
                process.stdout.write(`  n=${n} run ${r + 1}/${RUNS} ... `);
                const res = await runOnce(browser, token, n);
                runs.push(res);
                console.log(
                    `openMs=${res.openMs} heapUsed=${(res.heap.afterOpen / 1048576).toFixed(1)}MB ltMax=${res.ltMax} tab1=${res.tabMedianMs} tab2=${res.tabMedianWarmMs}`
                );
            }
            results.push(medianRun(runs));
        }

        try {
            fs.writeFileSync(
                OUT,
                JSON.stringify(
                    {
                        generated: new Date().toISOString(),
                        baseUrl: BASE,
                        runs: RUNS,
                        throttleX4: process.env.THROTTLE_X4 === '1',
                        metrics: results
                    },
                    null,
                    2
                ) + '\n'
            );
            console.log('HEAP baseline zapisany: ' + OUT);
        } catch (e) {
            console.warn('Nie zapisano JSON: ' + e.message);
        }
    } finally {
        await browser.close();
    }
})();
