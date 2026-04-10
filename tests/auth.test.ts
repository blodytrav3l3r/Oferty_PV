import request from 'supertest';
import express from 'express';
import authRoutes from '../src/routes/auth';

describe('Auth Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        // Note: In real tests, you'd mock the Prisma client
        // For now, we test basic validation
    });

    describe('POST /api/auth/login', () => {
        it('should return 400 if username or password is missing', async () => {
            const res = await request(app).post('/api/auth/login').send({ username: 'test' });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should return 400 if both username and password are missing', async () => {
            const res = await request(app).post('/api/auth/login').send({});

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });
});
