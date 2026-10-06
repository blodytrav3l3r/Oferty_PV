/**
 * Test E2E: guard niezapisanych zmian przy przechodzeniu miedzy modulami (SPA-GUARD-PRO).
 *
 * Scenariusze (modul RURY, nowa oferta, docId 'new'):
 *   G1 popup 3-btn z kontekstem (brud -> klik Kartoteka -> "Oferta (Rury)" + Zapisz/Opuść/Zostań)
 *   G2 Zostań -> hash rury, pole zachowane
 *   G3 Opuść bez zapisu -> hash kartoteka (SAVED stracony, draft sflushowany)
 *   G4 draft przetrwal wyjscie + powrot bez zapisu (pole zachowane, klucz w localStorage)
 *   G5 A-vs-B: ?edit=X1 nad brudna edycja -> popup "wczytać X1" -> Zostań -> hash wrocony
 *   G6 Zapisz i przejdź przy niekompletnej ofercie (brak numeru) -> walidacja blokuje, zostaje
 *   G7 F5 z brudem -> popup 3-btn w iframe (kontekst + Zapisz i odśwież) -> Anuluj -> bez reloadu
 *   G8 flush + F5 -> recovery draftu po przeladowaniu (modal #sok-draft-modal)
 *   G9 Przywróć -> logout z brudem -> licznik draftów -> Zostań -> sesja cała
 *   G10 leave porzuca stan: kartoteka -> zlecenia BEZ popupu; nowa edycja uzbraja z powrotem
 *   G11 żaden natywny dialog (beforeunload) nie wyskakuje przy klikaniu kafli
 *   G12 świeże moduły czyste: studnie (pre-wypełnione notatki!) i rury bez popupu przy wyjściu
 *
 * Run:
 *   node tests/playwright/spa-guard.cjs                # wymaga backendu na :3000
 *   node tests/playwright/spa-guard.cjs --spawn        # izolowany serwer :3177
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden test nie przeszedl.
 */

