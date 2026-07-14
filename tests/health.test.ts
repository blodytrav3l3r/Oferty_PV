import request from 'supertest';
import express from 'express';

describe('Sprawdzanie stanu zdrowia (Health Check)', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version
            });
        });
    });

    describe('GET /health', () => {
        it('powinien zwrócić status zdrowia (health status)', async () => {
            const res = await request(app).get('/health');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('memory');
        });
    });
});
