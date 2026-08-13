import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';

describe('Trasy autoryzacji', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        // Uwaga: W prawdziwych testach należy użyć mocka klienta Prisma
        // Na razie testujemy podstawową walidację
    });

    describe('POST /api/auth/login', () => {
        it('powinien zwrócić 400, jeśli brakuje loginu lub hasła', async () => {
            const res = await request(app).post('/api/auth/login').send({ username: 'test' });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('powinien zwrócić 400, jeśli brakuje zarówno loginu, jak i hasła', async () => {
            const res = await request(app).post('/api/auth/login').send({});

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('powinien zablokować logowanie po przekroczeniu limitu prób (LOGIN_LIMITER)', async () => {
            let status429 = false;
            for (let i = 0; i < 20; i++) {
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({ username: 'test', password: 'test' });
                if (res.statusCode === 429) {
                    status429 = true;
                    break;
                }
            }
            expect(status429).toBe(true);
        }, 15000);
    });
});
