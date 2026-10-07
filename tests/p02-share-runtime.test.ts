import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import offersRouter from '../src/routes/offers/index';
import ruryOrdersRouter from '../src/routes/orders/ruryOrders.export';
import studnieOrdersRouter from '../src/routes/orders/studnieOrders.export';

const OWNER = { id: 'owner-a', role: 'user', subUsers: [], username: 'ownerA' };
const RECIPIENT = { id: 'user-b', role: 'user', subUsers: [], username: 'userB' };
let currentUser: any = { ...OWNER };
// typy dokumentów z aktywnym share (per scenariusz); hasShare mockuje po documentType
let shareDocTypes: string[] = ['offer', 'order_rury', 'order_studnie'];

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...currentUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/utils/fts5Queue', () => ({
    enqueueFtsSync: jest.fn(),
    enqueueFtsRemove: jest.fn()
}));

jest.mock('../src/utils/fts5Sync', () => ({
    syncFts5: jest.fn().mockResolvedValue(undefined),
    removeFts5: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/services/pdfGenerator', () => ({
    __esModule: true,
    generateOfferRuryPDF: jest.fn(async () => Buffer.from('pdf')),
    generateOfferStudniePDF: jest.fn(async () => Buffer.from('pdf')),
    generateRuryOrderPDF: jest.fn(async () => Buffer.from('pdf')),
    generateStudnieOrderPDF: jest.fn(async () => Buffer.from('pdf')),
    generateKartaBudowyRuryPDF: jest.fn(async () => Buffer.from('pdf')),
    generateKartaBudowyPDF: jest.fn(async () => Buffer.from('pdf')),
    generateRuryPDFFromContext: jest.fn(async () => Buffer.from('pdf')),
    generateStudniePDFFromContext: jest.fn(async () => Buffer.from('pdf')),
    lookupOfferUsers: jest.fn(async () => ({ authorUser: null, guardianUser: null }))
}));

const RURY_OFFER_ID = crypto.randomUUID();
const RURY_ORDER_ID = 'order-rury-1';
const STUDNIE_ORDER_ID = 'order-studnie-1';

const ruryOfferRow: any = {
    id: RURY_OFFER_ID,
    userId: OWNER.id,
    offer_number: 'R1',
    state: 'final',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transportCost: 0,
    history: '[]',
    data: '{}',
    pricelistVersionId: null
};
const ruryOrderRow: any = {
    id: RURY_ORDER_ID,
    userId: OWNER.id,
    offerId: RURY_OFFER_ID,
    status: 'new',
    createdAt: new Date().toISOString(),
    data: '{}',
    version: 1,
    pricelistVersionId: null
};
const studnieOrderRow: any = {
    id: STUDNIE_ORDER_ID,
    userId: OWNER.id,
    offerStudnieId: 'os-1',
    status: 'new',
    createdAt: new Date().toISOString(),
    data: '{}',
    version: 1,
    pricelistVersionId: null
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: jest.fn(async ({ where }: any) =>
                where?.id === RURY_OFFER_ID ? { ...ruryOfferRow } : null
            ),
            create: jest.fn(async ({ data }: any) => data)
        },
        offer_items_rel: {
            findMany: jest.fn(async () => []),
            createMany: jest.fn(async () => ({ count: 0 }))
        },
        orders_rury_rel: {
            findUnique: jest.fn(async ({ where }: any) =>
                where?.id === RURY_ORDER_ID ? { ...ruryOrderRow } : null
            )
        },
        orders_studnie_rel: {
            findUnique: jest.fn(async ({ where }: any) =>
                where?.id === STUDNIE_ORDER_ID ? { ...studnieOrderRow } : null
            )
        },
        document_shares: {
            findFirst: jest.fn(async ({ where }: any) =>
                shareDocTypes.includes(where?.documentType) ? { id: 'share-1' } : null
            )
        },
        $transaction: jest.fn(async (fn: any) => {
            const prismaMock = jest.requireMock('../src/prismaClient').default;
            return fn(prismaMock);
        })
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offersRouter);
    app.use('/api/orders-rury', ruryOrdersRouter);
    app.use('/api/orders-studnie', studnieOrdersRouter);
    return app;
}

