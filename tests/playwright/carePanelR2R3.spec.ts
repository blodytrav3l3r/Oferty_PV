// @ts-nocheck
/**
 * carePanelR2R3.spec.ts — E2E opieki, fala R3+R2A (poziom HTTP + 2 testy DOM).
 *
 * NOWY plik, wzorowany na carePanel.spec.ts (tamtego NIE tykać):
 *   login przez page.request/request (cookie httpOnly w jarze kontekstu),
 *   seed TYLKO przez publiczne API na izolowanej DB :3199 (test-playwright.sqlite),
 *   zero prod/dev DB, zero migracji z testu (webServer w playwright.config.ts).
 *
 * UWAGA: LOGIN_LIMITER (10/min na IP|login) — spec robi ~7 loginów admin/run.
 * Uruchamiaj pojedynczo, bez --repeat-each i bez równoległych workerów;
 * parallel repeats dostaną 429 (limit, nie flake aplikacji).
 *
 * Scenariusze:
 *   (f) PUT followup zmieniający contactedAt → ETag panelu zmienia się (200 nie 304)
 *   (f2) PUT samej notatki → ETag zmienia się (dowód markera m, brak fałszywego 304)
 *   (g) ~25 overdue ofert → unreadCount pełny, items<=20, hasOverflow true
 *   (h) skeleton [data-care-loading] przy opóźnionym panelu (page.route delay)
 *   (i) błąd panelu → [data-care-error], potem retry znika
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';
const CLIENT_TAG = `E2E-CARE-R2R3-${Date.now()}`;
// P0.1 CSRF: mutacje (POST/PUT/DELETE) wymagają Origin zgodnego z Host (403 bez niego).
const ORIGIN = { Origin: BASE };

const KIND = 'rury';
let offerId = '';
let fuId = '';
const seededIds = [];

function fuPayload(contactedAt, nextContactAt) {
    return {
        channel: 'PHONE',
        result: 'CONTACTED',
        contactedAt,
        nextContactAt,
        outcome: 'OPEN'
    };
}

test.describe.serial('e2e: panel opieki R2R3', () => {
    test.beforeAll(async ({ request }) => {
        // 1. Admin login (kontrakt: cookie httpOnly, jak w carePanel.spec.ts).
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login failed').toBe(200);

        // 2. Seed oferty z unikalnym clientName (do (f); sprzątanie w afterAll).
        const created = await request.post(`${BASE}/api/offers-rury`, {
            headers: ORIGIN,
            data: { data: [{ clientName: `${CLIENT_TAG}-f`, items: [] }] }
        });
        expect(created.status(), 'Seed oferty (f) failed').toBe(200);
        const body = await created.json();
        offerId = (body.results || body.data || [])[0]?.id || '';
        expect(offerId, 'Seed oferty nie zwrócił id').not.toBe('');
        seededIds.push(offerId);

        // 3. Seed follow-up z contactedAt 2h wstecz (PUT w (f) przesunie na now).
        const contacted = new Date(Date.now() - 2 * 3600000).toISOString();
        const fu = await request.post(`${BASE}/api/offers-rury/${KIND}/${offerId}/followups`, {
            headers: ORIGIN,
            data: fuPayload(contacted, new Date(Date.now() + 86400000).toISOString())
        });
        expect(fu.status(), 'Seed follow-up (f) failed').toBe(200);
        fuId = (await fu.json()).id || '';
        expect(fuId, 'Seed follow-up nie zwrócił id').not.toBe('');
    });

    test.beforeEach(async ({ request }) => {
        // Fixture request z beforeAll to osobna instancja — login powtórzony
        // w kontekście każdego testu (jak w carePanel.spec.ts).
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login (beforeEach) failed').toBe(200);
    });

    test.afterAll(async ({ request }) => {
        // Sprzątanie seedów przez API (nie sqlite): DELETE ofert best-effort.
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        if (!login.ok()) return;
        for (const id of seededIds) {
            try {
                await request.delete(`${BASE}/api/offers-rury/${id}`, { headers: ORIGIN });
            } catch {
                /* best-effort */
            }
        }
    });

    test('(f) PUT followup zmienia contactedAt → ETag panelu zmienia się', async ({ request }) => {
        const first = await request.get(`${BASE}/api/care/panel?scope=mine`);
        expect(first.status(), 'GET /api/care/panel failed').toBe(200);
        const etag1 = first.headers()['etag'];
        // Twardo: brak ETag to realny bug (care.ts zawsze stawia nagłówek).
        expect(etag1, 'brak nagłówka ETag w /panel').toBeTruthy();

        // Pełny obiekt do PUT (schemat edycji wymaga wszystkich pól).
        const list = await request.get(`${BASE}/api/offers-rury/${KIND}/${offerId}/followups`);
        expect(list.status(), 'GET followups failed').toBe(200);
        const items = (await list.json()).items || [];
        const cur = items.find((i) => i.id === fuId) || items[0];
        expect(cur, 'brak follow-up do edycji').toBeTruthy();

        const put = await request.put(
            `${BASE}/api/offers-rury/${KIND}/${offerId}/followups/${cur.id}`,
            {
                headers: { ...ORIGIN, 'Content-Type': 'application/json' },
                data: {
                    channel: cur.channel,
                    result: cur.result,
                    contactedAt: new Date().toISOString(),
                    durationMin: cur.durationMin ?? null,
                    note: cur.note ?? null,
                    nextContactAt:
                        cur.nextContactAt || new Date(Date.now() + 86400000).toISOString(),
                    outcome: cur.outcome,
                    loseReason: cur.loseReason ?? null,
                    competitor: cur.competitor ?? null,
                    competitorPrice: cur.competitorPrice ?? null
                }
            }
        );
        // Guard w followUps połyka brak kolumny updatedAt (legacy DB),
        // więc 500 to realny bug, nie migracja.
        expect(put.status(), 'PUT followup failed').toBe(200);

        // Stary ETag po zmianie contactedAt (MAX w haśle ETag) musi dać 200, nie 304.
        const stale = await request.get(`${BASE}/api/care/panel?scope=mine`, {
            headers: { 'If-None-Match': etag1 }
        });
        expect(stale.status(), 'ETag nie unieważniony po PUT contactedAt (304 zamiast 200)').toBe(
            200
        );
        const etag2 = stale.headers()['etag'];
        expect(etag2, 'brak ETag po zmianie').toBeTruthy();
        expect(etag2, 'ETag identyczny mimo zmiany contactedAt').not.toBe(etag1);
    });

    test('(f2) PUT samej notatki → ETag zmienia się (marker m)', async ({ request }) => {
        // Dowód markera m: contactedAt/createdAt stoją, tylko note się zmienia.
        // Bez m byłby fałszywy 304 (a/b ślepe na edycję w miejscu).
        const list = await request.get(`${BASE}/api/offers-rury/${KIND}/${offerId}/followups`);
        expect(list.status(), 'GET followups failed').toBe(200);
        const items = (await list.json()).items || [];
        const cur = items.find((i) => i.id === fuId) || items[0];
        expect(cur, 'brak follow-up do edycji').toBeTruthy();

        const before = await request.get(`${BASE}/api/care/panel?scope=mine`);
        expect(before.status()).toBe(200);
        const etagBefore = before.headers()['etag'];
        expect(etagBefore, 'brak ETag przed edycją').toBeTruthy();

        const put = await request.put(
            `${BASE}/api/offers-rury/${KIND}/${offerId}/followups/${cur.id}`,
            {
                headers: { ...ORIGIN, 'Content-Type': 'application/json' },
                data: {
                    channel: cur.channel,
                    result: cur.result,
                    contactedAt: cur.contactedAt,
                    durationMin: cur.durationMin ?? null,
                    note: `R3-marker-${Date.now()}`,
                    nextContactAt:
                        cur.nextContactAt || new Date(Date.now() + 86400000).toISOString(),
                    outcome: cur.outcome,
                    loseReason: cur.loseReason ?? null,
                    competitor: cur.competitor ?? null,
                    competitorPrice: cur.competitorPrice ?? null
                }
            }
        );
        expect(put.status(), 'PUT samej notatki failed').toBe(200);

        const stale = await request.get(`${BASE}/api/care/panel?scope=mine`, {
            headers: { 'If-None-Match': etagBefore }
        });
        expect(stale.status(), 'fałszywy 304 po edycji notatki (marker m nie działa)').toBe(200);
        expect(stale.headers()['etag'], 'ETag identyczny mimo edycji notatki').not.toBe(etagBefore);
    });

    test('(g) ~25 overdue → unreadCount pełny, items<=20, hasOverflow', async ({ request }) => {
        const N = 25;
        const pastNext = new Date(Date.now() - 10 * 86400000).toISOString();
        for (let i = 0; i < N; i += 1) {
            const c = await request.post(`${BASE}/api/offers-rury`, {
                headers: ORIGIN,
                data: { data: [{ clientName: `${CLIENT_TAG}-g${i}`, items: [] }] }
            });
            expect(c.status(), `Seed oferty g${i} failed`).toBe(200);
            const cb = await c.json();
            const id = (cb.results || cb.data || [])[0]?.id || '';
            expect(id, `Seed g${i} bez id`).not.toBe('');
            seededIds.push(id);
            const f = await request.post(`${BASE}/api/offers-rury/${KIND}/${id}/followups`, {
                headers: ORIGIN,
                data: fuPayload(new Date(Date.now() - 86400000).toISOString(), pastNext)
            });
            expect(f.status(), `Seed follow-up g${i} failed`).toBe(200);
        }

        const resp = await request.get(
            `${BASE}/api/care/notifications?scope=mine&unreadOnly=true&limit=20`
        );
        expect(resp.status(), 'GET /api/care/notifications failed').toBe(200);
        const body = await resp.json();
        // Licznik pełny (cap tylko prezentacja, retencja/sync bez zmian).
        expect(body.unreadCount, 'unreadCount nie pokrywa ~25 overdue').toBeGreaterThanOrEqual(N);
        expect(body.items?.length, 'items ponad limit 20').toBeLessThanOrEqual(20);
        expect(body, 'brak hasOverflow w odpowiedzi').toHaveProperty('hasOverflow', true);
    });

    test('(h) skeleton przy opóźnionym panelu', async ({ page }) => {
        const login = await page.request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Login failed').toBe(200);

        // Opóźnij pakiet panelu — skeleton musi być widoczny w międzyczasie.
        await page.route('**/api/care/panel*', async (route) => {
            await new Promise((r) => setTimeout(r, 900));
            await route.continue();
        });
        await page.goto(`${BASE}/`);
        const panel = page.locator('#followup-panel');
        await expect(panel, 'panel opieki niewidoczny').toBeVisible({ timeout: 15000 });
        await expect(
            panel.locator('[data-care-loading]'),
            'skeleton [data-care-loading] niewidoczny przy opóźnieniu'
        ).toBeVisible({ timeout: 10000 });
        // Po dociągnięciu pakietu skeleton znika (jak w (e) carePanel.spec.ts).
        await expect(panel.locator('[data-care-loading]'), 'loading nie zniknął').toHaveCount(0, {
            timeout: 15000
        });
        await page.unroute('**/api/care/panel*');
    });

    test('(i) błąd panelu → [data-care-error], po retry znika', async ({ page }) => {
        const login = await page.request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Login failed').toBe(200);

        // Tnij WSZYSTKIE endpointy opieki (pakiet + legacy fallback) — inaczej
        // fallback dociągnie liczniki i [data-care-error] się nie pojawi.
        await page.route('**/api/care**', (route) => route.abort());
        await page.goto(`${BASE}/`);
        const panel = page.locator('#followup-panel');
        await expect(panel, 'panel opieki niewidoczny').toBeVisible({ timeout: 15000 });
        await expect(
            panel.locator('[data-care-error]'),
            'błąd [data-care-error] nie pokazał się po awarii'
        ).toBeVisible({ timeout: 15000 });

        // Retry tą samą ścieżką co polling (sok:user-ready woła loadCarePanel,
        // sukces czyści alert przez clearError) — bez przeładowania strony.
        await page.unroute('**/api/care**');
        await page.evaluate(() => document.dispatchEvent(new CustomEvent('sok:user-ready')));
        await expect(panel.locator('[data-care-error]'), 'błąd wisi po udanym retry').toHaveCount(
            0,
            { timeout: 15000 }
        );
    });
});
