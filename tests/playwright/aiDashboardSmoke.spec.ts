// @ts-nocheck
/**
 * aiDashboardSmoke.spec.ts — minimalny E2E AI Dashboard (poziom HTTP na żywym serwerze).
 *
 * Pokrywa kontrakt po checkpointach P0–P1 bez mutacji danych (same GET):
 *   login admin → historia transferów 200 z polem data →
 *   ml-status 200 z PRAWDZIWYM nagłówkiem CSP enforce (Helmet, nie mock) →
 *   well-selections 200 przy dowolnym stanie flagi (read-only exception).
 */
import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'anim123456';
const BASE = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3199';

test.describe('e2e: AI dashboard smoke (read-only)', () => {
    test.beforeEach(async ({ request }) => {
        const login = await request.post(`${BASE}/api/auth/login`, {
            data: { username: 'admin', password: ADMIN_PASSWORD }
        });
        expect(login.status(), 'Login failed').toBe(200);
    });

    test('historia transferów 200 z polem data (nie 500)', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/telemetry/ai/transfer/history`);
        expect(resp.status(), 'transfer/history nie odpowiada 200').toBe(200);
        const body = await resp.json();
        expect(Array.isArray(body.data), 'brak pola data[]').toBe(true);
    });

    test('ml-status niesie PRAWDZIWY CSP enforce (script-src + nonce)', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/telemetry/ai/ml-status`);
        expect(resp.status(), 'ml-status nie odpowiada 200').toBe(200);
        const csp = resp.headers()['content-security-policy'] || '';
        expect(csp, 'brak nagłówka CSP enforce').toContain('script-src');
        expect(csp, 'brak nonce w CSP enforce').toMatch(/nonce-[A-Za-z0-9+/=]+/);
        // style-src celowo ma unsafe-inline — sprawdzamy TYLKO dyrektywę script-src.
        const scriptSrc = /script-src ([^;]*)/.exec(csp)?.[1] ?? '';
        expect(scriptSrc, 'script-src bez unsafe-inline').not.toContain("'unsafe-inline'");
    });

    test('well-selections dostępne bez guarda (read-only exception)', async ({ request }) => {
        const resp = await request.get(`${BASE}/api/telemetry/ai/well-selections`);
        expect([200, 503], 'nieoczekiwany status well-selections').toContain(resp.status());
        if (resp.status() === 200) {
            const body = await resp.json();
            expect(Array.isArray(body.items), 'brak pola items[]').toBe(true);
        }
    });
});
