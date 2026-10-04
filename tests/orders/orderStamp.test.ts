/**
 * Pieczątka cennika w odpowiedziach zamówień (kolumna, nie blob — P0-D2).
 * GET detail + GET lista: rury i studnie. Wzorzec mocków:
 * tests/orders/ruryOrders.crud.test.ts (inline, bez referencji zewnętrznych).
 */
import request from 'supertest';
import express from 'express';
import ruryOrdersRouter from '../../src/routes/orders/ruryOrders.crud';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: 'user', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: { findUnique: jest.fn() },
        orders_rury_rel: { findUnique: jest.fn() },
        orders_studnie_rel: { findUnique: jest.fn() },
        $queryRaw: jest.fn()
    },
    Prisma: {
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-rury', ruryOrdersRouter);
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    mockUser.role = 'user';
    mockUser.subUsers = [];
});

const RURY_ROW = {
    id: 'or-1',
    userId: 'user-id',
    offerId: 'off-1',
    status: 'new',
    createdAt: '2026-10-01',
    version: 1,
    pricelistVersionId: 'v9',
    data: JSON.stringify({ clientName: 'T' })
};

const STUDNIE_ROW = {
    id: 'os-1',
    userId: 'user-id',
    offerStudnieId: 'off-1',
    status: 'new',
    createdAt: '2026-10-01',
    version: 1,
    pricelistVersionId: 'v8',
    data: JSON.stringify({ clientName: 'T' })
};

describe('order stamp (rury)', () => {
    it('GET /:id zwraca stamp z kolumny (blob bez stamp)', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue(RURY_ROW);
        const res = await request(createApp()).get('/api/orders-rury/or-1');
        expect(res.status).toBe(200);
        expect(res.body.data.pricelistVersionId).toBe('v9');
    });

    it('kolumna wygrywa z blobem przy rozjeździe', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            ...RURY_ROW,
            data: JSON.stringify({ pricelistVersionId: 'v1' })
        });
        const res = await request(createApp()).get('/api/orders-rury/or-1');
        expect(res.body.data.pricelistVersionId).toBe('v9');
    });

    it('GET / zwraca stamp na liście', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...RURY_ROW, data: '{}' }]);
        const res = await request(createApp()).get('/api/orders-rury/');
        expect(res.status).toBe(200);
        expect(res.body.data[0].pricelistVersionId).toBe('v9');
    });
});

describe('order stamp (studnie)', () => {
    it('GET /:id zwraca stamp z kolumny', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(STUDNIE_ROW);
        const res = await request(createApp()).get('/api/orders-studnie/os-1');
        expect(res.status).toBe(200);
        expect(res.body.data.pricelistVersionId).toBe('v8');
    });

    it('GET / zwraca stamp na liście', async () => {
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...STUDNIE_ROW, data: '{}' }]);
        const res = await request(createApp()).get('/api/orders-studnie/');
        expect(res.status).toBe(200);
        expect(res.body.data[0].pricelistVersionId).toBe('v8');
    });
});
