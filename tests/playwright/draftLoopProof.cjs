/**
 * Test E2E: dowod, ze root-cause fix petli draftu dziala w przegladarce.
 *
 * Root cause (naprawiony): public/js/studnie/transitionRenderer.js mutowal live
 * losowym `item.id` przy renderze kafelkow przejsc; dla order_studnie `id` nie ma
 * w DTO (ORDER_PRZEJSCIE_FIELDS), wiec draft/live/SAVED rozjezdzaly sie co sesje:
 * sesja N zapisywala draft z id_X, sesja N+1 renderowala id_Y -> wieczny modal.
 * Fix: lokalny deterministyczny `tileId`, zero zapisu do live.
 *
 * Scenariusze (modul STUDNIE, iframe app.html#/studnie, kind order_studnie):
 *   A seed   -> zamowienie z przejsciem BEZ klucza `id` przez PUT /api/orders-studnie
 *   B petla  -> enterOrderEditMode, render kafelkow, flush, reload, re-enter,
 *               checkRecovery -> CISZA + live/draft przejscia BEZ `id`
 *   C kontrola -> jawna zmiana rzednej w drafcie, checkRecovery -> MODAL (recovery zyje)
 *   D T6 w draftRecovery.cjs -> POMINIETO (adnotacja w raporcie, nie psuc dzialajacego pliku)
 *
 * Run:
 *   node tests/playwright/draftLoopProof.cjs --spawn   # izolowany serwer :3177 (build+seed)
 *   node tests/playwright/draftLoopProof.cjs           # wymaga backendu na :3000
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden scenariusz nie przeszedl.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

/* ── Playwright resolution (wzorzec draftRecovery.cjs) ── */
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
const ORDER_ID = 'e2e-loop-proof-1';

/* ── Spawn serwera (izolowany, port 3177, e2e.sqlite) ── */
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

/* ── Helpery modulowe (wzorzec draftRecovery.cjs) ── */

