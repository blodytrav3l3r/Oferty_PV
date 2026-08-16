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
            delete: jest.fn()
        },
        $queryRaw: jest.fn(),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn(),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
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
});

describe('Studnie Offers CRUD — autoryzacja (IDOR)', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    describe('POST /api/offers/studnie (upsert studni)', () => {
        it('tworzy nową ofertę studni i wywołuje upsert + syncFts5', async () => {
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_studnie_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-new', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(prisma.offers_studnie_rel.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 's-new' },
                    create: expect.objectContaining({ userId: 'user-id', state: 'draft' })
                })
            );
        });

        it('zwraca 403 przy edycji cudzej oferty studni (nie przejmuje jej)', async () => {
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockOfferStudnie,
                userId: 'other-user'
            });

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-1', clientName: 'HACK', status: 'draft' }] });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_studnie_rel.upsert).not.toHaveBeenCalled();
        });

        it('zwraca 403 gdy user próbuje utworzyć ofertę dla innego użytkownika', async () => {
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ userId: 'other-user', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_studnie_rel.upsert).not.toHaveBeenCalled();
        });

        it('pro może aktualizować ofertę swojego sub-usera', async () => {
            mockUser.role = 'pro';
            mockUser.subUsers = ['sub-user'];
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockOfferStudnie,
                userId: 'sub-user'
            });
            (prisma.offers_studnie_rel.upsert as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers/studnie')
                .send({ data: [{ id: 's-1', clientName: 'ACME', status: 'draft' }] });

            expect(res.statusCode).toBe(200);
            const upsertCall = (prisma.offers_studnie_rel.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertCall.update.userId).toBe('sub-user');
        });
    });
});
