/**
 * Test E2E: kafelki cenników + deep-link do panelu wersji (PRECO).
 *
 * Scenariusze:
 *   P1 kafelki admina: 3 linki z deep-linkiem, panel admina widoczny
 *   P2 deep-link PRECO: panel otwiera zakładkę PRECO, preview z deep-linku (?version=)
 *   P3 deep-link compare: ?version=&against= otwiera modal porównania
 *   P4 preview/diff nie mutują danych (tylko GET na /api/pricelist-versions)
 *   P5 brudna oferta: zmiana hash z panelem najpierw pyta o potwierdzenie
 *
 * Run:
 *   node tests/playwright/pricelistPreview.cjs                # backend na :3000
 *   node tests/playwright/pricelistPreview.cjs --spawn        # izolowany serwer :3179
 *
 * Exit code: 0 = OK, 1 = co najmniej jeden test nie przeszedl.
 */

const { execFileSync, spawn } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..', '..');
const SPAWN = process.argv.includes('--spawn');
const SPAWN_VERBOSE = process.env.SPAWN_VERBOSE === '1';
const BASE = process.env.BASE_URL || (SPAWN ? 'http://localhost:3179' : 'http://localhost:3000');
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'E2ePricelist!2026';

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

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function pollHealth(url, tries = 40) {
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
    const { rmSync } = require('fs');
    const dbFile = resolve(ROOT, 'data', 'e2e-pricelist-preview.sqlite');
    for (const suffix of ['', '-wal', '-shm']) {
        try {
            rmSync(dbFile + suffix, { force: true });
        } catch (_) {}
    }
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
    const server = spawn(process.execPath, [resolve(ROOT, 'dist', 'server.js')], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: '3179',
            DATABASE_URL: dbUrl,
            DEFAULT_ADMIN_PASSWORD: ADMIN_PASSWORD,
            NODE_ENV: 'development'
        },
        stdio: 'pipe'
    });
    // Handlery MUSZA byc podpiete zawsze: `stdio: 'pipe'` bez konsumenta
    // zapelnia bufor 64 KB i blokuje serwer (zawieszenie iframe w polowie
    // zadania). Tryb cichy tylko nie przekazuje danych dalej.
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

function precoRows(price) {
    return {
        konfig: [{ id: 'cfg-e2e', key: 'e2e_key', value: '1' }],
        kinety: [{ id: 'kin-e2e', order: 0, dn: 0, wellDn: 1000, height: 500, cena: price }],
        zakresy: [
            {
                id: 'zak-e2e',
                order: 0,
                label: 'E2E',
                min: 0,
                max: 500,
                grupy: '',
                wellDn: 1000
            }
        ]
    };
}

/**
 * Czeka na gotowy iframe modułu. Re-rozwiazuje uchwyt w petli, bo iframe SPA
 * potrafi sie przeladowac tuz po `contentFrame()` i stary uchwyt nigdy nie
 * osiagnie `complete` (flake 1/3 przebiegow z tego samego commita).
 */
async function waitModule(page, mod) {
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
        const el = await page.$(`#spa-iframe-${mod}`);
        const frame =
            (el && (await el.contentFrame())) ||
            page.frames().find((f) => f.url().includes(`${mod}.html`));
        if (frame) {
            const ready = await frame
                .waitForFunction(
                    () =>
                        document.readyState === 'complete' &&
                        !!document.getElementById('client-name'),
                    null,
                    { timeout: 5000 }
                )
                .then(() => true)
                .catch(() => false);
            if (ready) return frame;
        }
        await page.waitForTimeout(500);
    }
    throw new Error(`Iframe ${mod} niezaladowal sie w 40s`);
}

