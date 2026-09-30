/* Probe: klikniecia kafli Cennik (pricelist tabs) i Oferta (builder tabs) w module STUDNIE.
 * Loguje bledy konsoli przegladarki + violations CSP + stan po kliku.
 * Run: node tests/playwright/tabsProbe.cjs --spawn
 */
const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const BASE = 'http://localhost:3178';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    const { readdirSync } = require('fs');
    const roots = [];
    if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA + '\\npm-cache\\_npx');
    for (const r of roots) {
        try {
            for (const d of readdirSync(r)) {
                try {
                    return require(join(r, d, 'node_modules', 'playwright'));
                } catch (_) {}
            }
        } catch (_) {}
    }
    return require(join(ROOT, 'node_modules', 'playwright'));
}

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

async function main() {
    const { rmSync, existsSync, mkdirSync } = require('fs');
    const { delimiter } = require('path');
    const withBin = (extra) => ({
        ...process.env,
        PATH: join(ROOT, 'node_modules', '.bin') + delimiter + (process.env.PATH || ''),
        ...extra
    });
    const dbFile = join(ROOT, 'data', 'e2e-tabs.sqlite');
    const dbUrl = 'file:' + dbFile.replace(/\\/g, '/');
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
        if (existsSync(f)) rmSync(f);
    }
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
        cwd: ROOT,
        env: withBin({ DATABASE_URL: dbUrl }),
        stdio: 'pipe'
    });
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: withBin({ DATABASE_URL: dbUrl }),
        stdio: 'pipe'
    });
    const server = spawn(process.execPath, [join(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: { ...process.env, PORT: '3178', DATABASE_URL: dbUrl, DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD, NODE_ENV: 'development' },
        stdio: 'pipe'
    });
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) {
        server.kill();
        throw new Error('no health');
    }
    const { chromium } = resolvePlaywright();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e && e.message).slice(0, 300)));
    page.on('response', (r) => {
        if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[http${r.status()}] ${r.url().slice(0, 120)}`);
    });

    await page.goto(`${BASE}/index.html`);
    // Login przez API (cookie httpOnly w jarze — wzorzec draftRecovery.cjs).
    const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
        data: { username: 'admin', password: ADMIN_PASSWORD }
    });
    console.log('LOGIN status=' + loginResp.status());
    await page.goto(`${BASE}/app.html#/studnie`);
    await sleep(5000);
    const frames = page.frames().map((f) => f.url());
    console.log('FRAMES: ' + JSON.stringify(frames));
    const sf = page.frames().find((f) => (f.url() || '').includes('studnie.html'));
    if (!sf) {
        console.log('BRAK iframe studnie — test niemozliwy');
    } else {
        // 0) Header-nav Oferta/Cennik w STUDNIACH (data-section, binding w pricelistInit)
        const snav = await sf.$$eval('.nav-btn[data-section]', (els) =>
            els.map((e) => e.getAttribute('data-section'))
        );
        console.log('STUDNIE NAV: ' + JSON.stringify(snav));
        if (snav.includes('offer')) {
            await sf.$eval('#nav-offer', (e) =>
                e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            );
            await sleep(2000);
            const so = await sf.evaluate(() => ({
                offerActive: !!document.querySelector('#nav-offer.active'),
                sections: [...document.querySelectorAll('.section')].map((s) => s.id + '=' + (s.classList.contains('active') ? 'A' : '-')).join(',')
            }));
            console.log('STUDNIE nav-offer: ' + JSON.stringify(so));
        }
        if (snav.includes('pricelist')) {
            await sf.$eval('#nav-pricelist', (e) =>
                e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            );
            await sleep(2000);
            const sp = await sf.evaluate(() => ({
                pricelistActive: !!document.querySelector('#nav-pricelist.active'),
                prodRows: document.querySelectorAll('#studnie-pricelist-tbody tr, .studnie-product-row').length
            }));
            console.log('STUDNIE nav-pricelist: ' + JSON.stringify(sp));
        }
        const tabs = await sf.$$eval('.cennik-tab', (els) => els.map((e) => e.getAttribute('data-tab')));
        console.log('CENNIK TABS: ' + JSON.stringify(tabs));
        if (tabs.length > 1) {
            const vis = await sf.$eval('.cennik-tab[data-tab="dn1200"]', (e) => {
                const r = e.getBoundingClientRect();
                const cs = getComputedStyle(e);
                return { w: r.width, h: r.height, disp: cs.display, vis: cs.visibility };
            });
            console.log('dn1200 rect: ' + JSON.stringify(vis));
            await sf.$eval('.cennik-tab[data-tab="dn1200"]', (e) =>
                e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            );
            await sleep(2000);
            const active = await sf.$$eval('.cennik-tab.active', (els) =>
                els.map((e) => e.getAttribute('data-tab'))
            );
            console.log('PO KLIKU active=' + JSON.stringify(active));
            await sf.$eval('.cennik-tab[data-tab="preco"]', (e) =>
                e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            );
            await sleep(2000);
            const preco = await sf.evaluate(() => ({
                active: (document.querySelector('.cennik-tab.active') || {}).getAttribute
                    ? document.querySelector('.cennik-tab.active').getAttribute('data-tab')
                    : '?',
                rows: document.querySelectorAll('#preco-tbody tr, .preco-row, [data-preco-id]').length,
                text: document.body.innerText.slice(0, 120)
            }));
            console.log('PO KLIKU preco: ' + JSON.stringify(preco));
        }
        // 2) Builder tabs (oferta: Prefabrykaty/Przejscia)
        const btab = await sf.$('#btab-transitions');
        console.log('BTAB transitions present=' + !!btab);
        if (btab) {
            await sf.$eval('#btab-transitions', (e) =>
                e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            );
            await sleep(2000);
            const disp = await sf.$eval('#bcontent-transitions', (e) => e.style.display).catch(() => 'BRAK');
            const activeB = await sf.$eval('#btab-transitions.active', () => 'tak').catch(() => 'nie');
            console.log('PO KLIKU transitions: display=' + disp + ' active=' + activeB);
        }
        // 3) CSP w naglowku enforce
        const csp = await sf.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? 'meta' : 'header-only');
        console.log('CSP-MODE: ' + csp);
    }
    // 4) RURY: nawigacja Oferta/Cennik z partial-header
    await page.goto(`${BASE}/app.html#/rury`);
    await sleep(5000);
    const rf = page.frames().find((f) => (f.url() || '').includes('rury.html'));
    if (!rf) {
        console.log('BRAK iframe rury');
    } else {
        const nav = await rf.$$eval('.nav-btn[data-section]', (els) =>
            els.map((e) => e.getAttribute('data-section'))
        );
        console.log('RURY NAV: ' + JSON.stringify(nav));
        await rf.$eval('#nav-offer', (e) =>
            e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        );
        await sleep(2000);
        const st = await rf.evaluate(() => ({
            offerActive: !!document.querySelector('#nav-offer.active'),
            offerVisible:
                (document.getElementById('section-offer') || { style: {} }).style.display || '?'
        }));
        console.log('PO KLIKU nav-offer: ' + JSON.stringify(st));
        await rf.$eval('#nav-pricelist', (e) =>
            e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        );
        await sleep(2000);
        const st2 = await rf.evaluate(() => ({
            pricelistActive: !!document.querySelector('#nav-pricelist.active'),
            productsCount: document.querySelectorAll('#pricelist-tbody tr, .pricelist-row, [data-product-id]').length,
            offerItems: document.querySelectorAll('#offer-items-body tr, .offer-item').length,
            bodyText: document.body.innerText.slice(0, 200)
        }));
        console.log('PO KLIKU nav-pricelist: ' + JSON.stringify(st2));
    }
    console.log('ERRORS(' + errors.length + '):');
    for (const e of errors.slice(0, 20)) console.log('  ' + e);
    await browser.close();
    server.kill();
}

main().catch((e) => {
    console.error('PROBE-FAIL: ' + (e && e.stack || e));
    process.exit(1);
});
