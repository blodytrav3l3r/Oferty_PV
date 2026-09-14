import request from 'supertest';
import express from 'express';
import numbering from '../src/routes/orders/numbering';
import prisma from '../src/prismaClient';

// Auth jako user-B (zwykły user).
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-B', role: 'user', subUsers: [] };
        }
        next();
    }
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
        users: { findUnique: jest.fn() },
        order_counters: { findUnique: jest.fn(), upsert: jest.fn() },
        settings: { findUnique: jest.fn() },
        recycled_production_numbers: { findMany: jest.fn(), deleteMany: jest.fn() },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn()
    }
}));

describe('P0.2 numbering guard', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/numbering', numbering);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('403 przy claim cudzego numeru (user-B vs user-A)', async () => {
        const res = await request(app).post('/api/numbering/claim-number/user-A').send({});
        expect(res.statusCode).toBe(403);
        expect(prisma.order_counters.upsert).not.toHaveBeenCalled();
    });

    it('403 przy podglądzie cudzego next-number', async () => {
        const res = await request(app).get('/api/numbering/next-number/user-A');
        expect(res.statusCode).toBe(403);
        expect(prisma.users.findUnique).not.toHaveBeenCalled();
    });

    it('403 przy claim-production-number cudzego usera', async () => {
        const res = await request(app)
            .post('/api/numbering/claim-production-number/user-A')
            .send({});
        expect(res.statusCode).toBe(403);
    });

    it('403 przy hurtowym claim cudzego usera (licznik nie drgnie)', async () => {
        const res = await request(app)
            .post('/api/numbering/claim-production-numbers/user-A')
            .send({ count: 5 });
        expect(res.statusCode).toBe(403);
    });

    it('200 przy claim własnego numeru (brak drainu self)', async () => {
        (prisma.users.findUnique as jest.Mock).mockResolvedValue({ symbol: 'BB' });
        (prisma.order_counters.upsert as jest.Mock).mockResolvedValue({ lastNumber: 7 });
        const res = await request(app).post('/api/numbering/claim-number/user-B').send({});
        expect(res.statusCode).toBe(200);
        expect(res.body.nextSeq).toBe(7);
        expect(prisma.order_counters.upsert).toHaveBeenCalledTimes(1);
    });
});
