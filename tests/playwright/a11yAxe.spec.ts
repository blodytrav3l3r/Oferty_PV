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
        await page.waitForTimeout(1500);
        const results = await new AxeBuilder({ page })
            .include('#ka-user-filter')
            .include('#ka-date-from')
            .analyze();
        // Filtry muszą mieć etykiety
        const missingLabel = results.violations.filter(
            (v) => v.id === 'label' || v.id === 'aria-input-field-name'
        );
        expect(missingLabel).toEqual([]);
    });
});
