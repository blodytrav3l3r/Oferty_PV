/**
 * D-FIX-2: invalid/non-finite numerics never become silent 0 in pricing.
 * Granica mocka: zapis szkicu (saveRowsToDraft) + auth/limitery.
 * Kontrakt: null/''/'abc'/NaN/±Infinity/ujemne → 400 + ZERO zapisów;
 * poprawne liczby i numeryczne stringi → 200 z zapisem do szkicu.
 */
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import { requireFinitePrice, InvalidPriceError } from '../src/validators/finiteNumbers';
import { offerItemSchema } from '../src/validators/offerSchemas';
import { productPatchSchema } from '../src/validators/offerSchemas';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-1', username: 'admin', role: 'admin', subUsers: [] };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    PRECO_PRICING_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/prismaClient', () => ({ __esModule: true, default: {} }));

const saveRowsToDraft = jest.fn();
jest.mock('../src/services/pricelist/writeTarget', () => ({
    getPricelistWriteTarget: () => 'draft',
    findLatestDraft: jest.fn(async () => null),
    getEditorPricing: jest.fn(async () => ({ data: null, fallback: true })),
    saveRowsToDraft: (...args: unknown[]) => saveRowsToDraft(...args),
    parseIfMatch: () => undefined,
    parseVersionIdHeader: () => null
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const productsV2 = require('../src/routes/productsV2').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const productsStudnieV2 = require('../src/routes/productsStudnieV2').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const precoPricingV2 = require('../src/routes/precoPricingV2').default;

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/products-v2', productsV2);
    app.use('/api/products-studnie-v2', productsStudnieV2);
    app.use('/api/preco-v2', precoPricingV2);
    return app;
}

const VALID_RURY = [{ id: 'p1', name: 'Rura', category: 'K', price: 12.5 }];
const VALID_STUDNIE = [{ id: 's1', name: 'S', category: 'K', price: 10 }];
const VALID_PRECO = {
    '1000': { kinety: [{ dn: 200, prosta: 500, dodWlot: 100, order: 0 }] }
};

describe('D-FIX-2 requireFinitePrice (unit)', () => {
    test.each([null, undefined, '', '   ', 'abc', NaN, Infinity, -Infinity, -1, true, {}, []])(
        'reject: %p',
        (v) => {
            expect(() => requireFinitePrice(v, 'price')).toThrow(InvalidPriceError);
        }
    );
    test.each([
        [0, 0],
        [12.5, 12.5],
        ['13', 13],
        [' 12.5 ', 12.5]
    ])('accept: %p -> %p', (v, expected) => {
        expect(requireFinitePrice(v, 'price')).toBe(expected);
    });
});

describe('D-FIX-2 routes: invalid price -> 400, zero zapisów', () => {
    let app: express.Application;
    beforeEach(() => {
        jest.clearAllMocks();
        saveRowsToDraft.mockResolvedValue({ id: 'draft-1' });
        app = buildApp();
    });

    test.each([null, '', 'abc', -5])('PUT rury price=%p -> 400, brak zapisu', async (price) => {
        const res = await request(app)
            .put('/api/products-v2')
            .send({ data: [{ id: 'p1', name: 'R', category: 'K', price }] });
        expect(res.status).toBe(400);
        expect(saveRowsToDraft).not.toHaveBeenCalled();
    });

    test('PUT rury poprawne ceny -> 200 (liczba i numeric string)', async () => {
        const res = await request(app)
            .put('/api/products-v2')
            .send({ data: [...VALID_RURY, { id: 'p2', name: 'R2', category: 'K', price: '13' }] });
        expect(res.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'rury',
            [
                expect.objectContaining({ id: 'p1', price: 12.5 }),
                expect.objectContaining({ id: 'p2', price: 13 })
            ],
            'admin-1',
            undefined
        );
    });

    test.each([null, '', 'abc'])('PUT studnie price=%p -> 400, brak zapisu', async (price) => {
        const res = await request(app)
            .put('/api/products-studnie-v2')
            .send({ data: [{ id: 's1', name: 'S', category: 'K', price }] });
        expect(res.status).toBe(400);
        expect(saveRowsToDraft).not.toHaveBeenCalled();
    });

    test('PUT studnie poprawna cena -> 200', async () => {
        const res = await request(app)
            .put('/api/products-studnie-v2')
            .send({ data: VALID_STUDNIE });
        expect(res.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'studnie',
            [expect.objectContaining({ id: 's1', price: 10 })],
            'admin-1',
            undefined
        );
    });

    test.each([
        [{ '1000': { kinety: [{ dn: 200, prosta: 500, dodWlot: null, order: 0 }] } }],
        [{ '1000': { kinety: [{ dn: 200, prosta: '', dodWlot: 100, order: 0 }] } }],
        [{ '1000': { kinety: [{ dn: 200, prosta: 500, dodWlot: 'abc', order: 0 }] } }]
    ])('PUT preco invalid -> 400, brak zapisu', async (data) => {
        const res = await request(app).put('/api/preco-v2').send({ data });
        expect(res.status).toBe(400);
        expect(saveRowsToDraft).not.toHaveBeenCalled();
    });

    test('PUT preco zakresy min invalid -> 400, brak zapisu', async () => {
        const res = await request(app)
            .put('/api/preco-v2')
            .send({
                data: [
                    {
                        '1000': {
                            kinety: [],
                            spadekKineta: [{ min: null, max: 10, grupy: {} }]
                        }
                    }
                ]
            });
        expect(res.status).toBe(400);
        expect(saveRowsToDraft).not.toHaveBeenCalled();
    });

    test('PUT preco poprawne -> 200', async () => {
        const res = await request(app)
            .put('/api/preco-v2')
            .send({ data: [VALID_PRECO] });
        expect(res.status).toBe(200);
        expect(saveRowsToDraft).toHaveBeenCalledWith(
            'preco',
            expect.objectContaining({ konfig: expect.any(Array) }),
            'admin-1',
            undefined
        );
    });
});

describe('D-FIX-2 schemas: non-finite odrzucone', () => {
    test('offerItemSchema: Infinity price/quantity -> fail; poprawne -> pass', () => {
        expect(
            offerItemSchema.safeParse({ productId: 'x', quantity: 1, price: Infinity }).success
        ).toBe(false);
        expect(
            offerItemSchema.safeParse({ productId: 'x', quantity: Infinity, price: 5 }).success
        ).toBe(false);
        expect(offerItemSchema.safeParse({ productId: 'x', quantity: 2, price: 10 }).success).toBe(
            true
        );
    });

    test('productPatchSchema: NaN/Infinity price -> fail', () => {
        expect(productPatchSchema.safeParse({ price: NaN }).success).toBe(false);
        expect(productPatchSchema.safeParse({ price: Infinity }).success).toBe(false);
        expect(productPatchSchema.safeParse({ price: 99.99 }).success).toBe(true);
    });
});