const { execFileSync, spawn } = require('child_process');
const { resolve } = require('path');

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
    const homeNpx = j(process.env.HOME || process.env.USERPROFILE || '', '.npm', '_npx');
    roots.push(homeNpx);
    for (const root of roots) {
        try {
            const hashes = readdirSync(root, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            for (const h of hashes) {
                const p = j(root, h, 'node_modules', 'playwright');
                try {
                    return require(p);
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

async function startServer() {
    const { rmSync, existsSync, symlinkSync, mkdirSync } = require('fs');
    const dbFile = resolve(ROOT, 'data', 'e2e-spa-guard.sqlite');
    try {
        rmSync(dbFile, { force: true });
        rmSync(dbFile + '-wal', { force: true });
        rmSync(dbFile + '-shm', { force: true });
    } catch (_) {}
    const dbUrl = `file:${dbFile}?connection_limit=1&busy_timeout=30000`;
    const withBin = (env) => ({
        ...env,
        PATH: `${resolve(ROOT, 'node_modules', '.bin')}${require('path').delimiter}${process.env.PATH}`
    });
    execFileSync(
        process.execPath,
        [
            require.resolve('prisma/build/index.js'),
            'db',
            'push',
            '--skip-generate',
            '--accept-data-loss'
        ],
        { cwd: ROOT, env: withBin({ DATABASE_URL: dbUrl }), stdio: 'pipe' }
    );
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'seed'], {
        cwd: ROOT,
        env: withBin({ DATABASE_URL: dbUrl }),
        stdio: 'pipe'
    });
    void existsSync;
    void symlinkSync;
    void mkdirSync;
    const server = spawn(process.execPath, [resolve(ROOT, 'dist', 'server.js')], {
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
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) {
        server.kill();
        throw new Error('Serwer testowy nie wystartowal (health check)');
    }
    return server;
}

async function enterModule(page, mod) {
    await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return await waitModuleFrame(page, mod);
}

async function waitModuleFrame(page, mod) {
    const el = await page.waitForSelector(`#spa-iframe-${mod}`, { timeout: 15000 });
    let fr = await el.contentFrame();
    if (!fr) fr = page.frames().find((f) => f.url().includes(`${mod}.html`));
    if (!fr) throw new Error(`Cannot find ${mod} iframe`);
    await fr.waitForFunction(
        () => window.draftStore && window.draftAutosave && document.getElementById('client-name'),
        null,
        { timeout: 20000 }
    );
    return fr;
}

(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
        execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
        server = await startServer();
    }

    const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();

    let failed = false;
    const errors = [];
    const passed = [];
    const check = (name, ok, detail) => {
        if (ok) {
            passed.push(name);
            console.log(`  ✅ ${name}`);
        } else {
            failed = true;
            errors.push(`${name}: ${detail}`);
            console.log(`  ❌ ${name}: ${detail}`);
        }
    };

    try {
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        check(
            'LOGIN admin',
            /authToken=([^;]+)/.test(loginSetCookie),
            `status=${loginResp.status()}`
        );

        let frame = await enterModule(page, 'rury');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 15000 }
        );

        // G12: świeże moduły bez edycji = czysto (studnie pre-wypełniają notatki
        // generatorem — to nie brud; rury kontrolnie tak samo).
        for (const mod of ['studnie', 'rury']) {
            const fr = await enterModule(page, mod);
            await fr.waitForFunction(
                () => window.currentUser && window.currentUser.id !== undefined,
                null,
                { timeout: 15000 }
            );
            await sleep(1000);
            const fresh = await fr.evaluate(() => ({
                dirty: window.__sokIsDirty ? window.__sokIsDirty() : 'NO_FN',
                notes:
                    document.getElementById('offer-tab-notes')?.value ||
                    document.getElementById('offer-notes')?.value ||
                    ''
            }));
            check(`G12 świeży ${mod}: brak brudu`, fresh.dirty === false, `dirty=${fresh.dirty}`);
            if (mod === 'studnie') {
                check(
                    'G12 pułapka istnieje: notatki pre-wypełnione generatorem',
                    /Parametry techniczne:/.test(fresh.notes),
                    fresh.notes.slice(0, 80)
                );
            }
            await page.click('#spa-app-kartoteka');
            await sleep(1500);
            const silent = await page.evaluate(
                () =>
                    !document.getElementById('app-confirm-overlay') &&
                    /kartoteka/.test(window.location.hash)
            );
            check(`G12 wyjście ze świeżego ${mod}: bez popupu`, silent === true, String(silent));
        }

        // G12 przeładował stronę 2× — odnów ramkę rur przed G0.
        frame = await enterModule(page, 'rury');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 15000 }
        );

        // Brudzimy nowa oferte (diff live-vs-SAVED, bez flag — regresja rur).
        await frame.fill('#client-name', 'GUARD-E2E');
        const dirtyNow = await page.evaluate(() =>
            typeof window.__sokIsDirty === 'function' ? window.__sokIsDirty() : 'NO_SSOT'
        );
        check('G0 SSoT dirty wykrywa edycje rur bez flag', dirtyNow === true, `dirty=${dirtyNow}`);

        // G1: klik Kartoteka -> popup 3-btn z kontekstem w DOM rodzica.
        await page.click('#spa-app-kartoteka');
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        const btns = await page.evaluate(() => ({
            save: !!document.getElementById('app-confirm-save'),
            leave: !!document.getElementById('app-confirm-leave'),
            cancel: !!document.getElementById('app-confirm-cancel'),
            msg: document.getElementById('app-confirm-message')?.textContent || ''
        }));
        check(
            'G1 popup ma 3 przyciski',
            btns.save && btns.leave && btns.cancel,
            JSON.stringify(btns)
        );
        check('G1 popup nazywa dokument (P1.1)', /Rury/.test(btns.msg), btns.msg.slice(0, 120));

        // G2: Zostań -> dalej rury, pole cale.
        await page.click('#app-confirm-cancel');
        await page.waitForFunction(() => !document.getElementById('app-confirm-overlay'), null, {
            timeout: 5000
        });
        const hashStay = await page.evaluate(() => window.location.hash);
        const fieldStay = await frame.inputValue('#client-name');
        check(
            'G2 Zostań: hash rury + pole zachowane',
            /rury/.test(hashStay) && fieldStay === 'GUARD-E2E',
            `${hashStay} / ${fieldStay}`
        );

        // G3: Opuść bez zapisu -> kartoteka.
        await page.click('#spa-app-kartoteka');
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        await page.click('#app-confirm-leave');
        await page.waitForFunction(() => /kartoteka/.test(window.location.hash), null, {
            timeout: 8000
        });
        const hashLeft = await page.evaluate(() => window.location.hash);
        check('G3 Opuść bez zapisu: hash kartoteka', /kartoteka/.test(hashLeft), hashLeft);

        // G4: powrot — draft sflushowany przy wyjsciu, pole cale (iframe zyje w tle).
        await page.click('#spa-app-rury');
        // powrot tez przez guard (brud w ukrytym iframe) -> opusc bez zapisu
        try {
            await page.waitForSelector('#app-confirm-overlay', { timeout: 5000 });
            await sleep(400); // handlery modala wpinane +50ms po renderze
            await page.click('#app-confirm-leave');
        } catch (_) {}
        await page.waitForFunction(() => /#\/rury/.test(window.location.hash), null, {
            timeout: 8000
        });
        const frame2 = await waitModuleFrame(page, 'rury');
        const fieldBack = await frame2.inputValue('#client-name');
        check('G4 powrot: edycja zyje w ukrytym iframe', fieldBack === 'GUARD-E2E', fieldBack);
        const draftKey = await frame2.evaluate(() => {
            try {
                const uid = window.currentUser && window.currentUser.id;
                const k = window.draftStore.buildDraftKey(String(uid), 'offer_rury', 'new');
                const raw = localStorage.getItem(k);
                return raw && raw.indexOf('GUARD-E2E') !== -1 ? k : null;
            } catch (_) {
                return null;
            }
        });
        check('G4 draft sflushowany przy zmianie modulu', !!draftKey, String(draftKey));

        // G5: A-vs-B — ?edit=X1 nad brudna nowa oferta -> "wczytać X1" -> Zostań.
        // Uwaga: powrót w G4 wołał leave (= abandon), więc najpierw NOWA edycja.
        const frameAB = await waitModuleFrame(page, 'rury');
        await frameAB.fill('#client-name', 'GUARD-E2E-AB');
        await page.evaluate(() => {
            window.location.hash = '#/rury?edit=E2E_X1';
        });
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        const abMsg =
            (await page.evaluate(
                () => document.getElementById('app-confirm-message')?.textContent || ''
            )) || '';
        check(
            'G5 A-vs-B: popup nazywa wczytywana oferte',
            /wczyta.*E2E_X1/.test(abMsg),
            abMsg.slice(0, 160)
        );
        await page.click('#app-confirm-cancel');
        await page.waitForFunction(() => !document.getElementById('app-confirm-overlay'), null, {
            timeout: 5000
        });
        const hashAB = await page.evaluate(() => window.location.hash);
        check('G5 Zostań: hash wrocony (bez edit=X1)', !/E2E_X1/.test(hashAB), hashAB);

        // G6: Zapisz i przejdź przy niekompletnej ofercie (pusty numer) -> blokada, zostaje.
        await page.evaluate(() => {
            window.location.hash = '#/kartoteka';
        });
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        await page.click('#app-confirm-save');
        await sleep(2500);
        const overlayGone = await page.evaluate(
            () => !document.getElementById('app-confirm-overlay')
        );
        const hashG6 = await page.evaluate(() => window.location.hash);
        check(
            'G6 Zapisz i przejdź zablokowany walidacja: zostaje w rurach',
            overlayGone && /rury/.test(hashG6),
            `overlayGone=${overlayGone} hash=${hashG6}`
        );

        // G7: F5 z brudem -> custom popup 3-btn w iframe (nie natywny) -> Anuluj -> bez reloadu.
        const frame3 = await waitModuleFrame(page, 'rury');
        await frame3.click('#client-name');
        await frame3.press('#client-name', 'F5');
        await frame3.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        const f5btns = await frame3.evaluate(() => ({
            save: !!document.getElementById('app-confirm-save'),
            leave: !!document.getElementById('app-confirm-leave'),
            cancel: !!document.getElementById('app-confirm-cancel'),
            msg: document.getElementById('app-confirm-message')?.textContent || ''
        }));
        check(
            'G7 F5: popup 3-btn w iframe',
            f5btns.save && f5btns.leave && f5btns.cancel,
            JSON.stringify(f5btns).slice(0, 160)
        );
        check('G7 F5: popup z kontekstem', /Rury/.test(f5btns.msg), f5btns.msg.slice(0, 120));
        await frame3.click('#app-confirm-cancel');
        await frame3.waitForFunction(() => !document.getElementById('app-confirm-overlay'), null, {
            timeout: 5000
        });
        const fieldG7 = await frame3.inputValue('#client-name');
        check('G7 Anuluj: bez reloadu, pole cale', fieldG7 === 'GUARD-E2E-AB', fieldG7);

        // G8: deterministyczny flush + prawdziwy reload -> recovery draftu.
        await frame3.evaluate(() => window.draftAutosave.flushAll());
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        const frame4 = await waitModuleFrame(page, 'rury');
        await frame4.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 15000 }
        );
        await frame4.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        const recModal = await frame4.locator('#sok-draft-modal').count();
        check('G8 recovery po F5: modal draftu', recModal > 0, `modalCount=${recModal}`);

        // G9: Przywróć -> brud wraca -> logout pyta z licznikiem -> Zostań -> sesja cała.
        await frame4.click('[data-draft-act="restore"]');
        await frame4.waitForFunction(() => !document.getElementById('sok-draft-modal'), null, {
            timeout: 5000
        });
        const fieldRestored = await frame4.inputValue('#client-name');
        check('G9 Przywróć: pole z draftu', fieldRestored === 'GUARD-E2E-AB', fieldRestored);
        await frame4.evaluate(() => window.draftAutosave.flushAll());
        // :not(#theme-toggle) — przełącznik motywu dzieli klasę .header-logout.
        await page.click('button.header-logout:not(#theme-toggle)');
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        const lobtns = await page.evaluate(() => ({
            save: document.getElementById('app-confirm-save')?.textContent || '',
            leave: !!document.getElementById('app-confirm-leave'),
            cancel: !!document.getElementById('app-confirm-cancel'),
            msg: document.getElementById('app-confirm-message')?.textContent || ''
        }));
        check(
            'G9 logout: 3-btn (Zapisz i wyloguj)',
            /Zapisz i wyloguj/.test(lobtns.save) && lobtns.leave && lobtns.cancel,
            JSON.stringify(lobtns).slice(0, 160)
        );
        check(
            'G9 logout: licznik draftów',
            /Lokalnych draftów: 1/.test(lobtns.msg),
            lobtns.msg.slice(0, 160)
        );
        await page.click('#app-confirm-cancel');
        await page.waitForFunction(() => !document.getElementById('app-confirm-overlay'), null, {
            timeout: 5000
        });
        const stillApp = await page.evaluate(
            () =>
                window.location.href.includes('app.html') &&
                !!(window.currentUser && window.currentUser.id !== undefined)
        );
        check('G9 Zostań: sesja i strona całe', stillApp === true, String(stillApp));

        // G10+G11: porzucenie pamięta stan; natywne dialogi zakazane przy kaflach.
        const nativeDialogs = [];
        page.on('dialog', async (d) => {
            try {
                nativeDialogs.push(d.type());
            } catch (_) {}
        });
        // Stan po G9: brudny GUARD-E2E w rurach (G9 to był Zostań — nie porzucony).
        await page.click('#spa-app-kartoteka');
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        await page.click('#app-confirm-leave');
        await page.waitForFunction(() => /kartoteka/.test(window.location.hash), null, {
            timeout: 8000
        });
        const cleanAfterLeave = await page.evaluate(() =>
            typeof window.__sokIsDirty === 'function' ? window.__sokIsDirty() : 'NO_SSOT'
        );
        check(
            'G10 leave porzuca stan: guard cichy',
            cleanAfterLeave === false,
            `dirty=${cleanAfterLeave}`
        );
        // Drugie przejście (kartoteka -> zlecenia) BEZ popupu.
        await page.click('#spa-app-zlecenia');
        await sleep(1500);
        const noPopup = await page.evaluate(
            () =>
                !document.getElementById('app-confirm-overlay') &&
                /zlecenia/.test(window.location.hash)
        );
        check('G10 drugie przejście bez popupu', noPopup === true, String(noPopup));
        // Re-arm: powrót + nowa edycja -> guard wraca.
        await page.click('#spa-app-rury');
        await page.waitForFunction(() => /#\/rury/.test(window.location.hash), null, {
            timeout: 8000
        });
        const frame5 = await waitModuleFrame(page, 'rury');
        await frame5.fill('#client-name', 'GUARD-E2E X');
        await page.click('#spa-app-kartoteka');
        await page.waitForSelector('#app-confirm-overlay', { timeout: 8000 });
        await sleep(400); // handlery modala wpinane +50ms po renderze
        check('G10 re-arm: nowa edycja pyta znowu', true, '');
        await page.click('#app-confirm-cancel');
        await page.waitForFunction(() => !document.getElementById('app-confirm-overlay'), null, {
            timeout: 5000
        });
        check(
            'G11 brak natywnych dialogów przy kaflach',
            nativeDialogs.length === 0,
            JSON.stringify(nativeDialogs)
        );
    } catch (e) {
        failed = true;
        errors.push('EXCEPTION: ' + String((e && e.message) || e));
        console.log(`  ❌ EXCEPTION: ${String((e && e.message) || e)}`);
    } finally {
        await browser.close().catch(() => {});
        if (server) server.kill();
    }

    console.log(`\nAPI: ${passed.length} passed, ${errors.length} failed`);
    if (failed) {
        console.log(errors.join('\n'));
        process.exitCode = 1;
    }
})();
