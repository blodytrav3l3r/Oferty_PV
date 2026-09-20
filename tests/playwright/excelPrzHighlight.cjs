/**
 * E2E: hover/klik przejscia w podgladzie studni -> highlight komorek Excela.
 *
 * Kontekst: zamowienie SA/ZS/000050/2026 (studnia s1, 5 przejsc, legacy brak
 * pr.id) — hover z podgladu byl martwy, bo renderWellDiagram nie nadawal id.
 *
 * Sprawdza na ZYWYCH danych zamowienia (read-only, bez mutacji):
 *  1. <g data-prz-id> w diagramie s1: 5 ksztaltow, id niepuste i unikalne.
 *  2. Hover id -> dokladnie 4x td.excel-tr-hover przy otwartym Excelu.
 *  3. Klik id -> dokladnie 4x td.excel-tr-selected + tab DN wlasciciela.
 *  4. Drugi klik zdejmuje selekcje.
 *
 * Run:        node tests/playwright/excelPrzHighlight.cjs
 * Requires:   backend running on localhost:3000
 * Exit code:  0 = pass, 1 = fail
 */

const BASE = 'http://localhost:3000';
const ORDER_NO = 'SA/ZS/000050/2026';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    console.error('Cannot find playwright. Run: npm install playwright');
    process.exitCode = 1;
    throw new Error('playwright not found');
}
const { chromium } = resolvePlaywright();

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
    const ok = (cond, msg) => {
        if (!cond) fail(msg);
        else console.log('ok: ' + msg);
    };

    try {
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        if (!authToken) throw new Error('Login failed — no token');

        // Znajdz zamowienie po numerze (read-only).
        const listResp = await page.request.get(`${BASE}/api/orders-studnie/`);
        const listJson = await listResp.json();
        const listStr = JSON.stringify(listJson);
        if (!listStr.includes(ORDER_NO)) throw new Error(`Order ${ORDER_NO} not in list`);
        const items = listJson.data || listJson.orders || listJson;
        const arr = Array.isArray(items) ? items : [];
        const found = arr.find((o) => JSON.stringify(o).includes(ORDER_NO));
        if (!found) throw new Error(`Order ${ORDER_NO} not found in list payload`);
        const orderId = found.id;
        console.log('order id: ' + orderId);

        const ordResp = await page.request.get(`${BASE}/api/orders-studnie/${orderId}`);
        const ordJson = await ordResp.json();
        const order = ordJson.data || ordJson;
        const wells = order.wells || [];
        ok(wells.length >= 1, `zamowienie ma studnie (n=${wells.length})`);
        const s1 = wells.find((w) => w.name === 's1') || wells[0];
        console.log(`s1: dn=${s1.dn} przejscia=${(s1.przejscia || []).length}`);

        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'networkidle', timeout: 30000 });
        const iframeEl = await page.waitForSelector('#spa-iframe-studnie', { timeout: 15000 });
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
        if (!frame) throw new Error('Cannot find studnie iframe');
        await frame.waitForFunction(
            () => {
                try {
                    return studnieProducts.length > 0;
                } catch (_) {
                    return false;
                }
            },
            null,
            { timeout: 30000 }
        );

        // Wstrzyknij wells zamowienia (read-only wobec DB — tylko stan strony).
        await frame.evaluate((ws) => {
            window.wells = structuredClone(ws);
            window.currentWellIndex = 0;
            renderWellDiagram();
        }, wells);

        // 1. Ksztalty SVG s1.
        const shapes = await frame.evaluate(() => {
            const svg = document.getElementById('well-diagram');
            return Array.from(svg.querySelectorAll('g[data-prz-id]')).map((g) =>
                g.getAttribute('data-prz-id')
            );
        });
        const expectN = (s1.przejscia || []).length;
        ok(shapes.length === expectN, `diagram s1 ma ${shapes.length}/${expectN} ksztaltow`);
        ok(shapes.every((id) => id && id !== ''), 'wszystkie data-prz-id niepuste (backfill legacy)');
        ok(new Set(shapes).size === shapes.length, 'data-prz-id unikalne w s1');
        const firstId = shapes[0];

        // Hover przy zamknietym Excelu nie crashuje.
        await frame.evaluate((id) => window.svgPrzPointerEnter({}, id), firstId);

        // 2+3. Otworz Excel, hover -> 4 komorki, klik -> 4 komorki + tab.
        await frame.evaluate(() => openExcelTableModal());
        await frame.waitForSelector('#excel-table-overlay', { timeout: 10000 });
        const hoverCount = await frame.evaluate((id) => {
            window.svgPrzPointerEnter({}, id);
            return document.querySelectorAll('td[data-prz-id].excel-tr-hover').length;
        }, firstId);
        ok(hoverCount === 4, `hover -> ${hoverCount}/4 komorek excel-tr-hover`);
        await frame.evaluate((id) => window.svgPrzPointerLeave({}, id), firstId);

        const clickRes = await frame.evaluate((id) => {
            window.svgPrzPointerClick({}, id);
            return {
                selected: document.querySelectorAll('td[data-prz-id].excel-tr-selected').length,
                tab: typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : null
            };
        }, firstId);
        ok(clickRes.selected === 4, `klik -> ${clickRes.selected}/4 komorek excel-tr-selected`);
        const expectTab = String(s1.dn) === 'styczna' ? 'styczne' : String(s1.dn);
        ok(clickRes.tab === expectTab, `klik -> aktywny tab ${clickRes.tab} (DN s1=${expectTab})`);

        // 4. Drugi klik zdejmuje.
        const afterToggle = await frame.evaluate((id) => {
            window.svgPrzPointerClick({}, id);
            return document.querySelectorAll('td[data-prz-id].excel-tr-selected').length;
        }, firstId);
        ok(afterToggle === 0, `drugi klik -> ${afterToggle}/0 komorek (toggle off)`);
    } catch (e) {
        fail('EXCEPTION: ' + (e && e.message ? e.message : String(e)));
    } finally {
        await browser.close();
    }

    if (failed) {
        console.error('FAIL:');
        errors.forEach((e) => console.error(' - ' + e));
        process.exitCode = 1;
    } else {
        console.log('PASS: excelPrzHighlight');
    }
})();
