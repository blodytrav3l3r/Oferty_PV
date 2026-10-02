/**
 * D-FIX-2: invalid/non-finite numerics never become silent 0 in pricing.
 * Granica mocka: prismaClient (in-memory; asercje braku zapisu) + auth/limitery.
 * Kontrakt: null/''/'abc'/NaN/±Infinity/ujemne → 400 + ZERO zapisów;
 * poprawne liczby i numeryczne stringi → 200.
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

const calls: { op: string; data?: unknown }[] = [];

function table() {
    return {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => {
            calls.push({ op: 'deleteMany' });
            return { count: 0 };
        }),
        createMany: jest.fn(async ({ data }: any) => {
            calls.push({ op: 'createMany', data });
            return { count: (data as unknown[]).length };
        })
    };
}

const precoKonfig = table();
const precoKinety = table();
const precoZakresy = table();

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        productsRury: {
            deleteMany: jest.fn(async () => {
                calls.push({ op: 'rury.deleteMany' });
                return { count: 0 };
            }),
            createMany: jest.fn(async ({ data }: any) => {
                calls.push({ op: 'rury.createMany', data });
                return { count: (data as unknown[]).length };
            })
        },
        productsStudnie: {
            deleteMany: jest.fn(async () => {
                calls.push({ op: 'studnie.deleteMany' });
                return { count: 0 };
            }),
            createMany: jest.fn(async ({ data }: any) => {
                calls.push({ op: 'studnie.createMany', data });
                return { count: (data as unknown[]).length };
            })
        },
        precoKonfig,
        precoKinety,
        precoZakresy,
        precoKonfigDefault: table(),
        precoKinetyDefault: table(),
        precoZakresyDefault: table(),
        $transaction: jest.fn(async (arg: any) => {
            if (Array.isArray(arg)) {
                for (const op of arg) await op;
                return [];
            }
            const tx = {
                productsStudnie: {
                    deleteMany: jest.fn(async () => {
                        calls.push({ op: 'studnie.deleteMany' });
                        return { count: 0 };
                    }),
                    createMany: jest.fn(async ({ data }: any) => {
                        calls.push({ op: 'studnie.createMany', data });
                        return { count: (data as unknown[]).length };
                    })
                }
            };
            return arg(tx);
        })
    }
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
        calls.length = 0;
        jest.clearAllMocks();
        app = buildApp();
    });

    test.each([null, '', 'abc', -5])('PUT rury price=%p -> 400, brak zapisu', async (price) => {
        const res = await request(app)
            .put('/api/products-v2')
            .send({ data: [{ id: 'p1', name: 'R', category: 'K', price }] });
        expect(res.status).toBe(400);
        expect(calls).toEqual([]);
    });

    test('PUT rury poprawne ceny -> 200 (liczba i numeric string)', async () => {
        const res = await request(app)
            .put('/api/products-v2')
            .send({ data: [...VALID_RURY, { id: 'p2', name: 'R2', category: 'K', price: '13' }] });
        expect(res.status).toBe(200);
        const created = calls.find((c) => c.op === 'rury.createMany');
        expect(created).toBeDefined();
        expect(created!.data).toEqual([
            expect.objectContaining({ id: 'p1', price: 12.5 }),
            expect.objectContaining({ id: 'p2', price: 13 })
        ]);
    });

    test.each([null, '', 'abc'])('PUT studnie price=%p -> 400, brak createMany', async (price) => {
        const res = await request(app)
            .put('/api/products-studnie-v2')
            .send({ data: [{ id: 's1', name: 'S', category: 'K', price }] });
        expect(res.status).toBe(400);
        expect(calls.filter((c) => c.op === 'studnie.createMany')).toEqual([]);
    });

    test('PUT studnie poprawna cena -> 200', async () => {
        const res = await request(app)
            .put('/api/products-studnie-v2')
            .send({ data: VALID_STUDNIE });
        expect(res.status).toBe(200);
    });

    test.each([
        [{ '1000': { kinety: [{ dn: 200, prosta: 500, dodWlot: null, order: 0 }] } }],
        [{ '1000': { kinety: [{ dn: 200, prosta: '', dodWlot: 100, order: 0 }] } }],
        [{ '1000': { kinety: [{ dn: 200, prosta: 500, dodWlot: 'abc', order: 0 }] } }]
    ])('PUT preco invalid -> 400, brak deleteMany', async (data) => {
        const res = await request(app).put('/api/preco-v2').send({ data });
        expect(res.status).toBe(400);
        expect(precoKinety.deleteMany).not.toHaveBeenCalled();
        expect(precoKonfig.deleteMany).not.toHaveBeenCalled();
    });

    test('PUT preco zakresy min invalid -> 400', async () => {
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
        expect(precoZakresy.deleteMany).not.toHaveBeenCalled();
    });

    test('PUT preco poprawne -> 200', async () => {
        const res = await request(app)
            .put('/api/preco-v2')
            .send({ data: [VALID_PRECO] });
        expect(res.status).toBe(200);
        expect(precoKinety.createMany).toHaveBeenCalled();
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
