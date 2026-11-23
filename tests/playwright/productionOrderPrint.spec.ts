// @ts-nocheck
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const E2E_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';
const ORIGIN = new URL(E2E_BASE).origin;
const FIXTURE_PREFIX = `E2E-PRINT-${Date.now()}`;

async function loginAdmin(page) {
    if (!ADMIN_PASSWORD) throw new Error('TEST_ADMIN_PASSWORD jest wymagane.');
    const response = await page.request.post('/api/auth/login', {
        headers: { Origin: ORIGIN },
        data: { username: 'admin', password: ADMIN_PASSWORD }
    });
    expect(response.ok(), `logowanie nie powiodło się: ${response.status()}`).toBe(true);
    const me = await page.request.get('/api/auth/me');
    expect(me.ok(), `auth/me nie powiodło się: ${me.status()}`).toBe(true);
    const user = (await me.json()).user;
    const range = await page.request.put(`/api/users/${encodeURIComponent(user.id)}`, {
        headers: { Origin: ORIGIN },
        data: { productionRangeFrom: 98000, productionRangeTo: 98100 }
    });
    expect(range.ok(), `ustawienie zakresu testowego nie powiodło się: ${range.status()}`).toBe(
        true
    );
    return user;
}

async function createProductionFixture(page, user, index) {
    const id = `${FIXTURE_PREFIX}-${index}`;
    const claim = await page.request.post(
        `/api/orders-studnie/claim-production-number/${encodeURIComponent(user.id)}`,
        {
            headers: { Origin: ORIGIN, 'Idempotency-Key': `${id}-number` }
        }
    );
    expect(claim.ok(), `rezerwacja numeru nie powiodła się: ${claim.status()}`).toBe(true);
    const { number } = await claim.json();
    const wellName = `sE2E${index}`;
    const record = {
        id,
        userId: user.id,
        wellId: `${FIXTURE_PREFIX}-well-${index}`,
        elementIndex: index,
        elementKey: `${FIXTURE_PREFIX}-element-${index}`,
        productionOrderNumber: number,
        productName: `Dennica testowa ${index}`,
        componentType: 'dennica',
        productCategory: 'Dennica',
        productId: `E2E-DEN-${index}`,
        dn: '1000',
        srednica: 'DN1000',
        snr: wellName,
        wellName,
        wysokosc: '750',
        glebokosc: '600',
        rzednaDna: 0,
        dnoKineta: 150,
        rodzajStudni: 'beton',
        przejscia: [
            {
                productCategory: 'PVC SN8',
                productDn: '200',
                flowType: 'wlot',
                angle: 90,
                angleGony: '100.00',
                angleExecution: 270,
                heightFromElementMm: 300,
                rzednaWlaczenia: 0.3,
                spadekKineta: 0,
                spadekMufa: 0
            }
        ],
        blindKinetaPrzejscia: [],
        etykietaElementy: [
            { ilosc: '1 szt.', indeks: `E2E-DEN-${index}`, nazwa: `Dennica testowa ${index}` }
        ],
        malowanieW: 'brak',
        malowanieZ: 'brak',
        uwagi: `${FIXTURE_PREFIX} zapisany snapshot ${index}`
    };
    const response = await page.request.post('/api/orders-studnie/production', {
        headers: { Origin: ORIGIN },
        data: record
    });
    expect(response.ok(), `zapis PZ nie powiódł się: ${response.status()}`).toBe(true);
    return { id, number, wellName, productName: record.productName };
}

test('pojedynczy i wsadowy wydruk z kartoteki drukują zapisane strony w przeglądarce', async ({
    page
}) => {
    await page.addInitScript(() => {
        window.testSilentPrint = (html, title) => {
            const printDocument = new DOMParser().parseFromString(html, 'text/html');
            window.__e2ePrintCaptures ||= [];
            window.__e2ePrintCaptures.push({
                title: printDocument.title || title,
                pageCount: printDocument.querySelectorAll('.page').length,
                pageTexts: Array.from(printDocument.querySelectorAll('.page')).map(
                    (page) => page.textContent || ''
                ),
                text: printDocument.body?.textContent || ''
            });
        };
    });
    await page.route('**/js/spa/zlecenia.js*', async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const instrumented = source
            .replace(/(^\s*)silentPrint,/m, '$1testSilentPrint,')
            .replace(/\bsilentPrint\(/g, 'testSilentPrint(');
        expect(instrumented).not.toBe(source);
        await route.fulfill({ response, body: instrumented });
    });
    const user = await loginAdmin(page);
    const fixtures = await Promise.all([
        createProductionFixture(page, user, 1),
        createProductionFixture(page, user, 2)
    ]);

    await page.goto('/app.html#/zlecenia');
    const frame = page.frameLocator('#spa-iframe-zlecenia');
    await expect(frame.locator('#zlecenia-table-body tr')).toHaveCount(2, { timeout: 20000 });
    const zleceniaFrame = page.frames().find((child) => child.url().includes('zlecenia.html'));
    expect(zleceniaFrame).toBeTruthy();
    await zleceniaFrame.evaluate(() => (window.__e2ePrintCaptures = []));
    const originalTitle = await zleceniaFrame.title();

    const firstRow = frame.locator(`#zlecenia-table-body tr:has([data-id="${fixtures[0].id}"])`);
    await firstRow.getByRole('button', { name: 'Drukuj zlecenie' }).click();
    await frame.getByRole('button', { name: 'Drukuj', exact: true }).click();
    await expect
        .poll(() => zleceniaFrame.evaluate(() => window.__e2ePrintCaptures?.length || 0), {
            timeout: 10000
        })
        .toBe(1);

    const single = await zleceniaFrame.evaluate(() => window.__e2ePrintCaptures[0]);
    expect(single.title.replace(/\D/g, '')).toContain(fixtures[0].number.replace(/\D/g, ''));
    expect(single.title).toContain(fixtures[0].wellName);
    expect(single.pageCount).toBe(1);
    expect(single.text).toContain(fixtures[0].wellName);
    expect(single.text).toContain('DN1000');
    expect(single.text).toContain('PVC SN8');
    expect(single.text).toContain('+ 300 mm');
    await expect(firstRow.locator('.print-badge-z')).toContainText('1x');

    for (const fixture of fixtures) {
        await frame.locator(`#zlecenia-table-body tr [data-id="${fixture.id}"]`).check();
    }
    await frame.locator('[data-zl="printBatchZlecenia"]').click();
    await frame.getByRole('button', { name: /Drukuj wszystkie/ }).click();
    await expect
        .poll(() => zleceniaFrame.evaluate(() => window.__e2ePrintCaptures?.length || 0), {
            timeout: 10000
        })
        .toBe(2);

    const batch = await zleceniaFrame.evaluate(() => window.__e2ePrintCaptures[1]);
    expect(batch.pageCount).toBe(2);
    for (const fixture of fixtures) expect(batch.text).toContain(fixture.wellName);
    const normalizePageText = (value) => value.replace(/\s+/g, ' ').trim();
    expect(normalizePageText(batch.pageTexts[0])).toBe(normalizePageText(single.pageTexts[0]));
    await expect(
        frame.locator(`#zlecenia-table-body tr:has([data-id="${fixtures[0].id}"]) .print-badge-z`)
    ).toContainText('2x');
    await expect(
        frame.locator(`#zlecenia-table-body tr:has([data-id="${fixtures[1].id}"]) .print-badge-z`)
    ).toContainText('1x');

    await expect
        .poll(() =>
            page
                .locator('#spa-iframe-zlecenia')
                .evaluate((element) => element.contentDocument.title)
        )
        .toBe(originalTitle);
});
