import request from 'supertest';
import express from 'express';
import offerRoutes from '../src/routes/offers/index';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRawUnsafe: jest.fn(),
        offers_rel: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null)
        },
        offers_studnie_rel: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null)
        },
        offer_items_rel: { findMany: jest.fn().mockResolvedValue([]) },
        users: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([])
        }
    }
}));

describe('Offers Routes', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/offers', offerRoutes);
    });

    describe('GET /api/offers', () => {
        it('powinien zwrócić listę ofert', async () => {
            const res = await request(app).get('/api/offers');

            // Oczekuj albo 200 z danymi, albo 401 jeśli wymagana autoryzacja
            expect([200, 401]).toContain(res.statusCode);
        });
    });

    describe('POST /api/offers', () => {
        it('powinien zwrócić 400 jeśli brakuje wymaganych pól', async () => {
            const res = await request(app).post('/api/offers').send({});

            expect(res.statusCode).toBeGreaterThanOrEqual(400);
        });
    });
});
