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
    getEditorPricing: (...args: unknown[]) => getEditorPricing(...args),
    // Kopia parsera nagłówka (realny moduł ciągnie Prismę — tu tylko kontrakt).
    parseIfMatch: (header: unknown) =>
        typeof header === 'string' && header.length > 0 ? header.replace(/^"|"$/g, '') : undefined,
    parseVersionIdHeader: (header: unknown) => {
        if (typeof header !== 'string') return null;
        const value = header.trim();
        return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
    }
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
    it('zaokrągla kwoty cenników do groszy, zachowując precyzję wymiarów', async () => {
        const rury = await request(app())
            .put('/api/products')
            .send({
                data: [{ id: 'r1', name: 'Rura', price: 10.075, area: 1.2345 }]
            });
        expect(rury.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'rury',
            [expect.objectContaining({ price: 10.08, area: 1.2345 })],
            'admin1',
            undefined
        );
        const studnie = await request(app())
            .put('/api/products-studnie')
            .send({
                data: [
                    {
                        id: 's1',
                        name: 'Studnia',
                        price: 10.075,
                        cena1: 2.675,
                        doplataPEHD: 1.005,
                        area: 1.2345
                    }
                ]
            });
        expect(studnie.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'studnie',
            [
                expect.objectContaining({
                    price: 10.08,
                    cena1: 2.68,
                    doplataPEHD: 1.01,
                    area: 1.2345
                })
            ],
            'admin1',
            undefined
        );
    });

    it('zaokrągla ceny PRECO bez zmiany zakresów i średnic', async () => {
        const res = await request(app())
            .put('/api/preco-pricing')
            .send({
                data: {
                    1000: {
                        skrzynkaWlazowa: 10.075,
                        kinety: [{ dn: 150, prosta: 2.675, dodWlot: 1.005 }],
                        spadekKineta: [{ min: 2.123, max: 5.123, grupy: { '150-300': 10.075 } }]
                    }
                }
            });
        expect(res.status).toBe(200);
        const rows = saveRowsToDraft.mock.calls[0][1];
        expect(rows.kinety[0]).toEqual(
            expect.objectContaining({ dn: 150, height: 2.68, cena: 1.01 })
        );
        expect(rows.zakresy[0]).toEqual(
            expect.objectContaining({
                min: 2.123,
                max: 5.123,
                grupy: JSON.stringify({ '150-300': 10.08 })
            })
        );
        expect(JSON.parse(rows.konfig[0].value)).toEqual(
            expect.objectContaining({ skrzynkaWlazowa: 10.08 })
        );
    });
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
            'admin1',
            undefined
        );
    });

    it('studnie PUT przekazuje If-Match do zapisu szkicu', async () => {
        const res = await request(app())
            .put('/api/products-studnie')
            .set('If-Match', '"abc123"')
            .send({ data: [{ id: 's1', name: 'Studnia', price: 10 }] });

        expect(res.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'studnie',
            [expect.objectContaining({ id: 's1' })],
            'admin1',
            'abc123'
        );
    });

    it.each([
        ['/api/products', 'rury'],
        ['/api/products-studnie', 'studnie'],
        ['/api/preco-pricing', 'preco']
    ])('PUT %s z X-Pricelist-Version-Id zapisuje do wersji', async (url, type) => {
        saveRowsToDraft.mockImplementationOnce(async () => ({
            id: 'v123',
            sha256: 'nowy-sha'
        }));
        const body =
            type === 'preco'
                ? { data: { 1000: { kinety: [] } } }
                : { data: [{ id: 'x1', name: 'X', price: 10, category: 'K' }] };
        const res = await request(app())
            .put(url)
            .set('X-Pricelist-Version-Id', 'v123')
            .set('If-Match', '"abc"')
            .send(body);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ok: true,
            target: 'version',
            versionId: 'v123',
            sha256: 'nowy-sha'
        });
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            type,
            expect.anything(),
            'admin1',
            'abc',
            'v123'
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
            'admin1',
            undefined
        );
    });

    it.each([
        ['/api/products/export.xlsx', 'rury'],
        ['/api/products-studnie/export.xlsx', 'studnie'],
        ['/api/preco-pricing/export.xlsx', 'preco']
    ])('%s?source=live → 422 (tabela LIVE nie istnieje)', async (url, _type) => {
        const res = await request(app()).get(`${url}?source=live`);

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_SOURCE');
        expect(findLatestDraft).not.toHaveBeenCalled();
    });
});
