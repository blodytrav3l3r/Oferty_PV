/**
 * Bramka kontrastu aktywnego przycisku PEHD + overflow komorek ILOSC/ZAMOW.
 * Regresja: html[light] .btn-secondary (0,2,1) przebijal
 * .rury-table .pehd-btn-active (0,2,0) i czyscil bursztynowe tlo na bialo,
 * dajac bialy-tekst-na-bialym. Fix wymaga selektora .pehd-btn.pehd-btn-active.
 *
 * Run:  node tests/playwright/ruryPehdContrast.cjs
 * Needs: backend on :3000
 */

const BASE = 'http://localhost:3000';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    throw new Error('playwright not found (npm i)');
}

const { chromium } = resolvePlaywright();
const CHROME_PATH =
    process.env.CHROME_PATH ||
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lum(rgb) {
    const c = rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map((v) => {
            const x = parseFloat(v) / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox']
    });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const failures = [];
    const check = (name, cond, detail) => {
        console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
        if (!cond) failures.push(name);
    };

    try {
        const r = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        const token = (await r.json()).token;
        if (!token) throw new Error('Login failed - no token');

        await page.goto(`${BASE}/app.html#/rury`, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(3000);
        const iframeEl = await page.waitForSelector('#spa-iframe-rury', { timeout: 15000 });
        await sleep(2000);
        let frame = await iframeEl.contentFrame();
        if (!frame) frame = page.frames().find((f) => f.url().includes('rury'));
        if (!frame) throw new Error('no rury iframe');

        const probe = await frame.evaluate(async () => {
            const wrap = document.createElement('div');
            wrap.innerHTML =
                '<table class="rury-table"><tbody><tr>' +
                '<td class="text-right qty-cell"><span class="text-center-block">' +
                '<input type="number" class="edit-input w-75-c" min="1" value="1"> szt.</span></td>' +
                '<td class="text-center text-nowrap">' +
                '<input type="number" class="order-partial-qty" value="1" min="1" max="1"> ' +
                '<span class="order-qty-max">/ 1</span></td>' +
                '<td><div class="pehd-btn-stack">' +
                '<button class="btn btn-sm btn-secondary pehd-btn pehd-btn-active" id="probe-active">+ PEHD 3mm</button>' +
                '<button class="btn btn-sm btn-secondary pehd-btn pehd-btn-inactive" id="probe-inactive">+ PEHD 4mm</button>' +
                '</div></td></tr></tbody></table>';
            wrap.style.cssText =
                'position:fixed;top:0;left:0;z-index:99999;background:#fff;padding:20px;';
            document.body.appendChild(wrap);
            const cs = (id) => {
                const c = getComputedStyle(document.getElementById(id));
                return { bg: c.backgroundColor, color: c.color };
            };
            const out = { dark: { active: cs('probe-active') } };
            document.documentElement.setAttribute('data-theme', 'light');
            await new Promise((res) => setTimeout(res, 300));
            out.light = { active: cs('probe-active') };
            const tds = [...wrap.querySelectorAll('td.qty-cell, td.text-nowrap')];
            out.overflow = tds.map((td) => td.scrollWidth > td.clientWidth + 1);
            document.documentElement.removeAttribute('data-theme');
            wrap.remove();
            return out;
        });

        check(
            'dark active ma bursztynowe tlo',
            probe.dark.active.bg === 'rgb(245, 158, 11)',
            probe.dark.active.bg
        );
        check(
            'dark active kontrast >= 4.5',
            ratio(probe.dark.active.bg, probe.dark.active.color) >= 4.5,
            ratio(probe.dark.active.bg, probe.dark.active.color).toFixed(2)
        );
        check(
            'light active ma bursztynowe tlo',
            probe.light.active.bg === 'rgb(180, 83, 9)',
            probe.light.active.bg
        );
        check(
            'light active kontrast >= 4.5',
            ratio(probe.light.active.bg, probe.light.active.color) >= 4.5,
            ratio(probe.light.active.bg, probe.light.active.color).toFixed(2)
        );
        check(
            'komorki ilosci bez overflow',
            probe.overflow.every((o) => o === false),
            JSON.stringify(probe.overflow)
        );
    } catch (e) {
        console.log('FAIL exception :: ' + e.message);
        failures.push('exception');
    } finally {
        await browser.close();
    }
    if (failures.length > 0) {
        console.log('ruryPehdContrast: FAIL (' + failures.length + ')');
        process.exit(1);
    }
    console.log('ruryPehdContrast: OK');
})().catch((e) => {
    console.error('FAIL:', e.message);
    process.exit(1);
});
