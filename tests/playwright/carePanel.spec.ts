// @ts-nocheck
/**
 * carePanel.spec.ts — E2E opieki nad ofertami (poziom HTTP + 1 test DOM).
 *
 * Wzorzec logowania/seed ze smokeOfferFlow.spec.ts:
 *   login przez page.request/request (cookie httpOnly w jarze kontekstu),
 *   seed TYLKO przez publiczne API na izolowanej DB :3199 (test-playwright.sqlite),
 *   zero prod DB, zero migracji z testu (webServer w playwright.config.ts).
 *
 * UWAGA: LOGIN_LIMITER (10/min na IP|login) — spec robi ~7 loginow admin/run.
 * Uruchamiaj pojedynczo (jak CI smoke), bez --repeat-each i bez rownoleglych
 * workerow na tym pliku; parallel repeats dostana 429 (limit, nie flake aplikacji).
 *
 * Scenariusze:
 *   (a) panel laduje liczniki (summary) + kolejke (queue) + centrum (notifications)
 *   (b) snooze +3d zmienia stan i licznik (hidePaused wycina oferte)
 *   (c) done + reopen (terminal -> wznowienie)
 *   (d) rola user: 403 na scope=all / cudzy repId / snooze cudzej oferty
 *   (e) DOM: loading indicator znika po renderze panelu
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';
const USER_CREDS = { username: 'e2e-care-user', password: 'E2eCareTest123!' };
const CLIENT_TAG = `E2E-CARE-${Date.now()}`;
// P0.1 CSRF: mutacje (POST) wymagaja Origin zgodnego z Host (403 bez niego).
const ORIGIN = { Origin: BASE };

let offerKind = 'rury';
let offerId = '';

test.describe.serial('e2e: panel opieki', () => {
    test.beforeAll(async ({ request }) => {
        // 1. Admin login (kontrakt: cookie httpOnly, jak w smoke-specu).
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login failed').toBe(200);

        // 2. Seed konta user (przez API, 409 = juz istnieje -> idz dalej).
        const reg = await request.post(`${BASE}/api/auth/register`, {
            headers: ORIGIN,
            data: { username: USER_CREDS.username, password: USER_CREDS.password, role: 'user' }
        });
        expect([200, 409], 'Register user nieoczekiwany status').toContain(reg.status());

        // 3. Seed oferty (rury, fallback studnie) z unikalnym clientName.
        let created = null;
        const rury = await request.post(`${BASE}/api/offers-rury`, {
            headers: ORIGIN,
            data: { data: [{ clientName: CLIENT_TAG, items: [] }] }
        });
        if (rury.ok()) {
            const body = await rury.json();
            created = (body.results || body.data || [])[0];
        } else {
            offerKind = 'studnie';
            const stud = await request.post(`${BASE}/api/offers-studnie`, {
                headers: ORIGIN,
                data: { data: [{ clientName: CLIENT_TAG, wells: [] }] }
            });
            expect(stud.status(), 'Seed oferty failed (rury i studnie)').toBe(200);
            const body = await stud.json();
            created = (body.results || body.data || [])[0];
        }
        offerId = created?.id || created?.offerId || '';
        expect(offerId, 'Seed oferty nie zwrocil id').not.toBe('');
    });

    test.beforeEach(async ({ request }) => {
        // Fixture request z beforeAll to osobna instancja (jak w smoke-specu)
        // — login powtorzony w kontekscie kazdego testu.
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login (beforeEach) failed').toBe(200);
    });

    test('(a) panel laduje liczniki + kolejke + centrum', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/care/panel?scope=mine`);
        expect(resp.status(), 'GET /api/care/panel failed').toBe(200);
        const body = await resp.json();
        expect(body.ok).toBe(true);
        // Liczniki
        expect(typeof body.summary?.totalCount, 'brak summary.totalCount').toBe('number');
        expect(body.summary.totalCount, 'seedowana oferta poza summary').toBeGreaterThanOrEqual(1);
        // Kolejka
        expect(Array.isArray(body.queue?.items), 'brak queue.items[]').toBe(true);
        expect(body.queue.totalCount, 'seedowana oferta poza kolejka').toBeGreaterThanOrEqual(1);
        // Centrum
        expect(typeof body.notifications?.unreadCount, 'brak notifications.unreadCount').toBe(
            'number'
        );
        expect(Array.isArray(body.notifications?.items), 'brak notifications.items[]').toBe(true);
    });

    test('(b) snooze +3d zmienia stan i licznik', async ({ request }) => {
        const until = new Date(Date.now() + 3 * 86400000).toISOString();
        const snooze = await request.post(`${BASE}/api/care/${offerKind}/${offerId}/snooze`, {
            headers: ORIGIN,
            data: { snoozedUntil: until }
        });
        expect(snooze.status(), 'Snooze failed').toBe(200);
        const sBody = await snooze.json();
        expect(sBody.ok).toBe(true);
        expect(sBody.state?.snoozedUntil, 'brak snoozedUntil w stanie').toContain(
            until.slice(0, 10)
        );

        // Licznik: hidePaused=true wycina spauzowana oferte (mniej niz bez filtra,
        // a seedowana oferta znika z listy).
        const all = await (await request.get(`${BASE}/api/care/queue?scope=mine`)).json();
        const hidden = await (
            await request.get(`${BASE}/api/care/queue?scope=mine&hidePaused=true`)
        ).json();
        expect(hidden.totalCount, 'hidePaused nie wycielo snooze (licznik)').toBeLessThan(
            all.totalCount
        );
        const hiddenIds = (hidden.items || []).map((i) => i.offerId);
        expect(hiddenIds, 'spauzowana oferta dalej na liscie').not.toContain(offerId);
    });

    test('(c) done + reopen', async ({ request }) => {
        const done = await request.post(`${BASE}/api/care/${offerKind}/${offerId}/done`, {
            headers: ORIGIN,
            data: {}
        });
        expect(done.status(), 'Done failed').toBe(200);
        const dBody = await done.json();
        expect(dBody.state?.doneAt, 'brak doneAt po done').toBeTruthy();

        const reopen = await request.post(`${BASE}/api/care/${offerKind}/${offerId}/reopen`, {
            headers: ORIGIN,
            data: {}
        });
        expect(reopen.status(), 'Reopen failed').toBe(200);
        const rBody = await reopen.json();
        expect(rBody.state?.doneAt ?? null, 'doneAt przetrwalo reopen').toBeNull();
    });

    test('(d) user dostaje 403 na scope=all / cudzy rep / cudza oferte', async ({ request }) => {
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: USER_CREDS
        });
        expect(login.status(), 'User login failed').toBe(200);

        const all = await request.get(`${BASE}/api/care/panel?scope=all`);
        expect(all.status(), 'scope=all nie zablokowany dla user').toBe(403);

        const rep = await request.get(`${BASE}/api/care/panel?scope=mine&repId=cudzy-rep-id-xyz`);
        expect(rep.status(), 'cudzy repId nie zablokowany dla user').toBe(403);

        const until = new Date(Date.now() + 3 * 86400000).toISOString();
        const snooze = await request.post(`${BASE}/api/care/${offerKind}/${offerId}/snooze`, {
            headers: ORIGIN,
            data: { snoozedUntil: until }
        });
        expect(snooze.status(), 'snooze cudzej oferty nie zablokowany').toBe(403);

        // Sesja admina z powrotem dla kolejnych testow w tym workerze.
        const back = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(back.status(), 'Admin re-login failed').toBe(200);
    });

    test('(e) loading indicator znika po renderze panelu', async ({ page }) => {
        const login = await page.request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Login failed').toBe(200);

        await page.goto(`${BASE}/`);
        const panel = page.locator('#followup-panel');
        await expect(panel, 'panel opieki niewidoczny').toBeVisible({ timeout: 15000 });

        // Loading indicator (data-care-loading) znika po pierwszym renderze.
        await expect(panel.locator('[data-care-loading]'), 'loading nie zniknal').toHaveCount(0, {
            timeout: 15000
        });
        // Kolejka i liczniki wyrenderowane (nie placeholder "Ladowanie").
        await expect(page.locator('#care-queue-list'), 'kolejka niewidoczna').toBeVisible();
        await expect(page.locator('#care-buckets'), 'liczniki niewidoczne').toBeVisible();
        await expect(page.locator('#care-notif-list'), 'centrum niewidoczne').toBeVisible();
    });
});
