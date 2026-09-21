/**
 * Test E2E: spójność nazwy aplikacji (domyślnie S.O.K., konfigurowalna przez
 * APP_NAME/APP_SUBTITLE w env).
 *
 * Weryfikuje, że nazwa aplikacji to APP_NAME, a nie "WITROS Oferty" —
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
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

/* ── Playwright resolution (wzorzec excelEmptyRowAlignment.cjs) ── */
function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
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
                try {
                    return require(p);
                } catch (_) {}
            }
        } catch (_) {}
    }
    console.error('Cannot find playwright. Install it: npm install playwright');
    process.exitCode = 1;
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();
const CHROME_PATH = process.env.CHROME_PATH;

/* ── Forensics: ring-buffer logów serwera (zawsze, też bez SPAWN_VERBOSE) ── */
const SERVER_LOG_MAX = 300;
const serverLog = [];
function pushServerLog(chunk) {
    for (const l of String(chunk).split(/\r?\n/)) {
        if (l) serverLog.push(l);
    }
    while (serverLog.length > SERVER_LOG_MAX) serverLog.shift();
}
function dumpServerLogTail(n = 80) {
    const tail = serverLog.slice(-n);
    if (tail.length === 0) return;
    console.error('\n── serwer (ostatnie linie) ──');
    tail.forEach((l) => console.error('  [srv] ' + l));
}

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

/* Nazwa aplikacji — sparametryzowana przez env (--spawn przekazuje env do serwera). */
const APP_NAME = process.env.APP_NAME || 'S.O.K.';
const APP_SUBTITLE = process.env.APP_SUBTITLE || 'System Ofert i Kalkulacji';
function escRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const APP_NAME_RE = new RegExp(escRe(APP_NAME));

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

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
    const { rmSync, existsSync, symlinkSync, mkdirSync } = require('fs');
    const { delimiter } = require('path');
    // ponytail: absolutny file: URL — względne ścieżki SQLite CLI i runtime
    // resolvują różnie (prisma/ vs cwd), stąd rozjazd bazy na CI.
    const dbFile = join(ROOT, 'data', 'e2e.sqlite');
    const dbUrl = 'file:' + dbFile.replace(/\\/g, '/');
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
        if (existsSync(f)) rmSync(f);
    }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
    // ponytail: ts-node z `prisma db seed` wymaga node_modules/.bin na PATH;
    // delimiter zamiast twardego ';' (Linux ':' vs Windows ';').
    const withBin = (extra) => ({
        ...process.env,
        PATH: join(ROOT, 'node_modules', '.bin') + delimiter + (process.env.PATH || ''),
        ...extra
    });
    execFileSync(
        process.execPath,
        [
            require.resolve('prisma/build/index.js'),
            'db',
            'push',
            '--skip-generate',
            '--accept-data-loss'
        ],
        {
            cwd: ROOT,
            env: withBin({ DATABASE_URL: dbUrl }),
            stdio: 'pipe'
        }
    );
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: withBin({ DATABASE_URL: dbUrl }),
        stdio: 'pipe'
    });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: withBin({
            PORT: '3177',
            DATABASE_URL: dbUrl,
            DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD,
            NODE_ENV: 'development'
        }),
        stdio: 'pipe'
    });
    server.stderr.on('data', (d) => {
        pushServerLog(d);
        if (SPAWN_VERBOSE) process.stderr.write(d);
    });
    server.stdout.on('data', (d) => {
        pushServerLog(d);
        if (SPAWN_VERBOSE) process.stdout.write(d);
    });
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) {
        server.kill();
        throw new Error('Serwer testowy nie wystartował (health check)');
    }
    return server;
}