function trackWrites(page) {
    const writes = [];
    page.on('request', (req) => {
        if (!req.url().includes('/api/pricelist-versions')) return;
        if (req.method() !== 'GET') writes.push(`${req.method()} ${req.url()}`);
    });
    return writes;
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

    let failed = false;
    const errors = [];
    const check = (name, ok, detail) => {
        if (ok) {
            console.log(`  ✅ ${name}`);
        } else {
            failed = true;
            errors.push(`${name}: ${detail}`);
            console.log(`  ❌ ${name}: ${detail}`);
        }
    };

    let draftCleanupId = '';

    try {
        const login = await context.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        check('LOGIN admin', login.status() === 200, `status=${login.status()}`);

        // Lifecycle PRECO dopuszcza tylko jeden DRAFT na typ (DRAFT_EXISTS, 409),
        // więc para wersji powstaje jako: szkic bazowy -> publikacja -> szkic zmieniony.
        const baseDraft = await context.request.post(
            `${BASE}/api/pricelist-versions/preco/drafts`,
            {
                headers: { Origin: BASE },
                data: { rows: precoRows(100), note: 'E2E preview base' }
            }
        );
        const baseBody = baseDraft.status() === 201 ? await baseDraft.json() : {};
        const baseVersion = baseBody.version || {};

        const approve = await context.request.post(
            `${BASE}/api/pricelist-versions/${baseVersion.id}/approve`,
            {
                headers: { Origin: BASE },
                data: { effectiveFrom: new Date().toISOString() }
            }
        );
        const approveBody = approve.status() === 200 ? await approve.json() : {};

        const changedDraft = await context.request.post(
            `${BASE}/api/pricelist-versions/preco/drafts`,
            {
                headers: { Origin: BASE },
                data: { rows: precoRows(110), note: 'E2E preview changed' }
            }
        );
        const changedBody = changedDraft.status() === 201 ? await changedDraft.json() : {};
        const changedVersion = changedBody.version || {};
        draftCleanupId = changedVersion.id || '';

        check(
            'FIXTURE wersja bazowa APPROVED + szkic zmieniony',
            Boolean(
                baseVersion.id &&
                changedVersion.id &&
                approveBody.version &&
                approveBody.version.status === 'APPROVED'
            ),
            `draft=${baseDraft.status()} approve=${approve.status()} status=${approveBody.version?.status} draft2=${changedDraft.status()}`
        );

        const tilesPage = await context.newPage();
        await tilesPage.goto(`${BASE}/index.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await tilesPage.locator('#admin-panel:not(.hidden)').waitFor({ timeout: 20000 });
        const tiles = await tilesPage.evaluate(() => {
            const links = Array.from(document.querySelectorAll('#pricelist-tiles a.pv-admin-tile'));
            return links.map((a) => ({ href: a.getAttribute('href'), text: a.textContent }));
        });
        check('P1 3 kafelki cenników', tiles.length === 3, `links=${tiles.length}`);
        check(
            'P1 deep-link PRECO',
            tiles.some((t) => /#\/cennik\?tab=preco/.test(t.href || '')),
            JSON.stringify(tiles.map((t) => t.href))
        );
        await tilesPage.close();

        const previewPage = await context.newPage();
        const writesPreview = trackWrites(previewPage);
        await previewPage.goto(
            `${BASE}/app.html#/studnie?tab=pricelist&panel=versions&pvtype=preco&version=` +
                encodeURIComponent(baseVersion.id),
            { waitUntil: 'domcontentloaded', timeout: 30000 }
        );
        const previewFrame = await waitModule(previewPage, 'studnie');
        // Panel wersji to stały dock (`#pv-dock`), nie dawny modal wersji.
        await previewFrame.locator('#pv-dock').waitFor({ state: 'visible', timeout: 20000 });
        const precoTab = await previewFrame.evaluate(() => {
            const tab = document.querySelector('#pv-dock [data-pv-tab="preco"]');
            return tab ? tab.getAttribute('aria-pressed') : null;
        });
        check('P2 panel otwarty na PRECO', precoTab === 'true', `aria-pressed=${precoTab}`);

        await previewFrame.locator('#pv-preview-modal').waitFor({ timeout: 20000 });
        await previewFrame
            .locator('#pv-preview-body table')
            .waitFor({ timeout: 20000 })
            .catch(() => null);
        const previewText = await previewFrame
            .locator('#pv-preview-body')
            .innerText({ timeout: 20000 });
        check('P2 preview z deep-linku', /\b100\b/.test(previewText), previewText.slice(0, 120));
        await previewFrame.locator('#pv-preview-modal [data-csp="closeModal"]').first().click();
        check('P4 preview bez mutacji', writesPreview.length === 0, writesPreview.join('; '));
        await previewPage.close();

        const comparePage = await context.newPage();
        const writesCompare = trackWrites(comparePage);
        await comparePage.goto(
            `${BASE}/app.html#/studnie?tab=pricelist&panel=versions&pvtype=preco&version=` +
                encodeURIComponent(changedVersion.id) +
                '&against=' +
                encodeURIComponent(baseVersion.id),
            { waitUntil: 'domcontentloaded', timeout: 30000 }
        );
        const compareFrame = await waitModule(comparePage, 'studnie');
        await compareFrame.locator('#pv-diff-modal').waitFor({ timeout: 20000 });
        const diffText = await compareFrame.locator('#pv-diff-body').innerText({ timeout: 20000 });
        check('P3 compare z deep-linku', /110/.test(diffText), diffText.slice(0, 120));
        const selects = await compareFrame.locator('[data-pv-diff-select]').count();
        check('P3 dwa selecty wersji', selects === 2, `selects=${selects}`);
        check('P4 compare bez mutacji', writesCompare.length === 0, writesCompare.join('; '));
        await comparePage.close();

        const guardPage = await context.newPage();
        await guardPage.goto(`${BASE}/app.html#/rury`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        const ruryFrame = await waitModule(guardPage, 'rury');
        await ruryFrame.fill('#client-name', 'E2E-DEEP-LINK');
        await ruryFrame.fill('#offer-validity', 'E2E');
        await guardPage.evaluate(() => {
            window.location.hash = '#/rury?tab=pricelist&panel=versions';
        });
        const confirm = await guardPage
            .locator('#app-confirm-overlay')
            .waitFor({ timeout: 10000 })
            .then(() => true)
            .catch(() => false);
        check('P5 brudna oferta: confirm przed panelem', confirm === true, 'brak overlaya');
        await guardPage.close();
    } catch (err) {
        failed = true;
        errors.push(`EXCEPTION: ${err && err.message ? err.message : String(err)}`);
        console.log(`  ❌ EXCEPTION: ${err && err.stack ? err.stack : String(err)}`);
    } finally {
        // Teardown także po błędzie: szkic blokuje kolejne uruchomienie na tej
        // samej bazie (DRAFT_EXISTS). Wersja APPROVED zostaje — baza i tak jest
        // odtwarzana od zera przy starcie harnessu.
        if (draftCleanupId) {
            await context.request
                .delete(`${BASE}/api/pricelist-versions/${draftCleanupId}`, {
                    headers: { Origin: BASE }
                })
                .catch(() => {});
        }
        await browser.close();
        if (server) server.kill();
    }

    console.log('');
    if (failed) {
        console.log(`FAIL — ${errors.length} problem(ów):`);
        errors.forEach((e) => console.log(`  - ${e}`));
        process.exitCode = 1;
    } else {
        console.log('PASS — wszystkie scenariusze E2E cenników przeszły.');
    }
})();
