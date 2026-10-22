// @ts-nocheck
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('a11y axe', () => {
    test('index.html ma 0 poważnych naruszeń', async ({ page }) => {
        await page.goto('/');
        // Determinizm: loginFadeIn (0.5 s) blenduje kolory w trakcie —
        // axe mierzyłby mid-animacji (~4.2 zamiast 4.9 steady-state).
        await page.waitForFunction(
            () => {
                const b = document.querySelector('.login-box');
                return !!b && getComputedStyle(b).opacity === '1';
            },
            null,
            { timeout: 10000 }
        );
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

    async function waitForModuleFrame(page: any, name: string) {
        for (let i = 0; i < 40; i++) {
            const f = page.frames().find((fr: any) => fr.url().includes(name));
            if (f) return f;
            await page.waitForTimeout(300);
        }
        return null;
    }

    for (const mod of ['studnie.html', 'rury.html']) {
        test(`${mod} ma 0 naruszeń critical/serious`, async ({ page }) => {
            // Moduły SPA wymagają sesji (bez niej redirect do index.html
            // i test mierzyłby pustkę — por. fallback w teście kartoteki).
            // page.request dzieli cookie-jar ze strona (fixture request nie).
            const login = await page.request.post('/api/auth/login', {
                data: {
                    username: 'admin',
                    password: process.env.TEST_ADMIN_PASSWORD || 'anim123456'
                }
            });
            expect(login.ok(), `login failed: ${login.status()}`).toBe(true);
            await page.goto(`/app.html#/${mod.replace('.html', '')}`);
            const frame = await waitForModuleFrame(page, mod);
            expect(frame, `brak iframe ${mod}`).not.toBeNull();
            // Stabilizacja: poczekaj na głowny kontener modułu w frame.
            await frame!.locator('main, #spa-main, body').first().waitFor({ timeout: 15000 });
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .exclude('#toast-container')
                .analyze();
            // Artefakt pomiaru (ZWERYFIKOWANY): iframe modulu ma przezroczyste
            // body (router.js celowo), wiec axe zaklada biale tlo canvas. Wywolanie
            // .exclude() na selektor w iframe jest w @axe-core/playwright 4.13
            // nieskuteczne (sonda p22-excl: 1 violation z i bez exclude).
            // Realny render: rodzic app.html ma body rgb(10,14,26) — label
            // #a5b4fc na tym tle ma ~7:1 (OK). Filtrujemy DOKLADNIE ten jeden
            // znany false-positive po (rule + selektor + bg), nie cala regule.
            const serious = results.violations.filter(
                (v) => v.impact === 'critical' || v.impact === 'serious'
            );
            const withoutArtifact = serious.filter((v) => {
                if (v.id !== 'color-contrast') return true;
                const nodes = v.nodes || [];
                if (nodes.length === 0) return true;
                return !nodes.every((n: any) => {
                    const targets = (n.target || []).flat().join(' ');
                    const html = n.html || '';
                    return (
                        targets.includes('wizard-dot-label') && html.includes('wizard-dot-label')
                    );
                });
            });
            expect(withoutArtifact, JSON.stringify(withoutArtifact, null, 2)).toEqual([]);
        });
    }

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
            const userFilterLabel = (
                (await frame.getAttribute('#ka-user-filter', 'aria-label')) || ''
            ).trim();
            const dateFromLabel = (
                (await frame.getAttribute('#ka-date-from', 'aria-label')) || ''
            ).trim();
            // Alternatywnie: label for — liczy się tylko niepusty tekst etykiety.
            expect(
                userFilterLabel ||
                    (await frame.locator('#ka-user-filter').evaluate((el) => {
                        const l = document.querySelector(`label[for="${el.id}"]`);
                        return !!(l && (l.textContent || '').trim());
                    })),
                'Brak etykiety dla #ka-user-filter'
            ).toBeTruthy();
            expect(
                dateFromLabel ||
                    (await frame.locator('#ka-date-from').evaluate((el) => {
                        const l = document.querySelector(`label[for="${el.id}"]`);
                        return !!(l && (l.textContent || '').trim());
                    })),
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
