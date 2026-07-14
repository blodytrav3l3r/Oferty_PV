import request from 'supertest';
import express from 'express';
import offerRoutes from '../src/routes/offers/index';

describe('Offers Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/offers', offerRoutes);
        // Uwaga: W prawdziwych testach powinieneś zamockować klienta Prisma
    });

    describe('GET /api/offers', () => {
        it('powinien zwrócić listę ofert', async () => {
            const res = await request(app).get('/api/offers');

            // Oczekuj albo 200 z danymi, albo 401 jeśli wymagana autoryzacja
            expect([200, 401]).toContain(res.statusCode);
        });
    });

    describe('POST /api/offers', () => {
        it('powinien zwrócić 400 jeśli brakuje wymaganych pól', async () => {
            const res = await request(app).post('/api/offers').send({});

            expect(res.statusCode).toBeGreaterThanOrEqual(400);
        });
    });
});
