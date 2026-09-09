/**
 * Regression test: Excel relief pair (plyta <-> pierscien) + vis->TD mapping.
 *
 * Baza bledow #47: _excelBuildVisibleSeq liczyl Wlaz (select) jako slot
 * komponentow, wiec zapisy post-Wlaz ladowaly o 1 TD za daleko
 * (fantomowa "1" w Krag H=250, pusta komorka partnera).
 *
 * Sprawdza:
 *  1. Kazdy input liczbowy komponentu ma sygnature oninput zgodna z naglowkiem
 *     w tej samej kolumnie (th[data-col-id]) — wszystkie zakladki DN.
 *  2. Scenariusz pary na DN1000: pusta studnia -> "1" w pierscien ->
 *     model plyta+pierscien, komorka plyty "1", Krag H=250 pusty (i odwrotnie).
 *
 * Run:        node tests/playwright/excelReliefPair.cjs
 * Requires:   backend running on localhost:3000
 * Exit code:  0 = pass, 1 = fail
 */

const BASE = 'http://localhost:3000';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright. Run: npm install playwright');
    process.exitCode = 1;
    throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();

const EMPTY_WELL = {
    id: 'relief-w1',
    name: 'RELIEF-001',
    numer: 'RELIEF-001',
    dn: '1000',
    rzednaWlazu: null,
    rzednaDna: null,
    przejscia: [],
    config: [],
    autoSelect: false,
    configSource: 'MANUAL',
    autoLocked: true,
    redukcjaDN1000: false,
    kineta: 'brak',
    psiaBuda: false,
    magazyn: 'Kluczbork',
    nadbudowa: 'betonowa',
    stopnie: 'brak'
};
// Po jednej pustej studni na kazda zakladke — alignment sprawdzany na realnych wierszach.
const EMPTY_WELLS = ['1000', '1200', '1500', '2000', '2500', 'styczna'].map((dn, i) => ({
    ...JSON.parse(JSON.stringify(EMPTY_WELL)),
    id: `relief-w${i + 1}`,
    name: `RELIEF-00${i + 1}`,
    numer: `RELIEF-00${i + 1}`,
    dn
}));

const TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    let failed = false;
    const errors = [];
    const fail = (msg) => {
        failed = true;
        errors.push(msg);
    };

    try {
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        if (!authToken) throw new Error('Login failed — no token');
        await page.addInitScript((t) => localStorage.setItem('authToken', t), authToken);
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        const iframeEl = await page.waitForSelector('#spa-iframe-studnie', { timeout: 15000 });
        await page.waitForTimeout(2000);
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
        if (!frame) throw new Error('Cannot find studnie iframe');

        for (let i = 0; i < 15; i++) {
            const n = await frame.evaluate(() => {
                try {
                    return studnieProducts.length;
                } catch (_) {
                    return -1;
                }
            });
            if (n > 0) break;
            await page.waitForTimeout(2000);
        }

        await frame.evaluate((data) => {
            wells = JSON.parse(JSON.stringify(data));
            if (typeof _excelRebuildWellIndex === 'function') _excelRebuildWellIndex();
        }, EMPTY_WELLS);
        await frame.evaluate(() => openExcelTableModal());
        await page.waitForTimeout(1500);

        // 1. Naglowek <-> input per kolumna, wszystkie zakladki
        for (const tab of TABS) {
            const res = await frame.evaluate((t) => {
                if (typeof excelSwitchTab === 'function') excelSwitchTab(t);
                else {
                    _excelActiveTab = t;
                    _excelRenderTable(t);
                }
                const h1ths = [
                    ...document.querySelectorAll('#excel-table-container thead tr:nth-child(2) th')
                ];
                const anyRow = document.querySelector(
                    '#excel-table-container tr[data-widx]:not(#excel-empty-row)'
                );
                // brak wierszy danych na tej zakladce — blad (kazda ma swoja studnie)
                if (!anyRow) return { tab: t, ok: false, detail: 'no data row' };
                const tds = [...anyRow.children];
                if (tds.length !== h1ths.length)
                    return {
                        tab: t,
                        ok: false,
                        detail: `th/td count ${h1ths.length}/${tds.length}`
                    };
                const bad = [];
                tds.forEach((td, i) => {
                    const inp = td.querySelector('input[type="number"]');
                    if (!inp) return; // sticky/select/auto/readonly — poza zakresem
                    const oi = inp.getAttribute('oninput') || '';
                    if (!oi.includes('excelOnCompChange')) return; // rzedne/kat/przejscia — inny handler
                    const m = oi.match(
                        /excelOnCompChange\(\d+,'([^']+)',([^,]+),this\.value,('[^']*'|[^,)]+)/
                    );
                    if (!m) {
                        bad.push(`td${i}: unparseable oninput`);
                        return;
                    }
                    const ct = m[1];
                    const h = m[2].trim();
                    const pid = m[3].trim().replace(/^'|'$/g, '');
                    const expected = pid && pid !== 'null' ? `${ct}_${pid}` : `${ct}_${h}`;
                    const thId = h1ths[i].getAttribute('data-col-id') || '';
                    if (thId !== expected) bad.push(`td${i}: th=${thId} vs input=${expected}`);
                });
                return { tab: t, ok: bad.length === 0, detail: bad.slice(0, 5).join('; ') };
            }, tab);
            if (!res.ok) fail(`[${tab}] header<->input mismatch: ${res.detail}`);
            else console.log(`  PASS [${tab}] header<->input aligned`);
            await page.waitForTimeout(300);
        }

        // 2. Para w obie strony na DN1000
        await frame.evaluate(() => {
            if (typeof excelSwitchTab === 'function') excelSwitchTab('1000');
        });
        await page.waitForTimeout(800);

        const cellVal = (ct) =>
            frame.evaluate((c) => {
                const r = document.querySelector('#excel-table-container tr[data-widx="0"]');
                const inp = [...r.querySelectorAll('input[type="number"]')].find((i) =>
                    (i.getAttribute('oninput') || '').includes(`'${c}'`)
                );
                return inp ? inp.value : 'NO-INPUT';
            }, ct);
        const cfg = () =>
            frame.evaluate(() =>
                wells[0].config.map((c) => `${c.productId} x${c.quantity}`).sort()
            );
        const typeIn = async (ct) => {
            const h = await frame.evaluateHandle((c) => {
                const r = document.querySelector('#excel-table-container tr[data-widx="0"]');
                return [...r.querySelectorAll('input[type="number"]')].find((i) =>
                    (i.getAttribute('oninput') || '').includes(`'${c}'`)
                );
            }, ct);
            const el = h.asElement();
            if (!el) throw new Error(`no input for ${ct}`);
            await el.fill('1');
            await page.waitForTimeout(600);
        };

        await typeIn('pierscien_odciazajacy');
        let config = await cfg();
        let plate = await cellVal('plyta_zamykajaca');
        let krag = await cellVal('krag');
        console.log(
            `  ring->plate: config=${JSON.stringify(config)} plate=${plate} krag250=${krag}`
        );
        if (!config.some((c) => c.startsWith('PZE-')) || !config.some((c) => c.startsWith('PO-')))
            fail(`ring->plate: brak pary w modelu: ${JSON.stringify(config)}`);
        if (plate !== '1') fail(`ring->plate: komorka plyty=${plate}, oczekiwano 1`);
        if (krag !== '') fail(`ring->plate: fantom w Krag H=250: "${krag}"`);

        await frame.evaluate(() => {
            wells[0].config = [];
            if (typeof _excelClearResCache === 'function') _excelClearResCache(wells[0]);
            _excelRenderTable('1000');
        });
        await page.waitForTimeout(800);
        await typeIn('plyta_zamykajaca');
        config = await cfg();
        const ring = await cellVal('pierscien_odciazajacy');
        krag = await cellVal('krag');
        console.log(`  plate->ring: config=${JSON.stringify(config)} ring=${ring} krag250=${krag}`);
        if (!config.some((c) => c.startsWith('PZE-')) || !config.some((c) => c.startsWith('PO-')))
            fail(`plate->ring: brak pary w modelu: ${JSON.stringify(config)}`);
        if (ring !== '1') fail(`plate->ring: komorka pierscienia=${ring}, oczekiwano 1`);
        if (krag !== '') fail(`plate->ring: fantom w Krag H=250: "${krag}"`);
    } catch (e) {
        fail('FATAL: ' + e.message);
    } finally {
        await browser.close();
        if (failed) {
            console.error('\nFAIL:');
            errors.forEach((e) => console.error('  ' + e));
            process.exitCode = 1;
        } else {
            console.log('\nPASS: relief pair + header<->input aligned');
        }
    }
})();
