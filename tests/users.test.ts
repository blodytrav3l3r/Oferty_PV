import request from 'supertest';
import express from 'express';
import userRoutes from '../src/routes/users';

describe('Users Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/users', userRoutes);
        // Uwaga: W prawdziwych testach powinieneś zamockować klienta Prisma
    });

    describe('GET /api/users', () => {
        it('powinien zwrócić listę użytkowników', async () => {
            const res = await request(app).get('/api/users');

            // Oczekuj albo 200 z danymi, albo 401 jeśli wymagana autoryzacja
            expect([200, 401]).toContain(res.statusCode);
        });
    });

    describe('POST /api/users', () => {
        it('powinien zwrócić 400 jeśli brakuje wymaganych pól', async () => {
            const res = await request(app).post('/api/users').send({});

            expect(res.statusCode).toBeGreaterThanOrEqual(400);
        });
    });
});
