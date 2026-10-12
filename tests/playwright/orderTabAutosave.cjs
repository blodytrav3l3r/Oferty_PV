/**
 * Test E2E (regresja): auto-zapis edycji zamowienia studni przy zmianie zakladki.
 *
 * Bug: przejscie miedzy zakladkami z brudna edycja zamowienia failuje
 * (save-unclean), bo flaga dirty nigdy nie gasnie — diff live-vs-SAVED
 * w fields.clientContacts. Router (spa/router.js) pokazuje appConfirm3
 * ("Zapisz i przejdz"), __sokSaveDirty konczy bez wyjatku, ale
 * __sokIsDirty nadal true -> brak nawigacji.
 *
 * Scenariusze (modul STUDNIE, iframe app.html#/studnie, kind order_studnie):
 *   A seed   -> PUT /api/orders-studnie z clientContacts [{name, phone, email}]
 *   B edycja -> enterOrderEditMode (prawdziwa sciezka), asercja edytora
 *               kontaktow, jawna zmiana kontaktu (brudny draft)
 *   C zapis  -> klik zakladki SPA -> appConfirm3 -> "Zapisz i przejdz"
 *               -> PATCH /api/orders-studnie/:id -> sedno:
 *               __sokSaveDirty true, __sokIsDirty false, brak save-unclean
 *               w konsoli, hash docelowy, GET zwraca zgodne clientContacts
 *   D kontrola negatywna -> bez edycji zmiana zakladki bez modala
 *
 * Run:
 *   node tests/playwright/orderTabAutosave.cjs --spawn   # izolowany serwer :3177 (build+seed)
 *   node tests/playwright/orderTabAutosave.cjs           # wymaga backendu na :3000
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden scenariusz nie przeszedl.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

/* ── Playwright resolution (wzorzec draftLoopProof.cjs) ── */
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
const ORDER_ID = 'e2e-tab-autosave-1';
const CONTACT_A = { name: 'Jan Kontaktowy', phone: '600100200', email: 'jan@example.com' };
const CONTACT_B = { name: 'Jan Kontaktowy', phone: '600100201', email: 'jan@example.com' };
const TARGET_HASH = '#/rury';

