/**
 * E3c: walidacja formatu :id (z.string().uuid()).
 * POST /api/offers-rury/:id/duplicate i DELETE /api/shares/:id zwracają 400
 * przy malformed id (bez 404-oracle); poprawne UUID przechodzi do logiki.
 */
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import offerRoutes from '../../src/routes/offers/index';
import sharesRoutes from '../../src/routes/shares';
import prisma from '../../src/prismaClient';
import { idUuidParamSchema } from '../../src/validators/offerSchemas';
import { observeStudnieOrderDto } from '../../src/validators/orderSchemas';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: 'user', subUsers: [] };
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
    syncFts5: jest.fn().mockResolvedValue(true),
    removeFts5: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offer_items_rel: { findMany: jest.fn() },
        document_shares: { findUnique: jest.fn() }
    }
}));

const mocked = prisma as unknown as {
    offers_rel: { findUnique: jest.Mock };
    offer_items_rel: { findMany: jest.Mock };
    document_shares: { findUnique: jest.Mock };
};

function createOffersApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

function createSharesApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/shares', sharesRoutes);
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('idUuidParamSchema', () => {
    test('malformed id nie przechodzi', () => {
        for (const bad of ['nonexistent', 'o-1', '123', '', 'not-a-uuid']) {
            expect(idUuidParamSchema.safeParse({ id: bad }).success).toBe(false);
        }
    });

    test('poprawne UUID (crypto.randomUUID) przechodzi', () => {
        const id = crypto.randomUUID();
        const parsed = idUuidParamSchema.safeParse({ id });
        expect(parsed.success).toBe(true);
    });
});

describe('POST /api/offers/:id/duplicate — format :id', () => {
    test('malformed id → 400 bez dotykania bazy', async () => {
        const app = createOffersApp();
        const res = await request(app).post('/api/offers/not-a-uuid/duplicate');
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Nieprawidłowy format ID');
        expect(mocked.offers_rel.findUnique).not.toHaveBeenCalled();
    });

    test('poprawne UUID nieistniejącej oferty → 404 (logika bez zmian)', async () => {
        const app = createOffersApp();
        mocked.offers_rel.findUnique.mockResolvedValue(null);
        const res = await request(app).post(`/api/offers/${crypto.randomUUID()}/duplicate`);
        expect(res.statusCode).toBe(404);
        expect(mocked.offers_rel.findUnique).toHaveBeenCalledTimes(1);
    });
});

describe('DELETE /api/shares/:id — format :id', () => {
    test('malformed id → 400 bez dotykania bazy', async () => {
        const app = createSharesApp();
        const res = await request(app).delete('/api/shares/not-a-uuid');
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Nieprawidłowy format ID');
        expect(mocked.document_shares.findUnique).not.toHaveBeenCalled();
    });

    test('poprawne UUID nieistniejącego share → 404 (logika bez zmian)', async () => {
        const app = createSharesApp();
        mocked.document_shares.findUnique.mockResolvedValue(null);
        const res = await request(app).delete(`/api/shares/${crypto.randomUUID()}`);
        expect(res.statusCode).toBe(404);
        expect(mocked.document_shares.findUnique).toHaveBeenCalledTimes(1);
    });
});

describe('observeStudnieOrderDto — licznik unknownKeysTotal (bez .strict())', () => {
    test('czyste DTO: licznik 0', () => {
        const obs = observeStudnieOrderDto({
            id: 'order-1',
            wells: [
                {
                    id: 'well-1',
                    name: 'S1',
                    dn: '1000',
                    rzednaDna: 100,
                    configSource: 'AUTO',
                    config: [{ productId: 'k-1', quantity: 2, _elemId: 'el-1' }],
                    przejscia: [{ productId: 'p-1', angle: 90 }]
                }
            ]
        });
        expect(obs.unknownKeysTotal).toBe(0);
        expect(obs.runtimeLeaked).toEqual([]);
    });

    test('unknown + runtime leak: licznik > 0, tablice próbek nietknięte', () => {
        const obs = observeStudnieOrderDto({
            id: 'order-1',
            wells: [
                {
                    id: 'well-1',
                    dn: '1000',
                    solverCache: {},
                    _lastAutoConfig: 'x',
                    config: [{ productId: 'k-1', quantity: 1, isPlaceholder: true }],
                    przejscia: [{ productId: 'p-1', weirdField: 1 }]
                }
            ]
        });
        // solverCache + isPlaceholder + weirdField + _lastAutoConfig = 4
        expect(obs.unknownKeysTotal).toBe(4);
        expect(obs.unknownWellKeys).toContain('solverCache');
        expect(obs.unknownConfigKeys).toContain('isPlaceholder');
        expect(obs.unknownPrzejscieKeys).toContain('weirdField');
        expect(obs.runtimeLeaked).toContain('_lastAutoConfig');
    });
});
