import express from 'express';
import request from 'supertest';
import { handleCspReport } from '../src/mountRoutes';
import { createRateLimiter } from '../src/middleware/rateLimiter';

function buildApp(limiter?: express.RequestHandler) {
    const app = express();
    const mw = limiter ?? ((_req, _res, next) => next());
    app.post(
        '/api/csp-report',
        mw,
        express.text({ type: 'application/csp-report', limit: '10kb' }),
        handleCspReport
    );
    return app;
}

describe('POST /api/csp-report', () => {
    it('przyjmuje raport i odpowiada 204', async () => {
        const res = await request(buildApp())
            .post('/api/csp-report')
            .set('Content-Type', 'application/csp-report')
            .send('{"violated-directive":"script-src"}');
        expect(res.statusCode).toBe(204);
    });

    it('odrzuca body ponad limit (413)', async () => {
        const res = await request(buildApp())
            .post('/api/csp-report')
            .set('Content-Type', 'application/csp-report')
            .send('x'.repeat(20 * 1024));
        expect(res.statusCode).toBe(413);
    });

    it('burst ponad limit → 429 z retryAfter', async () => {
        const app = buildApp(createRateLimiter({ windowMs: 60000, maxHits: 2 }));
        const agent = request(app);
        const opts = {
            'Content-Type': 'application/csp-report'
        };
        expect((await agent.post('/api/csp-report').set(opts).send('a')).statusCode).toBe(204);
        expect((await agent.post('/api/csp-report').set(opts).send('b')).statusCode).toBe(204);
        const flooded = await agent.post('/api/csp-report').set(opts).send('c');
        expect(flooded.statusCode).toBe(429);
        expect(typeof flooded.body.retryAfter).toBe('number');
        expect(flooded.body.retryAfter).toBeGreaterThan(0);
    });
});
