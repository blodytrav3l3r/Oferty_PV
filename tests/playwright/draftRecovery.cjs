/**
 * Test E2E: recovery draftu "Znaleziono niezapisany draft" po refreshu strony.
 *
 * Regresja zgloszona przez uzytkownika: Odrzuc + F5 -> popup wracal.
 * Scenariusze w module RURY (kind offer_rury, docId 'new'):
 *   T1 ghost==live -> CISZA (wpis 'E2E', debounce, reload, ponowny wpis, checkRecovery)
 *   T2 genuine     -> MODAL (seed 'INNY', checkRecovery, modal + 3 przyciski)
 *   T3 Odrzuc+F5   -> CISZA (discard, toast, brak klucza, reload, checkRecovery)
 *   T4 Przywroc    -> pole klienta == 'PRZYWROCONY', clearContext, reload, CISZA
 *   T5 order_studnie DTO -> CISZA (draft == live, configStatus nie triggeruje)
 *
 * Run:
 *   node tests/playwright/draftRecovery.cjs                # wymaga backendu na :3000
 *   node tests/playwright/draftRecovery.cjs --spawn        # izolowany serwer :3177
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden test nie przeszedl.
 */

const { execFileSync, spawn } = require('child_process');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = SPAWN ? 'http://localhost:3177' : 'http://localhost:3000';

/* ── Playwright resolution (wzorzec appNameConsistency.cjs) ── */
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
    const ok = await pollHealth(`${BASE}/health`);
    if (!ok) {
        server.kill();
        throw new Error('Serwer testowy nie wystartowal (health check)');
    }
    return server;
}

/* ── Helpery modulowe ── */

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

/** Klucz draftu dla zalogowanego usera (localStorage same-origin, wspoldzielony z iframe). */
async function draftKey(frame, kind, docId) {
    return await frame.evaluate(
        ({ kind, docId }) => {
            try {
                const uid = window.currentUser && window.currentUser.id;
                if (uid === undefined || uid === null || String(uid) === '') return null;
                return window.draftStore.buildDraftKey(uid, kind, docId);
            } catch (_) {
                return null;
            }
        },
        { kind, docId }
    );
}

async function hasDraftKey(frame, key) {
    if (!key) return false;
    return await frame.evaluate((k) => !!localStorage.getItem(k), key);
}

async function modalCount(frame) {
    return await frame.locator('#sok-draft-modal').count();
}

