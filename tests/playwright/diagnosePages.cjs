/**
 * Diagnostyka pustych stron — otwiera każdy moduł SPA, zbiera:
 * console error/warn, pageerror, failed requests (4xx/5xx), puste iframy.
 * Uruchomienie: node tests/playwright/diagnosePages.cjs --spawn
 */
const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

function resolvePlaywright() {
    try { return require('playwright'); } catch (_) {}
    const { readdirSync } = require('fs');
    const roots = [];
    if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA + '\\npm-cache\\_npx');
    roots.push(join(process.env.USERPROFILE || '', '.npm', '_npx'));
    for (const root of roots) {
        try {
            const hashes = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
            for (const h of hashes) {
                try { return require(join(root, h.name, 'node_modules', 'playwright')); } catch (_) {}
            }
        } catch (_) {}
    }
    throw new Error('playwright not found');
}

const { chromium } = resolvePlaywright();
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function pollHealth(url, tries = 30) {
    for (let i = 0; i < tries; i++) {
        try { const r = await fetch(url); if (r.status === 200) return true; } catch (_) {}
        await sleep(1000);
    }
    return false;
}

async function startServer() {
    const dbUrl = 'file:./data/e2e.sqlite';
    const { rmSync, existsSync, symlinkSync } = require('fs');
    const dbFile = join(ROOT, 'prisma', 'data', 'e2e.sqlite');
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) { if (existsSync(f)) rmSync(f); }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: dbUrl, PATH: join(ROOT, 'node_modules', '.bin') + ';' + process.env.PATH },
        stdio: 'pipe'
    });
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: dbUrl, PATH: join(ROOT, 'node_modules', '.bin') + ';' + process.env.PATH },
        stdio: 'pipe'
    });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: { ...process.env, PORT: '3177', DATABASE_URL: dbUrl, DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD, NODE_ENV: 'development' },
        stdio: 'pipe'
    });
    if (!(await pollHealth(`${BASE}/health`))) { server.kill(); throw new Error('serwer nie wystartował'); }
    return server;
}

const MODULES = ['studnie', 'rury', 'kartoteka', 'zlecenia'];

(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Build + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    for (const mod of MODULES) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const problems = [];
        page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[console.${msg.type()}] ${msg.text().slice(0, 220)}`); });
        page.on('pageerror', (err) => problems.push(`[pageerror] ${String(err).slice(0, 220)}`));
        page.on('requestfailed', (req) => problems.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`));
        page.on('response', (res) => { if (res.status() >= 400) problems.push(`[http ${res.status()}] ${res.url()}`); });

        // login
        const loginResp = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD })
        });
        const lj = await loginResp.json();
        const token = lj.token || lj.authToken;
        await page.addInitScript((t) => localStorage.setItem('authToken', t), token);

        await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000);

        const frameEl = await page.waitForSelector(`#spa-iframe-${mod}`, { timeout: 10000 }).catch(() => null);
        let bodyLen = -1;
        if (frameEl) {
            const frame = await frameEl.contentFrame();
            if (frame) {
                bodyLen = await frame.evaluate(() => document.body.innerText.trim().length).catch(() => -2);
                // sekcje wewnątrz iframe
                const sections = await frame.evaluate(() =>
                    Array.from(document.querySelectorAll('.section.active, .section')).map((s) => `${s.id}:${s.innerText.trim().length}`)
                ).catch(() => []);
                if (sections.length) problems.push('[iframe-sections] ' + sections.join(', '));
            }
        } else {
            problems.push('[BRAK IFRAME] #spa-iframe-' + mod);
        }
        if (bodyLen === 0) problems.push('[IFRAME PUSTY] innerText length=0');

        console.log(`\n===== ${mod} ===== bodyText=${bodyLen}`);
        const uniq = [...new Set(problems)];
        uniq.slice(0, 25).forEach((p) => console.log('  ' + p));
        if (uniq.length > 25) console.log(`  ... (+${uniq.length - 25} więcej)`);
        await context.close();
    }

    await browser.close();
    if (server) server.kill();
})();