/* ── Spawn serwera (izolowany, port 3177, e2e.sqlite) ── */
async function startServer() {
    const { rmSync, existsSync, symlinkSync, mkdirSync } = require('fs');
    const { delimiter } = require('path');
    const dbFile = join(ROOT, 'data', 'e2e.sqlite');
    const dbUrl = 'file:' + dbFile.replace(/\\/g, '/');
    mkdirSync(join(ROOT, 'data'), { recursive: true });
    for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
        if (existsSync(f)) rmSync(f);
    }
    const distGen = join(ROOT, 'dist', 'generated');
    if (!existsSync(distGen)) {
        symlinkSync(join(ROOT, 'generated'), distGen, 'junction');
    }
    const withBin = (extra) => ({
        ...process.env,
        PATH: join(ROOT, 'node_modules', '.bin') + delimiter + (process.env.PATH || ''),
        ...extra
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

/* ── Helpery modulowe (wzorzec draftLoopProof.cjs) ── */

/** Wejscie w modul SPA (app.html#/<mod>), zwraca gotowy frame iframe. */
async function enterModule(page, mod) {
    await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return await waitModuleFrame(page, mod);
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
    await fr.waitForFunction(
        () => window.draftStore && window.draftAutosave && document.getElementById('client-name'),
        null,
        { timeout: 20000 }
    );
    return fr;
}

/** Wejscie w edycje zamowienia prawdziwa sciezka + czekanie na orderEditMode. */
async function enterOrder(frame, orderId) {
    await frame.evaluate((id) => window.enterOrderEditMode(id), orderId);
    await frame.waitForFunction(
        (id) =>
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            (orderEditMode.orderId === id ||
                (orderEditMode.order && orderEditMode.order.id === id)) &&
            Array.isArray(window.wells) &&
            window.wells.length > 0,
        orderId,
        { timeout: 25000 }
    );
}

/* ── Main ── */
(async () => {
    let server = null;
    if (SPAWN) {
        console.log('▶ Budowanie + start izolowanego serwera...');
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

    // Kolektory konsoli/pageerror: sedno regresji to brak save-unclean + zero bledow.
    const consoleLines = [];
    const pageErrors = [];
    page.on('console', (msg) => {
        try {
            consoleLines.push(`${msg.type()}: ${msg.text()}`);
        } catch (_) {}
    });
    page.on('pageerror', (err) => {
        pageErrors.push(String((err && err.message) || err));
    });

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
    const hasSaveUnclean = () => consoleLines.some((l) => l.includes('save-unclean'));

    try {
        // Login (cookie httpOnly w jarze kontekstu, dzielone z page.request).
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            headers: { Origin: BASE, Referer: `${BASE}/` },
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        const authToken = /authToken=([^;]+)/.exec(loginSetCookie)?.[1] || null;
        check('LOGIN admin', !!authToken, `status=${loginResp.status()}`);

        let frame = await enterModule(page, 'studnie');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 20000 }
        );
        frame.on('pageerror', (err) => {
            pageErrors.push('frame: ' + String((err && err.message) || err));
        });

        /* ── A: seed zamowienia z clientContacts ── */
        await frame.waitForFunction(
            () => Array.isArray(window.studnieProducts) && window.studnieProducts.length > 0,
            null,
            { timeout: 20000 }
        );
        const orderDoc = {
            id: ORDER_ID,
            clientName: 'E2E-TAB-AUTOSAVE',
            number: 'E2E/TAB-1',
            date: '2026-09-16',
            clientContacts: [CONTACT_A],
            wells: [
                {
                    id: 'w-tab-1',
                    name: 'S-TAB',
                    dn: '1000',
                    rzednaDna: 0,
                    config: [],
                    przejscia: []
                }
            ],
            wellDiscounts: {},
            visiblePrzejsciaTypes: [],
            transportMode: 'full',
            wizard: { globalParams: {}, currentStep: 5 }
        };
        const putResp = await page.request.put(`${BASE}/api/orders-studnie`, {
            headers: { Origin: BASE, Referer: `${BASE}/app.html#/studnie` },
            data: { data: [orderDoc] }
        });
        check('A PUT order (seed API)', putResp.ok(), `status=${putResp.status()}`);
        const getSeed = await page.request.get(`${BASE}/api/orders-studnie/${ORDER_ID}`);
        const seedJson = await getSeed.json().catch(() => ({}));
        const seedContacts = (seedJson && seedJson.data && seedJson.data.clientContacts) || null;
        check(
            'A SAVED clientContacts zgodne z seedem',
            Array.isArray(seedContacts) &&
                seedContacts.length === 1 &&
                seedContacts[0].phone === CONTACT_A.phone,
            `contacts=${JSON.stringify(seedContacts).slice(0, 160)}`
        );

        /* ── B: wejscie prawdziwa sciezka + asercja edytora kontaktow ── */
        await enterOrder(frame, ORDER_ID);
        check('B enterOrderEditMode', true, '');
        const editorState = await frame.evaluate(() => {
            try {
                const list =
                    typeof getClientContactsList === 'function' ? getClientContactsList() : null;
                const fields =
                    typeof getOfferFormFields === 'function' ? getOfferFormFields() : null;
                return {
                    listLen: Array.isArray(list) ? list.length : null,
                    listPhone: list && list[0] ? list[0].phone : null,
                    fieldsLen:
                        fields && Array.isArray(fields.clientContacts)
                            ? fields.clientContacts.length
                            : null,
                    hasRenderer: typeof renderClientContactsList === 'function'
                };
            } catch (e) {
                return { error: String((e && e.message) || e) };
            }
        });
        check(
            'B edytor kontaktow widzi 1 kontakt z seedu',
            editorState.listLen === 1 && editorState.listPhone === CONTACT_A.phone,
            JSON.stringify(editorState).slice(0, 200)
        );

        // Jawna edycja kontaktu (brudny draft): prawdziwy input + input/change,
        // fallback na renderer SSoT gdy brak wiersza w DOM.
        await frame.evaluate((phone) => {
            const inputs = Array.from(
                document.querySelectorAll('input[data-contact-field="phone"], input[name*="phone"]')
            );
            const first = inputs[0];
            if (first) {
                first.focus();
                first.value = phone;
                first.dispatchEvent(new Event('input', { bubbles: true }));
                first.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (typeof renderClientContactsList === 'function') {
                const cur =
                    typeof getClientContactsList === 'function'
                        ? getClientContactsList()
                        : [
                              {
                                  name: 'Jan Kontaktowy',
                                  phone: '600100200',
                                  email: 'jan@example.com'
                              }
                          ];
                const next = cur.map((c, i) => (i === 0 ? { ...c, phone } : c));
                renderClientContactsList(next, {});
                document.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, CONTACT_B.phone);
        await frame.waitForFunction(
            () => {
                try {
                    if (typeof window.__sokIsDirty === 'function')
                        return window.__sokIsDirty() === true;
                    if (
                        window.draftAutosave &&
                        typeof window.draftAutosave.hasUnsavedChanges === 'function'
                    )
                        return window.draftAutosave.hasUnsavedChanges() === true;
                } catch (_) {}
                return false;
            },
            null,
            { timeout: 15000 }
        );
        check('B edycja brudzi draft (__sokIsDirty true)', true, '');

        /* ── C: klik zakladki -> appConfirm3 -> Zapisz i przejdz -> PATCH ── */
        const patchWait = page.waitForResponse(
            (resp) =>
                resp.url().includes(`/api/orders-studnie/${ORDER_ID}`) &&
                resp.request().method() === 'PATCH',
            { timeout: 25000 }
        );
        await page.locator('#spa-app-rury').click();
        await page.waitForSelector('#app-confirm-overlay', { timeout: 10000 });
        const confirmTitle = await page
            .locator('#app-confirm-title')
            .textContent()
            .catch(() => '');
        check(
            'C appConfirm3 widoczny (Niezapisane zmiany)',
            (confirmTitle || '').includes('Niezapisane zmiany'),
            `title=${(confirmTitle || '').slice(0, 80)}`
        );
        const saveBtn = await page.locator('#app-confirm-save').count();
        check('C przycisk Zapisz i przejdz', saveBtn === 1, `count=${saveBtn}`);
        await page.locator('#app-confirm-save').click();
        const patchResp = await patchWait;
        check('C PATCH order po Zapisz i przejdz', patchResp.ok(), `status=${patchResp.status()}`);

        // Sedno regresji: saver raportuje sukces + flaga gasnie + nawigacja.
        const afterSave = await frame.evaluate(() => {
            const out = { saveDirty: null, isDirty: null, detail: null, error: null };
            try {
                out.detail = window.__sokLastDirtyDetail || null;
                if (typeof window.__sokIsDirty === 'function') out.isDirty = window.__sokIsDirty();
                else if (
                    window.draftAutosave &&
                    typeof window.draftAutosave.hasUnsavedChanges === 'function'
                )
                    out.isDirty = window.draftAutosave.hasUnsavedChanges();
            } catch (e) {
                out.error = String((e && e.message) || e);
            }
            return out;
        });
        // __sokSaveDirty wywolane sciezka routera; skoro PATCH przeszedl i modal
        // sie domknal, bezposredni probe savera musi tez zwrocic true (idempotentny).
        const saveProbe = await page.evaluate(() => {
            try {
                const fr = document.getElementById('spa-iframe-studnie');
                const w = (fr && fr.contentWindow) || window;
                if (typeof window.__sokSaveDirty !== 'function') return { skipped: true };
                return window.__sokSaveDirty(w).then(
                    (v) => ({ value: v === true }),
                    (e) => ({ error: String((e && e.message) || e) })
                );
            } catch (e) {
                return { error: String((e && e.message) || e) };
            }
        });
        check(
            'C __sokSaveDirty true',
            saveProbe.value === true,
            JSON.stringify(saveProbe).slice(0, 160)
        );
        check(
            'C __sokIsDirty false po zapisie',
            afterSave.isDirty === false,
            JSON.stringify(afterSave).slice(0, 200)
        );
        check(
            'C brak save-unclean w konsoli',
            !hasSaveUnclean(),
            consoleLines
                .filter((l) => l.includes('sokDirty'))
                .slice(-3)
                .join(' | ')
                .slice(0, 300)
        );
        await page.waitForFunction((h) => window.location.hash === h, TARGET_HASH, {
            timeout: 15000
        });
        check('C hash docelowy #/rury', page.url().includes(TARGET_HASH), page.url().slice(-40));

        const getAfter = await page.request.get(`${BASE}/api/orders-studnie/${ORDER_ID}`);
        const afterJson = await getAfter.json().catch(() => ({}));
        const afterContacts =
            (afterJson && afterJson.data && afterJson.data.clientContacts) || null;
        check(
            'C GET zwraca zgodne clientContacts (telefon po edycji)',
            Array.isArray(afterContacts) &&
                afterContacts.length === 1 &&
                afterContacts[0].phone === CONTACT_B.phone,
            `contacts=${JSON.stringify(afterContacts).slice(0, 160)}`
        );

        /* ── D: kontrola negatywna — bez edycji brak modala ── */
        await page.goto(`${BASE}/app.html#/studnie`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        frame = await waitModuleFrame(page, 'studnie');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 20000 }
        );
        await enterOrder(frame, ORDER_ID);
        const cleanDirty = await frame.evaluate(() => {
            try {
                if (typeof window.__sokIsDirty === 'function') return window.__sokIsDirty();
                if (
                    window.draftAutosave &&
                    typeof window.draftAutosave.hasUnsavedChanges === 'function'
                )
                    return window.draftAutosave.hasUnsavedChanges();
            } catch (_) {}
            return null;
        });
        check(
            'D bez edycji czysto (__sokIsDirty false)',
            cleanDirty === false,
            `dirty=${cleanDirty}`
        );
        await page.locator('#spa-app-kartoteka').click();
        let modalShown = false;
        try {
            await page.waitForSelector('#app-confirm-overlay', { timeout: 3000 });
            modalShown = true;
        } catch (_) {
            modalShown = false;
        }
        check('D bez edycji brak modala', modalShown === false, 'modal wyskoczyl bez zmian');
        check(
            'D pageerror zero',
            pageErrors.length === 0,
            pageErrors.slice(0, 3).join(' | ').slice(0, 300)
        );
    } catch (e) {
        failed = true;
        errors.push('FATAL: ' + (e && e.message ? e.message : String(e)));
    } finally {
        await browser.close();
        if (server) server.kill();
        if (failed) {
            console.error('\n❌ FAILED:');
            errors.forEach((e) => console.error('  ' + e));
            console.error(`  Przeszly: ${passed.join(', ')}`);
            process.exitCode = 1;
        } else {
            console.log(`\n✅ PASS: order tab autosave A/B/C/D (${passed.length} asercji)`);
        }
    }
})();
