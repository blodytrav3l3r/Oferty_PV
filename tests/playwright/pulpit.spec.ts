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
    for (let i = 0; i < 40; i++) {
        const frame = page.frames().find((f) => f.url().includes('index.html?host=pulpit'));
        if (frame) return frame;
        await page.waitForTimeout(250);
    }
    return null;
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
            const link = document.querySelector('a[href^="app.html#/"]');
            if (link) link.click();
        });
        await page.waitForFunction(() => !location.hash.includes('pulpit'));

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
