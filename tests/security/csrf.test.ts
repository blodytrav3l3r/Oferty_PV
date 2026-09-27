import express from 'express';
import request from 'supertest';
import { csrfProtection } from '../../src/middleware/csrf';

/**
 * P0.1: same-origin CSRF — kontrakt mutacji POST/PUT/PATCH/DELETE.
 * Supertest losuje port, więc Host ustawiamy jawnie (supertest nadpisuje
 * nagłówek Host przez .set — determinystyczny expected).
 * 1. Origin zgodny z Host -> pass
 * 2. Zły Origin -> 403
 * 3. Brak Origin + dobry Referer -> pass
 * 4. Brak Origin + zły Referer -> 403
 * 5. Brak obu -> 403
 * 6. Origin dobry + zły Referer -> pass (Origin wygrywa)
 * 7. GET bez nagłówków -> untouched
 */
const HOST = 'app.test';

function buildApp() {
    const app = express();
    app.use(csrfProtection);
    app.post('/api/mut', (_req, res) => res.status(200).json({ ok: true }));
    app.put('/api/mut', (_req, res) => res.status(200).json({ ok: true }));
    app.delete('/api/mut', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/mut', (_req, res) => res.status(200).json({ ok: true }));
    app.post('/api/csp-report', (_req, res) => res.status(204).end());
    return app;
}

describe('P0.1 CSRF same-origin', () => {
    it('same-origin Origin -> 2xx', async () => {
        const res = await request(buildApp())
            .post('/api/mut')
            .set('Host', HOST)
            .set('Origin', `http://${HOST}`);
        expect(res.status).toBe(200);
    });

    it('wrong Origin -> 403', async () => {
        const res = await request(buildApp())
            .post('/api/mut')
            .set('Host', HOST)
            .set('Origin', 'https://evil.test');
        expect(res.status).toBe(403);
    });

    it('missing Origin + valid Referer -> 2xx', async () => {
        const res = await request(buildApp())
            .post('/api/mut')
            .set('Host', HOST)
            .set('Referer', `http://${HOST}/studnie.html`);
        expect(res.status).toBe(200);
    });

    it('missing Origin + wrong Referer -> 403', async () => {
        const res = await request(buildApp())
            .post('/api/mut')
            .set('Host', HOST)
            .set('Referer', 'https://evil.test/x');
        expect(res.status).toBe(403);
    });

    it('missing both -> 403', async () => {
        const res = await request(buildApp()).post('/api/mut').set('Host', HOST);
        expect(res.status).toBe(403);
    });

    it('good Origin + wrong Referer -> 2xx (Origin wygrywa)', async () => {
        const res = await request(buildApp())
            .post('/api/mut')
            .set('Host', HOST)
            .set('Origin', `http://${HOST}`)
            .set('Referer', 'https://evil.test/x');
        expect(res.status).toBe(200);
    });

    it('PUT/DELETE zły Origin lub brak -> 403', async () => {
        const app = buildApp();
        expect(
            (
                await request(app)
                    .put('/api/mut')
                    .set('Host', HOST)
                    .set('Origin', 'https://evil.test')
            ).status
        ).toBe(403);
        expect((await request(app).delete('/api/mut').set('Host', HOST)).status).toBe(403);
    });

    it('GET bez nagłówków -> untouched', async () => {
        const res = await request(buildApp()).get('/api/mut').set('Host', HOST);
        expect(res.status).toBe(200);
    });

    it('/api/csp-report bez nagłówków -> untouched (204)', async () => {
        const res = await request(buildApp()).post('/api/csp-report').set('Host', HOST).send('x');
        expect(res.status).toBe(204);
    });
});
