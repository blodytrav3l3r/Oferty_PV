import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import ruryOrdersRouter from '../../src/routes/orders/ruryOrders.crud';
import searchRouter from '../../src/routes/offers/search';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'admin-1', role: 'admin', subUsers: [] };

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

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: {
        get: jest.fn(() => null),
        set: jest.fn(),
        invalidateAll: jest.fn(),
        invalidateNamespace: jest.fn()
    }
}));

jest.mock('../../src/utils/roleFilter', () => ({
    buildRoleWhereConditionWithShares: jest.fn(() => '')
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $queryRaw: jest.fn()
    },
    Prisma: {
        raw: (s: string): string => s,
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', studnieOrdersRouter);
    app.use('/api/orders-rury', ruryOrdersRouter);
    app.use('/api/offers/search', searchRouter);
    return app;
}

// Regresja: badge „Zamówienia" bez wiersza przy OS/000001 — COUNT (kolumna)
// mówił 1, a ordersMap była pusta, bo stary klucz FK w blobie wskazywał inną
// ofertę niż kolumna. Kolumna to SSoT, blob to tylko fallback.
describe('FK zamówienia: kolumna wygrywa z blobem', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        mockUser.id = 'admin-1';
        mockUser.role = 'admin';
        mockUser.subUsers = [];
        app = createApp();
    });

    it('GET /api/orders-studnie: stary offerId w blobie nie przykrywa kolumny', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([
            {
                id: 'ord-1',
                userId: 'admin-1',
                offerStudnieId: 'offer_studnie_1',
                status: 'new',
                createdAt: '2026-09-01',
                version: 1,
                data: JSON.stringify({ offerId: 'stale-offer', orderNumber: 'LKZ/1' })
            }
        ]);

        const res = await request(app).get('/api/orders-studnie?ids=offer_studnie_1');

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].offerStudnieId).toBe('offer_studnie_1');
        expect(res.body.data[0].offerId).toBeUndefined();
        expect(res.body.data[0].orderNumber).toBe('LKZ/1');
    });

    it('GET /api/orders-rury: stary offerStudnieId w blobie nie przykrywa kolumny', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([
            {
                id: 'ord-2',
                userId: 'admin-1',
                offerId: 'offer_rury_1',
                status: 'new',
                createdAt: '2026-09-01',
                version: 1,
                data: JSON.stringify({ offerStudnieId: 'stale-offer', orderNumber: 'ZR/1' })
            }
        ]);

        const res = await request(app).get('/api/orders-rury?ids=offer_rury_1');

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].offerId).toBe('offer_rury_1');
        expect(res.body.data[0].offerStudnieId).toBeUndefined();
        expect(res.body.data[0].orderNumber).toBe('ZR/1');
    });

    it('GET /api/orders-studnie: pusta kolumna (legacy) — fallback z bloba zachowuje link', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([
            {
                id: 'ord-legacy',
                userId: 'admin-1',
                offerStudnieId: null,
                status: 'new',
                createdAt: '2026-09-01',
                version: 1,
                data: JSON.stringify({ offerId: 'offer_studnie_9' })
            }
        ]);

        const res = await request(app).get('/api/orders-studnie?ids=offer_studnie_9');

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].offerStudnieId).toBe('offer_studnie_9');
    });

    it('GET /api/offers/search/orders?type=studnie: kolumna wygrywa z blobem', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([
            {
                id: 'ord-3',
                userId: 'admin-1',
                offerStudnieId: 'offer_studnie_3',
                status: 'new',
                createdAt: '2026-09-01',
                data: JSON.stringify({ offerId: 'stale-offer', orderNumber: 'LKZ/3' })
            }
        ]);

        const res = await request(app).get(
            '/api/offers/search/orders?id=offer_studnie_3&type=studnie'
        );

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].offerStudnieId).toBe('offer_studnie_3');
        expect(res.body.data[0].orderNumber).toBe('LKZ/3');
    });
});
