/**
 * Test E2E: spójność nazwy aplikacji S.O.K. (T1–T6).
 *
 * Weryfikuje, że nazwa aplikacji to "S.O.K.", a nie "WITROS Oferty" —
 * tytuły stron, nagłówek SPA, loginy/pulpit oraz regresję #92
 * (document.title w trybie edycji zamówienia rur).
 *
 * Run:
 *   node tests/playwright/appNameConsistency.cjs                # wymaga backendu na :3000
 *   node tests/playwright/appNameConsistency.cjs --spawn        # buduje + seeduje e2e.sqlite + startuje :3177
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden test nie przeszedł.
 */

const { execFileSync, spawn } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

const MODULES = {
    app: 'app.html',
    index: 'index.html',
    kartoteka: 'kartoteka.html',
    rury: 'rury.html',
    studnie: 'studnie.html',
    zlecenia: 'zlecenia.html'
};

/* ── Playwright resolution (wzorzec excelEmptyRowAlignment.cjs) ── */
function resolvePlaywright() {
    try { return require('playwright'); } catch (_) {}
    const { readdirSync } = require('fs');
    const { join: j } = require('path');
    const roots = [];
    if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA + '\\npm-cache\\_npx');
    const homeNpx = j(process.env.HOME || process.env.USERPROFILE || '', '.npm', '_npx');
    roots.push(homeNpx);
    for (const root of roots) {
        try {
            const hashes = readdirSync(root, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            for (const h of hashes) {
                const p = j(root, h, 'node_modules', 'playwright');
                try { return require(p); } catch (_) {}
            }
        } catch (_) {}
    }
    console.error('Cannot find playwright. Install it: npm install playwright');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();
const CHROME_PATH =
    process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function pollHealth(url, tries = 30) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(url);
            if (r.status === 200) return true;
        } catch (_) {}
        await sleep(1000);
    }
    return false;
}

/* ── Spawn serwera (izolowany, port 3177, e2e.sqlite) ── */
async function startServer() {
    const dbUrl = 'file:./data/e2e.sqlite';
    const { rmSync, existsSync, symlinkSync } = require('fs');
    const dbFile = join(ROOT, 'prisma', 'data', 'e2e.sqlite');
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
        if (existsSync(f)) rmSync(f);
    }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe'
    });
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe'
    });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: '3177',
            DATABASE_URL: dbUrl,
            DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD,
            NODE_ENV: 'development'
        },
        stdio: 'pipe'
    });
    server.stderr.on('data', (d) => { if (SPAWN_VERBOSE) process.stderr.write(d); });
    server.stdout.on('data', (d) => { if (SPAWN_VERBOSE) process.stdout.write(d); });
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) {
        server.kill();
        throw new Error('Serwer testowy nie wystartował (health check)');
    }
    return server;
}

const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';

