/**
 * productsV2 — kontrakt tras cennika rur (mock Prisma; bez DB).
 * Etap 1: LIVE jest tylko do odczytu — PUT zawsze do szkicu, PATCH/DELETE 409.
 */
import express from 'express';
import request from 'supertest';
import productsRouter from '../src/routes/productsV2';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const findMany = jest.fn();
const update = jest.fn();
const deleteRow = jest.fn();
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        productsRury: {
            findMany: (...args: unknown[]) => findMany(...args),
            update: (...args: unknown[]) => update(...args),
            delete: (...args: unknown[]) => deleteRow(...args)
        },
        productsRuryDefault: { findMany: jest.fn(async () => []) },
        settings: { findUnique: jest.fn(async () => null) },
        pricelistVersion: { findFirst: jest.fn(async () => null) }
    }
}));

const getEditorPricing = jest.fn();
const saveRowsToDraft = jest.fn();
jest.mock('../src/services/pricelist/writeTarget', () => ({
    getPricelistWriteTarget: () => 'draft',
    findLatestDraft: jest.fn(async () => null),
    getEditorPricing: (...args: unknown[]) => getEditorPricing(...args),
    saveRowsToDraft: (...args: unknown[]) => saveRowsToDraft(...args),
    parseIfMatch: (header: unknown) =>
        typeof header === 'string' ? header.replace(/^"|"$/g, '') : undefined,
    parseVersionIdHeader: () => null
}));

function app() {
    const a = express();
    a.use(express.json());
    a.use('/', productsRouter);
    return a;
}

beforeEach(() => {
    jest.clearAllMocks();
    getEditorPricing.mockResolvedValue({ data: [{ id: 'd1', price: 11 }], fallback: false });
    saveRowsToDraft.mockResolvedValue({ id: 'draft-1' });
    findMany.mockResolvedValue([{ id: 'r1', price: 10 }]);
});

describe('productsV2', () => {
    it('GET / czyta ceny z wersji (szkic)', async () => {
        const res = await request(app()).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [{ id: 'd1', price: 11 }] });
        expect(res.headers['x-pricelist-write-target']).toBe('draft');
        expect(getEditorPricing).toHaveBeenCalledWith('rury');
        expect(findMany).not.toHaveBeenCalled();
    });

    it('GET / bez wersji -> LIVE (bez nagłówka fallbacku przy braku source)', async () => {
        getEditorPricing.mockResolvedValue({ data: null, fallback: true });
        const res = await request(app()).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: [{ id: 'r1', price: 10 }] });
        expect(res.headers['x-pricelist-write-target']).toBe('draft');
    });

    it('GET /?source=hack → 422 z kodem (nie 400)', async () => {
        const res = await request(app()).get('/?source=hack');
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_SOURCE');
    });

    it('PATCH /:id → 409 LIVE_READ_ONLY, bez zapisu', async () => {
        const res = await request(app()).patch('/r1').send({ price: 99 });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('LIVE_READ_ONLY');
        expect(update).not.toHaveBeenCalled();
    });

    it('DELETE /:id → 409 LIVE_READ_ONLY, bez zapisu', async () => {
        const res = await request(app()).delete('/r1');
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('LIVE_READ_ONLY');
        expect(deleteRow).not.toHaveBeenCalled();
    });

    it('PUT / z nie-liczbową ceną → 400 przed zapisem (D-FIX-2)', async () => {
        const res = await request(app())
            .put('/')
            .send({ data: [{ id: 'r1', name: 'Rura', price: 'za darmo' }] });
        expect(res.status).toBe(400);
        expect(saveRowsToDraft).not.toHaveBeenCalled();
    });

    it('PUT / poprawny → zapis do szkicu (nie do LIVE)', async () => {
        const res = await request(app())
            .put('/')
            .send({ data: [{ id: 'r1', name: 'Rura', price: 12.5 }] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, count: 1, target: 'draft', versionId: 'draft-1' });
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'rury',
            [expect.objectContaining({ id: 'r1', price: 12.5 })],
            'admin1',
            undefined
        );
    });
});
