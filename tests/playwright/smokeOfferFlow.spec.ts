/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * smokeOfferFlow.spec.ts — blokujący smoke flow (Faza P2-1 planu optymalizacji).
 *
 * Pokrywa krytyczny łańcuch startu aplikacji:
 *   login API → SPA router → iframe modułu → partial loader → globals → wizard krok 1→2
 *   → dane solvera (/api/products-studnie) → zero nieobsłużonych błędów JS.
 *
 * Celowo BEZ auto-doboru i zapisu oferty (dynamiczne selektory step2 = flaky);
 * rozszerzenie gdy powstaną stabilne data-testid.
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

let authToken = '';

test.beforeAll(async ({ request }) => {
    const resp = await request.post(`${BASE}/api/auth/login`, {
        data: { username: 'admin', password: ADMIN_PASSWORD }
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    authToken = json.token || json.authToken;
    expect(authToken, 'Login failed - no token').toBeTruthy();
});

test.describe('smoke: oferta studni — start modułu', () => {
    let pageErrors = [];

    test.beforeEach(async ({ page }) => {
        pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(String(err)));
        await page.addInitScript((t) => localStorage.setItem('authToken', t), authToken);
    });

    test('SPA router ładuje moduł studnie i wizard krok 1 jest aktywny', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/studnie`);

        // Czekaj na iframe modułu (router tworzy #spa-iframe-studnie)
        const frame = await (async () => {
            for (let i = 0; i < 30; i++) {
                const f = page.frames().find((fr) => fr.url().includes('studnie.html'));
                if (f) return f;
                await page.waitForTimeout(300);
            }
            return null;
        })();
        expect(frame, 'iframe studnie.html nie został utworzony').not.toBeNull();

        // Partial step1 załadowany + aktywny
        await frame.waitForSelector('#wizard-step-1.active', { timeout: 15000 });
        await expect(frame.locator('#client-name')).toBeVisible();

        // Wizard indicator wyrenderowany
        await expect(frame.locator('#wizard-indicator .wizard-step-dot').first()).toBeVisible();
    });

    test('wizard przechodzi z kroku 1 do 2 po wpisaniu klienta', async ({ page }) => {
        await page.goto(`${BASE}/app.html#/studnie`);
        const frame = await (async () => {
            for (let i = 0; i < 30; i++) {
                const f = page.frames().find((fr) => fr.url().includes('studnie.html'));
                if (f) return f;
                await page.waitForTimeout(300);
            }
            return null;
        })();
        expect(frame).not.toBeNull();

        await frame.waitForSelector('#wizard-step-1.active', { timeout: 15000 });
        await frame.fill('#client-name', 'SMOKE Test Bud');
        // Przycisk Dalej odblokowuje się dopiero po wpisaniu klienta (updateStep1NextState)
        await frame.waitForSelector('#studnie-nav-next:not([disabled])', { timeout: 5000 });
        await frame.click('#studnie-nav-next');

        await expect(frame.locator('#wizard-step-2.active')).toHaveCount(1);
        await expect(frame.locator('#studnie-nav-step-info')).toContainText('Krok 2 z 5');
    });

    test('API produktów studni zwraca dane solvera', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/products-studnie`, {
            headers: { 'X-Auth-Token': authToken }
        });
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        const items = Array.isArray(body) ? body : body.data || body.products || [];
        expect(items.length, 'Brak produktów studni — solver nie zadziała').toBeGreaterThan(0);
    });

    test.afterEach(async () => {
        const fatal = pageErrors.filter((e) => !e.includes('ResizeObserver'));
        expect(fatal, `Nieobsłużone błędy JS: ${fatal.join(' | ')}`).toEqual([]);
    });
});
