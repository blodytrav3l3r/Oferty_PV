import request from 'supertest';
import express from 'express';
import clientRoutes from '../src/routes/clients';
import prisma from '../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        clients_rel: {
            findMany: jest.fn()
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn(),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clients', clientRoutes);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

describe('Clients CRUD — wspólna baza (Wariant A, globalny dostęp)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    describe('PUT /api/clients (upsert klientów)', () => {
        it('nadpisuje własnego klienta (userId = target)', async () => {
            const txMock = {
                $queryRaw: jest.fn().mockResolvedValue([{ id: 'c-own' }]),
                $executeRaw: jest.fn().mockResolvedValue(1),
                $queryRawAll: undefined
            };
            txMock.$queryRaw = jest.fn().mockResolvedValue([{ id: 'c-own' }]);
            (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
                fn(txMock)
            );
            (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'c-own' }]);

            const res = await request(app)
                .put('/api/clients')
                .send({ data: [{ id: 'c-own', name: 'Własny klient' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('nadpisuje klienta innego użytkownika — wspólna baza (Wariant A)', async () => {
            const txMock = {
                $queryRaw: jest.fn().mockResolvedValue([{ id: 'c-other' }]),
                $executeRaw: jest.fn().mockResolvedValue(1)
            };
            (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
                fn(txMock)
            );

            const res = await request(app)
                .put('/api/clients')
                .send({ data: [{ id: 'c-other', name: 'Cudzy klient' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('tworzy nowego klienta gdy id nie istnieje', async () => {
            const txMock = {
                $queryRaw: jest
                    .fn()
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([{ id: 'c-new' }]),
                $executeRaw: jest.fn().mockResolvedValue(1)
            };
            (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
                fn(txMock)
            );

            const res = await request(app)
                .put('/api/clients')
                .send({ data: [{ name: 'Nowy klient' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });
});
