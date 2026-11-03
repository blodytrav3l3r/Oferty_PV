// @ts-nocheck
/**
 * pulpit.spec.ts — Pulpit jako moduł SPA (#/pulpit → index.html?host=pulpit).
 *
 * Scenariusze: nawigacja kaflem, stan iframe po powrocie, brak drugiego
 * logowania w ramce, wylogowanie, wygaśnięcie sesji, odświeżenie.
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';

async function waitForPulpitFrame(page) {
    const isPulpit = (f) => !f.isDetached() && f.url().includes('index.html?host=pulpit');
    await expect
        .poll(() => page.frames().some(isPulpit), {
            message: 'iframe pulpit nie został utworzony',
            timeout: 15000
        })
        .toBe(true);
    return page.frames().find(isPulpit) || null;
}

test.describe('SPA: pulpit jako moduł', () => {
    test.beforeEach(async ({ page }) => {
        const resp = await page.request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(resp.status(), 'Login failed').toBe(200);
    });

    test('#/pulpit ładuje index.html?host=pulpit bez logowania w ramce', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit`);

        const frame = await waitForPulpitFrame(page);
        expect(frame, 'iframe pulpit nie został utworzony').not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });

        // Serwerowy znacznik trybu osadzonego + CSS ukrywające stronę wejścia.
        const marker = await frame.evaluate(() => document.documentElement.dataset.embedded);
        expect(marker).toBe('pulpit');
        for (const sel of ['#dash-header', '.index-logo', '.subtitle']) {
            await expect(frame.locator(sel)).toBeHidden();
        }
        // Brak podwójnego logowania: formularz z pulpitu nie jest widoczny.
        await expect(frame.locator('#login-section')).toBeHidden();
        await expect(frame.locator('#user-section')).toBeVisible();
    });

    test('kafel Studnie zmienia trasę shella, powrót zachowuje stan iframe', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit`);
        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });
        await frame.evaluate(() => {
            window.__pulpitProbe = 'keep';
        });

        await page.click('#spa-app-studnie');
        await page.waitForFunction(() => location.hash === '#/studnie');

        await page.click('#spa-app-pulpit');
        await page.waitForFunction(() => location.hash === '#/pulpit');

        const again = await waitForPulpitFrame(page);
        expect(await again.evaluate(() => window.__pulpitProbe)).toBe('keep');
        await expect(page.locator('#spa-app-pulpit')).toHaveAttribute('aria-current', 'page');
    });

    test('link app.html z wnętrza pulpitu nawiguje shell, nie ramkę', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit`);
        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });

        await frame.evaluate(() => {
            const link = document.querySelector('a[href="app.html#/rury"]');
            if (link) link.click();
        });
        await page.waitForFunction(() => location.hash === '#/rury');

        // Ramka pulpitu nadal istnieje w shellu — nawigacja nie przeładowała jej.
        expect(await waitForPulpitFrame(page)).not.toBeNull();
    });

    test('wylogowanie z shella wraca na stronę logowania', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit`);
        await waitForPulpitFrame(page);

        await page.locator('.header-logout:not(#theme-toggle)').first().click();
        await page.waitForURL(/\/index\.html$/, { timeout: 15000 });
        await expect(page.locator('#login-section')).toBeVisible();
    });

    test('brak sesji: #/pulpit przekierowuje na login, bez pętli', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto(`${BASE}/app.html#/pulpit`);
        await page.waitForURL(/\/index\.html$/, { timeout: 15000 });
        await expect(page.locator('#login-section')).toBeVisible();

        // Bezpośrednie wejście w tryb osadzony bez sesji gubi parametr host.
        await page.goto(`${BASE}/index.html?host=pulpit`);
        await page.waitForFunction(() => location.search === '', null, { timeout: 15000 });
        await expect(page.locator('#login-section')).toBeVisible();
    });

    test('logowanie na stronie wejścia kończy się w #/pulpit', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto(`${BASE}/index.html`);
        await page.fill('#login-username', 'admin');
        await page.fill('#login-password', ADMIN_PASSWORD);
        await page.click('.login-submit');
        await page.waitForURL(/#\/pulpit$/, { timeout: 15000 });

        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });
    });

    test('#/pulpit?host=x nie wyłącza trybu osadzonego', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit?host=x`);
        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        expect(frame.url()).toContain('host=pulpit');
        await frame.waitForSelector('#user-section', { timeout: 15000 });
        expect(await frame.evaluate(() => document.documentElement.dataset.embedded)).toBe(
            'pulpit'
        );
    });

    test('bezpośredni index.html?host=pulpit z sesją wchodzi do shella', async ({ page }) => {
        await page.goto(`${BASE}/index.html?host=pulpit`);
        await page.waitForURL(/app\.html#\/pulpit$/, { timeout: 15000 });

        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });
    });

    test('5xx /me w ramce nie wyrzuca z shella, 401 wyrzuca', async ({ page }) => {
        let frameCalls = 0;
        let frameAuth = 'error';
        await page.route('**/api/auth/me', async (route) => {
            // Shell (main frame) zawsze dostaje prawdziwą odpowiedź.
            if (route.request().frame() === page.mainFrame()) return route.continue();
            frameCalls++;
            if (frameAuth === 'error') {
                return route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: '{}'
                });
            }
            return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
        });

        await page.goto(`${BASE}/app.html#/pulpit`);
        await waitForPulpitFrame(page);
        await expect.poll(() => frameCalls, { timeout: 15000 }).toBeGreaterThan(0);
        // Negatywna asercja: po błędzie przejściowym shell zostaje na miejscu.
        await page.waitForTimeout(800);
        expect(page.url()).toContain('#/pulpit');

        // Kolejne wejście do ramki dostaje 401 → wyjście na stronę logowania.
        frameAuth = 'auth';
        await page.reload();
        await page.waitForURL(/\/index\.html$/, { timeout: 15000 });
        // Sesja w oknie najwyższym jest ważna — wejście pokazuje dashboard.
        await expect(page.locator('#user-section')).toBeVisible();
    });

    test('odświeżenie #/pulpit odtwarza moduł', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/pulpit`);
        expect(await waitForPulpitFrame(page)).not.toBeNull();

        await page.reload();
        const frame = await waitForPulpitFrame(page);
        expect(frame).not.toBeNull();
        await frame.waitForSelector('#user-section', { timeout: 15000 });
        expect(await frame.evaluate(() => document.documentElement.dataset.embedded)).toBe(
            'pulpit'
        );
    });
});
