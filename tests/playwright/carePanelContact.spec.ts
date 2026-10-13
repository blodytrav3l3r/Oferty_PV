// @ts-nocheck
/**
 * carePanelContact.spec.ts — E2E linii Obiekt/Adres + kontakt (tel:/mailto:)
 * w kartach kolejki i powiadomień.
 *
 * Wzorzec z carePanel.spec.ts (serial, seed przez publiczne API na :3199,
 * ORIGIN na mutacje, limit logowań). Nie tykać carePanel.spec.ts / R2R3.
 *
 * Scenariusze:
 *   (j) HTTP: /api/care/panel niesie invest/kontakt, braki = null
 *   (k) DOM: karta pełna pokazuje obiekt + tel: + mailto:
 *   (l) DOM: karta goła chowa linie (brak data-care-*)
 *   (m) DOM: karta powiadomienia niesie obiekt + tel:
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';
const CLIENT_TAG = `E2E-CARE-META-${Date.now()}`;
const ORIGIN = { Origin: BASE };

let offerFull = '';
let offerBare = '';

test.describe.serial('e2e: panel opieki — obiekt i kontakt', () => {
    test.beforeAll(async ({ request }) => {
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login failed').toBe(200);

        // A: pełna — investName kolumną, adres blobem, kontakt PUT-em.
        const full = await request.post(`${BASE}/api/offers-rury`, {
            headers: ORIGIN,
            data: {
                data: [
                    {
                        clientName: `${CLIENT_TAG}-full`,
                        investName: 'Obiekt E2E',
                        investAddress: 'ul. Testowa 1',
                        items: []
                    }
                ]
            }
        });
        expect(full.ok(), 'Seed oferty pełnej failed').toBe(true);
        const fullBody = await full.json();
        offerFull = (fullBody.results || fullBody.data || [])[0]?.id || '';
        expect(offerFull, 'Seed pełnej nie zwrócił id').not.toBe('');

        const contact = await request.put(
            `${BASE}/api/offers-rury/rury/${offerFull}/client-contact`,
            {
                headers: ORIGIN,
                data: {
                    contactPerson: 'Jan E2E',
                    clientPhone: '601000111',
                    clientEmail: 'jan.e2e@example.com'
                }
            }
        );
        expect(contact.ok(), 'Seed kontaktu failed').toBe(true);

        // B: goła — bez invest i kontaktu.
        const bare = await request.post(`${BASE}/api/offers-rury`, {
            headers: ORIGIN,
            data: { data: [{ clientName: `${CLIENT_TAG}-bare`, items: [] }] }
        });
        expect(bare.ok(), 'Seed oferty gołej failed').toBe(true);
        const bareBody = await bare.json();
        offerBare = (bareBody.results || bareBody.data || [])[0]?.id || '';
        expect(offerBare, 'Seed gołej nie zwrócił id').not.toBe('');
    });

    test.beforeEach(async ({ request }) => {
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login (beforeEach) failed').toBe(200);
    });

    test('(j) panel niesie obiekt+kontakt, braki = null', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/care/panel?scope=mine`);
        expect(resp.status(), 'GET /api/care/panel failed').toBe(200);
        const body = await resp.json();
        const full = (body.queue?.items || []).find((i) => i.offerId === offerFull);
        expect(full, 'pełnej brak w kolejce').toBeTruthy();
        expect(full.investName).toBe('Obiekt E2E');
        expect(full.investAddress).toBe('ul. Testowa 1');
        expect(full.contactPerson).toBe('Jan E2E');
        expect(full.phone).toBe('601000111');
        expect(full.email).toBe('jan.e2e@example.com');
        const bare = (body.queue?.items || []).find((i) => i.offerId === offerBare);
        expect(bare, 'gołej brak w kolejce').toBeTruthy();
        expect(bare.investName ?? null).toBeNull();
        expect(bare.contactPerson ?? null).toBeNull();
        const notif = (body.notifications?.items || []).find((n) => n.offerId === offerFull);
        expect(notif, 'pełnej brak w powiadomieniach').toBeTruthy();
        expect(notif.investName).toBe('Obiekt E2E');
        expect(notif.phone).toBe('601000111');
    });

    async function openPanel(page) {
        const login = await page.request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Login failed').toBe(200);
        await page.goto(`${BASE}/`);
        const panel = page.locator('#followup-panel');
        await expect(panel, 'panel opieki niewidoczny').toBeVisible({ timeout: 15000 });
        await expect(panel.locator('[data-care-loading]'), 'loading nie zniknął').toHaveCount(0, {
            timeout: 15000
        });
        await page.waitForResponse(/\/api\/care\/panel/, { timeout: 15000 }).catch(() => {});
    }

    test('(k) karta pełna: obiekt + tel: + mailto:', async ({ page }) => {
        await openPanel(page);
        const card = page.locator('.care-queue-card', { hasText: `${CLIENT_TAG}-full` });
        await expect(card, 'karty pełnej brak').toHaveCount(1, { timeout: 15000 });
        await expect(card.locator('[data-care-object]'), 'obiektu brak').toBeVisible();
        await expect(card.locator('[data-care-object]')).toContainText('Obiekt E2E');
        await expect(card.locator('[data-care-object]')).toContainText('ul. Testowa 1');
        await expect(card.locator('[data-care-contact]'), 'kontaktu brak').toBeVisible();
        await expect(card.locator('[data-care-contact]')).toContainText('Jan E2E');
        await expect(card.locator('a[href="tel:601000111"]'), 'tel: brak').toHaveCount(1);
        await expect(
            card.locator('a[href="mailto:jan.e2e@example.com"]'),
            'mailto: brak'
        ).toHaveCount(1);
    });

    test('(l) karta goła: brak linii obiektu i kontaktu', async ({ page }) => {
        await openPanel(page);
        const card = page.locator('.care-queue-card', { hasText: `${CLIENT_TAG}-bare` });
        await expect(card, 'karty gołej brak').toHaveCount(1, { timeout: 15000 });
        await expect(card.locator('[data-care-object]'), 'obiekt nie ukryty').toHaveCount(0);
        await expect(card.locator('[data-care-contact]'), 'kontakt nie ukryty').toHaveCount(0);
    });

    test('(m) powiadomienie pełnej: obiekt + tel:', async ({ page }) => {
        await openPanel(page);
        const card = page.locator('.care-notif-card', { hasText: `${CLIENT_TAG}-full` });
        await expect(card, 'powiadomienia pełnej brak').toHaveCount(1, { timeout: 15000 });
        await expect(card.locator('[data-care-object]'), 'obiektu brak').toBeVisible();
        await expect(card.locator('a[href="tel:601000111"]'), 'tel: brak').toHaveCount(1);
    });
});
