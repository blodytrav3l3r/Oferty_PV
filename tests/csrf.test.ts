import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { setCsrfCookie, csrfProtection } from '../src/middleware/csrf';

describe('CSRF Protection Middleware', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use(setCsrfCookie);
        app.use(csrfProtection);

        app.get('/api/test', (_req, res) => {
            res.json({ ok: true });
        });
        app.post('/api/test', (_req, res) => {
            res.json({ ok: true });
        });
        app.put('/api/test', (_req, res) => {
            res.json({ ok: true });
        });
        app.delete('/api/test', (_req, res) => {
            res.json({ ok: true });
        });
    });

    describe('GET — safe methods', () => {
        it('powinien przepuścić GET bez tokena CSRF', async () => {
            const res = await request(app).get('/api/test');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ ok: true });
        });

        it('powinien ustawić ciasteczko CSRF przy pierwszym żądaniu', async () => {
            const res = await request(app).get('/api/test');
            expect(res.headers['set-cookie']).toBeDefined();
            const cookies = res.headers['set-cookie'] as unknown as string[];
            const csrfCookie = cookies.find((c: string) => c.startsWith('csrf-token='));
            expect(csrfCookie).toBeDefined();
        });
    });

    describe('POST — wymaga tokena', () => {
        it('powinien zwrócić 403 gdy brak tokena CSRF', async () => {
            const res = await request(app).post('/api/test').send({ foo: 'bar' });
            expect(res.statusCode).toBe(403);
            expect(res.body).toHaveProperty('error', 'Invalid CSRF token');
        });

        it('powinien przepuścić POST z prawidłowym tokenem CSRF', async () => {
            const csrfToken = crypto.randomBytes(32).toString('hex');
            const res = await request(app)
                .post('/api/test')
                .set('Cookie', `csrf-token=${csrfToken}`)
                .set('x-csrf-token', csrfToken)
                .send({ foo: 'bar' });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ ok: true });
        });

        it('powinien zwrócić 403 gdy token CSRF się nie zgadza', async () => {
            const res = await request(app)
                .post('/api/test')
                .set('Cookie', 'csrf-token=valid-token')
                .set('x-csrf-token', 'wrong-token')
                .send({ foo: 'bar' });
            expect(res.statusCode).toBe(403);
            expect(res.body).toHaveProperty('error', 'Invalid CSRF token');
        });
    });

    describe('PUT i DELETE — wymagają tokena', () => {
        it('powinien zwrócić 403 dla PUT bez tokena', async () => {
            const res = await request(app).put('/api/test').send({ foo: 'bar' });
            expect(res.statusCode).toBe(403);
        });

        it('powinien zwrócić 403 dla DELETE bez tokena', async () => {
            const res = await request(app).delete('/api/test');
            expect(res.statusCode).toBe(403);
        });

        it('powinien przepuścić PUT z prawidłowym tokenem', async () => {
            const csrfToken = crypto.randomBytes(32).toString('hex');
            const res = await request(app)
                .put('/api/test')
                .set('Cookie', `csrf-token=${csrfToken}`)
                .set('x-csrf-token', csrfToken)
                .send({ foo: 'bar' });
            expect(res.statusCode).toBe(200);
        });

        it('powinien przepuścić DELETE z prawidłowym tokenem', async () => {
            const csrfToken = crypto.randomBytes(32).toString('hex');
            const res = await request(app)
                .delete('/api/test')
                .set('Cookie', `csrf-token=${csrfToken}`)
                .set('x-csrf-token', csrfToken);
            expect(res.statusCode).toBe(200);
        });
    });

    describe('setCsrfCookie — zarządzanie ciasteczkiem', () => {
        it('nie powinien nadpisać istniejącego ciasteczka CSRF', async () => {
            const existingToken = 'existing-csrf-token-value';
            const res = await request(app)
                .get('/api/test')
                .set('Cookie', `csrf-token=${existingToken}`);
            expect(res.statusCode).toBe(200);
            const setCookieHeader = res.headers['set-cookie'];
            expect(setCookieHeader).toBeUndefined();
        });
    });
});
