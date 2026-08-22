/**
 * Debug v2 — dlaczego brak iframe: URL po loadzie, auth/me status,
 * stan #spa-main, bezpośrednie studnie.html poza SPA.
 */
const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');
const ROOT = resolve(__dirname, '..', '..');
const BASE = 'http://localhost:3177';
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
const { rmSync, existsSync, symlinkSync } = require('fs');
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function pollHealth(url, tries = 30) {
    for (let i = 0; i < tries; i++) {
        try { const r = await fetch(url); if (r.status === 200) return true; } catch (_) {}
        await sleep(1000);
    }
    return false;
}
(async () => {
    const dbUrl = 'file:./data/e2e.sqlite';
    const dbFile = join(ROOT, 'prisma', 'data', 'e2e.sqlite');
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) { if (existsSync(f)) rmSync(f); }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    const env = { ...process.env, DATABASE_URL: dbUrl, PATH: join(ROOT, 'node_modules', '.bin') + ';' + process.env.PATH };
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], { cwd: ROOT, env, stdio: 'pipe' });
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], { cwd: ROOT, env, stdio: 'pipe' });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], { cwd: ROOT, env: { ...env, PORT: '3177', DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD, NODE_ENV: 'development' }, stdio: 'pipe' });
    if (!(await pollHealth(`${BASE}/health`))) { server.kill(); throw new Error('no server'); }

    // 1. Login API
    const lr = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD }) });
    const lj = await lr.json();
    console.log('login status:', lr.status, 'token:', lj.token ? 'OK' : JSON.stringify(lj).slice(0, 120));
    const token = lj.token || lj.authToken;

    // 2. auth/me z tokenem
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { 'x-auth-token': token } });
    console.log('auth/me (x-auth-token):', me.status);

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
    await page.addInitScript((t) => localStorage.setItem('authToken', t), token);
    await page.goto(`${BASE}/app.html#/studnie`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    console.log('final URL:', page.url());
    console.log('spa-main children:', await page.evaluate(() => document.getElementById('spa-main')?.children.length));
    console.log('body class:', await page.evaluate(() => document.body.className));
    console.log('has nav-apps:', await page.evaluate(() => !!document.querySelector('.nav-apps')));
    console.log('getAuthToken:', await page.evaluate(() => typeof getAuthToken === 'function' ? (getAuthToken() ? 'token-ok' : 'token-empty') : 'brak funkcji'));
    console.log('SpaRouter:', await page.evaluate(() => typeof window.SpaRouter));

    // 3. Bezpośrednio moduł poza SPA
    await page.goto(`${BASE}/studnie.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    console.log('\n--- studnie.html bezpośrednio ---');
    console.log('URL:', page.url());
    console.log('wizard-step-1 visible:', await page.evaluate(() => { const s = document.getElementById('wizard-step-1'); return s ? getComputedStyle(s).display : 'BRAK ELEMENTU'; }));
    console.log('client-name input:', await page.evaluate(() => !!document.getElementById('client-name')));
    console.log('body text len:', await page.evaluate(() => document.body.innerText.trim().length));

    await browser.close();
    server.kill();
})();
