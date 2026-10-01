import request from 'supertest';
import express from 'express';
import studnieOrdersRouter from '../../src/routes/orders/studnieOrders.crud';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'u-roundtrip', role: 'user', subUsers: [] };

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
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

/**
 * R-BLOB-3: prawdziwy round-trip zamówienia studni przez SQLite workera
 * (tests/tmp/jest-worker-*.sqlite, schema z db push — BEZ mocków prismy).
 *
 * Dowodzi braku cichego gubienia pól na ścieżce:
 * REST PUT → serializer (destructure + rest→blob) → kolumny + JSON →
 * read-back (kolumny wygrywają) → GET.
 * Unikalne ID na run (plik DB współdzielony w ramach workera).
 */
function uid(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function createApp() {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

function orderDoc(id: string) {
    return {
        id,
        offerStudnieId: 'offer-1',
        status: 'new',
        updatedAt: '2026-10-02T10:00:00.000Z',
        wizardState: { step: 5 },
        wells: [
            {
                id: 'w1',
                name: 'S1',
                dn: '1000',
                configSource: 'AUTO',
                config: [{ productId: 'k-1', quantity: 2, _elemId: 'el-1' }],
                przejscia: [{ productId: 'p-1', angle: 90 }]
            }
        ]
    };
}

describe('R-BLOB-3 orders studnie blob round-trip (real SQLite)', () => {
    let app: express.Application;
    const orderId = uid('ord-rt');

    beforeAll(() => {
        app = createApp();
    });

    afterAll(async () => {
        await prisma.orders_studnie_rel.deleteMany({ where: { id: orderId } });
        await prisma.$disconnect();
    });

    test('PUT create → GET: wells i klucze top-level bez utraty', async () => {
        const put = await request(app)
            .put('/api/orders-studnie')
            .send({ data: [orderDoc(orderId)] });
        expect(put.status).toBe(200);

        const get = await request(app).get(`/api/orders-studnie/${orderId}`);
        expect(get.status).toBe(200);
        const body = get.body?.data ?? get.body;

        expect(body.wells).toHaveLength(1);
        expect(body.wells[0].config[0]).toMatchObject({ productId: 'k-1', quantity: 2 });
        expect(body.wells[0].przejscia[0]).toMatchObject({ productId: 'p-1', angle: 90 });
        // Top-level przez rest→blob wraca (passthrough wymagany — sim test).
        expect(body.offerStudnieId).toBe('offer-1');
        expect(body.updatedAt).toBe('2026-10-02T10:00:00.000Z');
        expect(body.wizardState).toEqual({ step: 5 });
        // Wersja z kolumny (optimistic locking), start 1.
        expect(body.version).toBe(1);
    });

    test('PUT update: zmiana qty + version increment', async () => {
        const doc: any = orderDoc(orderId);
        doc.wells[0].config[0].quantity = 7;
        const put = await request(app)
            .put('/api/orders-studnie')
            .send({ data: [doc] });
        expect(put.status).toBe(200);

        const get = await request(app).get(`/api/orders-studnie/${orderId}`);
        const body = get.body?.data ?? get.body;
        expect(body.wells[0].config[0].quantity).toBe(7);
        expect(body.version).toBe(2);
    });
});
