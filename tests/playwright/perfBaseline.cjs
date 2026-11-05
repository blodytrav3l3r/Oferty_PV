/**
 * P1.6: baseline performance frontendu (BEFORE dla P1.7).
 *
 * Run: node tests/playwright/perfBaseline.cjs --spawn
 *   (buduje + migruje izolowany PostgreSQL + serwer :3178)
 * Bez --spawn: mierzy istniejacy serwer na BASE_URL (domyslnie :3000).
 *
 * Metryki per strona (cold ×3 + warm ×3): requests, bajty, JS-bajty, DCL, load,
 * liczba /api/*, liczba /api/auth/me, bledy konsoli. Wynik: JSON + tabela median.
 * Strony shella mierza dodatkowo pierwsze montowanie modulu w iframe
 * (frameReq/frameKB/frameJsKB/frameApi/frameMe/frameCacheHits/frameDcl/frameLoad)
 * — wlasne Resource Timing ramki, odczyt po bramce spokoju (nie po stalej pauzie).
 * Exit 0 = OK.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');
const fs = require('fs');
const { createIsolatedPostgresSchema } = require('./isolatedPostgres.cjs');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const PORT = process.env.PERF_PORT || (SPAWN ? '3178' : '3000');
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

const RESOURCE_TIMING_BUFFER_CAP = 5000;

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {
        console.error('Cannot find playwright.');
        process.exitCode = 1;
        throw new Error('playwright not found');
    }
}
const { chromium } = resolvePlaywright();
const { resolveChromePath, resolveOutPath } = require('./throttleHelper.cjs');

const CHROME_PATH = resolveChromePath();

const PAGES = [
    ['index', '/index.html'],
    ['app', '/app.html'],
    ['app-studnie', '/app.html#/studnie'],
    ['app-rury', '/app.html#/rury'],
    ['app-pulpit', '/app.html#/pulpit'],
    ['studnie', '/studnie.html'],
    ['rury', '/rury.html'],
    ['kartoteka', '/kartoteka.html'],
    ['zlecenia', '/zlecenia.html']
];
const RUNS = 3;
const ONLY = process.env.PERF_ONLY ? process.env.PERF_ONLY.split(',') : null;

async function startServer() {
    const { existsSync, symlinkSync } = require('fs');
    const { delimiter } = require('path');
    const { databaseUrl: dbUrl } = await createIsolatedPostgresSchema('perf_baseline');
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
    const withBin = (extra) => ({
        ...process.env,
        PATH: join(ROOT, 'node_modules', '.bin') + delimiter + (process.env.PATH || ''),
        ...extra
    });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: withBin({
            PORT,
            DATABASE_URL: dbUrl,
            DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD,
            NODE_ENV: 'development'
        }),
        stdio: 'pipe'
    });
    server.stdout.on('data', (d) => {
        if (process.env.PERF_VERBOSE === '1') process.stdout.write('[srv] ' + d);
    });
    server.stderr.on('data', (d) => {
        process.stderr.write('[srv-err] ' + String(d).slice(-2000));
    });
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`${BASE}/health`);
            if (r.ok) break;
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 1000));
    }
    // Warmup: swiezy seed robi FTS-backfill + auto-ensure na 1 polaczeniu.
    // Gate na gotowosc DB+auth: POST login az 200 (przy flakach wczesniej
    // padaly pierwsze goto). Potem rozgrzanie statykow.
    let authed = false;
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`${BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD })
            });
            if (r.ok) {
                authed = true;
                break;
            }
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 1000));
    }
    if (!authed) {
        server.kill();
        throw new Error('Serwer testowy: login warmup nie przeszedl (DB/auth niegotowe)');
    }
    try {
        await fetch(`${BASE}/index.html`);
        await fetch(`${BASE}/app.html`);
        await fetch(`${BASE}/api/version`);
    } catch (_) {}
    return server;
}

async function loginOnce(browser) {
    // Jeden login na caly przebieg (limiter 10/min) — cookie wstrzykiwane
    // do kazdego kontekstu. Cold = swiezy kontekst (pusty cache), ta sama sesja.
    const ctx = await browser.newContext();
    const login = await ctx.request.post(`${BASE}/api/auth/login`, {
        data: { username: 'admin', password: ADMIN_PASSWORD }
    });
    if (!login.ok()) throw new Error(`Login failed: ${login.status()}`);
    const state = await ctx.storageState();
    await ctx.close();
    const cookie = (state.cookies || []).find((c) => c.name === 'authToken');
    if (!cookie) throw new Error('Brak cookie authToken po loginie');
    return { name: cookie.name, value: cookie.value, domain: 'localhost', path: '/' };
}

async function readEmbeddedFrame(page) {
    // Pierwsze montowanie modulu SPA: ramka ma wlasny dokument, wiec jej Resource
    // Timing jest jedynym wiarygodnym pomiarem wagi (rodzic liczy tylko siebie).
    // Tylko shell (`/app.html`): index.html i moduly standalone robia redirect do
    // shella, wiec ich "ramka" to ten sam montaz — liczony raz, w wierszu app-*.
    const notFound = {
        found: false,
        url: '',
        req: 0,
        kb: 0,
        jsKB: 0,
        api: 0,
        me: 0,
        cacheHits: 0,
        dcl: -1,
        load: -1
    };
    if (!page.url().includes('/app.html')) return notFound;
    const main = page.mainFrame();
    const isModule = (f) => !f.isDetached() && f !== main && f.url() !== 'about:blank';
    let frame = null;
    for (let i = 0; i < 12 && !frame; i++) {
        const visible = await page.$('iframe.spa-iframe-visible');
        frame = visible ? await visible.contentFrame() : null;
        if (frame) break;
        if (!(await page.$('iframe'))) break; // brak ramki na tej stronie
        await page.waitForTimeout(250);
    }
    if (!frame) frame = page.frames().find(isModule) || null;
    if (!frame) return notFound;
    try {
        await frame.waitForLoadState('load', { timeout: 15000 });
    } catch (_) {}
    const perf = await frame.evaluate((cap) => {
        const nav = performance.getEntriesByType('navigation')[0];
        const res = performance.getEntriesByType('resource');
        if (res.length >= cap) {
            throw new Error(
                `Resource Timing buffer overflow in frame: ${res.length} >= ${cap} (limit truncates metrics)`
            );
        }
        const sum = (list) => list.reduce((s, r) => s + (r.transferSize || 0), 0);
        const api = res.filter((r) => r.name.includes('/api/')).length;
        return {
            dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : -1,
            load: nav ? Math.round(nav.loadEventEnd) : -1,
            jsBytes: Math.round(sum(res.filter((r) => r.initiatorType === 'script'))),
            resBytes: Math.round(sum(res) + (nav ? nav.transferSize || 0 : 0)),
            resCount: res.length + (nav ? 1 : 0),
            api,
            me: res.filter((r) => r.name.includes('/api/auth/me')).length,
            // transferSize 0 przy trafieniu w cache: shell zdazyl juz pobrac ten
            // plik, wiec wiersz ramki to przyrost po shellu, nie pelna waga modulu.
            cacheHits: res.filter((r) => !r.transferSize).length
        };
    }, RESOURCE_TIMING_BUFFER_CAP);
    return {
        found: true,
        url: frame.url(),
        req: perf.resCount,
        kb: Math.round(perf.resBytes / 1024),
        jsKB: Math.round(perf.jsBytes / 1024),
        api: perf.api,
        me: perf.me,
        cacheHits: perf.cacheHits,
        dcl: perf.dcl,
        load: perf.load
    };
}

/** Liczba wpisow Resource Timing: dokument glowny + ramka modulu (jesli jest). */
async function resourceCount(page) {
    const main = await page.evaluate(() => performance.getEntriesByType('resource').length);
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.url() !== 'about:blank');
    if (!frame) return main;
    try {
        return main + (await frame.evaluate(() => performance.getEntriesByType('resource').length));
    } catch (_) {
        return main;
    }
}