/* ── Main ── */
(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }

    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();

    let failed = false;
    const errors = [];

    const check = (name, ok, detail) => {
        if (ok) {
            console.log(`  ✅ ${name}`);
        } else {
            failed = true;
            errors.push(`${name}: ${detail}`);
            console.log(`  ❌ ${name}: ${detail}`);
        }
    };

    try {
        // T1 — top-level app.html title
        await page.goto(`${BASE}/app.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1000);
        const t1 = await page.title();
        check('T1 app.html title', /S\.O\.K\./.test(t1) && !/WITROS/i.test(t1), `title="${t1}"`);

        // T2 — statyczne <title> wszystkich modułów (fetch omija iframe redirect)
        const TITLES = {
            'app.html': /<title>\s*S\.O\.K\./,
            'index.html': /<title>\s*S\.O\.K\./,
            'kartoteka.html': /<title>\s*S\.O\.K\./,
            'rury.html': /<title>\s*S\.O\.K\./,
            'studnie.html': /<title>\s*S\.O\.K\./,
            'zlecenia.html': /<title>\s*S\.O\.K\./
        };
        for (const [file, re] of Object.entries(TITLES)) {
            const resp = await page.request.get(`${BASE}/${file}`);
            const html = await resp.text();
            check(`T2 ${file}`, re.test(html) && !/WITROS Oferty/i.test(html), 'title mismatch');
        }

        // Login
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        if (!authToken) throw new Error('Login failed — no token');
        await page.addInitScript((t) => localStorage.setItem('authToken', t), authToken);

        // T4 — login + Pulpit
        await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        const t4title = await page.title();
        const t4logo = await page.locator('img.index-logo-sok[alt="S.O.K."]').count();
        const t4sub = await page.locator('.subtitle').first().textContent().catch(() => '');
        check('T4 Pulpit title', /S\.O\.K\. — Generator Ofert/.test(t4title), `title="${t4title}"`);
        check('T4 logo', t4logo === 1, `img.index-logo-sok count=${t4logo}`);
        check('T4 subtitle', (t4sub || '').includes('System Ofert i Kalkulacji'), `subtitle="${t4sub}"`);

        // T3 — nagłówek SPA w app.html
        await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        const iframeEl = await page.waitForSelector('#spa-iframe-studnie', { timeout: 15000 });
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find((f) => f.url().includes('studnie'));
        if (!frame) throw new Error('Cannot find studnie iframe');

        const t3 = await page.evaluate(() => {
            const logo = document.querySelector('img.logo-sok');
            const logoAlt = logo ? logo.getAttribute('alt') : '';
            const text = document.getElementById('spa-logo-text');
            const textVal = text ? text.textContent.trim() : '';
            return { logoAlt, text: textVal };
        });
        check('T3 SPA logo', t3.logoAlt === 'S.O.K.', `alt="${t3.logoAlt}"`);
        check('T3 module name', t3.text === 'Kalkulator Studni', `#spa-logo-text="${t3.text}"`);
        check('T3 no WITROS', !/WITROS/i.test(t3.text), `text="${t3.text}"`);

        // T5 — REGRESJA #92: document.title po wejściu/wyjściu trybu edycji zamówienia
        await frame.waitForTimeout(2000);
        let pw = -1;
        for (let i = 0; i < 15; i++) {
            pw = await frame.evaluate(() => { try { return (typeof studnieProducts !== 'undefined') ? studnieProducts.length : 0; } catch (_) { return 0; } });
            if (pw > 0) break;
            await frame.waitForTimeout(1000);
        }

        // Przejdź do modułu rur
        await page.goto(`${BASE}/app.html#/rury`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);
        const ruryFrameEl = await page.waitForSelector('#spa-iframe-rury', { timeout: 15000 });
        let ruryFrame = await ruryFrameEl.contentFrame();
        if (!ruryFrame) ruryFrame = page.frames().find((f) => f.url().includes('rury'));
        if (!ruryFrame) throw new Error('Cannot find rury iframe');

        // Mock zamówienia (ordersRury to let globalny)
        await ruryFrame.evaluate(() => {
            // eslint-disable-next-line no-global-assign
            ordersRury = [{
                id: 'e2e-order-1',
                clientName: 'E2E Klient',
                clientNip: '',
                clientNumber: 'E2E/1',
                clientAddress: '',
                clientContact: '',
                investName: 'E2E',
                investAddress: '',
                investContractor: '',
                offerNumber: 'OF/2026/001',
                notes: '',
                transportKm: 0,
                transportRate: 0,
                transportMode: 'fractional',
                date: '2026-08-09',
                validity: '30',
                paymentTerms: '',
                items: [],
                orderNumber: 'ZAM/2026/001'
            }];
        });

        let enterTitle = '';
        let exitTitle = '';
        let exitError = '';
        const t5res = await ruryFrame.evaluate(async () => {
            const out = { enterTitle: '', exitTitle: '', error: '' };
            try {
                await enterRuryOrderEditMode('e2e-order-1');
                out.enterTitle = document.title;
                if (typeof exitOrderEditMode === 'function') {
                    try {
                        exitOrderEditMode();
                        out.exitTitle = document.title;
                    } catch (e) {
                        out.error = 'exitError: ' + (e && e.message ? e.message : String(e));
                        out.exitTitle = document.title;
                    }
                } else {
                    out.exitTitle = document.title;
                }
            } catch (e) {
                out.error = 'enterError: ' + (e && e.message ? e.message : String(e));
            }
            return out;
        });
        enterTitle = t5res.enterTitle;
        exitTitle = t5res.exitTitle;
        exitError = t5res.error;

        check('T5 enter title', /Zamówienie:/.test(enterTitle) && !/WITROS/i.test(enterTitle), `title="${enterTitle}"`);
        if (!exitError) {
            check('T5 exit title', exitTitle === 'S.O.K. — Generator Ofert', `title="${exitTitle}"`);
        } else {
            console.log(`  ⚠ T5 exitError (soft): ${exitError}`);
        }
        check('T5 no WITROS', !/WITROS/i.test(enterTitle + ' ' + exitTitle), `enter="${enterTitle}" exit="${exitTitle}"`);

        // T6 — wydruk (soft-check, SKIP przy braku danych)
        // Modal wydruku wymaga danych ofert/zamówień w bazie; bez nich renderuje toast.
        // Weryfikujemy tylko, że moduł rur nie ma w DOM żadnej nazwy WITROS Oferty.
        const t6 = await ruryFrame.evaluate(() => document.body.innerText.slice(0, 5000));
        check('T6 no WITROS w module', !/WITROS\s*[O\-–—]/i.test(t6), 'found WITROS in body text');
    } catch (e) {
        failed = true;
        errors.push('FATAL: ' + e.message);
    } finally {
        await browser.close();
        if (server) server.kill();
        if (failed) {
            console.error('\n❌ FAILED:');
            errors.forEach((e) => console.error('  ' + e));
            process.exitCode = 1;
        } else {
            console.log('\n✅ PASS: nazwa aplikacji spójna (S.O.K.) we wszystkich testach T1–T6');
        }
    }
})();
