import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../src/routes/auth';
import prisma from '../src/prismaClient';
import bcrypt from 'bcryptjs';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn()
        },
        sessions: {
            create: jest.fn(),
            delete: jest.fn()
        }
    }
}));

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn()
}));

jest.mock('../src/middleware/auth', () => {
    const actual = jest.requireActual('../src/middleware/auth');
    return {
        ...actual,
        createSession: jest.fn().mockResolvedValue('test-token'),
        deleteSession: jest.fn().mockResolvedValue(undefined),
        requireAuth: (req: any, _res: any, next: any) => {
            if (req.headers['x-test-user']) {
                req.user = JSON.parse(req.headers['x-test-user'] as string);
                next();
            } else {
                const token = req.headers['x-auth-token'] || req.cookies?.authToken;
                if (token) {
                    req.user = { id: 'user-id', username: 'admin', role: 'admin' };
                    next();
                } else {
                    _res.status(401).json({ error: 'Unauthorized' });
                }
            }
        },
        requireAdmin: (req: any, res: any, next: any) => {
            if (req.user?.role === 'admin') next();
            else res.status(403).json({ error: 'Forbidden' });
        }
    };
});

describe('Auth Routes - Z-70', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/auth', authRoutes);
    });

    describe('POST /api/auth/login', () => {
        it('powinien zalogować i ustawić httpOnly cookie', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'u1',
                username: 'admin',
                password: 'hashed',
                role: 'admin',
                firstName: 'A',
                lastName: 'B',
                subUsers: '[]'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'pass' });

            expect(res.statusCode).toBe(200);
            expect(res.body.token).toBe('test-token');
            expect(res.headers['set-cookie']).toBeDefined();
            const cookie = res.headers['set-cookie'][0];
            expect(cookie).toMatch(/HttpOnly/i);
            expect(cookie).toMatch(/SameSite=Lax/i);
        });

        it('powinien zwrócić 401 dla błędnego hasła', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'u1',
                username: 'admin',
                password: 'hashed',
                role: 'admin',
                subUsers: '[]'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'wrong' });
            expect(res.statusCode).toBe(401);
        });

        it('powinien zwrócić 401 gdy user nie istnieje', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nouser', password: 'xxxx' });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('powinien wyczyścić cookie', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Cookie', 'authToken=test-token');
            expect(res.statusCode).toBe(200);
            expect(res.headers['set-cookie']).toBeDefined();
        });
    });

    describe('GET /api/auth/me', () => {
        it('powinien zwrócić user gdy autoryzowany', async () => {
            const res = await request(app).get('/api/auth/me').set('x-auth-token', 'test-token');
            expect(res.statusCode).toBe(200);
            expect(res.body.user).toBeDefined();
        });

        it('powinien zwrócić 401 gdy brak tokenu', async () => {
            const res = await request(app).get('/api/auth/me');
            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('powinien zwrócić 401 dla błędnego starego hasła', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'user-id',
                username: 'admin',
                password: 'hashed'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('x-test-user', JSON.stringify({ id: 'user-id', role: 'admin' }))
                .send({ oldPassword: 'wrongPass', newPassword: 'NewPass123!' });

            expect(res.statusCode).toBe(401);
        });

        it('powinien zmienić hasło gdy stare poprawne', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'user-id',
                username: 'admin',
                password: 'hashed'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');
            (prisma.users.update as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('x-test-user', JSON.stringify({ id: 'user-id', role: 'admin' }))
                .send({ oldPassword: 'oldPass', newPassword: 'NewPass123!' });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });

    describe('isCookieSecure', () => {
        it('powinien ustawić secure gdy COOKIE_SECURE true', async () => {
            process.env.COOKIE_SECURE = 'true';
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'u1',
                username: 'admin',
                password: 'hashed',
                role: 'admin',
                subUsers: '[]'
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'pass' });
            expect(res.headers['set-cookie'][0]).toMatch(/Secure/i);
            delete process.env.COOKIE_SECURE;
        });
    });
});
