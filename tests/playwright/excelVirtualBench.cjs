/**
 * P1-B.2 benchmark: Excel virtual OFF vs ON @ 1k/5k.
 * Mierzy: czas otwarcia modala, liczbe wezlow DOM na pozycjach scrolla
 * (top/25/50/75/100/top), stabilnosc po 10 cyklach 0->100->0% (min/max),
 * czas edycji jednego wiersza.
 *
 * Run:   node tests/playwright/excelVirtualBench.cjs
 * Wymaga: backend na localhost:3000
 */
const BASE = 'http://localhost:3000';

const fs = require('fs');
const path = require('path');
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
const BENCH_NS_LIST = process.env.BENCH_NS
    ? process.env.BENCH_NS.split(',')
          .map(Number)
          .filter((v) => Number.isFinite(v) && v > 0)
    : [1000, 5000];
const OUT_DEFAULT = path.join(
    __dirname,
    '../../docs/plans/bench-excel-virtual-' +
        (process.env.BENCH_NS ? BENCH_NS_LIST.join('-') : '1k5k') +
        '.json'
);
const OUT = resolveOutPath(OUT_DEFAULT);

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function buildWells(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push({
            id: 'b' + i,
            name: 'B-' + String(i + 1).padStart(4, '0'),
            dn: '1000',
            rzednaWlazu: 2.0,
            rzednaDna: 0.5,
            przejscia: [],
            config: [],
            autoSelect: false,
            configSource: 'MANUAL',
            kineta: '',
            psiaBuda: false,
            magazyn: 'Kluczbork'
        });
    }
    return arr;
}

async function measure(frame, n) {
    return frame.evaluate(async (count) => {
        const out = {};
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const nodes = () => document.getElementsByTagName('*').length;
        const rows = () =>
            [...document.querySelectorAll('#excel-table-container tbody tr[data-widx]')].filter(
                (r) => r.style.display !== 'none'
            ).length;
        const t0 = performance.now();
        openExcelTableModal();
        // czekaj na wiersze (max 30 s)
        for (let i = 0; i < 150; i++) {
            await wait(200);
            if (rows() > 0) break;
        }
        out.openMs = Math.round(performance.now() - t0);
        out.rows = rows();
        const cont = document.getElementById('excel-table-container');
        const pos = {};
        for (const p of [0, 0.25, 0.5, 0.75, 1, 0]) {
            if (cont) cont.scrollTop = cont.scrollHeight * p;
            await wait(400);
            pos[p] = nodes();
        }
        out.nodesByScroll = pos;
        // 10 cykli stabilnosci
        let mn = Infinity;
        let mx = 0;
        for (let k = 0; k < 10; k++) {
            if (cont) cont.scrollTop = cont.scrollHeight;
            await wait(150);
            if (cont) cont.scrollTop = 0;
            await wait(150);
            const c = nodes();
            if (c < mn) mn = c;
            if (c > mx) mx = c;
        }
        out.cycleMin = mn;
        out.cycleMax = mx;
        // edycja pierwszego wiersza
        const row = document.querySelector('#excel-table-container tbody tr[data-widx]');
        const wIdx = row ? parseInt(row.getAttribute('data-widx'), 10) : -1;
        const inp = row ? row.querySelector('input[data-field="rzednaWlazu"]') : null;
        if (inp) inp.value = '7.7';
        const t1 = performance.now();
        excelOnRzednaChange(wIdx);
        await wait(1200);
        out.editMs = Math.round(performance.now() - t1);
        out.ok = wells[wIdx] && wells[wIdx].rzednaWlazu === 7.7;
        return out;
    }, n);
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
        await applyThrottle(loginPage);
        const loginResp = await loginPage.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        const loginCookieMatch = /authToken=([^;]+)/.exec(loginSetCookie);
        const token = loginCookieMatch ? loginCookieMatch[1] : null;
        if (!token) throw new Error('Login failed');
        await loginCtx.close();

        const benchRows = [];
        for (const n of process.env.BENCH_NS
            ? process.env.BENCH_NS.split(',').map(Number)
            : [1000, 5000]) {
            for (const mode of ['OFF', 'ON']) {
                const context = await browser.newContext({
                    viewport: { width: 1600, height: 1000 }
                });
                const page = await context.newPage();
                await applyThrottle(page);
                // Wariant A: cookie httpOnly do jara kontekstu; flaga virtual
                // zostaje w localStorage (nie-auth, bez zmian).
                await context.addCookies([
                    { name: 'authToken', value: token, domain: 'localhost', path: '/' }
                ]);
                await page.addInitScript(
                    ({ m }) => {
                        if (m === 'OFF') localStorage.setItem('sok_excel_virtual', '0');
                    },
                    { m: mode }
                );
                const hash = mode === 'OFF' ? '#/studnie?virtual=0' : '#/studnie';
                await page.goto(`${BASE}/app.html${hash}`, { waitUntil: 'load', timeout: 60000 });
                // przyczyna: DOM — iframe SPA wpinany asynchronicznie; warunkiem jest
                // waitForSelector poniżej (sztywny sen przed nim zbędny).
                const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
                    timeout: 60000,
                    state: 'attached'
                });
                // przyczyna: DOM — kontekst JS iframe gotowy, gdy produkty załadowane;
                // warunkiem jest waitForFunction poniżej (sen po selektorze zbędny).
                let frame = await iframeEl.contentFrame();
                for (let i = 0; i < 20 && !frame; i++) {
                    // przyczyna: polling — contentFrame podpina się asynchronicznie po
                    // attach iframe; brak selektora na gotowy kontekst.
                    await page.waitForTimeout(1000);
                    frame = await iframeEl.contentFrame();
                }
                if (!frame) throw new Error('No frame ' + mode + ' n=' + n);
                // przyczyna: backend — produkty/cennik ładowane asynchronicznie; polling
                // pętlą zastąpiony jednym warunkiem (timeout jak suma pętli: 15×~2 s).
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
                await frame.evaluate((d) => {
                    // eslint-disable-next-line no-global-assign
                    wells = d;
                }, buildWells(n));
                const r = await measure(frame, n);
                benchRows.push({ n, mode, ...r });
                console.log(
                    `BENCH n=${n} ${mode} rows=${r.rows} openMs=${r.openMs} editMs=${r.editMs} ok=${r.ok}`
                );
                console.log(
                    `  nodesByScroll=${JSON.stringify(r.nodesByScroll)} cycleMin=${r.cycleMin} cycleMax=${r.cycleMax}`
                );
                await context.close();
            }
        }
        try {
            fs.writeFileSync(
                OUT,
                JSON.stringify(
                    {
                        generated: new Date().toISOString(),
                        throttleX4: process.env.THROTTLE_X4 === '1',
                        rows: benchRows
                    },
                    null,
                    2
                ) + '\n'
            );
            console.log('BENCH zapisany: ' + OUT);
        } catch (_) {}
    } finally {
        await browser.close();
    }
})();
