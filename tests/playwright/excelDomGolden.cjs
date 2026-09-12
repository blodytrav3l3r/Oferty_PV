/**
 * F1a DOM-golden: golden KONTRAKTU virtualizowanego widoku (DOM = view only),
 * nie 1200 rekordow. SHA-256 canonicalizowanego thead+tbody per tab x6 +
 * test strukturalny scrolla (top/middle/bottom) + test czulosci na izolowanej
 * kopii fixture.
 *
 * Run:
 *   node tests/playwright/excelDomGolden.cjs           (porownanie z golden)
 *   node tests/playwright/excelDomGolden.cjs --update  (autoryzacja nowego stanu)
 * Wymaga: backend na localhost:3000
 *
 * Invariant --update: autoryzacja nowego expected state, NIE naprawa FAIL-a
 * (FAIL -> diagnoza -> zmiana oczekiwana? NIE -> STOP; TAK -> --update ->
 * review diff -> PASS).
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildPerfWells } = require('./excelPerfFixture.cjs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, '../../docs/plans/golden-excel-dom-1200.json');
const UPDATE = process.argv.includes('--update');
const TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];

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

function canon(html) {
    return String(html).replace(/>\s+</g, '><').trim();
}

function sha(s) {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

async function openFrame(browser, token, fixture) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    await page.addInitScript((t) => {
        localStorage.setItem('authToken', t);
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
    await frame.evaluate((d) => {
        // eslint-disable-next-line no-global-assign
        wells = d;
    }, fixture);
    await frame.evaluate(() => {
        openExcelTableModal();
    });
    await frame.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 150; i++) {
            const n = document.querySelectorAll(
                '#excel-table-container tbody tr[data-widx]'
            ).length;
            if (n > 0) break;
            await wait(200);
        }
        await wait(500);
    });
    return { context, page, frame };
}

async function tabHash(frame, tab) {
    return frame.evaluate((t) => {
        excelSwitchTab(t);
        const cont = document.getElementById('excel-table-container');
        const thead = cont.querySelector('thead');
        const tbody = cont.querySelector('tbody');
        const canonFn = (html) => String(html).replace(/>\s+</g, '><').trim();
        const rows = [...tbody.querySelectorAll('tr[data-widx]')];
        return {
            html: canonFn(thead.outerHTML) + canonFn(tbody.outerHTML),
            rows: rows.length,
            logical: rows.map((r) => r.getAttribute('data-logical-row'))
        };
    }, tab);
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    let failed = false;
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

        // Test czulosci na IZOLOWANEJ kopii fixture (bazowy nietkniety)
        const sensFixture = buildPerfWells();
        sensFixture[0].name = 'ZMIANA-CZULOSCI';
        sensFixture[0].numer = 'ZMIANA-CZULOSCI';
        const { context: sensCtx, frame: sensFrame } = await openFrame(browser, token, sensFixture);
        const sensH = await tabHash(sensFrame, '1000');
        await sensCtx.close();

        // Wlasciwy pomiar na bazowym fixture
        const fixture = buildPerfWells();
        const { context, frame } = await openFrame(browser, token, fixture);
        const hashes = {};
        const details = {};
        for (const t of TABS) {
            await sleep(400);
            const r = await tabHash(frame, t);
            hashes[t] = sha(canon(r.html));
            details[t] = { rows: r.rows };
        }

        // Test strukturalny scrolla: top/middle/bottom spelnia kontrakt slice
        await frame.evaluate(() => excelSwitchTab('1000'));
        await sleep(400);
        const scrollCheck = await frame.evaluate(async () => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            const cont = document.getElementById('excel-table-container');
            const out = [];
            for (const p of [0, 0.5, 1]) {
                cont.scrollTop = cont.scrollHeight * p;
                await wait(450);
                const rows = [...cont.querySelectorAll('tbody tr[data-widx]')];
                const logical = rows.map((r) => parseInt(r.getAttribute('data-logical-row'), 10));
                const mono = logical.every((v, i) => i === 0 || v === logical[i - 1] + 1);
                out.push({ pos: p, rows: rows.length, mono });
            }
            const atBottom =
                !!document.getElementById('excel-empty-row') ||
                cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 2;
            return { slices: out, emptyAtBottom: atBottom };
        });
        const scrollOk =
            scrollCheck.slices.every((s) => s.mono && s.rows > 0 && s.rows <= 80) &&
            scrollCheck.emptyAtBottom;
        console.log(
            'scroll-contract: ' + (scrollOk ? 'OK' : 'FAIL') + ' ' + JSON.stringify(scrollCheck)
        );
        if (!scrollOk) failed = true;

        if (UPDATE) {
            fs.writeFileSync(
                OUT,
                JSON.stringify({ generated: new Date().toISOString(), tabs: hashes }, null, 2) +
                    '\n'
            );
            console.log('GOLDEN zapisany: ' + OUT);
        } else {
            if (!fs.existsSync(OUT)) {
                failed = true;
                console.log('MISSING golden (uruchom z --update)');
            } else {
                const golden = JSON.parse(fs.readFileSync(OUT, 'utf8'));
                for (const t of TABS) {
                    if (golden.tabs[t] === hashes[t]) {
                        console.log(`  OK ${t}: ${hashes[t].slice(0, 12)} rows=${details[t].rows}`);
                    } else {
                        failed = true;
                        console.log(
                            `  DIFF ${t}: golden=${(golden.tabs[t] || '?').slice(0, 12)} cur=${hashes[t].slice(0, 12)}`
                        );
                    }
                }
                // Czulosc: zmieniony fixture MUSI dac inny hash
                const sensSha = sha(canon(sensH.html));
                if (sensSha === hashes['1000']) {
                    failed = true;
                    console.log('  SENSITIVITY FAIL: mutacja nazwy nie zmienia hasha');
                } else {
                    console.log('  SENSITIVITY OK: mutacja wykryta');
                }
            }
        }
        await context.close();
    } finally {
        await browser.close();
    }
    if (failed && !UPDATE) {
        console.log('DOM GOLDEN FAILED');
        process.exitCode = 1;
    } else {
        console.log(UPDATE ? 'GOLDEN zapisany' : 'DOM GOLDEN OK');
    }
})();
