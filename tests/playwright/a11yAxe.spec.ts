/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('a11y axe', () => {
    test('index.html ma 0 poważnych naruszeń', async ({ page }) => {
        await page.goto('/');
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('#toast-container')
            .analyze();
        // Tylko poważne/krytyczne blokują
        const serious = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
        );
        expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });

    test('kartoteka filtry mają dostępne nazwy (aria-label)', async ({ page }) => {
        await page.goto('/app.html#/kartoteka');
        // Kartoteka jest w iframe (SPA) — poczekaj na frame
        const frame = await (async () => {
            for (let i = 0; i < 30; i++) {
                const f = page.frames().find((fr) => fr.url().includes('kartoteka.html'));
                if (f) return f;
                await page.waitForTimeout(300);
            }
            return null;
        })();
        if (frame) {
            // Sprawdź bezpośrednio atrybuty w iframe (bardziej stabilne niż Axe include na page)
            await frame.waitForSelector('#ka-user-filter', { timeout: 10000 });
            const userFilterLabel = await frame.getAttribute('#ka-user-filter', 'aria-label');
            const dateFromLabel = await frame.getAttribute('#ka-date-from', 'aria-label');
            // Alternatywnie: label for — jeśli aria-label brak, sprawdź <label>
            expect(
                userFilterLabel ||
                    (await frame
                        .locator('#ka-user-filter')
                        .evaluate((el) => !!document.querySelector(`label[for="${el.id}"]`))),
                'Brak etykiety dla #ka-user-filter'
            ).toBeTruthy();
            expect(
                dateFromLabel ||
                    (await frame
                        .locator('#ka-date-from')
                        .evaluate((el) => !!document.querySelector(`label[for="${el.id}"]`))),
                'Brak etykiety dla #ka-date-from'
            ).toBeTruthy();
            // Dodatkowo uruchom axe na całym frame (bez include — unika błędu No elements for include)
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const missingLabel = results.violations.filter(
                (v) => v.id === 'label' || v.id === 'aria-input-field-name'
            );
            expect(missingLabel).toEqual([]);
        } else {
            // Fallback: bez iframe — analizuj całą stronę
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const missingLabel = results.violations.filter(
                (v) => v.id === 'label' || v.id === 'aria-input-field-name'
            );
            expect(missingLabel).toEqual([]);
        }
    });
});
