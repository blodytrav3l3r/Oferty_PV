// @ts-nocheck
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

async function login(page) {
    if (!ADMIN_PASSWORD) throw new Error('TEST_ADMIN_PASSWORD jest wymagane.');
    const response = await page.request.post('/api/auth/login', {
        data: { username: 'admin', password: ADMIN_PASSWORD }
    });
    expect(response.ok(), `logowanie nie powiodło się: ${response.status()}`).toBe(true);
}

async function openPulpit(page) {
    await page.goto('/app.html#/pulpit');
    const frame = page.frameLocator('#spa-iframe-pulpit');
    await expect(frame.locator('#user-section')).toBeVisible({ timeout: 15000 });
}

async function failNextStudnieNavigation(page) {
    await page.route('**/studnie.html?*', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><head></head><body>Incomplete test document</body></html>'
        })
    );
    await page.locator('#spa-app-studnie').click();
    await expect(page.locator('[data-spa-retry]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[role="alert"]')).toContainText('Nie udało się wczytać widoku');
    await expect(page.locator('#spa-iframe-pulpit')).toBeVisible();
}

test.describe('iframe SPA: obsługa błędu nawigacji w przeglądarce', () => {
    test('po błędzie można wrócić do działającego modułu', async ({ page }) => {
        await login(page);
        await openPulpit(page);
        await failNextStudnieNavigation(page);

        await page.locator('[data-spa-back]').click();

        await expect(page).toHaveURL(/#\/pulpit$/);
        await expect(page.locator('[data-spa-retry]')).toHaveCount(0);
        await expect(
            page.frameLocator('#spa-iframe-pulpit').locator('#user-section')
        ).toBeVisible();
        await expect(page.locator('#spa-app-pulpit')).toHaveAttribute('aria-current', 'page');
    });

    test('po błędzie można ponowić ładowanie i odsłonić gotowy moduł', async ({ page }) => {
        await login(page);
        await openPulpit(page);
        await failNextStudnieNavigation(page);
        await page.unroute('**/studnie.html?*');

        await page.locator('[data-spa-retry]').click();

        const studnieFrame = page.frameLocator('#spa-iframe-studnie');
        await expect(studnieFrame.locator('#wizard-step-1.active')).toBeVisible({
            timeout: 20000
        });
        await expect(page.locator('[data-spa-retry]')).toHaveCount(0);
        await expect(page.locator('#spa-app-studnie')).toHaveAttribute('aria-current', 'page');
    });
});
