// @ts-nocheck
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const E2E_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';

async function prepareAxeFrameBackgrounds(page: any) {
    await page.evaluate(() => {
        const candidates = [
            document.querySelector('#spa-main'),
            document.body,
            document.documentElement
        ].filter(Boolean);
        const background = candidates
            .map((element) => getComputedStyle(element).backgroundColor)
            .find((color) => !color.startsWith('rgba(0, 0, 0, 0)'));
        if (!background) return;

        document.querySelectorAll('iframe.spa-module-iframe').forEach((iframe) => {
            const childDocument = iframe.contentDocument;
            if (!childDocument?.body) return;
            if (getComputedStyle(childDocument.body).backgroundColor !== 'rgba(0, 0, 0, 0)') {
                return;
            }
            childDocument.documentElement.style.backgroundColor = background;
            childDocument.body.style.backgroundColor = background;
        });
    });
}

async function expectNoSeriousAxeViolations(page: any) {
    await prepareAxeFrameBackgrounds(page);
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('#toast-container')
        .analyze();
    const serious = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

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
        await prepareAxeFrameBackgrounds(page);
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
            // Determinizm: .wizard-step animuje wejscie (wizardFadeIn 0.35 s).
            // Axe mierzyl kontrast przy opacity ~0.22 — kolor #fff na #686bed
            // (4.27) zamiast steady-state #5b5fec (4.84). Czekamy na koniec animacji.
            await frame!.waitForFunction(
                () => {
                    const el = document.querySelector('.wizard-step.active');
                    return !el || Number(getComputedStyle(el).opacity) === 1;
                },
                null,
                { timeout: 10000 }
            );
            await prepareAxeFrameBackgrounds(page);
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .exclude('#toast-container')
                .analyze();
            // .wizard-indicator ma jawne tło, dzięki czemu axe mierzy kontrast
            // etykiet również w osadzonym module z przezroczystym body.
            const serious = results.violations.filter(
                (v) => v.impact === 'critical' || v.impact === 'serious'
            );
            expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

            // Strażnik: faktyczna regresja kontrastu etykiety musi być wykryta.
            await frame!
                .locator('.wizard-dot-label')
                .first()
                .evaluate((label) => {
                    label.style.transition = 'none';
                    label.style.color = 'rgb(200, 200, 200)';
                    label.style.backgroundColor = 'rgb(255, 255, 255)';
                });
            await prepareAxeFrameBackgrounds(page);
            const regression = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const contrast = regression.violations.find((v) => v.id === 'color-contrast');
            expect(contrast?.nodes.some((n) => n.html.includes('wizard-dot-label'))).toBe(true);
        });

        test(`${mod} na 390 px pozwala doscrollować ostatnie pole nad dolną nawigację`, async ({
            page
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
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
            await frame!.locator('.wizard-nav-fixed').waitFor({ timeout: 15000 });
            await frame!.locator('.wizard-step.active').waitFor({ timeout: 15000 });

            const clearance = await frame!.evaluate(() => {
                const step = document.querySelector('.wizard-step.active');
                const footer = document.querySelector('.wizard-nav-fixed');
                const fields = Array.from(step?.querySelectorAll('input, select, textarea') || []);
                const visibleFields = fields.filter((field) => {
                    const style = getComputedStyle(field);
                    return (
                        !field.disabled && style.display !== 'none' && style.visibility !== 'hidden'
                    );
                });
                const lastField = visibleFields[visibleFields.length - 1];
                if (!lastField || !footer) return null;

                const scrollableAncestors = [];
                for (
                    let ancestor = lastField.parentElement;
                    ancestor;
                    ancestor = ancestor.parentElement
                ) {
                    const style = getComputedStyle(ancestor);
                    if (
                        ancestor.scrollHeight > ancestor.clientHeight &&
                        /(auto|scroll)/.test(style.overflowY)
                    ) {
                        scrollableAncestors.push(ancestor);
                    }
                }

                lastField.scrollIntoView({ block: 'end' });
                for (const ancestor of scrollableAncestors) {
                    ancestor.scrollTop = ancestor.scrollHeight;
                }
                const pageScroller = document.scrollingElement;
                if (pageScroller && pageScroller.scrollHeight > pageScroller.clientHeight) {
                    pageScroller.scrollTop = pageScroller.scrollHeight;
                }

                return (
                    footer.getBoundingClientRect().top - lastField.getBoundingClientRect().bottom
                );
            });

            expect(clearance, 'brak ostatniego pola lub dolnej nawigacji').not.toBeNull();
            expect(clearance).toBeGreaterThanOrEqual(8);
        });
    }

    test('kartoteka filtry mają dostępne nazwy (aria-label)', async ({ page }) => {
        const login = await page.request.post('/api/auth/login', {
            data: { username: 'admin', password: process.env.TEST_ADMIN_PASSWORD || 'anim123456' }
        });
        expect(login.ok(), 'logowanie do Kartoteki').toBe(true);
        await page.goto('/app.html#/kartoteka');
        const frame = await waitForModuleFrame(page, 'kartoteka.html');
        expect(frame, 'brak autoryzowanego iframe Kartoteki').not.toBeNull();
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
        await prepareAxeFrameBackgrounds(page);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const missingLabel = results.violations.filter(
            (v) => v.id === 'label' || v.id === 'aria-input-field-name'
        );
        expect(missingLabel).toEqual([]);
    });

    const remainingModules = [
        {
            route: 'pulpit',
            frameUrl: 'index.html?host=pulpit',
            readySelector: '#user-section'
        },
        {
            route: 'kartoteka',
            frameUrl: 'kartoteka.html',
            readySelector: '#ka-user-filter'
        },
        {
            route: 'zlecenia',
            frameUrl: 'zlecenia.html',
            readySelector: '#zlecenia-search-input'
        },
        {
            route: 'cennik?tab=studnie',
            frameUrl: 'cennik.html',
            readySelector: '#cennik-frame-studnie'
        }
    ];

    for (const module of remainingModules) {
        test(`${module.route} ma 0 naruszeń axe critical/serious w stanie początkowym`, async ({
            page
        }) => {
            const login = await page.request.post('/api/auth/login', {
                data: {
                    username: 'admin',
                    password: process.env.TEST_ADMIN_PASSWORD || 'anim123456'
                }
            });
            expect(login.ok(), `login failed: ${login.status()}`).toBe(true);

            await page.goto(`/app.html#/${module.route}`);
            const frame = await waitForModuleFrame(page, module.frameUrl);
            expect(frame, `brak iframe ${module.frameUrl}`).not.toBeNull();
            await frame!.locator(module.readySelector).waitFor({ timeout: 15000 });

            if (module.route.startsWith('cennik?')) {
                await expect(frame!.locator('#cennik-frame-studnie')).toBeVisible();
                await expect
                    .poll(() => page.frames().some((child) => child.url().includes('studnie.html')))
                    .toBe(true);
            }

            if (module.route === 'zlecenia') {
                await frame!.waitForFunction(
                    () => {
                        const activeFilter = document.querySelector(
                            'button[data-filter="all"].zlecenia-filter-tab.active'
                        );
                        if (!activeFilter) return false;

                        const colorProbe = document.createElement('span');
                        colorProbe.style.backgroundColor = 'var(--accent-strong)';
                        document.body.append(colorProbe);
                        const expectedBackground = getComputedStyle(colorProbe).backgroundColor;
                        colorProbe.remove();

                        return (
                            getComputedStyle(activeFilter).backgroundColor === expectedBackground
                        );
                    },
                    null,
                    { timeout: 10000 }
                );
            }

            await prepareAxeFrameBackgrounds(page);
            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .exclude('#toast-container')
                .analyze();
            const serious = results.violations.filter(
                (violation) => violation.impact === 'critical' || violation.impact === 'serious'
            );
            expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

            if (module.route === 'pulpit') {
                const contrastViolation = results.violations.find(
                    (violation) => violation.id === 'color-contrast'
                );
                const contrastNodes = contrastViolation?.nodes ?? [];
                expect(
                    contrastNodes.some((node) => node.html.includes('admin-user-login')),
                    'CTA dodawania użytkownika ma zachować kontrast tekstu na ciemnym tle'
                ).toBe(false);
                expect(
                    contrastNodes.some((node) =>
                        node.html.includes('Kwalifikujące nowe rekordy od ostatniego SUCCESS')
                    ),
                    'Wartość karty Nowe dane ma zachować kontrast tekstu'
                ).toBe(false);
            }

            if (module.route === 'kartoteka') {
                const search = frame!.locator('#ka-local-search-input');
                await search.fill(`brak-wynikow-${Date.now()}`);
                await expect(frame!.locator('#ka-offers-list')).toContainText(
                    'Brak ofert pasujących do filtrów.',
                    { timeout: 10000 }
                );
                await expectNoSeriousAxeViolations(page);
            }
        });
    }

    test('AI dashboard nie powoduje poziomego overflow przy 320 px', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 844 });
        const login = await page.request.post('/api/auth/login', {
            data: {
                username: 'admin',
                password: process.env.TEST_ADMIN_PASSWORD || 'anim123456'
            }
        });
        expect(login.ok(), `login failed: ${login.status()}`).toBe(true);

        await page.goto('/app.html#/pulpit');
        const frame = await waitForModuleFrame(page, 'index.html?host=pulpit');
        expect(frame, 'brak iframe pulpitu').not.toBeNull();
        await frame!.locator('#ai-ml-status .ai-ml-refresh-btn').waitFor({ timeout: 15000 });

        const overflow = await frame!.locator('#ai-dashboard-content').evaluate((content) => ({
            clientWidth: content.clientWidth,
            scrollWidth: content.scrollWidth
        }));
        expect(
            overflow.scrollWidth - overflow.clientWidth,
            JSON.stringify(overflow, null, 2)
        ).toBeLessThanOrEqual(1);
    });

    test('Pulpit użytkownika bez ofert ma dostępny stan pustej kolejki', async ({ page }) => {
        const adminPassword = process.env.TEST_ADMIN_PASSWORD;
        if (!adminPassword) throw new Error('TEST_ADMIN_PASSWORD jest wymagane.');

        const origin = new URL(E2E_BASE).origin;
        const adminLogin = await page.request.post('/api/auth/login', {
            headers: { Origin: origin },
            data: { username: 'admin', password: adminPassword }
        });
        expect(adminLogin.ok(), `admin login failed: ${adminLogin.status()}`).toBe(true);

        const username = `a11y-user-${Date.now()}`;
        const userPassword = 'A11yBrowserTest123!';
        const registration = await page.request.post('/api/auth/register', {
            headers: { Origin: origin },
            data: { username, password: userPassword, role: 'user' }
        });
        expect(registration.ok(), `user registration failed: ${registration.status()}`).toBe(true);

        const userLogin = await page.request.post('/api/auth/login', {
            headers: { Origin: origin },
            data: { username, password: userPassword }
        });
        expect(userLogin.ok(), `user login failed: ${userLogin.status()}`).toBe(true);

        await page.goto('/app.html#/pulpit');
        const frame = page.frameLocator('#spa-iframe-pulpit');
        await expect(frame.locator('#followup-panel')).toBeVisible({ timeout: 15000 });
        await expect(frame.locator('#care-queue-list')).toBeVisible();
        await expectNoSeriousAxeViolations(page);
    });

    test('nawigacja modułów jest osiągalna klawiaturą z widocznym focusem', async ({ page }) => {
        const login = await page.request.post('/api/auth/login', {
            data: {
                username: 'admin',
                password: process.env.TEST_ADMIN_PASSWORD || 'anim123456'
            }
        });
        expect(login.ok(), `login failed: ${login.status()}`).toBe(true);

        await page.goto('/app.html#/pulpit');
        const pulpitLink = page.getByRole('link', { name: 'Pulpit' });
        const studnieLink = page.getByRole('link', { name: 'Studnie' });
        await expect(pulpitLink).toBeVisible();
        await expect(studnieLink).toBeVisible();

        await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('spa-main');
        await pulpitLink.focus();
        await expect
            .poll(() => page.evaluate(() => document.activeElement?.id))
            .toBe('spa-app-pulpit');

        await page.keyboard.press('Tab');

        const nextFocusedId = await page.evaluate(() => document.activeElement?.id);
        expect(nextFocusedId).toBe('spa-app-studnie');
        const focusStyle = await studnieLink.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                isKeyboardFocused: element.matches(':focus-visible'),
                outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth
            };
        });
        expect(focusStyle).toEqual({
            isKeyboardFocused: true,
            outlineStyle: 'solid',
            outlineWidth: '2px'
        });
    });
});