/** Diagnostyka: draft vs live (przy failu widac co sie rozjechalo). */
async function dumpDraftVsLive(frame, kind, docId) {
    try {
        return await frame.evaluate(
            ({ kind, docId }) => {
                const out = {};
                try {
                    const uid = window.currentUser && window.currentUser.id;
                    out.key = window.draftStore.buildDraftKey(uid, kind, docId);
                    const raw = localStorage.getItem(out.key);
                    out.hasKey = !!raw;
                    if (raw) {
                        const d = JSON.parse(raw);
                        out.draftFields = d.payload && d.payload.fields;
                        out.draftItemsLen =
                            d.payload && d.payload.items ? d.payload.items.length : null;
                        out.draftWellsLen =
                            d.payload && d.payload.wells ? d.payload.wells.length : null;
                    }
                    out.liveFields = window.getOfferFormFields ? window.getOfferFormFields() : null;
                    let items = null;
                    try {
                        items =
                            typeof currentOfferItems !== 'undefined'
                                ? currentOfferItems
                                : window.currentOfferItems;
                    } catch (_) {
                        items = window.currentOfferItems;
                    }
                    out.liveItemsLen = Array.isArray(items) ? items.length : null;
                    out.liveTransportMode = window.currentRuryTransportMode;
                    out.modal = !!document.getElementById('sok-draft-modal');
                } catch (e) {
                    out.error = String((e && e.message) || e);
                }
                return JSON.stringify(out).slice(0, 900);
            },
            { kind, docId }
        );
    } catch (e) {
        return 'dump error: ' + String((e && e.message) || e);
    }
}
async function seedOfferRuryDraft(frame, clientName) {
    return await frame.evaluate((name) => {
        try {
            const uid = window.currentUser && window.currentUser.id;
            const live = window.getOfferFormFields ? window.getOfferFormFields() : {};
            let items = [];
            try {
                items =
                    typeof currentOfferItems !== 'undefined' && Array.isArray(currentOfferItems)
                        ? currentOfferItems
                        : window.currentOfferItems || [];
            } catch (_) {
                items = window.currentOfferItems || [];
            }
            const payload = {
                fields: Object.assign({}, live, { clientName: name }),
                items: JSON.parse(JSON.stringify(items))
            };
            if (window.currentRuryTransportMode !== undefined)
                payload.transportMode = window.currentRuryTransportMode;
            const draft = window.draftStore.buildDraft({
                userId: uid,
                kind: 'offer_rury',
                docId: 'new',
                payload
            });
            if (!draft) return { ok: false, reason: 'buildDraft null' };
            const res = window.draftStore.saveDraft(window.localStorage, draft);
            return {
                ok: !!res.ok,
                reason: res.reason || null,
                key: window.draftStore.buildDraftKey(uid, 'offer_rury', 'new')
            };
        } catch (e) {
            return { ok: false, reason: String((e && e.message) || e) };
        }
    }, clientName);
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
        // Login (cookie httpOnly w jarze kontekstu, dzielone z page).
        const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        const loginSetCookie = loginResp.headers()['set-cookie'] || '';
        const loginCookieMatch = /authToken=([^;]+)/.exec(loginSetCookie);
        const authToken = loginCookieMatch ? loginCookieMatch[1] : null;
        check('LOGIN admin', !!authToken, `status=${loginResp.status()}`);

        let frame = await enterModule(page, 'rury');
        await frame.waitForFunction(
            () => window.currentUser && window.currentUser.id !== undefined,
            null,
            { timeout: 20000 }
        );
        const uid = await frame.evaluate(() => {
            try {
                const u = window.currentUser;
                return u ? String(u.id) : null;
            } catch (_) {
                return null;
            }
        });
        check('RURY currentUser', !!uid, `userId=${uid}`);

        /* ── T1: ghost==live -> CISZA po refreshu ── */
        const key1 = await draftKey(frame, 'offer_rury', 'new');
        check('T1 klucz draftu', !!key1, `key=${key1}`);
        await frame.locator('#client-name').fill('E2E');
        await frame.waitForFunction((k) => !!localStorage.getItem(k), key1, { timeout: 10000 });
        check(
            'T1 autosave zapisal draft',
            await hasDraftKey(frame, key1),
            'brak klucza po debounce'
        );

        frame = await reloadAndEnter(page, 'rury');
        check('T1 reload: draft przetrwal', await hasDraftKey(frame, key1), 'klucz zniknal po F5');
        // Live == draft: ponowny wpis tej samej wartosci (ghost-branch w checkRecovery).
        await frame.locator('#client-name').fill('E2E');
        await frame.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        check('T1 ghost==live -> brak modala', (await modalCount(frame)) === 0, 'modal widoczny');
        // Sprzatanie: live do fresh + kasacja klucza (pagehide-flush nie moze wskrzesic ducha).
        await frame.locator('#client-name').fill('');
        await frame.evaluate(() => window.draftAutosave.clearContext('offer_rury', 'new'));
        check('T1 cleanup: klucz usuniety', !(await hasDraftKey(frame, key1)), 'klucz zostal');

        /* ── T2: genuine draft -> MODAL ── */
        const seed2 = await seedOfferRuryDraft(frame, 'INNY');
        check('T2 seed draft INNY', !!seed2.ok, `reason=${seed2.reason}`);
        await frame.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        await frame.waitForSelector('#sok-draft-modal', { state: 'attached', timeout: 5000 });
        const t2title = await frame.locator('#sok-draft-modal').textContent();
        check(
            'T2 modal widoczny',
            (t2title || '').includes('Znaleziono niezapisany draft'),
            `title=${(t2title || '').slice(0, 80)}`
        );
        for (const act of ['restore', 'download', 'discard']) {
            const c = await frame.locator(`#sok-draft-modal [data-draft-act="${act}"]`).count();
            check(`T2 przycisk ${act}`, c === 1, `count=${c}`);
        }

        /* ── T3: Odrzuc + F5 -> CISZA (skarga uzytkownika) ── */
        await frame.locator('#sok-draft-modal [data-draft-act="discard"]').click();
        await frame.waitForFunction(() => document.body.innerText.includes('odrzucony'), null, {
            timeout: 5000
        });
        check('T3 toast odrzucony', true, '');
        check(
            'T3 klucz usuniety po discard',
            !(await hasDraftKey(frame, seed2.key)),
            'klucz zostal'
        );
        frame = await reloadAndEnter(page, 'rury');
        await frame.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        check('T3 po F5 brak modala', (await modalCount(frame)) === 0, 'modal wrocil po F5');
        // Flush przy pagehide moze zapisac ghosta == live (nieszkodliwy, brak modala).
        // Regresja to STARY draft ('INNY') wskrzeszony po discard — tego nie moze byc.
        const t3ghost = await frame.evaluate(() => {
            try {
                const uid = window.currentUser && window.currentUser.id;
                const key = window.draftStore.buildDraftKey(uid, 'offer_rury', 'new');
                const raw = localStorage.getItem(key);
                if (!raw) return { has: false };
                const d = JSON.parse(raw);
                const live = window.getOfferFormFields ? window.getOfferFormFields() : {};
                return {
                    has: true,
                    draftClient: d.payload && d.payload.fields && d.payload.fields.clientName,
                    liveClient: live.clientName
                };
            } catch (e) {
                return { has: true, error: String((e && e.message) || e) };
            }
        });
        check(
            'T3 brak starych danych (ghost==live albo brak klucza)',
            !t3ghost.has || t3ghost.draftClient === t3ghost.liveClient,
            JSON.stringify(t3ghost).slice(0, 200)
        );

        /* ── T4: Przywroc -> pole klienta + CISZA po zapisie ── */
        // Snapshot calego live PRZED seedem (restore ma efekty uboczne na formularz —
        // renderOfferItems/transport; odtworzenie snapshotu gwarantuje live == fresh).
        const snap4 = await frame.evaluate(() => {
            const live = window.getOfferFormFields ? window.getOfferFormFields() : {};
            let items = [];
            try {
                items =
                    typeof currentOfferItems !== 'undefined' && Array.isArray(currentOfferItems)
                        ? currentOfferItems
                        : window.currentOfferItems || [];
            } catch (_) {
                items = window.currentOfferItems || [];
            }
            return {
                fields: live,
                items: JSON.parse(JSON.stringify(items)),
                tm: window.currentRuryTransportMode
            };
        });
        const seed4 = await seedOfferRuryDraft(frame, 'PRZYWROCONY');
        check('T4 seed draft PRZYWROCONY', !!seed4.ok, `reason=${seed4.reason}`);
        await frame.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        await frame.waitForSelector('#sok-draft-modal', { state: 'attached', timeout: 5000 });
        await frame.locator('#sok-draft-modal [data-draft-act="restore"]').click();
        const restoredVal = await frame.locator('#client-name').inputValue();
        check('T4 restore wypelnil klienta', restoredVal === 'PRZYWROCONY', `val="${restoredVal}"`);
        // Symulacja zapisu: live do snapshotu (bezposrednie .value, zero eventow),
        // kasacja kontekstu, reload. Flush przy pagehide pisze wtedy ghost == fresh.
        await frame.evaluate((snap) => {
            const set = (id, v) => {
                const el = document.getElementById(id);
                if (el && v !== undefined) el.value = v;
            };
            const f = snap.fields || {};
            set('offer-number', f.number);
            set('offer-date', f.date);
            set('client-name', f.clientName);
            set('client-number', f.clientNumber);
            set('client-nip', f.clientNip);
            set('client-address', f.clientAddress);
            set('client-contact', f.clientContact);
            set('invest-name', f.investName);
            set('invest-address', f.investAddress);
            set('invest-contractor', f.investContractor);
            set('offer-notes', f.notes);
            set('offer-tab-notes', f.notes);
            set('offer-payment-terms', f.paymentTerms);
            set('offer-tab-payment-terms', f.paymentTerms);
            set('offer-validity', f.validity);
            set('offer-tab-validity', f.validity);
            set('transport-km', f.transportKm);
            set('transport-rate', f.transportRate);
            try {
                currentOfferItems = JSON.parse(JSON.stringify(snap.items || []));
            } catch (_) {}
            try {
                window.currentOfferItems = JSON.parse(JSON.stringify(snap.items || []));
            } catch (_) {}
            if (snap.tm !== undefined) {
                try {
                    currentRuryTransportMode = snap.tm;
                } catch (_) {}
                window.currentRuryTransportMode = snap.tm;
            }
        }, snap4);
        await frame.evaluate(() => window.draftAutosave.clearContext('offer_rury', 'new'));
        frame = await reloadAndEnter(page, 'rury');
        await frame.evaluate(() => window.draftAutosave.checkRecovery('offer_rury'));
        check(
            'T4 po zapisie brak modala',
            (await modalCount(frame)) === 0,
            await dumpDraftVsLive(frame, 'offer_rury', 'new')
        );

        /* ── T5: order_studnie DTO -> CISZA (draft == live) ── */
        let sframe = null;
        try {
            sframe = await enterModule(page, 'studnie');
        } catch (e) {
            sframe = null;
            console.log(`  ⏭ SKIP T5: brak modulu studni (${e.message})`);
        }
        if (sframe) {
            const ready = await sframe.evaluate(
                () => !!(window.draftStore && window.draftAutosave)
            );
            if (!ready) {
                console.log('  ⏭ SKIP T5: brak draftAutosave w studniach');
            } else {
                const t5 = await sframe.evaluate(() => {
                    try {
                        const DTO = {
                            id: 'w1',
                            name: 'S1',
                            dn: '1000',
                            config: [{ productId: 'p', quantity: 2 }],
                            przejscia: []
                        };
                        const order = {
                            id: 'o1',
                            version: 1,
                            clientName: 'K',
                            wells: JSON.parse(JSON.stringify([DTO])),
                            wellDiscounts: {},
                            visiblePrzejsciaTypes: [],
                            transportMode: 'full',
                            wizard: { globalParams: {}, currentStep: 5 }
                        };
                        const liveWells = JSON.parse(JSON.stringify([DTO]));
                        liveWells[0].configStatus = 'OK';
                        liveWells[0].configErrors = [];
                        try {
                            orderEditMode = { orderId: 'o1', order };
                        } catch (_) {}
                        window.orderEditMode = { orderId: 'o1', order };
                        try {
                            ordersStudnie = [order];
                        } catch (_) {}
                        window.ordersStudnie = [order];
                        try {
                            wells = liveWells;
                        } catch (_) {}
                        window.wells = liveWells;
                        try {
                            wellDiscounts = {};
                        } catch (_) {}
                        window.wellDiscounts = {};
                        // Seed = live (mirror _draftCollectLive 1:1): draft rowny formularzowi.
                        // Klucze opcjonalne bierzemy z live (nie z palca) — inaczej
                        // VPT/transport/wizard rozjezdzaja sie z live i modal JEST.
                        const fields = window.getOfferFormFields
                            ? window.getOfferFormFields()
                            : { clientName: 'K' };
                        let liveVpt;
                        try {
                            liveVpt =
                                typeof visiblePrzejsciaTypes !== 'undefined' &&
                                visiblePrzejsciaTypes
                                    ? Array.from(visiblePrzejsciaTypes)
                                    : window.visiblePrzejsciaTypes instanceof Set
                                      ? Array.from(window.visiblePrzejsciaTypes)
                                      : [];
                        } catch (_) {
                            liveVpt = [];
                        }
                        let liveWd = {};
                        try {
                            liveWd =
                                typeof wellDiscounts !== 'undefined' && wellDiscounts
                                    ? wellDiscounts
                                    : window.wellDiscounts || {};
                        } catch (_) {
                            liveWd = window.wellDiscounts || {};
                        }
                        let liveTm;
                        try {
                            liveTm =
                                typeof currentTransportMode !== 'undefined'
                                    ? currentTransportMode
                                    : window.currentTransportMode;
                        } catch (_) {
                            liveTm = window.currentTransportMode;
                        }
                        const payload = {
                            fields,
                            wells: JSON.parse(JSON.stringify(liveWells)),
                            wellDiscounts: JSON.parse(JSON.stringify(liveWd)),
                            visiblePrzejsciaTypes: liveVpt.slice()
                        };
                        if (liveTm !== undefined) payload.transportMode = liveTm;
                        try {
                            if (typeof getWizardGlobalParams === 'function')
                                payload.wizardGlobalParams = getWizardGlobalParams();
                        } catch (_) {}
                        try {
                            if (typeof currentWizardStep !== 'undefined')
                                payload.wizardStep = currentWizardStep;
                        } catch (_) {}
                        const uid2 = window.currentUser && window.currentUser.id;
                        const draft = window.draftStore.buildDraft({
                            userId: uid2,
                            kind: 'order_studnie',
                            docId: 'o1',
                            payload
                        });
                        if (!draft) return { ok: false, reason: 'buildDraft null' };
                        const res = window.draftStore.saveDraft(window.localStorage, draft);
                        if (!res.ok) return { ok: false, reason: res.reason };
                        window.draftAutosave.checkRecovery('order_studnie');
                        const modalHere = !!document.getElementById('sok-draft-modal');
                        const key = window.draftStore.buildDraftKey(uid2, 'order_studnie', 'o1');
                        return {
                            ok: true,
                            modalHere,
                            keyKept: !!localStorage.getItem(key),
                            dbg: JSON.stringify({ liveVpt, liveTm }).slice(0, 200)
                        };
                    } catch (e) {
                        return { ok: false, reason: String((e && e.message) || e) };
                    }
                });
                check('T5 seed order_studnie', !!t5.ok, `reason=${t5.reason}`);
                if (t5.ok) {
                    check(
                        'T5 draft==live -> brak modala',
                        t5.modalHere === false,
                        `modal widoczny dbg=${t5.dbg}`
                    );
                    check('T5 klucz istnieje (nie-wakuum)', t5.keyKept === true, 'brak klucza');
                }
            }
        }
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
            console.log(`\n✅ PASS: draft recovery T1–T5 (${passed.length} asercji)`);
        }
    }
})();
