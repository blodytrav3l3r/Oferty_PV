/**
 * F1a visual gate: screenshoty modala Excela na fixture 1200.
 * 2 viewporty x 3 ujecia (gora / dol + pusty wiersz / zakladka styczne).
 *
 * Run:
 *   node tests/playwright/excelVisualGate.cjs           (porownanie z golden)
 *   node tests/playwright/excelVisualGate.cjs --update  (autoryzacja nowych referencji)
 * Wymaga: backend na localhost:3000
 *
 * Elementy dynamiczne: brak (overlay nie zawiera czasu, ID sa stabilne dla
 * fixture, zadnych spinnerow; screenshot bez fokusa w inpucie; reduced-motion;
 * czekanie na document.fonts.ready). Maska: brak — swiadomie, caly overlay.
 * Diff: canvas w przegladarce (zero nowych zaleznosci), tolerancja kanalu 16,
 * limit domyslny 100 px (wzorzec appNameConsistency.cjs).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildPerfWells } = require('./excelPerfFixture.cjs');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots', 'excel-gate');
const UPDATE = process.argv.includes('--update');
const MAX_DIFF = 100;
const VIEWPORTS = [
    { name: 'desktop', width: 1600, height: 1000 },
    { name: 'mobile', width: 390, height: 844 }
];
const SHOTS = ['top', 'bottom', 'styczne'];

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

async function diffPx(page, refBuf, curBuf) {
    return page.evaluate(
        async ({ refB64, curB64 }) => {
            const load = (b64) =>
                new Promise((res, rej) => {
                    const img = new Image();
                    img.onload = () => res(img);
                    img.onerror = () => rej(new Error('img decode'));
                    img.src = 'data:image/png;base64,' + b64;
                });
            const [a, b] = await Promise.all([load(refB64), load(curB64)]);
            if (a.width !== b.width || a.height !== b.height)
                return { diff: -1, w: b.width, h: b.height, rw: a.width, rh: a.height };
            const c = document.createElement('canvas');
            c.width = a.width;
            c.height = a.height;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(a, 0, 0);
            const da = ctx.getImageData(0, 0, c.width, c.height).data;
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(b, 0, 0);
            const db = ctx.getImageData(0, 0, c.width, c.height).data;
            let diff = 0;
            for (let i = 0; i < da.length; i += 4) {
                if (
                    Math.abs(da[i] - db[i]) > 16 ||
                    Math.abs(da[i + 1] - db[i + 1]) > 16 ||
                    Math.abs(da[i + 2] - db[i + 2]) > 16
                )
                    diff++;
            }
            return { diff, w: b.width, h: b.height };
        },
        { refB64: refBuf.toString('base64'), curB64: curBuf.toString('base64') }
    );
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

        const fixture = buildPerfWells();
        fs.mkdirSync(OUT_DIR, { recursive: true });

        for (const vp of VIEWPORTS) {
            const context = await browser.newContext({
                viewport: { width: vp.width, height: vp.height },
                reducedMotion: 'reduce'
            });
            const page = await context.newPage();
            await page.addInitScript((t) => {
                localStorage.setItem('authToken', t);
            }, token);
            await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'load', timeout: 60000 });
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
            if (!frame) throw new Error('No frame ' + vp.name);
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
                try {
                    await document.fonts.ready;
                } catch (_) {}
                await wait(800);
                if (document.activeElement) document.activeElement.blur();
            });
            const overlay = await frame.locator('#excel-table-overlay');

            const shots = {};
            shots.top = await overlay.screenshot();
            await frame.evaluate(() => {
                const cont = document.getElementById('excel-table-container');
                if (cont) cont.scrollTop = cont.scrollHeight;
            });
            await page.waitForTimeout(600);
            await frame.evaluate(() => {
                if (document.activeElement) document.activeElement.blur();
            });
            shots.bottom = await overlay.screenshot();
            await frame.evaluate(() => {
                excelSwitchTab('styczne');
            });
            await page.waitForTimeout(600);
            await frame.evaluate(() => {
                if (document.activeElement) document.activeElement.blur();
            });
            shots.styczne = await overlay.screenshot();

            const cmpPage = await context.newPage();
            await cmpPage.goto('about:blank');
            for (const name of SHOTS) {
                const file = path.join(OUT_DIR, `excel-gate-${vp.name}-${name}.png`);
                if (UPDATE) {
                    fs.writeFileSync(file, shots[name]);
                    console.log(`  UPDATE ${vp.name}/${name}`);
                    continue;
                }
                if (!fs.existsSync(file)) {
                    failed = true;
                    console.log(`  MISSING golden ${vp.name}/${name} (uruchom z --update)`);
                    continue;
                }
                const r = await diffPx(cmpPage, fs.readFileSync(file), shots[name]);
                if (r.diff < 0) {
                    failed = true;
                    console.log(
                        `  SIZE-MISMATCH ${vp.name}/${name}: ref ${r.rw}x${r.rh} vs cur ${r.w}x${r.h}`
                    );
                } else if (r.diff > MAX_DIFF) {
                    failed = true;
                    console.log(`  DIFF ${vp.name}/${name}: ${r.diff}px > ${MAX_DIFF}px`);
                } else {
                    console.log(`  OK ${vp.name}/${name}: ${r.diff}px`);
                }
            }
            await context.close();
        }
    } finally {
        await browser.close();
    }
    if (failed && !UPDATE) {
        console.log('VISUAL GATE FAILED');
        process.exitCode = 1;
    } else {
        console.log(UPDATE ? 'GOLDEN zapisane' : 'VISUAL GATE OK');
    }
})();
