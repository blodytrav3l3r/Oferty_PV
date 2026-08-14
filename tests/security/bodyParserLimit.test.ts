import express from 'express';
import request from 'supertest';

describe('body-parser JSON limit (regresja CWE-1123977)', () => {
    const LIMIT = '1kb';

    function buildApp() {
        const app = express();
        app.use(express.json({ limit: LIMIT }));
        app.post('/api/echo', (req, res) => {
            res.status(200).json({ received: req.body });
        });
        return app;
    }

    it('payload ponizej limitu -> 200', async () => {
        const res = await request(buildApp())
            .post('/api/echo')
            .send({ data: 'x'.repeat(100) });
        expect(res.status).toBe(200);
    });

    it('payload powyzej limitu -> 413', async () => {
        const res = await request(buildApp())
            .post('/api/echo')
            .send({ data: 'x'.repeat(2 * 1024) });
        expect(res.status).toBe(413);
    });

    it('duzy payload bez limitu -> 200 (kontrola, ze 413 wynika z limitu, nie z bledu)', async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/echo', (req, res) => {
            res.status(200).json({ received: req.body });
        });
        const res = await request(app)
            .post('/api/echo')
            .send({ data: 'x'.repeat(2 * 1024) });
        expect(res.status).toBe(200);
    });
});
