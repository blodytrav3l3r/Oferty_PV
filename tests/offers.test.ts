import request from 'supertest';
import express from 'express';
import ruryRouter from '../src/routes/offers/ruryCrud';

/**
 * P1.5: kontrakt GET /api/offers-rury (wczesniej placeholder [200,401] bez auth).
 * 200 {data, totalCount} + mapping biznesowy (cena z pozycji, status);
 * blad paginacji -> 500; brak sesji -> 401.
 */

const offerRow = {
    id: 'o1',
    userId: 'u1',
    offer_number: 'OF/1',
    state: 'final',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    transportCost: 100,
    clientName: 'Klient',
    investName: 'Inwestycja',
    clientNumber: 'C1',
    version: 3,
    pricelistVersionId: null
};

const itemRows = [
    { id: 'i1', offerId: 'o1', productId: 'p1', quantity: 2, discount: 0, price: 50 },
    { id: 'i2', offerId: 'o1', productId: 'p2', quantity: 1, discount: 0, price: 30 }
];

let currentUser: { id: string; role: string; subUsers?: string[] } | null = {
    id: 'u1',
    role: 'user',
    subUsers: []
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findMany: jest.fn(async () => [{ ...offerRow }]),
            count: jest.fn(async () => 1)
        },
        offer_items_rel: {
            findMany: jest.fn(async () => itemRows.map((r) => ({ ...r })))
        },
        document_shares: {
            findMany: jest.fn(async () => [])
        }
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
        req.user = currentUser;
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers-rury', ruryRouter);
    return app;
}

beforeEach(() => {
    currentUser = { id: 'u1', role: 'user', subUsers: [] };
    jest.clearAllMocks();
});

describe('offers-rury GET /', () => {
    it('zwraca 200 z mappingiem: cena 2*50+1*30=130, status final->active', async () => {
        const res = await request(createApp()).get('/api/offers-rury');
        expect(res.status).toBe(200);
        expect(res.body.totalCount).toBe(1);
        expect(res.body.data).toHaveLength(1);
        const o = res.body.data[0];
        expect(o).toMatchObject({ id: 'o1', type: 'offer', status: 'active', version: 3 });
        expect(o.price).toBe(130);
        expect(o.items).toHaveLength(2);
        expect(o.title).toContain('OF/1');
    });

    it('zly query paginacji -> 500 (Zod parse w handlerze, nie crash)', async () => {
        const res = await request(createApp()).get('/api/offers-rury?limit=nie-liczba');
        expect(res.status).toBe(500);
    });

    it('bez sesji -> 401', async () => {
        currentUser = null;
        const res = await request(createApp()).get('/api/offers-rury');
        expect(res.status).toBe(401);
    });
});
