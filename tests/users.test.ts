import request from 'supertest';
import express from 'express';
import userRoutes from '../src/routes/users';
import prisma from '../src/prismaClient';
import bcrypt from 'bcryptjs';

// Mock auth middlewares
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-id', role: 'user', subUsers: [] };
        }
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Brak uprawnień administratora' });
        }
    }
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_password')
}));

// Mock Prisma
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        order_counters: {
            findUnique: jest.fn(),
        },
        users: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        }
    }
}));

const mockUsers = [
    {
        id: 'admin-id',
        username: 'admin',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'Admin',
        phone: '123456789',
        email: 'admin@e.com',
        symbol: 'A',
        subUsers: '["user-id"]',
        orderStartNumber: 1,
        productionOrderStartNumber: 1,
        createdAt: new Date().toISOString()
    },
    {
        id: 'user-id',
        username: 'user1',
        role: 'user',
        firstName: 'User',
        lastName: 'One',
        phone: '987654321',
        email: 'user@e.com',
        symbol: 'U1',
        subUsers: '[]',
        orderStartNumber: 5,
        productionOrderStartNumber: 1,
        createdAt: new Date().toISOString()
    }
];

describe('Users Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        // For tests that need specific users
        app.use((req: any, _res: any, next) => {
            if (req.headers['x-user-role']) {
                req.user = { id: req.headers['x-user-id'], role: req.headers['x-user-role'], subUsers: req.headers['x-subusers'] ? JSON.parse(req.headers['x-subusers'] as string) : [] };
            }
            next();
        });
        app.use('/api/users', userRoutes);
    });

    describe('GET /api/users', () => {
        it('powinien zwrócić listę użytkowników dla admina oraz wyliczyć nextOrderNumber', async () => {
            (prisma.users.findMany as jest.Mock).mockResolvedValue(mockUsers);
            (prisma.order_counters.findUnique as jest.Mock).mockResolvedValueOnce({ lastNumber: 2 }); // Admin counter
            (prisma.order_counters.findUnique as jest.Mock).mockRejectedValueOnce(new Error('no counter')); // User counter fallback

            const res = await request(app)
                .get('/api/users')
                .set('x-user-id', 'admin-id')
                .set('x-user-role', 'admin');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].nextOrderNumber).toContain('A/000003');
            expect(res.body.data[1].nextOrderNumber).toContain('U1/000005');
        });

        it('powinien odrzucić dostęp dla zwykłego usera', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('x-user-id', 'user-id')
                .set('x-user-role', 'user');

            expect(res.statusCode).toBe(403);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('powinien zaktualizować dane usera dla admina', async () => {
            (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(mockUsers[1]); // Find existing
            (prisma.users.update as jest.Mock).mockResolvedValueOnce({});

            const res = await request(app)
                .put('/api/users/user-id')
                .set('x-user-id', 'admin-id')
                .set('x-user-role', 'admin')
                .send({
                    firstName: 'NewName',
                    password: 'newpassword',
                    subUsers: ['some-id']
                });

            expect(res.statusCode).toBe(200);
            expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
            expect(prisma.users.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'user-id' },
                data: expect.objectContaining({
                    firstName: 'NewName',
                    subUsers: '["some-id"]'
                })
            }));
        });

        it('powinien zwrócić 409 jeśli username istnieje', async () => {
            (prisma.users.findUnique as jest.Mock)
                .mockResolvedValueOnce(mockUsers[1]) // user
                .mockResolvedValueOnce(mockUsers[0]); // existing username conflict

            const res = await request(app)
                .put('/api/users/user-id')
                .set('x-user-role', 'admin')
                .send({ username: 'admin' });

            expect(res.statusCode).toBe(409);
        });

        it('powinien zwrócić 400 dla nieprawidłowych danych (walidacja Zod)', async () => {
            const res = await request(app)
                .put('/api/users/user-id')
                .set('x-user-role', 'admin')
                .send({ email: 'invalid-email-format' });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('nie powinien pozwolić usunąć samego siebie', async () => {
            const res = await request(app)
                .delete('/api/users/admin-id')
                .set('x-user-id', 'admin-id')
                .set('x-user-role', 'admin');

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Nie możesz usunąć siebie');
        });

        it('powinien usunąć usera', async () => {
            (prisma.users.delete as jest.Mock).mockResolvedValueOnce({});
            const res = await request(app)
                .delete('/api/users/user-id')
                .set('x-user-id', 'admin-id')
                .set('x-user-role', 'admin');

            expect(res.statusCode).toBe(200);
            expect(prisma.users.delete).toHaveBeenCalledWith({ where: { id: 'user-id' } });
        });
    });

    describe('GET /api/users-for-assignment', () => {
        it('powinien zwrócić wszystkich userów dla admina', async () => {
            (prisma.users.findMany as jest.Mock).mockResolvedValue(mockUsers);
            const res = await request(app)
                .get('/api/users/for-assignment')
                .set('x-user-role', 'admin');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('powinien zwrócić tylko przypisanych i siebie, dla powiązanego subUsera', async () => {
            (prisma.users.findMany as jest.Mock).mockResolvedValue(mockUsers);
            const res = await request(app)
                .get('/api/users/for-assignment')
                .set('x-user-id', 'admin-id')
                .set('x-user-role', 'user')
                .set('x-subusers', '["user-id"]');

            expect(res.statusCode).toBe(200);
            expect(res.body.data).toHaveLength(2); // self (admin-id) and subUser (user-id)
        });
    });
});
