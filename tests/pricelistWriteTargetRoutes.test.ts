/**
 * S5: trasy cenników w trybie draft — studnie/preco PUT -> DRAFT oraz
 * alias eksportu `?source=live` -> DRAFT (409 bez szkicu, bez buildu XLSX).
 */
import express from 'express';
import request from 'supertest';
import ruryRouter from '../src/routes/productsV2';
import studnieRouter from '../src/routes/productsStudnieV2';
import precoRouter from '../src/routes/precoPricingV2';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next(),
    PRECO_PRICING_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn(async () => undefined)
}));

jest.mock('../src/prismaClient', () => ({ __esModule: true, default: {} }));

const findLatestDraft = jest.fn();
const saveRowsToDraft = jest.fn();
const getEditorPricing = jest.fn();
jest.mock('../src/services/pricelist/writeTarget', () => ({
    getPricelistWriteTarget: () => 'draft',
    findLatestDraft: (...args: unknown[]) => findLatestDraft(...args),
    saveRowsToDraft: (...args: unknown[]) => saveRowsToDraft(...args),
    getEditorPricing: (...args: unknown[]) => getEditorPricing(...args)
}));

function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/products', ruryRouter);
    a.use('/api/products-studnie', studnieRouter);
    a.use('/api/preco-pricing', precoRouter);
    return a;
}

beforeEach(() => {
    jest.clearAllMocks();
    findLatestDraft.mockResolvedValue(null);
    getEditorPricing.mockResolvedValue({ data: [], fallback: false });
    saveRowsToDraft.mockImplementation(async (type: string) => ({ id: `${type}-draft` }));
});

describe('S5 draft routes', () => {
    it.each([
        ['/api/products', 'rury'],
        ['/api/products-studnie', 'studnie'],
        ['/api/preco-pricing', 'preco']
    ])('GET %s deklaruje cel zapisu draft', async (url, type) => {
        const res = await request(app()).get(url);

        expect(res.status).toBe(200);
        expect(res.headers['x-pricelist-write-target']).toBe('draft');
        expect(getEditorPricing).toHaveBeenCalledWith(type);
    });

    it('studnie PUT zapisuje do DRAFT', async () => {
        const res = await request(app())
            .put('/api/products-studnie')
            .send({ data: [{ id: 's1', name: 'Studnia', price: 10 }] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            count: 1,
            target: 'draft',
            versionId: 'studnie-draft'
        });
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'studnie',
            [expect.objectContaining({ id: 's1', price: 10 })],
            'admin1'
        );
    });

    it('preco PUT zapisuje do DRAFT', async () => {
        const res = await request(app())
            .put('/api/preco-pricing')
            .send({ data: { 1000: { kinety: [] } } });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            ok: true,
            target: 'draft',
            versionId: 'preco-draft'
        });
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'preco',
            expect.objectContaining({ konfig: expect.any(Array) }),
            'admin1'
        );
    });

    it.each([
        ['/api/products/export.xlsx', 'rury'],
        ['/api/products-studnie/export.xlsx', 'studnie'],
        ['/api/preco-pricing/export.xlsx', 'preco']
    ])('%s?source=live aliasuje do DRAFT', async (url, type) => {
        const res = await request(app()).get(`${url}?source=live`);

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('NO_DRAFT_VERSION');
        expect(findLatestDraft).toHaveBeenCalledWith(type);
    });
});
