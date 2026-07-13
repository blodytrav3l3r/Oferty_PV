// PEHD pricing browser test (studnie module)
// Usage: node scripts/pehdBrowserTest.cjs
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH =
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('requestfailed', (r) =>
        consoleMsgs.push(`[reqfail] ${r.method()} ${r.url()} ${r.failure()?.errorText}`)
    );
    page.on('response', (r) => {
        const u = r.url();
        if (u.includes('/api/telemetry') || u.includes('/ai/')) {
            consoleMsgs.push(`[resp ${r.status()}] ${u}`);
        }
    });

    // ---- login (send CSRF header manually; doLogin in app omits it) ----
    await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(600);
    const loginRes = await page.evaluate(async () => {
        const m = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
        const token = m ? m[1] : '';
        const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            body: JSON.stringify({ username: 'admin', password: 'adnim123456789' })
        });
        const data = await resp.json().catch(() => null);
        return { status: resp.status, ok: resp.ok, error: data && data.error };
    });
    console.log('LOGIN:', JSON.stringify(loginRes));
    if (!loginRes.ok) {
        console.error('ERROR: login failed:', loginRes.error);
        await browser.close();
        process.exit(1);
    }
    await sleep(400);

    // ---- go to studnie ----
    await page.goto(BASE_URL + '/app.html#/studnie', { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(1500);

    // find studnie iframe
    let frame = null;
    for (let i = 0; i < 30; i++) {
        frame = page.frames().find((f) => f.url().includes('studnie.html'));
        if (frame) break;
        await sleep(300);
    }
    if (!frame) {
        console.error('ERROR: studnie iframe not found');
        await page.screenshot({ path: path.join(OUT_DIR, 'pehd-no-iframe.png') });
        await browser.close();
        process.exit(1);
    }
    // wait for app globals
    for (let i = 0; i < 40; i++) {
        const ready = await frame.evaluate(
            () =>
                typeof studnieProducts !== 'undefined' &&
                Array.isArray(studnieProducts) &&
                studnieProducts.length > 0 &&
                typeof window.autoSelectComponents === 'function' &&
                typeof window.getItemPriceBreakdown === 'function'
        );
        if (ready) break;
        await sleep(300);
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'pehd-initial.png') });

    // ---- build a well + solve + test PEHD ----
    const result = await frame.evaluate(async () => {
        const out = { steps: [], config: [], errors: [] };
        try {
            // lexical globals (not on window): studnieProducts, wells, currentWellIndex, pehdPricePerM2
            if (typeof window.recalculatePEHDInternal === 'function') {
                window.recalculatePEHDInternal(pehdPricePerM2 != null ? pehdPricePerM2 : 270);
            }
            out.pehdPricePerM2 = pehdPricePerM2;

            // create well DN1000, depth 2m
            const well = window.createNewWell ? window.createNewWell(null, 1000) : null;
            if (!well) throw new Error('createNewWell unavailable');
            well.rzednaDna = 0;
            well.rzednaWlazu = 2000;
            well.wkladkaDennica = 'brak';
            well.wkladkaNadbudowa = 'brak';
            well.wkladkaZwienczenie = 'brak';
            wells.push(well);
            currentWellIndex = wells.length - 1;

            await window.autoSelectComponents(true);
            const w = wells[currentWellIndex];
            out.configCount = (w.config || []).length;
            out.config = (w.config || []).map((c) => {
                const p = studnieProducts.find((x) => x.id === c.productId);
                return {
                    productId: c.productId,
                    componentType: p ? p.componentType : '?',
                    area: p ? p.area : null,
                    doplataPEHD: p ? p.doplataPEHD : null,
                    qty: c.quantity
                };
            });

            const types = ['wkladkaDennica', 'wkladkaNadbudowa', 'wkladkaZwienczenie'];
            out.pehdMatrix = {};
            for (const t of types) {
                // OFF
                w.wkladkaDennica = 'brak';
                w.wkladkaNadbudowa = 'brak';
                w.wkladkaZwienczenie = 'brak';
                const off = w.config.map((c) => {
                    const p = studnieProducts.find((x) => x.id === c.productId);
                    const b = window.getItemPriceBreakdown(w, p, true, c);
                    return { id: c.productId, pehd: b.pehd, total: b.total };
                });
                // ON
                w[t] = '3mm';
                const on = w.config.map((c) => {
                    const p = studnieProducts.find((x) => x.id === c.productId);
                    const b = window.getItemPriceBreakdown(w, p, true, c);
                    return { id: c.productId, pehd: b.pehd, total: b.total };
                });
                out.pehdMatrix[t] = { off, on };
            }
        } catch (e) {
            out.errors.push(String(e && e.stack ? e.stack : e));
        }
        return out;
    });

    // toggle PEHD via real UI handler to also trigger telemetry logging
    await frame.evaluate(() => {
        try {
            if (typeof window.updateWellParam === 'function') {
                window.updateWellParam('wkladkaDennica', '3mm');
            }
        } catch (e) {}
    });
    await sleep(1500);

    await page.screenshot({ path: path.join(OUT_DIR, 'pehd-after-toggle.png') });

    const report = { result, consoleMsgs, pageErrors };
    fs.writeFileSync(
        path.join(OUT_DIR, 'pehd-report.json'),
        JSON.stringify(report, null, 2)
    );
    console.log('=== PEHD TEST RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n=== CONSOLE (telemetry/ai) ===');
    console.log(consoleMsgs.filter((m) => /telemetry|\/ai\/|reqfail|\[error\]|\[warn\]/.test(m)).join('\n'));
    console.log('\n=== PAGE ERRORS ===');
    console.log(pageErrors.join('\n'));

    await browser.close();
})().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
});
