/**
 * E2E: 1-klik quick-edit w Liscie przejsc Zlecen Produkcyjnych (regresja 2-kliku).
 *
 * Scenariusz (kazda aktywacja JEDNYM klikiem, bez podwojnych klikow):
 *  3a. klik Kat -> input istnieje i sfokusowany (fokus trzyma 400 ms).
 *  3b. fill 33 + klik Rzedna -> Kat=33 w modelu, input Kata znika,
 *      input Rzednej sfokusowany; ZERO requestow production/* w trakcie.
 *  3c. klik Uwagi (blur) -> kafelek pokazuje 33, pelny rerender, 0 bledow konsoli.
 *  killer. wiszacy GET production/* (1500 ms) + switch Spadek kin.->mufa:
 *      2x1 klik, zapis 7, fokus trzyma.
 *
 * Determinizm: --spawn buduje izolowany serwer :3177 (e2e.sqlite, fresh seed)
 * i seeduje WLASNE zamowienie z 2 przejsciami przez PUT /api/orders-studnie
 * (wzorzec draftLoopProof.cjs). Bez --spawn wymaga E2E_QE_ORDER_ID
 * (istniejace zamowienie z >=2 przejsciami, read-only, bez PUT).
 * Nigdy nie klika Zapisz/Akceptuj/Usun (zero mutacji DB poza seedem).
 *
 * Run:   node tests/playwright/qeQuickEditSwitch.cjs --spawn
 *        node tests/playwright/qeQuickEditSwitch.cjs   (wymaga :3000 + E2E_QE_ORDER_ID)
 * Exit:  0 = pass, 1 = fail.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

function resolvePlaywright() {
    try {
        return require('playwright');
    } catch (_) {}
    const { readdirSync } = require('fs');
    const { join: j } = require('path');
    const roots = [];
    if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA + '\\npm-cache\\_npx');
    roots.push(j(process.env.HOME || process.env.USERPROFILE || '', '.npm', '_npx'));
    for (const root of roots) {
        try {
            for (const h of readdirSync(root, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name)) {
                try {
                    return require(j(root, h, 'node_modules', 'playwright'));
                } catch (_) {}
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
const ORDER_ID = 'e2e-qe-switch-1';

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
    execFileSync(
        process.execPath,
        [
            require.resolve('prisma/build/index.js'),
            'db',
            'push',
            '--skip-generate',
            '--accept-data-loss'
        ],
        { cwd: ROOT, env: { ...process.env, DATABASE_URL: dbUrl }, stdio: 'pipe' }
    );
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: {
            ...process.env,
            DATABASE_URL: dbUrl,
            PATH: join(ROOT, 'node_modules', '.bin') + ';' + process.env.PATH
        },
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
    server.stderr.on('data', (d) => {
        if (SPAWN_VERBOSE) process.stderr.write(d);
    });
    server.stdout.on('data', (d) => {
        if (SPAWN_VERBOSE) process.stdout.write(d);
    });
    const deadline = Date.now() + 30000;
    let ok = false;
    while (Date.now() < deadline) {
        try {
            const r = await fetch(`${BASE}/health`);
            if (r.status === 200) {
                ok = true;
                break;
            }
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ok) {
        server.kill();
        throw new Error('Serwer testowy nie wystartowal (health check)');
    }
    return server;
}

async function waitModuleFrame(page, mod) {
    const el = await page.waitForSelector(`#spa-iframe-${mod}`, { timeout: 15000 });
    let fr = await el.contentFrame();
    for (let i = 0; i < 30; i++) {
        const cand =
            (await el.contentFrame()) || page.frames().find((f) => f.url().includes(`${mod}.html`));
        if (cand && cand.url().includes(`${mod}.html`)) {
            fr = cand;
            break;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    if (!fr) throw new Error(`Cannot find ${mod} iframe`);
    return fr;
}

(async () => {
    let server = null;
    if (SPAWN) {
        console.log('> Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }
    const launchOptions = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        let url = '';
        try {
            const loc = m.location();
            if (loc && loc.url) url = loc.url;
        } catch (_) {}
        const text = m.text();
        // Killer celowo strzela w nieistniejace id (oczekiwany 404 po delayu).
        if (url.includes('00000000-0000-0000-0000-000000000000')) return;
        if (url.includes('favicon.ico') || text.includes('favicon.ico')) return;
        consoleErrors.push('[console.error] ' + url + ' :: ' + text.slice(0, 200));
    });
    page.on('pageerror', (e) =>
        consoleErrors.push('[pageerror] ' + String((e && e.message) || e).slice(0, 300))
    );
    let clicks = 0;
    const click = async (locator) => {
        clicks++;
        await locator.click();
    };
    let failed = false;
    const errors = [];
    let passedCount = 0;
    const check = (name, ok, detail) => {
        if (ok) {
            passedCount++;
            console.log(`  PASS [${name}] ${detail}`);
        } else {
            failed = true;
            errors.push(`${name}: ${detail}`);
            console.log(`  FAIL [${name}] ${detail}`);
        }
    };

    try {
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const qeSetCookie = loginResp.headers()['set-cookie'] || '';
        const qeCookieMatch = /authToken=([^;]+)/.exec(qeSetCookie);
        check('login', !!qeCookieMatch, `status=${loginResp.status()}`);

        await page.goto(`${BASE}/app.html#/studnie`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        const frame = await waitModuleFrame(page, 'studnie');
        await frame.waitForFunction(
            () =>
                window.currentUser &&
                window.currentUser.id !== undefined &&
                Array.isArray(window.studnieProducts) &&
                window.studnieProducts.length > 0,
            null,
            { timeout: 30000 }
        );

        let orderId = ORDER_ID;
        if (SPAWN) {
            // Self-seed: studnia DN1000 (krag + dennica z cennika) + 2 przejscia
            // w osobnych elementach, zeby filtr PZ mial co pokazac.
            const runtime = await frame.evaluate(() => {
                const prods = Array.isArray(window.studnieProducts) ? window.studnieProducts : [];
                const prz = prods.find((p) => p.componentType === 'przejscie');
                const den = prods.find(
                    (p) => p.componentType === 'dennica' && String(p.dn) === '1000' && p.height > 0
                );
                const krg = prods.find(
                    (p) =>
                        p.componentType === 'krag' &&
                        String(p.dn) === '1000' &&
                        p.height > 0 &&
                        p.id !== (den && den.id)
                );
                let wlot = 'wlot';
                try {
                    if (window.FLOW_TYPES && window.FLOW_TYPES.WLOT) wlot = window.FLOW_TYPES.WLOT;
                } catch (_) {}
                return {
                    przId: prz ? prz.id : null,
                    den: den ? { id: den.id, h: den.height } : null,
                    krg: krg ? { id: krg.id, h: krg.height } : null,
                    wlot
                };
            });
            check(
                'seed-produkty',
                !!(runtime.przId && runtime.den && runtime.krg),
                JSON.stringify(runtime).slice(0, 160)
            );
            const denH = runtime.den.h;
            const krgH = runtime.krg.h;
            const rzDna = 100.0;
            const rz1 = +(rzDna + (denH * 0.5) / 1000).toFixed(3);
            const rz2 = +(rzDna + (denH + krgH * 0.5) / 1000).toFixed(3);
            const orderDoc = {
                id: ORDER_ID,
                number: 'E2E/QE-1',
                clientName: 'E2E-QE',
                date: '2026-09-25',
                wells: [
                    {
                        id: 'w-qe-1',
                        name: 'S-QE',
                        dn: '1000',
                        rzednaDna: rzDna,
                        rzednaWlazu: +(rzDna + (denH + krgH) / 1000 + 1).toFixed(3),
                        config: [
                            { productId: runtime.krg.id, quantity: 1 },
                            { productId: runtime.den.id, quantity: 1 }
                        ],
                        przejscia: [
                            {
                                productId: runtime.przId,
                                angle: 90,
                                rzednaWlaczenia: rz1,
                                flowType: runtime.wlot
                            },
                            {
                                productId: runtime.przId,
                                angle: 270,
                                rzednaWlaczenia: rz2,
                                flowType: runtime.wlot
                            }
                        ]
                    }
                ],
                wellDiscounts: {},
                visiblePrzejsciaTypes: [],
                transportMode: 'full',
                wizard: { globalParams: {}, currentStep: 5 }
            };
            const putResp = await page.request.put(`${BASE}/api/orders-studnie`, {
                data: { data: [orderDoc] }
            });
            check('seed-PUT', putResp.ok(), `status=${putResp.status()}`);
        } else {
            orderId = process.env.E2E_QE_ORDER_ID || '';
            if (!orderId)
                throw new Error('Bez --spawn ustaw E2E_QE_ORDER_ID (zamowienie z >=2 przejsciami)');
        }

        // Wejscie w edycje zamowienia + modal PZ.
        await frame.evaluate((id) => window.enterOrderEditMode(id), orderId);
        await frame.waitForFunction(
            (id) =>
                typeof orderEditMode !== 'undefined' &&
                orderEditMode &&
                Array.isArray(window.wells) &&
                window.wells.length > 0,
            orderId,
            { timeout: 25000 }
        );
        await frame.evaluate(() => {
            currentWellIndex = 0;
            window.openZleceniaProdukcyjne();
        });
        await frame.waitForFunction(
            () => {
                const m = document.getElementById('zlecenia-modal');
                const l = document.getElementById('zl-przejscia-list');
                return !!(
                    m &&
                    m.classList.contains('active') &&
                    l &&
                    l.querySelector('[data-action="activateQuickEdit"]')
                );
            },
            null,
            { timeout: 15000 }
        );
        // Dobierz element z >=2 polami QE (filtr PZ po elementIndex).
        const switched = await frame.evaluate(async () => {
            const n = typeof zleceniaElementsList !== 'undefined' ? zleceniaElementsList.length : 0;
            for (let i = 0; i < n; i++) {
                await window.selectZleceniaElement(i);
                const c = document.querySelectorAll(
                    '#zl-przejscia-list [data-action="activateQuickEdit"]'
                ).length;
                if (c >= 2) return { i, c };
            }
            return { i: -1, c: 0 };
        });
        check('pz-element', switched.c >= 2, `el=${switched.i} qe=${switched.c}`);
        const przId = await frame.evaluate(() =>
            document
                .querySelector('#zl-przejscia-list [data-action="activateQuickEdit"]')
                .getAttribute('data-prz-id')
        );

        const cellFocusedInput = ([id, field]) => {
            const cell = document.querySelector(
                `#zl-przejscia-list [data-prz-id="${CSS.escape(id)}"][data-field="${field}"]`
            );
            const inp = cell && cell.querySelector('input');
            return !!(inp && document.activeElement === inp);
        };
        const readWellField = ([id, field]) => {
            const cell = document.querySelector(
                `#zl-przejscia-list [data-prz-id="${CSS.escape(id)}"][data-field="${field}"]`
            );
            if (!cell) return 'NO-CELL';
            const w = getCurrentWell();
            const idx = resolvePrzejscieIndex(w, cell, parseInt(cell.getAttribute('data-i'), 10));
            const p = w.przejscia[idx];
            if (!p) return 'NO-ROW';
            return field === 'angle' ? p.angle : p[field];
        };
        const cellHasNoInput = ([id, field]) => {
            const cell = document.querySelector(
                `#zl-przejscia-list [data-prz-id="${CSS.escape(id)}"][data-field="${field}"]`
            );
            return !!(cell && !cell.querySelector('input'));
        };

        // 3a. 1-klik Kat -> input + fokus (fokus trzyma 400 ms stabilnosci).
        const angleCell = frame
            .locator(`#zl-przejscia-list [data-prz-id="${przId}"][data-field="angle"]`)
            .first();
        await click(angleCell);
        let a3ok = false;
        try {
            await frame.waitForFunction(cellFocusedInput, [przId, 'angle'], { timeout: 5000 });
            await page.waitForTimeout(400);
            a3ok = await frame.evaluate(cellFocusedInput, [przId, 'angle']);
        } catch (_) {}
        check('3a', a3ok, '1 klik Kat -> input sfokusowany i trzyma');

        // 3b. fill 33 + 1-klik Rzedna -> zapis + fokus, zero requestow production/*.
        let prodHits = 0;
        page.on('request', (r) => {
            if (r.url().includes('/api/orders-studnie/production')) prodHits++;
        });
        await frame
            .locator(`#zl-przejscia-list [data-prz-id="${przId}"][data-field="angle"] input`)
            .fill('33');
        const bBefore = clicks;
        await click(
            frame
                .locator(
                    `#zl-przejscia-list [data-prz-id="${przId}"][data-field="rzednaWlaczenia"]`
                )
                .first()
        );
        let bFocus = false;
        let bSave = false;
        let bGone = false;
        try {
            await frame.waitForFunction(cellFocusedInput, [przId, 'rzednaWlaczenia'], {
                timeout: 5000
            });
            bFocus = true;
        } catch (_) {}
        try {
            bSave = (await frame.evaluate(readWellField, [przId, 'angle'])) === 33;
            bGone = await frame.evaluate(cellHasNoInput, [przId, 'angle']);
        } catch (_) {}
        check(
            '3b',
            bFocus && bSave && bGone && prodHits === 0 && clicks - bBefore === 1,
            `kliki=${clicks - bBefore} fokus=${bFocus} zapis33=${bSave} prodHits=${prodHits}`
        );

        // 3c. klik Uwagi (blur) -> kafelek 33, pelny rerender.
        await click(frame.locator('#zl-uwagi'));
        let cOk = false;
        try {
            await frame.waitForFunction(
                ([id]) => {
                    const c = document.querySelector(
                        `#zl-przejscia-list [data-prz-id="${CSS.escape(id)}"][data-field="angle"]`
                    );
                    return !!(
                        c &&
                        !c.querySelector('input') &&
                        (c.textContent || '').includes('33')
                    );
                },
                [przId],
                { timeout: 8000 }
            );
            cOk = true;
        } catch (_) {}
        check('3c', cOk, 'blur -> kafelek 33 bez inputa');

        // Killer: wiszacy GET production/* (1500 ms) + switch pol.
        let routeHit = false;
        const kT0 = Date.now();
        await page.route('**/api/orders-studnie/production/*', async (route) => {
            routeHit = true;
            await new Promise((r) => setTimeout(r, 1500));
            await route.continue();
        });
        await frame.evaluate(() => {
            window.__killerFetchDone = false;
            window.__killerP = window
                .loadProductionOrderDetail({ id: '00000000-0000-0000-0000-000000000000' })
                .then(() => {
                    window.__killerFetchDone = true;
                })
                .catch(() => {
                    window.__killerFetchDone = true;
                });
        });
        const kBefore = clicks;
        await click(
            frame
                .locator(`#zl-przejscia-list [data-prz-id="${przId}"][data-field="spadekKineta"]`)
                .first()
        );
        let kF1 = false;
        try {
            await frame.waitForFunction(cellFocusedInput, [przId, 'spadekKineta'], {
                timeout: 5000
            });
            kF1 = true;
        } catch (_) {}
        await frame
            .locator(`#zl-przejscia-list [data-prz-id="${przId}"][data-field="spadekKineta"] input`)
            .fill('7');
        await click(
            frame
                .locator(`#zl-przejscia-list [data-prz-id="${przId}"][data-field="spadekMufa"]`)
                .first()
        );
        let kF2 = false;
        let kSave = false;
        try {
            await frame.waitForFunction(cellFocusedInput, [przId, 'spadekMufa'], { timeout: 5000 });
            kF2 = true;
        } catch (_) {}
        try {
            kSave = (await frame.evaluate(readWellField, [przId, 'spadekKineta'])) === 7;
        } catch (_) {}
        await frame.waitForFunction(() => window.__killerFetchDone === true, null, {
            timeout: 10000
        });
        const overlapped = routeHit && Date.now() - kT0 >= 1400;
        check(
            'killer',
            kF1 && kF2 && kSave && overlapped && clicks - kBefore === 2,
            `kliki=${clicks - kBefore} f1=${kF1} zapis7=${kSave} f2=${kF2} overlap=${overlapped}`
        );

        check('console', consoleErrors.length === 0, `${consoleErrors.length} bledow`);
        if (consoleErrors.length)
            console.log('CONSOLE: ' + consoleErrors.join(' | ').slice(0, 800));
        console.log(`RAZEM klikow: ${clicks} (3a=1, 3b=1, 3c=1, killer=2)`);
    } catch (e) {
        failed = true;
        errors.push('exception: ' + (e && e.message ? e.message : String(e)).slice(0, 300));
        console.log('FAIL [exception] ' + errors[errors.length - 1]);
    } finally {
        await browser.close();
        if (server) server.kill();
    }
    console.log(`WYNIK qeQuickEditSwitch: ${failed ? 'FAIL' : 'PASS'} (${passedCount} passed)`);
    if (failed) {
        errors.forEach((e) => console.log(' - ' + e));
        process.exitCode = 1;
    }
})();
