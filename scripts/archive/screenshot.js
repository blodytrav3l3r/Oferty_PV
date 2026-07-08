// Screenshot script using Puppeteer + Playwright Chromium
// Usage: node scripts/screenshot.js <label>
// Outputs: screenshots/<label>-<view>.png

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH =
    'C:\\Users\\blody\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');
const LABEL = process.argv[2] || 'shot';

async function login(page) {
    console.log('=== LOGIN ===');
    try {
        await page.goto(BASE_URL + '/index.html', { waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
    try {
        await page.waitForSelector('#login-username', { timeout: 5000 });
        await page.type('#login-username', 'admin');
        await page.type('#login-password', 'admin123');
        await new Promise((r) => setTimeout(r, 200));
        await page.click('.login-btn');
        await new Promise((r) => setTimeout(r, 2500));
        console.log(`  logged in, URL: ${page.url()}`);
    } catch (e) {
        console.log(`  login failed: ${e.message.substring(0, 100)}`);
    }
}

async function go(page, hash) {
    console.log(`\n=== ${hash} ===`);
    try {
        await page.goto(BASE_URL + '/app.html' + hash, {
            waitUntil: 'networkidle2',
            timeout: 20000
        });
    } catch (e) {
        try {
            await page.goto(BASE_URL + '/app.html' + hash, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
        } catch (e2) {
            console.log(`  goto failed: ${e2.message.substring(0, 100)}`);
            return false;
        }
    }
    await new Promise((r) => setTimeout(r, 2200)); // Wait for iframe SPA load
    return true;
}

async function shot(page, name) {
    const outPath = path.join(OUTPUT_DIR, `${LABEL}-${name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    const stat = fs.statSync(outPath);
    console.log(`  saved: ${name}.png (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function shotFrame(frame, name) {
    const outPath = path.join(OUTPUT_DIR, `${LABEL}-${name}.png`);
    await frame.screenshot({ path: outPath });
    const stat = fs.statSync(outPath);
    console.log(`  saved: ${name}.png (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function shotIframe(page, name) {
    // Find the visible iframe and screenshot its content
    const frame = page
        .frames()
        .find(
            (f) =>
                (f !== page.mainFrame() && f.url().includes('studnie')) ||
                f.url().includes('rury') ||
                f.url().includes('kartoteka') ||
                f.url().includes('zlecenia')
        );
    if (frame) {
        await shotFrame(frame, name);
    } else {
        console.log(`  no iframe found for ${name}`);
    }
}

async function clickInIframe(page, selector, label) {
    // Try main frame first, then iframes
    let handle = await page.$(selector);
    if (!handle) {
        const frames = page.frames().filter((f) => f !== page.mainFrame());
        for (const f of frames) {
            try {
                handle = await f.$(selector);
                if (handle) break;
            } catch (e) {}
        }
    }
    if (handle) {
        try {
            await handle.click();
            await new Promise((r) => setTimeout(r, 1500));
            console.log(`  clicked: ${label}`);
            return true;
        } catch (e) {
            console.log(`  click failed: ${e.message.substring(0, 80)}`);
        }
    }
    // Fallback: call wizardNext() in iframe window
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    for (const f of frames) {
        try {
            const result = await f.evaluate(() => {
                if (typeof window.wizardNext === 'function') {
                    window.wizardNext();
                    return 'called';
                }
                return 'no-function';
            });
            if (result === 'called') {
                await new Promise((r) => setTimeout(r, 1500));
                console.log(`  invoked via JS in frame (${f.url().split('/').pop()}): ${label}`);
                return true;
            }
        } catch (e) {
            console.log(`  iframe eval failed: ${e.message.substring(0, 60)}`);
        }
    }
    console.log(`  selector not found: ${selector} (${label})`);
    return false;
}

async function shotIframeView(page, viewName) {
    // Iframe screenshot: get iframe bounding box from main page
    try {
        const iframeHandle = await page.$('iframe.spa-module-iframe');
        if (iframeHandle) {
            const box = await iframeHandle.boundingBox();
            if (box && box.width > 0 && box.height > 0) {
                const outPath = path.join(OUTPUT_DIR, `${LABEL}-${viewName}.png`);
                await page.screenshot({
                    path: outPath,
                    clip: {
                        x: Math.max(0, box.x),
                        y: Math.max(0, box.y),
                        width: Math.min(box.width, 1440 - Math.max(0, box.x)),
                        height: Math.min(box.height, 900 - Math.max(0, box.y))
                    }
                });
                const stat = fs.statSync(outPath);
                console.log(
                    `  saved: ${viewName}.png (${(stat.size / 1024).toFixed(1)} KB) - iframe clip`
                );
            } else {
                console.log(`  iframe has no box for ${viewName}`);
            }
        } else {
            console.log(`  no iframe element found for ${viewName}`);
        }
    } catch (e) {
        console.log(`  error shotting iframe ${viewName}: ${e.message.substring(0, 80)}`);
    }
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1440,900'
        ],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
            console.log(`[console.${msg.type()}] ${msg.text().substring(0, 200)}`);
        }
    });
    page.on('pageerror', (err) => {
        console.log(`[pageerror] ${err.message.substring(0, 200)}`);
    });

    await login(page);

    // ===== STUDNIE — wszystkie stany =====
    // Step 1: Dane klienta
    if (await go(page, '#/studnie')) {
        await shotIframeView(page, 'studnie-step1-dane-klienta');
    }

    // Click "Dalej" to go to step 2 (parametry studni) — this is where the double-class bug was
    await clickInIframe(
        page,
        'button.wizard-btn-next, button#studnie-nav-next',
        'wizard-next-from-step1'
    );
    await shotIframeView(page, 'studnie-step2-parametry');

    // Click "Dalej" again to step 3 (oferta)
    await clickInIframe(
        page,
        'button.wizard-btn-next, button#studnie-nav-next',
        'wizard-next-to-step3'
    );
    await shotIframeView(page, 'studnie-step3-oferta');

    // Step 4: Karta Budowy
    await clickInIframe(
        page,
        'button.wizard-btn-next, button#studnie-nav-next',
        'wizard-next-to-step4'
    );
    await shotIframeView(page, 'studnie-step4-karta-budowy');

    // Step 5: Zamówienie
    await clickInIframe(
        page,
        'button.wizard-btn-next, button#studnie-nav-next',
        'wizard-next-to-step5'
    );
    await shotIframeView(page, 'studnie-step5-zamowienie');

    // Cennik (pricelist) — where the 25 th width bug was
    if (await go(page, '#/studnie')) {
        await new Promise((r) => setTimeout(r, 800));
        // Try switching to cennik section
        await page.evaluate(() => {
            if (window.SpaRouter && window.SpaRouter.showSection) {
                window.SpaRouter.showSection('pricelist');
            }
        });
        await new Promise((r) => setTimeout(r, 1500));
        await shotIframeView(page, 'studnie-cennik');
    }

    // ===== RURY =====
    if (await go(page, '#/rury')) {
        await shotIframeView(page, 'rury-step1-dane-klienta');
    }

    // Click through rury wizard
    await clickInIframe(page, 'button.wizard-btn-next, button[id*="next"]', 'rury-wizard-next');
    await new Promise((r) => setTimeout(r, 1500));
    await shotIframeView(page, 'rury-step2-produkty');

    await clickInIframe(page, 'button.wizard-btn-next, button[id*="next"]', 'rury-wizard-next2');
    await new Promise((r) => setTimeout(r, 1500));
    await shotIframeView(page, 'rury-step3-oferta');

    await clickInIframe(page, 'button.wizard-btn-next, button[id*="next"]', 'rury-wizard-next3');
    await new Promise((r) => setTimeout(r, 1500));
    await shotIframeView(page, 'rury-step4-karta-budowy');

    await clickInIframe(page, 'button.wizard-btn-next, button[id*="next"]', 'rury-wizard-next4');
    await new Promise((r) => setTimeout(r, 1500));
    await shotIframeView(page, 'rury-step5-zamowienie');

    // Rury cennik
    if (await go(page, '#/rury')) {
        await new Promise((r) => setTimeout(r, 800));
        await page.evaluate(() => {
            if (window.SpaRouter && window.SpaRouter.showSection) {
                window.SpaRouter.showSection('pricelist');
            }
        });
        await new Promise((r) => setTimeout(r, 1500));
        await shotIframeView(page, 'rury-cennik');
    }

    // Rury oferta section
    if (await go(page, '#/rury')) {
        await new Promise((r) => setTimeout(r, 800));
        await page.evaluate(() => {
            if (window.SpaRouter && window.SpaRouter.showSection) {
                window.SpaRouter.showSection('offer');
            }
        });
        await new Promise((r) => setTimeout(r, 1500));
        await shotIframeView(page, 'rury-oferta');
    }

    // ===== KARTOTEKA + ZLECENIA =====
    if (await go(page, '#/kartoteka')) {
        await new Promise((r) => setTimeout(r, 1500));
        await shot(page, 'app-kartoteka');
    }
    if (await go(page, '#/zlecenia')) {
        await new Promise((r) => setTimeout(r, 1500));
        await shot(page, 'app-zlecenia');
    }

    await browser.close();
    console.log('\nDONE');
}

main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
});
