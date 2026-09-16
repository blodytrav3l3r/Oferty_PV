/**
 * P1.3 — testy regresyjne limitów rozmiaru JSON per-route.
 * Małe trasy: 1mb (duży payload → 413 z JSON z errorHandler).
 * Duże trasy: 50mb (legalny duży payload oferty → przechodzi).
 */

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-id', role: 'admin', username: 'admin' };
        }
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock offer exports (router pomocniczy montowany w offers/index)
jest.mock('../src/routes/offers/exports', () => ({
    __esModule: true,
    default: jest.fn((_req: any, _res: any, next: any) => next())
}));

// Mock prisma — minimum dla testowanych tras:
// settings (GET/PUT year-letter), offers-rury POST (prefetch + transakcja).
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue({})
        },
        offers_rel: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn().mockResolvedValue(null)
        },
        offer_items_rel: {
            findMany: jest.fn().mockResolvedValue([])
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(0),
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
        $transaction: jest.fn(async (arg: any) => {
            if (typeof arg === 'function') {
                const tx = {
                    offers_rel: {
                        create: jest.fn().mockResolvedValue({}),
                        update: jest.fn().mockResolvedValue({}),
                        updateMany: jest.fn().mockResolvedValue({ count: 1 })
                    },
                    offer_items_rel: {
                        deleteMany: jest.fn().mockResolvedValue({}),
                        createMany: jest.fn().mockResolvedValue({ count: 0 })
                    }
                };
                return arg(tx);
            }
            if (Array.isArray(arg)) {
                return Promise.all(arg.map((p: any) => (typeof p === 'function' ? p() : p)));
            }
            return undefined;
        })
    }
}));

import request from 'supertest';
import express from 'express';
import { mountRoutes } from '../src/mountRoutes';

function createTestApp() {
    const app = express();
    const passThrough: express.RequestHandler = (_req, _res, next) => next();
    mountRoutes(app, passThrough);
    return app;
}

describe('P1.3 limity JSON per-route', () => {
    let app: express.Express;

    beforeEach(() => {
        app = createTestApp();
    });

    it('duży payload na małej trasie → 413 z JSON', async () => {
        const res = await request(app)
            .put('/api/settings/year-letter')
            .send({ letter: 'A'.repeat(2 * 1024 * 1024) });
        expect(res.statusCode).toBe(413);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body.error).toMatch(/Zbyt duży payload/);
    });

    it('mała trasa działa normalnie dla zwykłego payloadu', async () => {
        const res = await request(app).get('/api/settings/year-letter');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('letter', '');
    });

    it('duży legalny payload oferty rur (~1,4mb) przechodzi limit 50mb', async () => {
        // Jeden rekord ~4kb (passthrough), 350 rekordów daje ~1,4mb > 1mb.
        const items = Array.from({ length: 350 }, (_v, i) => ({
            productId: 'prod-' + i,
            quantity: 1,
            opis: 'x'.repeat(4000)
        }));
        const res = await request(app)
            .post('/api/offers-rury')
            .send({ data: [{ clientId: 'client-1', transportCost: 0, items }] });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
});
