import express from 'express';
import request from 'supertest';
import { securityHeaders, httpsRedirect } from '../src/middleware/security';

// ─── securityHeaders ────────────────────────────────────────────────

describe('securityHeaders', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(securityHeaders);
        app.get('/test', (_req, res) => res.json({ ok: true }));
    });

    it('should set X-Content-Type-Options header', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should set X-XSS-Protection header', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set Referrer-Policy header', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy header', async () => {
        const res = await request(app).get('/test');
        expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    });
});

// ─── httpsRedirect ──────────────────────────────────────────────────

describe('httpsRedirect', () => {
    it('should not redirect in development mode', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const app = express();
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });

    it('should pass through when NODE_ENV is not production', async () => {
        const originalEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;

        const app = express();
        app.use(httpsRedirect);
        app.get('/test', (_req, res) => res.json({ ok: true }));

        const res = await request(app).get('/test');
        expect(res.statusCode).toBe(200);

        process.env.NODE_ENV = originalEnv;
    });
});
