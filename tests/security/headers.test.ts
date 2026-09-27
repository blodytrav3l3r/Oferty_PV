import request from 'supertest';
import app from '../../src/app';

/**
 * P0.6: kontrakt nagłówków — realne okablowanie z src/app.ts.
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy ogranicza wyciek
 * - Permissions-Policy zamyka sensory
 * - CSP enforce zawiera script-src bez zezwoleń obcych domen
 * - Report-Only z nonce (Faza 1 planu CSP)
 */
describe('P0.6 headers matrix', () => {
    it('nagłówki bezpieczeństwa na odpowiedzi HTML', async () => {
        const res = await request(app).get('/');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(res.headers['permissions-policy']).toContain('camera=()');
    });

    it('CSP enforce bez obcych źródeł skryptów', async () => {
        const res = await request(app).get('/');
        const csp = String(res.headers['content-security-policy'] || '');
        expect(csp).toContain("script-src 'self'");
        expect(csp).not.toMatch(/https?:\/\/(?!self)/);
        expect(csp).toContain("frame-ancestors 'self'");
    });

    it('CSP Report-Only z nonce per request', async () => {
        const a = await request(app).get('/');
        const b = await request(app).get('/');
        const ra = String(a.headers['content-security-policy-report-only'] || '');
        const rb = String(b.headers['content-security-policy-report-only'] || '');
        expect(ra).toMatch(/nonce-[A-Za-z0-9+/=]+/);
        expect(rb).toMatch(/nonce-[A-Za-z0-9+/=]+/);
        expect(ra).not.toBe(rb);
    });
});
