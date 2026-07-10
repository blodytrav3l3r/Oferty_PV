/**
 * Regression test: Excel Configuration Table – empty row alignment.
 *
 * Verifies that the empty row (#excel-empty-row) has identical column
 * positions (left, width) as the data rows in the same <tbody>.
 *
 * Run:        node tests/playwright/excelEmptyRowAlignment.cjs
 * Requires:   playwright (available in npx cache or node_modules)
 * Requires:   backend + Vite running on localhost:3000 / :5174
 *
 * Exit code:
 *   0 = all tabs aligned
 *   1 = at least one column misaligned or error
 */

const BASE = 'http://localhost:5174';

/* ── Playwright resolution ── */
function resolvePlaywright() {
    // 1) node_modules (future-proof if playwright becomes dep)
    try { return require('playwright'); } catch (_) {}
    // 2) npx cache (local dev)
    const cacheRoot = process.env.LOCALAPPDATA + '\\npm-cache\\_npx';
    const { readdirSync } = require('fs');
    const { join } = require('path');
    try {
        const hashes = readdirSync(cacheRoot, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        for (const h of hashes) {
            const p = join(cacheRoot, h, 'node_modules', 'playwright');
            try { return require(p); } catch (_) {}
        }
    } catch (_) {}
    console.error('Cannot find playwright. Install it: npm install playwright');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();

/* ── Chromium executable ── */
const CHROME_PATH = process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

/* ── Mock wells (identical to diagnosed scenario) ── */
const MOCK_WELLS = [
    { id: 'w1', name: 'ST-001', dn: '1000', rzednaWlazu: 1.5, rzednaDna: 0.0, przejscia: [{ id: 'p1', productId: '', rzednaWlaczenia: 0.5, angle: 90, flowType: 'WYLOT', category: '' }, { id: 'p2', productId: '', rzednaWlaczenia: 0.8, angle: 45, flowType: 'WYLOT', category: '' }], autoSelect: true, configSource: 'AUTO', redukcjaDN1000: false, kineta: '', psiaBuda: false, magazyn: 'Kluczbork' },
    { id: 'w2', name: 'ST-002', dn: '1000', rzednaWlazu: 1.2, rzednaDna: 0.1, przejscia: [{ id: 'p3', productId: '', rzednaWlaczenia: 0.3, angle: 90, flowType: 'WYLOT', category: '' }], autoSelect: false, configSource: 'MANUAL', redukcjaDN1000: false, kineta: '', psiaBuda: true, magazyn: 'Kluczbork' },
    { id: 'w3', name: 'ST-003', dn: '1500', rzednaWlazu: 1.8, rzednaDna: 0.2, przejscia: [{ id: 'p4', productId: '', rzednaWlaczenia: 0.6, angle: 90, flowType: 'WYLOT', category: '' }], autoSelect: true, configSource: 'AUTO', redukcjaDN1000: true, redukcjaTargetDN: 1000, kineta: '', psiaBuda: false, magazyn: 'Kluczbork' },
    // Add a DN1500 with reduction — triggers hasReduction=true, more columns
];

/* ── Tabs to verify ── */
const TABS = ['1000', '1500'];

/* ── Helpers ── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Main ── */
(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();

    let failed = false;
    const errors = [];

    try {
        // 1. Login via API
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: 'anim123456' }
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        if (!authToken) { throw new Error('Login failed — no token'); }

        // 2. Set auth token before page scripts
        await page.addInitScript(t => localStorage.setItem('authToken', t), authToken);

        // 3. Navigate to studnie module
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // 4. Locate iframe
        const iframeEl = await page.waitForSelector('#spa-iframe-studnie', { timeout: 15000 });
        await page.waitForTimeout(2000);
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find(f => f.url().includes('studnie'));
        if (!frame) throw new Error('Cannot find studnie iframe');

        // 5. Wait for studnieProducts to load
        let spLen = -1;
        for (let i = 0; i < 15; i++) {
            spLen = await frame.evaluate(() => { try { return studnieProducts.length; } catch (_) { return -1; } });
            if (spLen > 0) break;
            await page.waitForTimeout(2000);
        }
        if (spLen <= 0) throw new Error('studnieProducts did not load');

        // 6. Inject mock wells (bare name, NOT window.wells — wells is let)
        // Use data alias to avoid parameter shadowing the global `wells`
        await frame.evaluate((data) => {
            // eslint-disable-next-line no-global-assign
            wells = data;
        }, MOCK_WELLS);

        // 7. Open Excel Configuration Table
        await frame.evaluate(() => openExcelTableModal());
        await page.waitForTimeout(2000);

        // 8. For each tab, compare data row vs empty row
        for (const tab of TABS) {
            const result = await frame.evaluate((t) => {
                // Switch tab
                if (typeof excelSwitchTab === 'function') {
                    excelSwitchTab(t);
                } else {
                    // Fallback: direct render
                    _excelActiveTab = t;
                    _excelRenderTable(t);
                }

                const table = document.querySelector('#excel-table-container table');
                if (!table) return { tab: t, error: 'no table' };

                const allRows = [...table.querySelectorAll('tr')];
                const empty = document.getElementById('excel-empty-row');
                if (!empty) return { tab: t, error: 'no empty row', rows: allRows.length };

                // Data rows: tbody rows except empty row
                const dataRows = allRows.filter(r => r.parentNode.tagName === 'TBODY' && r !== empty);
                if (dataRows.length === 0) return { tab: t, error: 'no data rows in tbody', rows: allRows.length };

                const dataRow = dataRows[0]; // compare against first data row

                // Guard: column count must match
                if (dataRow.children.length !== empty.children.length) {
                    return { tab: t, error: 'column count mismatch', dataCols: dataRow.children.length, emptyCols: empty.children.length };
                }

                // Compare left + width for every column
                const cols = dataRow.children.length;
                const diffs = [];
                for (let i = 0; i < cols; i++) {
                    const dr = dataRow.children[i].getBoundingClientRect();
                    const er = empty.children[i].getBoundingClientRect();
                    const diffL = +(dr.left - er.left).toFixed(1);
                    const diffW = +(dr.width - er.width).toFixed(1);
                    if (Math.abs(diffL) > 1 || Math.abs(diffW) > 1) {
                        diffs.push({ col: i, dataLeft: +dr.left.toFixed(1), emptyLeft: +er.left.toFixed(1), diffL, dataW: +dr.width.toFixed(1), emptyW: +er.width.toFixed(1), diffW });
                    }
                }

                return {
                    tab: t,
                    cols,
                    dataRows: dataRows.length,
                    ok: diffs.length === 0,
                    diffs
                };
            }, tab);

            if (result.error) {
                failed = true;
                errors.push(`[${tab}] ${result.error} (rows: ${result.rows || '?'})`);
            } else if (!result.ok) {
                failed = true;
                errors.push(`[${tab}] ${result.diffs.length}/${result.cols} columns misaligned`);
                result.diffs.forEach(d => {
                    errors.push(`  col ${d.col}: left diff=${d.diffL}px, width diff=${d.diffW}px`);
                });
            } else {
                console.log(`  ✅ ${tab}: ${result.dataRows} data rows, ${result.cols} cols, all aligned`);
            }

            await page.waitForTimeout(500);
        }
    } catch (e) {
        failed = true;
        errors.push('FATAL: ' + e.message);
    } finally {
        await browser.close();
        if (failed) {
            console.error('\n❌ FAILED:');
            errors.forEach(e => console.error('  ' + e));
            process.exitCode = 1;
        } else {
            console.log('\n✅ PASS: empty row aligned in all tabs');
        }
    }
})();