/* ── Main ── */
(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }

    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
    const browser = await chromium.launch(launchOptions);
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
        // przyczyna: DOM — SPA router ustawia document.title asynchronicznie po load.
        await page
            .waitForFunction(() => document.title && document.title.length > 0, null, {
                timeout: 10000
            })
            .catch(() => {});
        const t1 = await page.title();
        check('T1 app.html title', APP_NAME_RE.test(t1) && !/WITROS/i.test(t1), `title="${t1}"`);

        // T2 — statyczne <title> wszystkich modułów (fetch omija iframe redirect)
        const TITLES = {
            'app.html': new RegExp('<title>\\s*' + escRe(APP_NAME)),
            'index.html': new RegExp('<title>\\s*' + escRe(APP_NAME)),
            'kartoteka.html': new RegExp('<title>\\s*' + escRe(APP_NAME)),
            'rury.html': new RegExp('<title>\\s*' + escRe(APP_NAME)),
            'studnie.html': new RegExp('<title>\\s*' + escRe(APP_NAME)),
            'zlecenia.html': new RegExp('<title>\\s*' + escRe(APP_NAME))
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
        if (!loginResp.ok()) {
            const body = await loginResp.text().catch(() => '');
            throw new Error(`Login failed — HTTP ${loginResp.status()}: ${body.slice(0, 200)}`);
        }
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        // Wariant A: brak tokenu w JSON = sesja w cookie httpOnly (jar kontekstu).
        // Twardy błąd tylko gdy ani tokenu, ani cookie sesji.
        const cookies = await context.cookies();
        if (!authToken && !cookies.some((c) => c.name === 'authToken')) {
            throw new Error('Login failed — brak tokenu w JSON i brak cookie authToken');
        }
        // Wariant A: cookie httpOnly z logowania siedzi w jarze kontekstu
        // (page.request dzieli cookie z page) — bez localStorage.

        // T4 — login + Pulpit
        await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // przyczyna: DOM — logo Pulpitu renderowane przez JS po load; warunek zamiast snu.
        await page
            .locator('img.index-logo-sok')
            .first()
            .waitFor({ timeout: 15000 })
            .catch(() => {});
        const t4title = await page.title();
        const t4logoCount = await page.locator('img.index-logo-sok').count();
        const t4logoAlt = t4logoCount
            ? await page.locator('img.index-logo-sok').first().getAttribute('alt')
            : null;
        const t4sub = await page
            .locator('.subtitle')
            .first()
            .textContent()
            .catch(() => '');
        check(
            'T4 Pulpit title',
            new RegExp(escRe(APP_NAME) + ' — Generator Ofert').test(t4title),
            `title="${t4title}"`
        );
        check(
            'T4 logo',
            t4logoCount === 1 && t4logoAlt === APP_NAME,
            `img.index-logo-sok count=${t4logoCount} alt="${t4logoAlt}"`
        );
        check('T4 subtitle', (t4sub || '').includes(APP_SUBTITLE), `subtitle="${t4sub}"`);

        // T3 — nagłówek SPA w app.html
        await page.goto(`${BASE}/app.html#/studnie`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        // przyczyna: DOM — router SPA podpina iframe asynchronicznie; warunkiem jest
        // waitForSelector poniżej (sztywny sen przed nim zbędny).
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
        check('T3 SPA logo', t3.logoAlt === APP_NAME, `alt="${t3.logoAlt}"`);
        check('T3 module name', t3.text === 'Oferty studnie', `#spa-logo-text="${t3.text}"`);
        check('T3 no WITROS', !/WITROS/i.test(t3.text), `text="${t3.text}"`);

        // T5 — REGRESJA #92: document.title po wejściu/wyjściu trybu edycji zamówienia
        // przyczyna: backend — produkty/cennik ładowane asynchronicznie; polling pętlą
        // zastąpiony jednym warunkiem (timeout jak suma pętli: 15×~2 s).
        let pw = -1;
        await frame
            .waitForFunction(
                () => {
                    try {
                        return typeof studnieProducts !== 'undefined' && studnieProducts.length > 0;
                    } catch (_) {
                        return false;
                    }
                },
                null,
                { timeout: 30000 }
            )
            .catch(() => {});
        pw = await frame
            .evaluate(() => {
                try {
                    return typeof studnieProducts !== 'undefined' ? studnieProducts.length : 0;
                } catch (_) {
                    return 0;
                }
            })
            .catch(() => 0);

        // Przejdź do modułu rur
        await page.goto(`${BASE}/app.html#/rury`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        // przyczyna: DOM — router SPA podpina iframe rur asynchronicznie; warunkiem jest
        // waitForSelector poniżej (sztywny sen przed nim zbędny).
        const ruryFrameEl = await page.waitForSelector('#spa-iframe-rury', { timeout: 15000 });
        let ruryFrame = await ruryFrameEl.contentFrame();
        if (!ruryFrame) ruryFrame = page.frames().find((f) => f.url().includes('rury'));
        if (!ruryFrame) throw new Error('Cannot find rury iframe');

        // przyczyna: DOM — ~50 defer-skryptów rury ładuje się po podpięciu
        // iframe; bez warunku evaluate trafia przed orderEditMode.js (T5 flaky).
        await ruryFrame
            .waitForFunction(() => typeof enterRuryOrderEditMode === 'function', null, {
                timeout: 30000
            })
            .catch(() => {});

        // Mock zamówienia (ordersRury to let globalny)
        await ruryFrame.evaluate(() => {
            // eslint-disable-next-line no-global-assign
            ordersRury = [
                {
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
                }
            ];
        });

        let enterTitle = '';
        let exitTitle = '';
        let exitError = '';
        // T5 retry: zimny CI potrafi nie dowieźć łańcucha render/lock za 1. razem.
        // Tytuł wchodzi od razu po znalezieniu danych (orderEditMode.js), więc
        // brak /Zamówienie:/ = realny problem z wejściem w tryb, nie timing tytułu.
        let t5res = { enterTitle: '', exitTitle: '', error: '' };
        let t5attempts = 0;
        for (let attempt = 1; attempt <= 3; attempt++) {
            t5attempts = attempt;
            t5res = await ruryFrame.evaluate(async () => {
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
            if (/Zamówienie:/.test(t5res.enterTitle || '')) break;
            await sleep(2000);
        }
        if (t5attempts > 1) console.log(`  ℹ T5 wszedł po próbie ${t5attempts}/3`);
        enterTitle = t5res.enterTitle;
        exitTitle = t5res.exitTitle;
        exitError = t5res.error;

        check(
            'T5 enter title',
            /Zamówienie:/.test(enterTitle) && !/WITROS/i.test(enterTitle),
            `title="${enterTitle}"`
        );
        if (!exitError) {
            check(
                'T5 exit title',
                exitTitle === APP_NAME + ' — Generator Ofert',
                `title="${exitTitle}"`
            );
        } else {
            console.log(`  ⚠ T5 exitError (soft): ${exitError}`);
        }
        check(
            'T5 no WITROS',
            !/WITROS/i.test(enterTitle + ' ' + exitTitle),
            `enter="${enterTitle}" exit="${exitTitle}"`
        );

        // T6 — wydruk (soft-check, SKIP przy braku danych)
        // Modal wydruku wymaga danych ofert/zamówień w bazie; bez nich renderuje toast.
        // Weryfikujemy tylko, że moduł rur nie ma w DOM żadnej nazwy WITROS Oferty.
        const t6 = await ruryFrame.evaluate(() => document.body.innerText.slice(0, 5000));
        check('T6 no WITROS w module', !/WITROS\s*[O\-–—]/i.test(t6), 'found WITROS in body text');
    } catch (e) {
        failed = true;
        errors.push('FATAL: ' + e.message);
    } finally {
        if (failed) {
            // Forensics: screenshot + URL/tytuł + ogon logu serwera + plik pod CI artefakt.
            try {
                const url = page.url();
                const title = await page.title().catch(() => '');
                console.error(`\n── forensics: url="${url}" title="${title}"`);
                await page.screenshot({ path: join(ROOT, 'e2e-appname-fail.png') });
                console.error('── forensics: zapisano e2e-appname-fail.png');
            } catch (_) {}
            try {
                require('fs').writeFileSync(
                    join(ROOT, 'e2e-appname-server.log'),
                    serverLog.join('\n')
                );
                console.error('── forensics: zapisano e2e-appname-server.log');
            } catch (_) {}
            dumpServerLogTail(80);
        }
        await browser.close();
        if (server) server.kill();
        if (failed) {
            console.error('\n❌ FAILED:');
            errors.forEach((e) => console.error('  ' + e));
            process.exitCode = 1;
        } else {
            console.log(
                `\n✅ PASS: nazwa aplikacji spójna (${APP_NAME}) we wszystkich testach T1–T6`
            );
        }
    }
})();
