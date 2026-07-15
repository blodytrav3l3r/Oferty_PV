// @ts-check
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Login przez UI
    await page.goto('http://localhost:3000/index.html');
    await page.locator('#login-username').fill('admin');
    await page.locator('#login-password').fill('anim123456');
    await page.locator('button:has-text("Zaloguj")').click();
    await page.waitForURL('**/app.html**', { timeout: 10000 }).catch(() => {});
    console.log('Logged in');

    await page.goto('http://localhost:3000/app.html#/studnie');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#spa-iframe-studnie', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const frame = await (await page.locator('#spa-iframe-studnie').elementHandle()).contentFrame();

    // Sprawdź stan w iframe (frame.evaluate ma dostęp do let)
    const check = async () => {
        return frame.evaluate(() => ({
            defined: typeof studnieProducts,
            prodLen: studnieProducts?.length || 0,
            przejCount: (studnieProducts || []).filter(p => p.componentType === 'przejscie' && p.active !== 0).length,
            typesSize: typeof visiblePrzejsciaTypes !== 'undefined' ? visiblePrzejsciaTypes.size : -1
        }));
    };

    let data = await check();
    console.log('Initial:', JSON.stringify(data));

    // Debug: sprawdź dlaczego przejCount = 0
    const debug = await frame.evaluate(() => {
        const allComponents = [...new Set(studnieProducts.map(p => p.componentType))];
        const przejscia = studnieProducts.filter(p => p.componentType === 'przejscie');
        const przejActive = przejscia.filter(p => p.active !== 0);
        const sampleInactive = przejscia.filter(p => p.active === 0).slice(0, 3).map(p => ({ id: p.id, name: p.name, active: p.active }));
        return {
            allComponentTypes: allComponents,
            przejTotal: przejscia.length,
            przejActive: przejActive.length,
            przejInactive: przejscia.length - przejActive.length,
            sampleInactive: sampleInactive,
            sampleActive: przejActive.slice(0, 3).map(p => ({ id: p.id, name: p.name, active: p.active }))
        };
    });
    console.log('Debug:', JSON.stringify(debug, null, 2));

    if (data.przejCount === 0) {
        console.error('FAIL: brak aktywnych przejść w bazie');
        await page.screenshot({ path: 'przejscia-fail.png', fullPage: false });
        await browser.close();
        process.exit(1);
    }

    // Kliknij zakładkę Przejścia
    await frame.locator('#btab-transitions').click();
    await page.waitForTimeout(800);

    const html = await frame.locator('#inline-przejscia-app').innerHTML();
    const hidden = html.includes('Wszystkie przejścia są ukryte');

    if (hidden) {
        console.error('PROBLEM: Przejścia ukryte mimo fixu!');
        console.error('HTML:', html.substring(0, 500));
        await page.screenshot({ path: 'przejscia-hidden.png', fullPage: false });
        await browser.close();
        process.exit(1);
    }

    const tiles = await frame.locator('.przejscia-vis-tile').count();
    console.log(`OK: Przejścia widoczne (${tiles} typów)`);
    await page.screenshot({ path: 'przejscia-visible.png', fullPage: false });

    // Popup
    const btns = frame.locator('#inline-przejscia-app button');
    for (let i = 0; i < await btns.count(); i++) {
        const txt = await btns.nth(i).textContent();
        if (txt && (txt.includes('okaż') || txt.includes('kryj'))) {
            await btns.nth(i).click(); break;
        }
    }
    await page.waitForTimeout(500);

    const popup = frame.locator('#przejscia-visibility-overlay');
    if (await popup.isVisible().catch(() => false)) {
        const pHtml = await popup.innerHTML();
        const m = pHtml.match(/Widoczne:.*?(\d+)\s*\/\s*(\d+)/);
        if (m) console.log(`Popup OK: ${m[1]} / ${m[2]} typów`);
        await page.screenshot({ path: 'przejscia-popup.png', fullPage: false });
    }

    await browser.close();
    console.log('TEST PASSED');
})();
