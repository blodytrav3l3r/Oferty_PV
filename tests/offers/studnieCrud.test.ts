import request from 'supertest';
import express from 'express';
import studnieRoutes from '../../src/routes/offers/index';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
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

jest.mock('../../src/utils/fts5Sync', () => ({
    syncFts5: jest.fn().mockResolvedValue(undefined),
    removeFts5: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: {
        invalidateAll: jest.fn()
    }
}));

jest.mock('../../src/utils/productionOrderGuard', () => ({
    hasProductionOrdersForOffer: jest.fn().mockResolvedValue(false)
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_studnie_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
            delete: jest.fn()
        },
        $queryRaw: jest.fn(),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1),
        $transaction: jest.fn()
    },
    Prisma: {
        raw: (s: string): string => s,
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

const mockOfferStudnie = {
    id: 's-1',
    userId: 'user-id',
    offer_number: 'S1',
    state: 'draft',
    clientName: 'ACME',
    investName: null,
    clientNip: null,
    clientNumber: null,
    history: '[]',
    data: JSON.stringify({ clientName: 'ACME' }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', studnieRoutes);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
    (prisma.$transaction as jest.Mock).mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        if (Array.isArray(arg)) return Promise.all(arg);
        return arg;
    });
});

describe('Studnie Offers CRUD — autoryzacja (IDOR)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    describe('POST /api/offers/studnie (upsert studni)', () => {
        it('tworzy nową ofertę studni i wywołuje create + syncFts5', async () => {
            (prisma.offers_studnie_rel.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.offers_studnie_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-new', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(prisma.offers_studnie_rel.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ userId: 'user-id', state: 'draft', version: 1 })
            });
        });

        it('stale version → 409 VERSION_CONFLICT (P0-D2)', async () => {
            (prisma.offers_studnie_rel.findMany as jest.Mock).mockResolvedValue([
                { ...mockOfferStudnie, version: 2 }
            ]);
            (prisma.offers_studnie_rel.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-1', clientName: 'ACME', status: 'draft', version: 1 }] });

            expect(res.statusCode).toBe(409);
            expect(res.body.code).toBe('VERSION_CONFLICT');
            expect(res.body.serverVersion).toBe(2);
        });

        it('zwraca 403 przy edycji cudzej oferty studni (nie przejmuje jej)', async () => {
            (prisma.offers_studnie_rel.findMany as jest.Mock).mockResolvedValue([
                { ...mockOfferStudnie, userId: 'other-user' }
            ]);

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-1', clientName: 'HACK', status: 'draft' }] });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_studnie_rel.create).not.toHaveBeenCalled();
            expect(prisma.offers_studnie_rel.updateMany).not.toHaveBeenCalled();
        });

        it('zwraca 403 gdy user próbuje utworzyć ofertę dla innego użytkownika', async () => {
            (prisma.offers_studnie_rel.findMany as jest.Mock).mockResolvedValue([]);

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ userId: 'other-user', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_studnie_rel.create).not.toHaveBeenCalled();
            expect(prisma.offers_studnie_rel.updateMany).not.toHaveBeenCalled();
        });

        it('pro może aktualizować ofertę swojego sub-usera', async () => {
            mockUser.role = 'pro';
            mockUser.subUsers = ['sub-user'];
            (prisma.offers_studnie_rel.findMany as jest.Mock).mockResolvedValue([
                { ...mockOfferStudnie, userId: 'sub-user' }
            ]);
            (prisma.offers_studnie_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-1', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(200);
            const updateCall = (prisma.offers_studnie_rel.updateMany as jest.Mock).mock.calls[0][0];
            expect(updateCall.data.userId).toBe('sub-user');
        });
    });
});
