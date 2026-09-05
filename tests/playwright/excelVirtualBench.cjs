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

        for (const n of [1000, 5000]) {
            for (const mode of ['OFF', 'ON']) {
                const context = await browser.newContext({
                    viewport: { width: 1600, height: 1000 }
                });
                const page = await context.newPage();
                await page.addInitScript(
                    ({ t, m }) => {
                        localStorage.setItem('authToken', t);
                        if (m === 'OFF') localStorage.setItem('sok_excel_virtual', '0');
                    },
                    { t: token, m: mode }
                );
                const hash = mode === 'OFF' ? '#/studnie?virtual=0' : '#/studnie';
                await page.goto(`${BASE}/app.html${hash}`, { waitUntil: 'load', timeout: 60000 });
                await page.waitForTimeout(2500);
                const iframeEl = await page.waitForSelector('#spa-iframe-studnie', {
                    timeout: 60000,
                    state: 'attached'
                });
                await page.waitForTimeout(2500);
                let frame = await iframeEl.contentFrame();
                for (let i = 0; i < 20 && !frame; i++) {
                    await page.waitForTimeout(1000);
                    frame = await iframeEl.contentFrame();
                }
                if (!frame) throw new Error('No frame ' + mode + ' n=' + n);
                for (let i = 0; i < 15; i++) {
                    const c = await frame.evaluate(() => {
                        try {
                            return studnieProducts.length;
                        } catch (_) {
                            return -1;
                        }
                    });
                    if (c > 0) break;
                    await page.waitForTimeout(2000);
                }
                await frame.evaluate((d) => {
                    // eslint-disable-next-line no-global-assign
                    wells = d;
                }, buildWells(n));
                const r = await measure(frame, n);
                console.log(
                    `BENCH n=${n} ${mode} rows=${r.rows} openMs=${r.openMs} editMs=${r.editMs} ok=${r.ok}`
                );
                console.log(
                    `  nodesByScroll=${JSON.stringify(r.nodesByScroll)} cycleMin=${r.cycleMin} cycleMax=${r.cycleMax}`
                );
                await context.close();
            }
        }
    } finally {
        await browser.close();
    }
})();
