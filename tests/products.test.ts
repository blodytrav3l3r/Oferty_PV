import request from 'supertest';
import express from 'express';
import productsRouter from '../src/routes/productsV2';

/**
 * P1.5: kontrakt GET /api/products (wczesniej placeholder bez routera, zawsze 404).
 * Live source (bez ?source): 200 {data} z Prisma; blad DB -> 500; brak sesji -> 401.
 */

const rows = [
    { id: 'p1', name: 'Rura 110', category: 'rury', price: 10.5 },
    { id: 'p2', name: 'Rura 160', category: 'rury', price: 20 }
];

let currentUser: { id: string; role: string } | null = { id: 'u1', role: 'user' };
let failDb = false;

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        productsRury: {
            findMany: jest.fn(async () => {
                if (failDb) throw new Error('db down');
                return rows.map((r) => ({ ...r }));
            })
        }
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
        req.user = currentUser;
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if ((req as any).user?.role === 'admin') next();
        else res.status(403).json({ error: 'Forbidden' });
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/products', productsRouter);
    return app;
}

beforeEach(() => {
    currentUser = { id: 'u1', role: 'user' };
    failDb = false;
    jest.clearAllMocks();
});

describe('products GET / (live)', () => {
    it('zwraca 200 {data} z wierszami cennika', async () => {
        const res = await request(createApp()).get('/api/products');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0]).toMatchObject({ id: 'p1', price: 10.5 });
    });

    it('blad DB -> 500 z kodem bledu (nie wyciek stosu)', async () => {
        failDb = true;
        const res = await request(createApp()).get('/api/products');
        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
    });

    it('bez sesji -> 401', async () => {
        currentUser = null;
        const res = await request(createApp()).get('/api/products');
        expect(res.status).toBe(401);
    });
});
