/**
 * P1.6: baseline performance frontendu (BEFORE dla P1.7).
 *
 * Run: node tests/playwright/perfBaseline.cjs --spawn
 *   (buduje + push/seed data/perf-baseline.sqlite + serwer :3178, jak appNameConsistency)
 * Bez --spawn: mierzy istniejacy serwer na BASE_URL (domyslnie :3000).
 *
 * Metryki per strona (cold ×3 + warm ×3): requests, bajty, JS-bajty, DCL, load,
 * liczba /api/*, liczba /api/auth/me, bledy konsoli. Wynik: JSON + tabela median.
 * Exit 0 = OK.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');
const fs = require('fs');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const PORT = process.env.PERF_PORT || (SPAWN ? '3178' : '3000');
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

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

const PAGES = [
    ['index', '/index.html'],
    ['app', '/app.html'],
    ['app-studnie', '/app.html#/studnie'],
    ['app-rury', '/app.html#/rury'],
    ['studnie', '/studnie.html'],
    ['rury', '/rury.html'],
    ['kartoteka', '/kartoteka.html'],
    ['zlecenia', '/zlecenia.html']
];
const RUNS = 3;
const ONLY = process.env.PERF_ONLY ? process.env.PERF_ONLY.split(',') : null;

async function startServer() {
    const { rmSync, existsSync, symlinkSync, mkdirSync } = require('fs');
    const { delimiter } = require('path');
    const dbFile = join(ROOT, 'data', 'perf-baseline.sqlite');
    const dbUrl = 'file:' + dbFile.replace(/\\/g, '/');
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
        if (existsSync(f)) rmSync(f);
    }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
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
        { cwd: ROOT, env: withBin({ DATABASE_URL: dbUrl }), stdio: 'pipe' }
    );
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: withBin({ DATABASE_URL: dbUrl }),
        stdio: 'pipe'
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

async function measurePage(browser, url, mode, authCookie) {
    const out = [];
    let context = null;
    for (let i = 0; i < RUNS; i++) {
        if (mode === 'cold' || !context) {
            if (context) await context.close();
            context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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
        const nav = await page.evaluate(() => {
            const n = performance.getEntriesByType('navigation')[0];
            const js = performance
                .getEntriesByType('resource')
                .filter((r) => r.initiatorType === 'script')
                .reduce((s, r) => s + (r.transferSize || 0), 0);
            const total = performance
                .getEntriesByType('resource')
                .reduce((s, r) => s + (r.transferSize || 0), 0);
            return {
                dcl: n ? Math.round(n.domContentLoadedEventEnd) : -1,
                load: n ? Math.round(n.loadEventEnd) : -1,
                jsBytes: Math.round(js),
                resBytes: Math.round(total)
            };
        });
        const api = reqs.filter((r) => r.url.includes('/api/')).length;
        const me = reqs.filter((r) => r.url.includes('/api/auth/me')).length;
        out.push({
            requests: reqs.length,
            api,
            me,
            jsBytes: nav.jsBytes,
            resBytes: nav.resBytes,
            dcl: nav.dcl,
            load: nav.load,
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
                    `js=${(c.jsBytes / 1024).toFixed(0)}KB dcl=${c.dcl}ms load=${c.load}ms err=${c.consoleErrors}`
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
            summary[name][mode] = {
                requests: m('requests'),
                api: m('api'),
                me: m('me'),
                jsKB: Math.round(m('jsBytes') / 1024),
                resKB: Math.round(m('resBytes') / 1024),
                dclMs: m('dcl'),
                loadMs: m('load'),
                consoleErrors: m('consoleErrors')
            };
        }
    }
    const outPath =
        process.env.PERF_OUT || 'C:/Users/blody/AppData/Local/Temp/opencode/p16-baseline.json';
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
    console.log('\nZapisano:', outPath);
})().catch((e) => {
    console.error('PERF-BASELINE FAIL:', e.message);
    process.exitCode = 1;
});