/**
 * Zamiana stalej pauzy 2,5 s na bramke spokoju: koniec dopiero gdy liczba
 * zasobow (shell + ramka) nie rosnie przez 2 proby po min. 1 s. Bez tego
 * wynik zalezy od szybkosci maszyny (szum +-2 zadania).
 */
async function waitForQuiescence(page) {
    const started = Date.now();
    let prev = -1;
    for (let i = 0; i < 40; i++) {
        const n = await resourceCount(page);
        const elapsed = Date.now() - started;
        if (n === prev && elapsed > 1000) return;
        prev = n;
        await page.waitForTimeout(250);
    }
}

async function measurePage(browser, url, mode, authCookie) {
    const out = [];
    let context = null;
    for (let i = 0; i < RUNS; i++) {
        if (mode === 'cold' || !context) {
            if (context) await context.close();
            context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
            // DomySlny bufor Resource Timing (250 wpisow) ucina duze moduly
            // (studnie.html: 229) — bez tego req/KB/api cicho zanizone.
            await context.addInitScript((cap) => {
                if (performance.setResourceTimingBufferSize)
                    performance.setResourceTimingBufferSize(cap);
            }, RESOURCE_TIMING_BUFFER_CAP);
            await context.addCookies([authCookie]);
        }
        const page = await context.newPage();
        const reqs = [];
        let consoleErrors = 0;
        const errTexts = [];
        page.on('console', (m) => {
            if (m.type() === 'error') {
                consoleErrors++;
                if (errTexts.length < 3) errTexts.push(m.text().slice(0, 200));
            }
        });
        page.on('pageerror', (e) => {
            consoleErrors++;
            if (errTexts.length < 3) errTexts.push('pageerror: ' + String(e).slice(0, 200));
        });
        page.on('response', async (resp) => {
            try {
                const h = resp.headers();
                reqs.push({ url: resp.url(), len: parseInt(h['content-length'] || '0', 10) || 0 });
            } catch (_) {}
        });
        await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try {
            await page.waitForLoadState('load', { timeout: 20000 });
        } catch (_) {}
        await page.waitForTimeout(2500);
        await waitForQuiescence(page);
        const nav = await page.evaluate((cap) => {
            const n = performance.getEntriesByType('navigation')[0];
            const res = performance.getEntriesByType('resource');
            if (res.length >= cap) {
                throw new Error(
                    `Resource Timing buffer overflow in page: ${res.length} >= ${cap} (limit truncates metrics)`
                );
            }
            const js = res
                .filter((r) => r.initiatorType === 'script')
                .reduce((s, r) => s + (r.transferSize || 0), 0);
            const total = res.reduce((s, r) => s + (r.transferSize || 0), 0);
            return {
                dcl: n ? Math.round(n.domContentLoadedEventEnd) : -1,
                load: n ? Math.round(n.loadEventEnd) : -1,
                jsBytes: Math.round(js),
                resBytes: Math.round(total)
            };
        }, RESOURCE_TIMING_BUFFER_CAP);
        const api = reqs.filter((r) => r.url.includes('/api/')).length;
        const me = reqs.filter((r) => r.url.includes('/api/auth/me')).length;
        const frame = await readEmbeddedFrame(page);
        out.push({
            requests: reqs.length,
            api,
            me,
            jsBytes: nav.jsBytes,
            resBytes: nav.resBytes,
            dcl: nav.dcl,
            load: nav.load,
            frameFound: frame.found,
            frameUrl: frame.url,
            frameReq: frame.req,
            frameKB: frame.kb,
            frameJsKB: frame.jsKB,
            frameApi: frame.api,
            frameMe: frame.me,
            frameCacheHits: frame.cacheHits,
            frameDcl: frame.dcl,
            frameLoad: frame.load,
            consoleErrors,
            errTexts
        });
        await page.close();
    }
    if (context) await context.close();
    return out;
}

