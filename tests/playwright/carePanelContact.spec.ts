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
 *   (n) DOM: Kontakt z kafelka otwiera modal opieki w miejscu (bez kartoteki)
 *   (o) DOM: presety +9d i custom 28d odkładają (pill), 99 odrzucone
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';
const RUN_ID = randomUUID();
const CLIENT_TAG = `E2E-CARE-META-${RUN_ID}`;
const CONTACT_USERNAME = `e2e-care-meta-${RUN_ID}`;
const CONTACT_PASSWORD = randomBytes(32).toString('base64url');
const ORIGIN = { Origin: BASE };

let offerFull = '';
let offerBare = '';
let contactUserId = '';

test.describe.serial('e2e: panel opieki — obiekt i kontakt', () => {
    test.beforeAll(async ({ request }) => {
        const login = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Admin login failed').toBe(200);

        // Ten plik używa własnej skrzynki. Inne specy tworzą >20 powiadomień
        // admina równolegle, a panel pokazuje tylko 20 najnowszych.
        const registration = await request.post(`${BASE}/api/auth/register`, {
            headers: ORIGIN,
            data: {
                username: CONTACT_USERNAME,
                password: CONTACT_PASSWORD,
                role: 'user',
                firstName: 'E2E',
                lastName: 'Care Contact'
            }
        });
        expect(registration.status(), 'Seed dedykowanego użytkownika failed').toBe(200);
        contactUserId = (await registration.json()).user?.id || '';
        expect(contactUserId, 'Seed użytkownika nie zwrócił id').not.toBe('');

        const contactLogin = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: CONTACT_USERNAME, password: CONTACT_PASSWORD }
        });
        expect(contactLogin.status(), 'Login dedykowanego użytkownika failed').toBe(200);

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
            data: { username: CONTACT_USERNAME, password: CONTACT_PASSWORD }
        });
        expect(login.status(), 'Login dedykowanego użytkownika (beforeEach) failed').toBe(200);
    });

    test.afterAll(async ({ request }) => {
        if (!contactUserId) return;

        const contactLogin = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: CONTACT_USERNAME, password: CONTACT_PASSWORD }
        });
        expect(contactLogin.status(), 'Cleanup login dedykowanego użytkownika failed').toBe(200);

        const notifications = await request.get(
            `${BASE}/api/care/notifications?scope=mine&unreadOnly=true&limit=100`
        );
        expect(notifications.ok(), 'Cleanup powiadomień failed').toBe(true);
        const notificationIds = ((await notifications.json()).items || []).map((item) => item.id);
        if (notificationIds.length > 0) {
            const markRead = await request.post(`${BASE}/api/care/notifications/read`, {
                headers: { ...ORIGIN, 'Content-Type': 'application/json' },
                data: { ids: notificationIds }
            });
            expect(markRead.ok(), 'Cleanup odczytu powiadomień failed').toBe(true);
        }

        for (const offerId of [offerFull, offerBare].filter(Boolean)) {
            const deletion = await request.delete(`${BASE}/api/offers-rury/${offerId}`, {
                headers: ORIGIN
            });
            expect(deletion.status(), `Cleanup oferty ${offerId} failed`).toBe(200);
        }

        const adminLogin = await request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(adminLogin.status(), 'Cleanup login admina failed').toBe(200);
        const userDeletion = await request.delete(`${BASE}/api/users/${contactUserId}`, {
            headers: ORIGIN
        });
        expect(userDeletion.status(), 'Cleanup użytkownika testowego failed').toBe(200);
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

    async function selectSevenDayRange(page, panel) {
        await expect(
            panel.getByText('Wybierz zakres dat, aby wczytać kolejkę.'),
            'panel nie poprosił o wybór zakresu dat'
        ).toBeVisible();
        await expect(panel.locator('[data-care-loading]')).toHaveCount(0);

        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().includes('/api/care/panel') && response.request().method() === 'GET'
        );
        await panel.locator('[data-care-range="7d"]').click();
        const response = await responsePromise;
        expect(response.ok(), 'GET /api/care/panel failed after selecting 7d').toBe(true);
        await expect(panel.locator('[data-care-loading]')).toHaveCount(0);
    }

    async function openPanel(page) {
        const login = await page.request.post(`${BASE}/api/auth/login`, {
            headers: ORIGIN,
            data: { username: CONTACT_USERNAME, password: CONTACT_PASSWORD }
        });
        expect(login.status(), 'Login dedykowanego użytkownika failed').toBe(200);
        await page.goto(`${BASE}/`);
        const panel = page.locator('#followup-panel');
        await expect(panel, 'panel opieki niewidoczny').toBeVisible({ timeout: 15000 });
        await selectSevenDayRange(page, panel);
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

    test('(o) presety snooze + custom 28d, odrzut 99', async ({ page }) => {
        await openPanel(page);
        const full = page.locator('.care-queue-card', { hasText: `${CLIENT_TAG}-full` });
        await expect(full, 'karty pełnej brak').toHaveCount(1, { timeout: 15000 });
        await full.locator('[aria-label="Odłóż o 9 dni"]').click();
        await expect(full, 'brak pilla Odłożono o 9d').toContainText('Odłożono o 9d', {
            timeout: 15000
        });
        const bare = page.locator('.care-queue-card', { hasText: `${CLIENT_TAG}-bare` });
        await expect(bare, 'karty gołej brak').toHaveCount(1, { timeout: 15000 });
        await bare.locator('.care-snooze-custom').fill('28');
        await bare.locator('[aria-label="Odłóż o własną liczbę dni"]').click();
        await expect(bare, 'brak pilla Odłożono o 28d').toContainText('Odłożono o 28d', {
            timeout: 15000
        });
        await bare.locator('button', { hasText: 'Cofnij' }).click();
        await expect(
            bare.locator('[aria-label="Odłóż o 9 dni"]'),
            'brak powrotu presetów po Cofnij'
        ).toBeVisible({ timeout: 15000 });
        await bare.locator('.care-snooze-custom').fill('99');
        await bare.locator('[aria-label="Odłóż o własną liczbę dni"]').click();
        await expect(bare, 'śmieci 99 nie mogą odłożyć').not.toContainText('Odłożono o 99d');
        await expect(
            bare.locator('[aria-label="Odłóż o 9 dni"]'),
            'presety zniknęły po odrzucie'
        ).toBeVisible();
    });

    test('(n) Kontakt otwiera modal opieki bez nawigacji do kartoteki', async ({ page }) => {
        await openPanel(page);
        const card = page.locator('.care-queue-card', { hasText: `${CLIENT_TAG}-full` });
        await expect(card, 'karty pełnej brak').toHaveCount(1, { timeout: 15000 });
        await card.locator('[data-care-contact-open]').click();
        await expect(page.locator('#offer-followup-title'), 'modal opieki nie otwarty').toBeVisible(
            { timeout: 15000 }
        );
        expect(page.url(), 'nawigacja do kartoteki zamiast modala').not.toContain('kartoteka');
        // Modal sam stawia focus w dialogu → Escape dociera do overlaya.
        await page.keyboard.press('Escape');
        await expect(page.locator('#offer-followup-title'), 'modal nie zamknięty').toHaveCount(0, {
            timeout: 15000
        });
        await expect(card, 'kolejka zniknęła po modalu').toHaveCount(1);
    });
});
