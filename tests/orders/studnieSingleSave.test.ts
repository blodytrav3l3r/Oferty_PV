import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';
import { logAudit } from '../../src/services/auditService';

const mockedLogAudit = logAudit as unknown as jest.Mock;

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: { invalidateAll: jest.fn(), invalidateNamespace: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn()
        },
        $queryRaw: jest.fn()
    },
    Prisma: {
        empty: '',
        sql: (strings: any, ...values: any[]): string => String.raw({ raw: strings }, ...values),
        join: (values: any[]): string => values.join(', ')
    }
}));

const mockedPrisma = prisma as unknown as {
    orders_studnie_rel: {
        findUnique: jest.Mock;
        upsert: jest.Mock;
        update: jest.Mock;
    };
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('P1 HIGH — single-order save + optimistic concurrency', () => {
    test('PUT create (brak rekordu) przechodzi bez baseUpdatedAt', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue(null);
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o-new', wells: [], updatedAt: 't1' }] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
        expect(mockedPrisma.orders_studnie_rel.upsert).toHaveBeenCalledTimes(1);
    });

    test('PUT single ze zgodnym baseUpdatedAt przechodzi', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            data: JSON.stringify({ updatedAt: 'srv-t' }),
            userId: 'user-id'
        });
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o1', wells: [], updatedAt: 'srv-t' }], baseUpdatedAt: 'srv-t' });
        expect(res.status).toBe(200);
    });

    test('PUT single z niezgodnym baseUpdatedAt → 409 + serverOrder', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [{ id: 'w1' }] }),
            userId: 'user-id'
        });
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({ data: [{ id: 'o1', wells: [], updatedAt: 'old-t' }], baseUpdatedAt: 'old-t' });
        expect(res.status).toBe(409);
        expect(res.body.serverOrder.updatedAt).toBe('srv-t');
        expect(mockedPrisma.orders_studnie_rel.upsert).not.toHaveBeenCalled();
    });

    test('PATCH ze zgodnym baseUpdatedAt scala i NIE zapisuje baseUpdatedAt', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            id: 'o1',
            userId: 'user-id',
            status: 'new',
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [] })
        });
        const res = await request(createApp())
            .patch('/api/orders-studnie/o1')
            .send({ wells: [{ id: 'w1' }], updatedAt: 'new-t', baseUpdatedAt: 'srv-t' });
        expect(res.status).toBe(200);
        const savedData = JSON.parse(
            mockedPrisma.orders_studnie_rel.update.mock.calls[0][0].data.data
        );
        expect(savedData).not.toHaveProperty('baseUpdatedAt');
        expect(savedData.wells).toEqual([{ id: 'w1' }]);
    });

    test('PATCH z niezgodnym baseUpdatedAt → 409 + serverOrder', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue({
            id: 'o1',
            userId: 'user-id',
            status: 'new',
            data: JSON.stringify({ updatedAt: 'srv-t', wells: [{ id: 'w1' }] })
        });
        const res = await request(createApp())
            .patch('/api/orders-studnie/o1')
            .send({ wells: [], updatedAt: 'old-t', baseUpdatedAt: 'old-t' });
        expect(res.status).toBe(409);
        expect(res.body.serverOrder.wells).toEqual([{ id: 'w1' }]);
        expect(mockedPrisma.orders_studnie_rel.update).not.toHaveBeenCalled();
    });

    test('PUT create loguje SLIM audit (bez wells) a upsert zapisuje pełne dane', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue(null);
        const wells = [
            { id: 'w1', config: [{ productId: 'p1', quantity: 2 }] },
            { id: 'w2', config: [{ productId: 'p2', quantity: 1 }] }
        ];
        const res = await request(createApp())
            .put('/api/orders-studnie')
            .send({
                data: [
                    {
                        id: 'o-big',
                        offerId: 'offer-1',
                        offerNumber: 'OS/1',
                        orderNumber: 'SYM/ZS/1/2026',
                        clientName: 'Klient',
                        totalNetto: 100,
                        totalBrutto: 123,
                        totalWeight: 50,
                        kartaBudowy: { foo: 'bar' },
                        wells,
                        updatedAt: 't1'
                    }
                ]
            });
        expect(res.status).toBe(200);
        // dane biznesowe bez zmian — pełne wells w bazie
        const savedData = JSON.parse(
            mockedPrisma.orders_studnie_rel.upsert.mock.calls[0][0].create.data
        );
        expect(savedData.wells).toEqual(wells);
        // audit slim: brak wells, metadane + hash
        expect(mockedLogAudit).toHaveBeenCalledTimes(1);
        const auditArgs = mockedLogAudit.mock.calls[0];
        expect(auditArgs[0]).toBe('order');
        expect(auditArgs[3]).toBe('create');
        const auditData = auditArgs[4];
        expect(auditData).not.toHaveProperty('wells');
        expect(auditData).toMatchObject({
            _slimAudit: true,
            id: 'o-big',
            offerId: 'offer-1',
            orderNumber: 'SYM/ZS/1/2026',
            clientName: 'Klient',
            wellsCount: 2,
            totalNetto: 100,
            totalBrutto: 123,
            totalWeight: 50,
            kartaBudowy: true
        });
        expect(auditData.wellsHash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(auditData).length).toBeLessThan(2048);
    });

    test('wellsHash deterministyczny — niezależny od kolejności kluczy', async () => {
        mockedPrisma.orders_studnie_rel.findUnique.mockResolvedValue(null);
        const wells = (swap: boolean) => {
            const w = swap
                ? { config: [{ quantity: 2, productId: 'p1' }], id: 'w1' }
                : { id: 'w1', config: [{ productId: 'p1', quantity: 2 }] };
            return [w];
        };
        const send = (id: string, w: unknown[]) =>
            request(createApp())
                .put('/api/orders-studnie')
                .send({ data: [{ id, offerId: 'offer-1', wells: w, updatedAt: 't1' }] });
        await send('o-h1', wells(false));
        const hash1 = mockedLogAudit.mock.calls[0][3].wellsHash;
        mockedLogAudit.mockClear();
        await send('o-h2', wells(true));
        const hash2 = mockedLogAudit.mock.calls[0][3].wellsHash;
        expect(hash1).toBe(hash2);
    });
});
