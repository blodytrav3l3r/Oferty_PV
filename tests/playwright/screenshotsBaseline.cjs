/**
 * Baseline screenshotów wizualnych (TASK-013, docs/REPAIR_PLAN.md).
 *
 * Zapamiętuje stan wizualny PRZED zmianami CSS (PHASE-03+). Strony:
 * studnie/rury/kartoteka (SPA app.html#/moduł) na 1280x800 i 390x844.
 * Zapis do tests/playwright/screenshots/baseline/.
 *
 * Run:
 *   node tests/playwright/screenshotsBaseline.cjs           # wymaga backendu na :3000
 *   node tests/playwright/screenshotsBaseline.cjs --spawn   # buduje + seeduje e2e.sqlite + startuje :3177
 *
 * Exit code: 0 = OK, 1 = błąd.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');
const { mkdirSync } = require('fs');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';
const OUT_DIR = process.env.SHOT_OUT || join(__dirname, 'screenshots', 'baseline');

const MODULES = ['studnie', 'rury', 'kartoteka'];
const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 }
];

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
const CHROME_PATH = process.env.CHROME_PATH;
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

(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }

    mkdirSync(OUT_DIR, { recursive: true });

    const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
    const browser = await chromium.launch(launchOptions);

    let failed = false;
    const errors = [];

    try {
        const loginResp = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD })
        });
        const loginJson = await loginResp.json();
        const authToken = loginJson.token || loginJson.authToken;
        if (!authToken) throw new Error('Login failed — no token');

        for (const mod of MODULES) {
            for (const vp of VIEWPORTS) {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height }
                });
                const page = await context.newPage();
                await page.addInitScript((t) => localStorage.setItem('authToken', t), authToken);

                await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(2500);

                const iframe = await page.waitForSelector(`#spa-iframe-${mod}`, { timeout: 15000 }).catch(() => null);
                if (!iframe) {
                    failed = true;
                    errors.push(`${mod}/${vp.name}: brak iframe #spa-iframe-${mod}`);
                    console.log(`  ❌ ${mod}/${vp.name}: brak iframe`);
                    await context.close();
                    continue;
                }
                const frame = await iframe.contentFrame() || page.frames().find((f) => f.url().includes(mod));
                if (!frame) {
                    failed = true;
                    errors.push(`${mod}/${vp.name}: iframe bez contentFrame`);
                    await context.close();
                    continue;
                }
                // Czekaj na załadowanie danych modułu (wizualnie kompletna strona)
                for (let i = 0; i < 10; i++) {
                    const ready = await frame.evaluate(() => document.readyState === 'complete').catch(() => false);
                    if (ready) break;
                    await page.waitForTimeout(1000);
                }
                await page.waitForTimeout(1500);

                const file = join(OUT_DIR, `${mod}-${vp.name}.png`);
                await page.screenshot({ path: file, fullPage: true });
                console.log(`  ✅ ${mod}/${vp.name} -> ${file}`);
                await context.close();
            }
        }
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
            console.log(`\n✅ PASS: baseline zapisany do ${OUT_DIR}`);
        }
    }
})();