function median(a) {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
}

(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }
    const browser = await chromium.launch({
        headless: true,
        ...(CHROME_PATH ? { executablePath: CHROME_PATH } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const pages = ONLY ? PAGES.filter(([n]) => ONLY.includes(n)) : PAGES;
    const result = {};
    const authCookie = await loginOnce(browser);
    try {
        for (const [name, url] of pages) {
            result[name] = {
                cold: await measurePage(browser, url, 'cold', authCookie),
                warm: await measurePage(browser, url, 'warm', authCookie)
            };
            const c = result[name].cold[0];
            console.log(
                `  ${name}: cold req=${c.requests} api=${c.api} me=${c.me} ` +
                    `js=${(c.jsBytes / 1024).toFixed(0)}KB dcl=${c.dcl}ms load=${c.load}ms err=${c.consoleErrors}` +
                    (c.frameFound
                        ? ` | frame(${c.frameUrl.replace(/^.*\//, '')}) req=${c.frameReq} ` +
                          `api=${c.frameApi} me=${c.frameMe} kb=${c.frameKB} ` +
                          `js=${c.frameJsKB}KB dcl=${c.frameDcl}ms`
                        : '')
            );
        }
    } finally {
        await browser.close();
        if (server) server.kill();
    }
    const summary = {};
    for (const [name] of pages) {
        summary[name] = {};
        for (const mode of ['cold', 'warm']) {
            const rows = result[name][mode];
            const m = (k) => median(rows.map((r) => r[k]));
            // Mediana tylko po przebiegach z ramka — inaczej brak ramki w 1 z 3
            // przebiegow po cichu zaniza wiersz (zera wchodza do mediany).
            const frameRows = rows.filter((r) => r.frameFound);
            const fm = (k) => (frameRows.length ? median(frameRows.map((r) => r[k])) : 0);
            summary[name][mode] = {
                requests: m('requests'),
                api: m('api'),
                me: m('me'),
                jsKB: Math.round(m('jsBytes') / 1024),
                resKB: Math.round(m('resBytes') / 1024),
                dclMs: m('dcl'),
                loadMs: m('load'),
                frameFound: frameRows.length > 0,
                frameRuns: frameRows.length,
                frameReq: fm('frameReq'),
                frameKB: fm('frameKB'),
                frameJsKB: fm('frameJsKB'),
                frameApi: fm('frameApi'),
                frameMe: fm('frameMe'),
                frameCacheHits: fm('frameCacheHits'),
                frameDclMs: fm('frameDcl'),
                frameLoadMs: fm('frameLoad'),
                consoleErrors: m('consoleErrors')
            };
        }
    }
    const OUT_DEFAULT = join(ROOT, 'docs', 'plans', 'p16-baseline.json');
    const outPath = resolveOutPath(process.env.PERF_OUT || OUT_DEFAULT);
    fs.writeFileSync(
        outPath,
        JSON.stringify({ base: BASE, runs: RUNS, summary, raw: result }, null, 1)
    );
    console.log('\nMediana (cold):');
    console.log('strona        req  api me  jsKB resKB  dcl   load  err');
    for (const [name] of pages) {
        const s = summary[name].cold;
        console.log(
            `${name.padEnd(13)} ${String(s.requests).padStart(3)} ${String(s.api).padStart(4)} ` +
                `${String(s.me).padStart(2)} ${String(s.jsKB).padStart(5)} ${String(s.resKB).padStart(5)} ` +
                `${String(s.dclMs).padStart(5)} ${String(s.loadMs).padStart(5)} ${String(s.consoleErrors).padStart(4)}`
        );
    }
    const frames = pages.filter(([name]) => summary[name].cold.frameFound);
    if (frames.length) {
        console.log('\nPierwsze montowanie modulu w iframe (mediana cold):');
        console.log('strona        req  api me cache  jsKB  kB  dcl   load');
        for (const [name] of frames) {
            const s = summary[name].cold;
            console.log(
                `${name.padEnd(13)} ${String(s.frameReq).padStart(3)} ${String(s.frameApi).padStart(4)} ` +
                    `${String(s.frameMe).padStart(2)} ${String(s.frameCacheHits).padStart(5)} ` +
                    `${String(s.frameJsKB).padStart(5)} ${String(s.frameKB).padStart(4)} ` +
                    `${String(s.frameDclMs).padStart(4)} ${String(s.frameLoadMs).padStart(5)}`
            );
        }
    }
    console.log('\nZapisano:', outPath);
})().catch((e) => {
    console.error('PERF-BASELINE FAIL:', e.message);
    process.exitCode = 1;
});
