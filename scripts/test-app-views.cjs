const { spawn } = require('child_process');
const { chromium } = require('playwright');

(async () => {
    const env = { ...process.env, PORT: '3005', DEFAULT_ADMIN_PASSWORD: 'anim123456' };
    const srv = spawn('node', ['dist/server.js'], { env, stdio: 'pipe' });

    let started = false;
    srv.stdout.on('data', (d) => {
        const txt = d.toString();
        console.log('SRV STDOUT:', txt.trim());
        if (txt.includes('Server running') || txt.includes('Serwer') || txt.includes('nasłuchuje'))
            started = true;
    });
    srv.stderr.on('data', (d) => console.error('SRV STDERR:', d.toString()));

    for (let i = 0; i < 20; i++) {
        try {
            const res = await fetch('http://localhost:3005/health');
            if (res.ok) {
                started = true;
                break;
            }
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 500));
    }

    if (!started) {
        console.error('Server failed to start');
        srv.kill();
        process.exit(1);
    }
    console.log('Server is running on port 3005');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleLogs = [];
    page.on('console', (msg) =>
        consoleLogs.push({ type: msg.type(), text: msg.text(), location: msg.location() })
    );
    page.on('pageerror', (err) =>
        consoleLogs.push({ type: 'pageerror', text: err.message, stack: err.stack })
    );

    // login
    const loginRes = await page.request.post('http://localhost:3005/api/auth/login', {
        data: { username: 'admin', password: 'anim123456' }
    });
    console.log('Login status:', loginRes.status());
    const loginJson = await loginRes.json();
    const token = loginJson.token || loginJson.authToken;
    console.log('Got token:', token ? token.substring(0, 10) + '...' : 'NONE');

    await page.addInitScript((t) => localStorage.setItem('authToken', t), token);

    const routes = ['/studnie', '/rury', '/kartoteka', '/zlecenia', '/settings'];
    for (const route of routes) {
        consoleLogs.length = 0;
        console.log('\n==================================================');
        console.log('Testing route:', route);
        console.log('==================================================');
        await page.goto('http://localhost:3005/app.html#' + route, {
            waitUntil: 'networkidle',
            timeout: 15000
        }).catch((e) => console.log('goto err:', e.message));
        await page.waitForTimeout(2000);

        // main page title/module
        const spaLogoText = await page.innerText('#spa-logo-text').catch(() => 'err');
        console.log('SPA Header text:', spaLogoText.trim());

        // check iframe
        const iframeHandle = await page.$('#spa-iframe');
        if (!iframeHandle) {
            console.log('❌ #spa-iframe not found');
        } else {
            const frame = await iframeHandle.contentFrame();
            if (!frame) {
                console.log('❌ iframe contentFrame is null');
            } else {
                const frameTitle = await frame.title().catch(() => 'no title');
                const frameBodyText = await frame
                    .evaluate(() => document.body.innerText)
                    .catch((e) => 'err: ' + e.message);
                console.log('Frame Title:', frameTitle);
                console.log('Frame Body Text length:', frameBodyText.length);
                console.log(
                    'Frame Body Text sample:',
                    frameBodyText.substring(0, 250).replace(/\s+/g, ' ')
                );

                // Now test tabs inside Studnie if route === '/studnie'
                if (route === '/studnie') {
                    console.log('--- Testing tabs inside Studnie iframe ---');
                    const tabSelectors = [
                        { name: 'Konfiguracja', sel: '#wizard-step-1-btn, button[onclick*="showStep(1)"]' },
                        { name: 'Oferta', sel: '#wizard-step-2-btn, button[onclick*="showStep(2)"]' },
                        { name: 'Cennik', sel: '#wizard-step-3-btn, button[onclick*="showStep(3)"]' }
                    ];
                    for (const t of tabSelectors) {
                        const tabBtn = await frame.$(t.sel);
                        if (tabBtn) {
                            await tabBtn.click().catch(() => {});
                            await page.waitForTimeout(500);
                            const activeText = await frame.evaluate(() => document.body.innerText).catch(() => '');
                            console.log(`Tab [${t.name}] text len:`, activeText.length, 'sample:', activeText.substring(0, 150).replace(/\s+/g, ' '));
                        } else {
                            console.log(`Tab button [${t.name}] not found`);
                        }
                    }
                }
            }
        }

        const errors = consoleLogs.filter(
            (l) => l.type === 'error' || l.type === 'pageerror'
        );
        if (errors.length > 0) {
            console.log('ERRORS count:', errors.length);
            errors.forEach((e) => {
                console.log('  ❌ [ERROR]', e.text);
                if (e.location && e.location.url)
                    console.log('     at', e.location.url + ':' + e.location.lineNumber);
                if (e.stack) console.log('     stack:', e.stack.split('\n')[0]);
            });
        } else {
            console.log('✓ No JS console errors on route ' + route);
        }
    }

    await browser.close();
    srv.kill();
    process.exit(0);
})();
