/**
 * Debug v3 — zawartość iframe'ów od środka + screenshoty.
 * node tests/playwright/debugContent.cjs   (serwer już działa na :3177)
 */
const { join, resolve } = require('path');
const ROOT = resolve(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3177';
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
const fs = require('fs');
const OUT = join(__dirname, 'screenshots', 'debug');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const lr = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: ADMIN_PASSWORD }) });
    const token = (await lr.json()).token;
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

    for (const mod of ['studnie', 'rury', 'kartoteka', 'zlecenia']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push('[pageerror] ' + String(e).slice(0, 200)));
        await page.addInitScript((t) => localStorage.setItem('authToken', t), token);
        await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);

        const frameEl = await page.$(`#spa-iframe-${mod}`);
        let info = 'BRAK IFRAME';
        if (frameEl) {
            const frame = await frameEl.contentFrame();
            if (frame) {
                info = await frame.evaluate(() => {
                    const active = document.querySelector('.section.active');
                    return JSON.stringify({
                        readyState: document.readyState,
                        scripts: document.scripts.length,
                        activeSection: active ? active.id : null,
                        activeTextLen: active ? active.innerText.trim().length : -1,
                        wizardStep1: !!document.getElementById('wizard-step-1'),
                        clientName: !!document.getElementById('client-name'),
                        offersListLen: document.getElementById('ka-offers-list') ? document.getElementById('ka-offers-list').innerText.length : null,
                        zleceniaRows: document.getElementById('zlecenia-table-body') ? document.getElementById('zlecenia-table-body').children.length : null,
                        partialHosts: Array.from(document.querySelectorAll('[data-partial]')).map((h) => `${h.id}:${h.children.length}`).join(','),
                        topErrors: window.__errCount || 0
                    });
                }).catch((e) => 'eval-err: ' + String(e).slice(0, 150));
            }
        }
        console.log(`\n===== ${mod} =====`);
        console.log(' ', info);
        errs.slice(0, 8).forEach((e) => console.log('  ', e));
        await page.screenshot({ path: join(OUT, `${mod}.png`), fullPage: true });
        await context.close();
    }
    await browser.close();
    console.log('\nscreenshoty:', OUT);
})();