describe('P0.2 share runtime — recipient B (share present)', () => {
    let app: express.Application;
    beforeEach(() => {
        currentUser = { ...RECIPIENT };
        shareDocTypes = ['offer', 'order_rury', 'order_studnie'];
        app = createApp();
    });

    it('A1 lista kontrolna: detail shared offer_rury → 200', async () => {
        const res = await request(app).get(`/api/offers/${RURY_OFFER_ID}`);
        expect(res.statusCode).toBe(200);
    });

    it('A2 export PDF shared offer_rury → 200', async () => {
        const res = await request(app).get(`/api/offers/${RURY_OFFER_ID}/export-pdf`);
        expect(res.statusCode).toBe(200);
    });

    it('A3 duplicate shared offer_rury → 200 (P0.3 fix)', async () => {
        const res = await request(app).post(`/api/offers/${RURY_OFFER_ID}/duplicate`);
        expect(res.statusCode).toBe(200);
    });

    it('B1 detail shared order_rury → 200', async () => {
        const res = await request(app).get(`/api/orders-rury/${RURY_ORDER_ID}`);
        expect(res.statusCode).toBe(200);
    });

    it('B2 export shared order_rury → 200 (P0.3 fix)', async () => {
        const res = await request(app).get(`/api/orders-rury/${RURY_ORDER_ID}/export-pdf`);
        expect(res.statusCode).toBe(200);
    });

    it('C1 detail shared order_studnie → 200', async () => {
        const res = await request(app).get(`/api/orders-studnie/${STUDNIE_ORDER_ID}`);
        expect(res.statusCode).toBe(200);
    });

    it('C2 export shared order_studnie → 200 (P0.3 fix)', async () => {
        const res = await request(app).get(`/api/orders-studnie/${STUDNIE_ORDER_ID}/export-pdf`);
        expect(res.statusCode).toBe(200);
    });
});

describe('P0.2 regression — owner A keeps access', () => {
    let app: express.Application;
    beforeEach(() => {
        currentUser = { ...OWNER };
        shareDocTypes = [];
        app = createApp();
    });

    it('owner duplicate own offer → 200', async () => {
        const res = await request(app).post(`/api/offers/${RURY_OFFER_ID}/duplicate`);
        expect(res.statusCode).toBe(200);
    });

    it('owner export own order → 200', async () => {
        const res = await request(app).get(`/api/orders-rury/${RURY_ORDER_ID}/export-pdf`);
        expect(res.statusCode).toBe(200);
    });
});

describe('P0.5 inheritance — tylko share oferty, brak share zamówienia', () => {
    let app: express.Application;
    beforeEach(() => {
        currentUser = { ...RECIPIENT };
        // tylko oferta-studnie udostępniona; order_studnie NIE
        shareDocTypes = ['offer_studnie'];
        app = createApp();
    });

    it('D1 detail order_studnie przez share oferty → 200', async () => {
        const res = await request(app).get(`/api/orders-studnie/${STUDNIE_ORDER_ID}`);
        expect(res.statusCode).toBe(200);
    });

    it('D2 export order_studnie przez share oferty → 200', async () => {
        const res = await request(app).get(`/api/orders-studnie/${STUDNIE_ORDER_ID}/export-pdf`);
        expect(res.statusCode).toBe(200);
    });

    it('D3 rury order bez share oferty (offer spoza listy) → 404', async () => {
        const res = await request(app).get(`/api/orders-rury/${RURY_ORDER_ID}`);
        expect(res.statusCode).toBe(404);
    });
});

describe('P0.5 inheritance — share oferty rur', () => {
    let app: express.Application;
    beforeEach(() => {
        currentUser = { ...RECIPIENT };
        shareDocTypes = ['offer'];
        app = createApp();
    });

    it('D4 detail order_rury przez share oferty → 200', async () => {
        const res = await request(app).get(`/api/orders-rury/${RURY_ORDER_ID}`);
        expect(res.statusCode).toBe(200);
    });
});
