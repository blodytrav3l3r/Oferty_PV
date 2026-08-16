import request from 'supertest';
import express from 'express';
import ruryOrdersRouter from '../../src/routes/orders/ruryOrders.crud';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findUnique: jest.fn()
        },
        order_counters_rury: {
            findUnique: jest.fn(),
            upsert: jest.fn()
        },
        orders_rury_rel: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn()
        },
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn().mockResolvedValue(1),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    },
    Prisma: {
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

const mockOrder = {
    id: 'or-1',
    userId: 'user-id',
    offerId: 'off-1',
    status: 'new',
    createdAt: new Date().toISOString(),
    data: JSON.stringify({ clientName: 'Testowy klient', totalPrice: 250 })
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-rury', ruryOrdersRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

describe('Rury Orders CRUD', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        mockUser.id = 'user-id';
        mockUser.role = 'user';
        mockUser.subUsers = [];
        app = createApp();
    });

    describe('POST /claim-rury-number/:userId', () => {
        it('zwraca 403 gdy user nie ma uprawnień do cudzego numeru', async () => {
            const res = await request(app)
                .post('/api/orders-rury/claim-rury-number/other-user')
                .set('x-user-id', 'user-id');
            expect(res.statusCode).toBe(403);
        });

        it('zwraca 404 gdy użytkownik nie istnieje', async () => {
            mockUser.id = 'admin-id';
            mockUser.role = 'admin';
            const app2 = createApp();
            (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app2)
                .post('/api/orders-rury/claim-rury-number/nonexistent')
                .set('x-user-id', 'admin-id');
            expect(res.statusCode).toBe(404);
        });

        it('zwraca sformatowany numer i inkrementuje licznik', async () => {
            mockUser.id = 'admin-id';
            mockUser.role = 'admin';
            const app2 = createApp();
            (prisma.users.findUnique as jest.Mock).mockResolvedValue({
                id: 'user-id',
                symbol: 'AB'
            });
            (prisma.order_counters_rury.findUnique as jest.Mock).mockResolvedValue({
                lastNumber: 4
            });
            (prisma.order_counters_rury.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app2)
                .post('/api/orders-rury/claim-rury-number/user-id')
                .set('x-user-id', 'admin-id');

            expect(res.statusCode).toBe(200);
            const year = new Date().getFullYear();
            expect(res.body.number).toBe(`AB/ZR/000005/${year}`);
            expect(res.body.nextSeq).toBe(5);
            expect(prisma.order_counters_rury.upsert).toHaveBeenCalled();
        });
    });

    describe('GET /:id', () => {
        it('zwraca 200 i pełne zamówienie dla właściciela', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app).get('/api/orders-rury/or-1');
            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe('or-1');
            expect(res.body.data.clientName).toBe('Testowy klient');
            expect(res.body.data.totalPrice).toBe(250);
        });

        it('zwraca 404 dla cudzego zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockOrder,
                userId: 'other-user'
            });

            const res = await request(app).get('/api/orders-rury/or-1');
            expect(res.statusCode).toBe(404);
        });

        it('zwraca 404 dla nieistniejącego zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(null);
            const res = await request(app).get('/api/orders-rury/nope');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /', () => {
        it('tworzy nowe zamówienie (upsert create)', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.orders_rury_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .put('/api/orders-rury')
                .set('x-user-id', 'user-id')
                .send({
                    data: [
                        {
                            id: 'or-new',
                            offerId: 'off-1',
                            status: 'new',
                            clientName: 'Nowy klient'
                        }
                    ]
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(prisma.orders_rury_rel.upsert).toHaveBeenCalled();
        });

        it('aktualizuje istniejące zamówienie właściciela', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'user-id',
                data: JSON.stringify({ clientName: 'Stary' })
            });
            (prisma.orders_rury_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .put('/api/orders-rury')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 'or-1', status: 'accepted', clientName: 'Nowy' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('zwraca 403 przy edycji cudzego zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'other-user',
                data: '{}'
            });

            const res = await request(app)
                .put('/api/orders-rury')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 'or-1', status: 'accepted' }] });

            expect(res.statusCode).toBe(403);
            expect(prisma.orders_rury_rel.upsert).not.toHaveBeenCalled();
        });
    });

    describe('GET /:id', () => {
        it('zwraca 404 dla cudzego zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'other-user',
                status: 'new',
                data: '{}'
            });

            const res = await request(app).get('/api/orders-rury/or-1');

            expect(res.statusCode).toBe(404);
        });

        it('zwraca 200 dla właściciela', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'user-id',
                status: 'new',
                data: JSON.stringify({ clientName: 'X' })
            });

            const res = await request(app).get('/api/orders-rury/or-1');

            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe('or-1');
        });

        it('pro może odczytać zamówienie sub-usera (200)', async () => {
            mockUser.id = 'pro-id';
            mockUser.role = 'pro';
            mockUser.subUsers = ['sub-user'];
            const app2 = createApp();
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'sub-user',
                status: 'new',
                data: JSON.stringify({ clientName: 'X' })
            });

            const res = await request(app2).get('/api/orders-rury/or-1');

            expect(res.statusCode).toBe(200);
        });

        it('pro NIE może odczytać zamówienia niepowiązanego użytkownika (404)', async () => {
            mockUser.id = 'pro-id';
            mockUser.role = 'pro';
            mockUser.subUsers = ['sub-user'];
            const app2 = createApp();
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'stranger',
                status: 'new',
                data: '{}'
            });

            const res = await request(app2).get('/api/orders-rury/or-1');

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PATCH /:id', () => {
        it('aktualizuje status zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'user-id',
                status: 'new',
                data: JSON.stringify({ clientName: 'X' })
            });
            (prisma.orders_rury_rel.update as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .patch('/api/orders-rury/or-1')
                .set('x-user-id', 'user-id')
                .send({ status: 'accepted' });

            expect(res.statusCode).toBe(200);
            expect(prisma.orders_rury_rel.update).toHaveBeenCalledWith({
                where: { id: 'or-1' },
                data: expect.objectContaining({ status: 'accepted' })
            });
        });

        it('zwraca 403 gdy user zmienia opiekuna bez roli admin', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'user-id',
                status: 'new',
                data: '{}'
            });

            const res = await request(app)
                .patch('/api/orders-rury/or-1')
                .set('x-user-id', 'user-id')
                .send({ userId: 'someone-else' });

            expect(res.statusCode).toBe(403);
            expect(prisma.orders_rury_rel.update).not.toHaveBeenCalled();
        });

        it('zwraca 404 dla cudzego zamówienia', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
                id: 'or-1',
                userId: 'other-user',
                status: 'new',
                data: '{}'
            });

            const res = await request(app)
                .patch('/api/orders-rury/or-1')
                .set('x-user-id', 'user-id')
                .send({ status: 'accepted' });

            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /:id', () => {
        it('usuwa zamówienie przez admina (raw SQL)', async () => {
            mockUser.id = 'admin-id';
            mockUser.role = 'admin';
            const app2 = createApp();
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);

            const res = await request(app2)
                .delete('/api/orders-rury/or-1')
                .set('x-user-id', 'admin-id');

            expect(res.statusCode).toBe(200);
            expect(prisma.$executeRaw).toHaveBeenCalled();
        });

        it('usuwa własne zamówienie przez zwykłego użytkownika (deleteMany)', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(mockOrder);
            (prisma.orders_rury_rel.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

            const res = await request(app)
                .delete('/api/orders-rury/or-1')
                .set('x-user-id', 'user-id');

            expect(res.statusCode).toBe(200);
            expect(prisma.orders_rury_rel.deleteMany).toHaveBeenCalled();
            expect(prisma.$executeRaw).not.toHaveBeenCalled();
        });

        it('zwraca ok nawet gdy zamówienie nie istnieje', async () => {
            (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .delete('/api/orders-rury/nope')
                .set('x-user-id', 'user-id');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });
});