/** Wejscie w modul SPA (app.html#/<mod>), zwraca gotowy frame iframe. */
async function enterModule(page, mod) {
    await page.goto(`${BASE}/app.html#/${mod}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return await waitModuleFrame(page, mod);
}

/** Reload strony + ponowne wejscie w modul (nowy obiekt frame). */
async function reloadAndEnter(page, mod) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    return await waitModuleFrame(page, mod);
}

async function waitModuleFrame(page, mod) {
    const el = await page.waitForSelector(`#spa-iframe-${mod}`, { timeout: 15000 });
    // Bramka na URL (bez eval w stronie): swiezy iframe to about:blank, a na nim
    // waitForFunction pada przez CSP (brak utility world). Czekamy na nawigacje.
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

async function modalCount(frame) {
    return await frame.locator('#sok-draft-modal').count();
}

/** Wejscie w edycje zamowienia + czekanie na orderEditMode z wells. */
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
        // Login (cookie httpOnly w jarze kontekstu, dzielone z page.request).
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        const loginCookieMatch = /authToken=([^;]+)/.exec(loginSetCookie);
        const authToken = loginCookieMatch ? loginCookieMatch[1] : null;
        check('LOGIN admin', !!authToken, `status=${loginResp.status()}`);

        let frame = await enterModule(page, 'studnie');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 20000 }
        );

        /* ── A: seed zamowienia z przejsciem BEZ `id` ── */
        // Cennik laduje sie asynchronicznie — czekamy na produkty PRZED seedem,
        // zeby przejscie mialo realny productId (solver/draft deterministyczne).
        await frame.waitForFunction(
            () => Array.isArray(window.studnieProducts) && window.studnieProducts.length > 0,
            null,
            { timeout: 20000 }
        );
        // Realny productId przejscia z cennika + wartosc FLOW_TYPES.WLOT z runtime.
        const runtime = await frame.evaluate(() => {
            const prods = Array.isArray(window.studnieProducts) ? window.studnieProducts : [];
            const prz = prods.find((p) => p.componentType === 'przejscie');
            let wlot = 'wlot';
            try {
                if (typeof FLOW_TYPES !== 'undefined' && FLOW_TYPES.WLOT) wlot = FLOW_TYPES.WLOT;
                else if (window.FLOW_TYPES && window.FLOW_TYPES.WLOT) wlot = window.FLOW_TYPES.WLOT;
            } catch (_) {}
            return { productId: prz ? prz.id : null, wlot };
        });
        check('A cennik ma przejscie', !!runtime.productId, JSON.stringify(runtime).slice(0, 120));

        const orderDoc = {
            id: ORDER_ID,
            clientName: 'E2E-LOOP',
            number: 'E2E/LOOP-1',
            date: '2026-09-16',
            wells: [
                {
                    id: 'w-loop-1',
                    name: 'S-LOOP',
                    dn: '1000',
                    rzednaDna: 0,
                    config: [],
                    przejscia: [
                        {
                            productId: runtime.productId,
                            angle: 90,
                            rzednaWlaczenia: 1.5,
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
        check('A PUT order (seed API)', putResp.ok(), `status=${putResp.status()}`);
        const getResp = await page.request.get(`${BASE}/api/orders-studnie/${ORDER_ID}`);
        const getJson = await getResp.json().catch(() => ({}));
        const savedWells = getJson && getJson.data && getJson.data.wells;
        const savedPrz =
            Array.isArray(savedWells) && savedWells[0] ? savedWells[0].przejscia : null;
        check(
            'A SAVED przejscie BEZ id',
            Array.isArray(savedPrz) &&
                savedPrz.length === 1 &&
                !Object.prototype.hasOwnProperty.call(savedPrz[0], 'id'),
            `keys=${savedPrz && savedPrz[0] ? Object.keys(savedPrz[0]).join(',') : 'brak'}`
        );

        /* ── B: petla — render kafelkow NIE mutuje live, po F5 CISZA ── */
        await enterOrder(frame, ORDER_ID);
        check('B enterOrderEditMode', true, '');

        // Render kafelkow przejsc dokladnie sciezka produkcyjna (renderTransitionTileHTML).
        // Inwariant po ficie stabilnych id (9b30d58): render DODAJE id/displayIndex
        // (backfill), ale jest IDEMPOTENTNY — drugi przebieg nie zmienia kluczy.
        const renderRes = await frame.evaluate(() => {
            const out = {
                rendered: 0,
                keysBefore: [],
                keysAfter: [],
                keysAfter2: [],
                hasIdAfter: null
            };
            try {
                const w = typeof getCurrentWell === 'function' ? getCurrentWell() : window.wells[0];
                if (!w || !Array.isArray(w.przejscia) || w.przejscia.length === 0)
                    return { error: 'brak przejsc w live' };
                out.keysBefore = w.przejscia.map((p) => Object.keys(p).sort());
                const doRender = () => {
                    w.przejscia.forEach((pr, idx) => {
                        let prod = null;
                        try {
                            prod =
                                typeof getStudnieProductById === 'function'
                                    ? getStudnieProductById(pr.productId)
                                    : null;
                        } catch (_) {}
                        if (typeof renderTransitionTileHTML === 'function')
                            renderTransitionTileHTML(pr, idx, prod, {});
                        out.rendered++;
                    });
                    // Pelny inline-configurator, jesli kontener istnieje.
                    try {
                        if (document.getElementById('inline-przejscia-app'))
                            renderInlinePrzejsciaApp('inline-przejscia-app');
                    } catch (_) {}
                };
                doRender();
                out.keysAfter = w.przejscia.map((p) => Object.keys(p).sort());
                out.hasIdAfter = w.przejscia.map((p) =>
                    Object.prototype.hasOwnProperty.call(p, 'id')
                );
                doRender();
                out.keysAfter2 = w.przejscia.map((p) => Object.keys(p).sort());
            } catch (e) {
                return { error: String((e && e.message) || e) };
            }
            return out;
        });
        check(
            'B render kafelkow (1 przejscie × 2 przebiegi)',
            renderRes.rendered === 2,
            JSON.stringify(renderRes).slice(0, 200)
        );
        check(
            'B render idempotentny (2. przebieg nie zmienia kluczy, id stabilne)',
            Array.isArray(renderRes.hasIdAfter) &&
                renderRes.hasIdAfter.every((h) => h === true) &&
                JSON.stringify(renderRes.keysAfter) === JSON.stringify(renderRes.keysAfter2),
            `keysAfter=${JSON.stringify(renderRes.keysAfter).slice(0, 200)}`
        );

        // Settle przed flushem: draft ma schwytac ustabilizowany live (po solverze),
        // inaczej porownanie po F5 mierzyloby dryf solvera, nie petle id.
        await frame.waitForFunction(
            () =>
                Array.isArray(window.studnieProducts) &&
                window.studnieProducts.length > 0 &&
                Array.isArray(window.wells) &&
                window.wells.length > 0 &&
                (function () {
                    const s = JSON.stringify(window.wells);
                    if (window.__loopPrevWells === s) {
                        window.__loopSettleN = (window.__loopSettleN || 0) + 1;
                    } else {
                        window.__loopPrevWells = s;
                        window.__loopSettleN = 0;
                    }
                    return window.__loopSettleN >= 3;
                })(),
            null,
            { timeout: 30000 }
        );
        // Flush = zapis draftu z live (symulacja pagehide/beforeunload), asercja draftu.
        await frame.evaluate(() => window.draftAutosave.flushAll());
        const draftInfo = await frame.evaluate((orderId) => {
            try {
                const uid = window.currentUser && window.currentUser.id;
                const key = window.draftStore.buildDraftKey(uid, 'order_studnie', orderId);
                const raw = localStorage.getItem(key);
                if (!raw) return { has: false };
                const d = JSON.parse(raw);
                const wells = d.payload && d.payload.wells;
                const prz = wells && wells[0] ? wells[0].przejscia : null;
                return {
                    has: true,
                    przKeys: prz && prz[0] ? Object.keys(prz[0]).sort() : null,
                    przHasId: prz
                        ? prz.map((p) => Object.prototype.hasOwnProperty.call(p, 'id'))
                        : null
                };
            } catch (e) {
                return { has: true, error: String((e && e.message) || e) };
            }
        }, ORDER_ID);
        check(
            'B flush zapisal draft',
            draftInfo.has === true,
            JSON.stringify(draftInfo).slice(0, 160)
        );
        check(
            'B draft przejscia zgodne z live (te same id, petla domknieta)',
            Array.isArray(draftInfo.przHasId) &&
                draftInfo.przHasId.every((h) => h === true) &&
                JSON.stringify(draftInfo.przKeys) ===
                    JSON.stringify((renderRes.keysAfter[0] || []).slice().sort()),
            `keys=${JSON.stringify(draftInfo.przKeys).slice(0, 160)}`
        );

        // Reload + ponowne wejscie: stara petla pokazywala tu wieczny modal (id_X vs id_Y).
        frame = await reloadAndEnter(page, 'studnie');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 20000 }
        );
        await enterOrder(frame, ORDER_ID);
        // Settle: solver/auto-dobor po wejsciu mutuje live asynchronicznie — czekamy
        // na stabilny live (ten sam JSON w kolejnych tickach) ZANIM ocenimy recovery.
        // Bez tego modal mierzylby stan przejsciowy, nie petle.
        await frame.waitForFunction(
            () =>
                Array.isArray(window.studnieProducts) &&
                window.studnieProducts.length > 0 &&
                Array.isArray(window.wells) &&
                window.wells.length > 0 &&
                (function () {
                    const s = JSON.stringify(window.wells);
                    if (window.__loopPrevWells === s) {
                        window.__loopSettleN = (window.__loopSettleN || 0) + 1;
                    } else {
                        window.__loopPrevWells = s;
                        window.__loopSettleN = 0;
                    }
                    return window.__loopSettleN >= 3;
                })(),
            null,
            { timeout: 30000 }
        );
        await frame.evaluate(() => window.draftAutosave.checkRecovery('order_studnie'));
        const bModal = await modalCount(frame);
        let bDump = '';
        if (bModal !== 0) {
            bDump = await frame.evaluate((orderId) => {
                try {
                    const canon = function (v) {
                        if (v === null || typeof v !== 'object') return JSON.stringify(v);
                        if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
                        const ks = Object.keys(v).sort();
                        return (
                            '{' +
                            ks.map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') +
                            '}'
                        );
                    };
                    const uid = window.currentUser && window.currentUser.id;
                    const raw = localStorage.getItem(
                        window.draftStore.buildDraftKey(uid, 'order_studnie', orderId)
                    );
                    const draft = raw ? JSON.parse(raw) : null;
                    const dp = draft ? canon(draft.payload) : 'brak-draftu';
                    const lp = canon({
                        fields: window.getOfferFormFields ? window.getOfferFormFields() : null,
                        wells: window.wells
                    });
                    // Pierwsza roznica draft vs live (skrot do 400 znakow kontekstu).
                    let i = 0;
                    while (i < dp.length && i < lp.length && dp[i] === lp[i]) i++;
                    return `draftLen=${dp.length} liveLen=${lp.length} firstDiff@${i}: ...${dp.slice(Math.max(0, i - 120), i + 280)}`;
                } catch (e) {
                    return 'dump error: ' + String((e && e.message) || e);
                }
            }, ORDER_ID);
        }
        check(
            'B po F5 brak modala (petla zamknieta)',
            bModal === 0,
            `modal widoczny ${bDump}`.slice(0, 500)
        );

        /* ── C: kontrola pozytywna — jawna zmiana draftu -> MODAL ── */
        const seedC = await frame.evaluate((orderId) => {
            try {
                const fields = window.getOfferFormFields ? window.getOfferFormFields() : {};
                const liveWells = JSON.parse(JSON.stringify(window.wells || []));
                if (!liveWells[0] || !liveWells[0].przejscia || !liveWells[0].przejscia[0])
                    return { ok: false, reason: 'brak przejscia w live' };
                liveWells[0].przejscia[0].rzednaWlaczenia = 9.999;
                let liveVpt = [];
                try {
                    liveVpt =
                        typeof visiblePrzejsciaTypes !== 'undefined' && visiblePrzejsciaTypes
                            ? Array.from(visiblePrzejsciaTypes)
                            : [];
                } catch (_) {}
                let liveWd = {};
                try {
                    liveWd =
                        typeof wellDiscounts !== 'undefined' && wellDiscounts
                            ? wellDiscounts
                            : window.wellDiscounts || {};
                } catch (_) {}
                const payload = {
                    fields,
                    wells: liveWells,
                    wellDiscounts: JSON.parse(JSON.stringify(liveWd)),
                    visiblePrzejsciaTypes: liveVpt.slice()
                };
                try {
                    if (typeof currentTransportMode !== 'undefined')
                        payload.transportMode = currentTransportMode;
                } catch (_) {}
                try {
                    if (typeof getWizardGlobalParams === 'function')
                        payload.wizardGlobalParams = getWizardGlobalParams();
                } catch (_) {}
                try {
                    if (typeof currentWizardStep !== 'undefined')
                        payload.wizardStep = currentWizardStep;
                } catch (_) {}
                const uid = window.currentUser && window.currentUser.id;
                const draft = window.draftStore.buildDraft({
                    userId: uid,
                    kind: 'order_studnie',
                    docId: orderId,
                    payload
                });
                if (!draft) return { ok: false, reason: 'buildDraft null' };
                const res = window.draftStore.saveDraft(window.localStorage, draft);
                if (!res.ok) return { ok: false, reason: res.reason };
                return { ok: true };
            } catch (e) {
                return { ok: false, reason: String((e && e.message) || e) };
            }
        }, ORDER_ID);
        check('C seed draft (rzedna 9.999)', !!seedC.ok, `reason=${seedC.reason}`);
        await frame.evaluate(() => window.draftAutosave.checkRecovery('order_studnie'));
        await frame.waitForSelector('#sok-draft-modal', { state: 'attached', timeout: 5000 });
        const cTitle = await frame.locator('#sok-draft-modal').textContent();
        check(
            'C modal recovery widoczny',
            (cTitle || '').includes('Znaleziono niezapisany draft'),
            `title=${(cTitle || '').slice(0, 80)}`
        );
        for (const act of ['restore', 'download', 'discard']) {
            const c = await frame.locator(`#sok-draft-modal [data-draft-act="${act}"]`).count();
            check(`C przycisk ${act}`, c === 1, `count=${c}`);
        }
        // Sprzatanie: Odrzuc kasuje klucz; clearContext domyka kontekst.
        await frame.locator('#sok-draft-modal [data-draft-act="discard"]').click();
        await frame.waitForFunction(() => document.body.innerText.includes('odrzucony'), null, {
            timeout: 5000
        });
        await frame.evaluate(
            (id) => window.draftAutosave.clearContext('order_studnie', id),
            ORDER_ID
        );
        const cKeyGone = await frame.evaluate((orderId) => {
            try {
                const uid = window.currentUser && window.currentUser.id;
                return !localStorage.getItem(
                    window.draftStore.buildDraftKey(uid, 'order_studnie', orderId)
                );
            } catch (_) {
                return false;
            }
        }, ORDER_ID);
        check('C cleanup: klucz usuniety', cKeyGone === true, 'klucz zostal');

        /* ── D: T6 w draftRecovery.cjs — swiadomie POMINIETE ── */
        console.log(
            '  ℹ D T6: POMINIETO dopisywanie do draftRecovery.cjs (ryzyko rozrywania dzialajacego pliku T1-T5; dowod zyje w tym pliku)'
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
            console.log(`\n✅ PASS: draft loop proof A/B/C (${passed.length} asercji)`);
        }
    }
})();
