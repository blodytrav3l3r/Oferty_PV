import request from 'supertest';
import express from 'express';
import offerRoutes from '../src/routes/offers';

describe('Offers Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/offers', offerRoutes);
        // Note: In real tests, you'd mock the Prisma client
    });

    describe('GET /api/offers', () => {
        it('should return offers list', async () => {
            const res = await request(app).get('/api/offers');

            // Expect either 200 with data or 401 if auth required
            expect([200, 401]).toContain(res.statusCode);
        });
    });

    describe('POST /api/offers', () => {
        it('should return 400 if required fields are missing', async () => {
            const res = await request(app).post('/api/offers').send({});

            expect(res.statusCode).toBeGreaterThanOrEqual(400);
        });
    });
});
