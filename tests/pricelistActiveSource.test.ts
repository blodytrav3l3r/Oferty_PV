/**
 * Paczka 1: GET cenników z ?source=active czyta ceny z wersji ACTIVE
 * przez centralny resolveActivePricing (kształt legacy 1:1 z GET live).
 * Brak ACTIVE → LIVE + X-Pricelist-Fallback: live; zły source → 422.
 * Zwykły GET bez source bez zmian. Edycja LIVE po aktywacji nie rusza active.
 */

import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    PRECO_PRICING_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    sha256: string;
}

const versions: VRow[] = [];
const itemsRury: Array<Record<string, unknown>> = [];
const itemsStudnie: Array<Record<string, unknown>> = [];
const itemsKonfig: Array<Record<string, unknown>> = [];
const itemsKinety: Array<Record<string, unknown>> = [];
const itemsZakresy: Array<Record<string, unknown>> = [];
const liveRury: Array<Record<string, unknown>> = [];
const liveStudnie: Array<Record<string, unknown>> = [];
const liveKonfig: Array<Record<string, unknown>> = [];
const liveKinety: Array<Record<string, unknown>> = [];
const liveZakresy: Array<Record<string, unknown>> = [];

type Where = {
    type?: string;
    status?: string | { in: string[] };
    effectiveFrom?: string | { lte: string };
    id?: string | { not: string };
};

function matchWhere(v: VRow, where: Where | undefined): boolean {
    if (!where) return true;
    if (where.type !== undefined && v.type !== where.type) return false;
    if (where.status !== undefined) {
        if (typeof where.status === 'string') {
            if (v.status !== where.status) return false;
        } else if (!where.status.in.includes(v.status)) return false;
    }
    if (where.effectiveFrom !== undefined) {
        if (typeof where.effectiveFrom === 'string') {
            if (v.effectiveFrom !== where.effectiveFrom) return false;
        } else if (!(v.effectiveFrom <= where.effectiveFrom.lte)) return false;
    }
    return true;
}

function pickActive(where: Where): VRow | null {
    const cands = versions
        .filter((v) => matchWhere(v, where))
        .sort((a, b) =>
            a.effectiveFrom !== b.effectiveFrom
                ? b.effectiveFrom.localeCompare(a.effectiveFrom)
                : b.seq - a.seq
        );
    return cands.length > 0 ? { ...cands[0] } : null;
}

function itemDelegate(store: Array<Record<string, unknown>>) {
    return {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            store.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async ({ where }: { where?: { versionId?: string } }) => {
            if (!where?.versionId) {
                const n = store.length;
                store.length = 0;
                return { count: n };
            }
            let n = 0;
            for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].versionId === where.versionId) {
                    store.splice(i, 1);
                    n++;
                }
            }
            return { count: n };
        }),
        findMany: jest.fn(async ({ where }: { where?: { versionId?: string } }) => {
            const out = !where?.versionId
                ? [...store]
                : store.filter((r) => r.versionId === where.versionId);
            return out.map((r) => ({ ...r }));
        })
    };
}

const versionDelegate = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where }: { where: Where }) => pickActive(where))
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        pricelistItemRury: itemDelegate(itemsRury),
        pricelistItemStudnie: itemDelegate(itemsStudnie),
        pricelistItemPrecoKonfig: itemDelegate(itemsKonfig),
        pricelistItemPrecoKinety: itemDelegate(itemsKinety),
        pricelistItemPrecoZakresy: itemDelegate(itemsZakresy),
        productsRury: { findMany: jest.fn(async () => liveRury.map((r) => ({ ...r }))) },
        productsStudnie: { findMany: jest.fn(async () => liveStudnie.map((r) => ({ ...r }))) },
        precoKonfig: { findMany: jest.fn(async () => liveKonfig.map((r) => ({ ...r }))) },
        precoKinety: { findMany: jest.fn(async () => liveKinety.map((r) => ({ ...r }))) },
        precoZakresy: { findMany: jest.fn(async () => liveZakresy.map((r) => ({ ...r }))) }
    }
}));

import productsRouter from '../src/routes/productsV2';
import studnieRouter from '../src/routes/productsStudnieV2';
import precoRouter from '../src/routes/precoPricingV2';

const EFF = '2020-01-01T00:00:00.000Z';

function seedAll(): void {
    liveRury.push({ id: 'R1', name: 'Rura R1', category: 'K', price: 100 });
    versions.push({
        id: 'v-rury-1',
        type: 'rury',
        seq: 1,
        version: 'v1',
        status: 'ACTIVE',
        effectiveFrom: EFF,
        sha256: 'x'
    });
    itemsRury.push({
        id: 'v-rury-1:R1',
        versionId: 'v-rury-1',
        name: 'Rura R1',
        category: 'K',
        price: 80
    });

    liveStudnie.push({
        id: 'S1',
        name: 'Krąg',
        category: 'Kręgi',
        componentType: 'krag',
        dn: '1000',
        height: 500,
        magazynWL: true,
        magazynKLB: false,
        formaStandardowa: true,
        formaStandardowaKLB: false,
        active: true,
        price: 100
    });
    versions.push({
        id: 'v-studnie-1',
        type: 'studnie',
        seq: 1,
        version: 'v1',
        status: 'ACTIVE',
        effectiveFrom: EFF,
        sha256: 'x'
    });
    itemsStudnie.push({
        id: 'v-studnie-1:S1',
        versionId: 'v-studnie-1',
        name: 'Krąg',
        category: 'Kręgi',
        componentType: 'krag',
        dn: '1000',
        height: 500,
        magazynWL: true,
        magazynKLB: false,
        formaStandardowa: true,
        formaStandardowaKLB: false,
        active: true,
        price: 80
    });

    liveKonfig.push({
        id: 'k-live',
        key: '1000',
        value: JSON.stringify({ skrzynkaWlazowa: 10, cenaDnoOsadnika: 20, cenaPelnaWysMB: 30 })
    });
    liveKinety.push({
        id: 'kin-live',
        order: 0,
        dn: 160,
        wellDn: 1000,
        height: 500,
        cena: 11
    });
    liveZakresy.push({
        id: 'z-live',
        order: 0,
        label: 'spadekKineta',
        min: 0,
        max: 100,
        grupy: JSON.stringify({ '110-160': 50 }),
        wellDn: 1000
    });
    versions.push({
        id: 'v-preco-1',
        type: 'preco',
        seq: 1,
        version: 'v1',
        status: 'ACTIVE',
        effectiveFrom: EFF,
        sha256: 'x'
    });
    itemsKonfig.push({
        id: 'v-preco-1:c1',
        versionId: 'v-preco-1',
        key: '1000',
        value: JSON.stringify({ skrzynkaWlazowa: 99, cenaDnoOsadnika: 20, cenaPelnaWysMB: 30 })
    });
    itemsKinety.push({
        id: 'v-preco-1:k1',
        versionId: 'v-preco-1',
        order: 0,
        dn: 160,
        wellDn: 1000,
        height: 500,
        cena: 77
    });
    itemsZakresy.push({
        id: 'v-preco-1:z1',
        versionId: 'v-preco-1',
        order: 0,
        label: 'spadekKineta',
        min: 0,
        max: 100,
        grupy: JSON.stringify({ '110-160': 55 }),
        wellDn: 1000
    });
}

let app: express.Application;

beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/products', productsRouter);
    app.use('/api/products-studnie', studnieRouter);
    app.use('/api/preco-pricing', precoRouter);
});

beforeEach(() => {
    for (const s of [
        versions,
        itemsRury,
        itemsStudnie,
        itemsKonfig,
        itemsKinety,
        itemsZakresy,
        liveRury,
        liveStudnie,
        liveKonfig,
        liveKinety,
        liveZakresy
    ]) {
        s.length = 0;
    }
    seedAll();
});

describe('Paczka 1: source=active czyta z ACTIVE', () => {
    test('rury: active 80 vs live 100; plain GET bez zmian i bez nagłówka', async () => {
        const active = await request(app).get('/api/products?source=active');
        expect(active.status).toBe(200);
        expect(active.body.data).toHaveLength(1);
        expect(active.body.data[0].price).toBe(80);
        expect(active.headers['x-pricelist-fallback']).toBeUndefined();

        const plain = await request(app).get('/api/products');
        expect(plain.status).toBe(200);
        expect(plain.body.data[0].price).toBe(100);
        expect(plain.headers['x-pricelist-fallback']).toBeUndefined();
    });

    test('studnie: legacy 1/0 i dn liczbowe z wersji', async () => {
        const active = await request(app).get('/api/products-studnie?source=active');
        expect(active.status).toBe(200);
        expect(active.body.data).toHaveLength(1);
        expect(active.body.data[0].price).toBe(80);
        expect(active.body.data[0].magazynWL).toBe(1);
        expect(active.body.data[0].magazynKLB).toBe(0);
        expect(active.body.data[0].dn).toBe(1000);

        const plain = await request(app).get('/api/products-studnie');
        expect(plain.body.data[0].price).toBe(100);
    });

    test('preco: nested per DN z wersji (scalars + kinety + zakresy)', async () => {
        const active = await request(app).get('/api/preco-pricing?source=active');
        expect(active.status).toBe(200);
        const entry = active.body.data[0];
        expect(entry['1000'].skrzynkaWlazowa).toBe(99);
        expect(entry['1000'].kinety[0]).toMatchObject({ dn: 160, prosta: 500, dodWlot: 77 });
        expect(entry['1000'].spadekKineta[0].grupy).toEqual({ '110-160': 55 });

        const plain = await request(app).get('/api/preco-pricing');
        expect(plain.body.data[0]['1000'].skrzynkaWlazowa).toBe(10);
        expect(plain.body.data[0]['1000'].kinety[0].dodWlot).toBe(11);
    });

    test('edycja LIVE po aktywacji nie zmienia source=active', async () => {
        liveRury[0].price = 999;
        liveStudnie[0].price = 999;
        liveKonfig[0].value = JSON.stringify({
            skrzynkaWlazowa: 999,
            cenaDnoOsadnika: 20,
            cenaPelnaWysMB: 30
        });

        expect((await request(app).get('/api/products?source=active')).body.data[0].price).toBe(80);
        expect(
            (await request(app).get('/api/products-studnie?source=active')).body.data[0].price
        ).toBe(80);
        expect(
            (await request(app).get('/api/preco-pricing?source=active')).body.data[0]['1000']
                .skrzynkaWlazowa
        ).toBe(99);
        expect((await request(app).get('/api/products')).body.data[0].price).toBe(999);
    });

    test('brak ACTIVE → LIVE + X-Pricelist-Fallback: live', async () => {
        versions.length = 0;
        for (const [url, price] of [
            ['/api/products?source=active', 100],
            ['/api/products-studnie?source=active', 100]
        ] as const) {
            const res = await request(app).get(url);
            expect(res.status).toBe(200);
            expect(res.body.data[0].price).toBe(price);
            expect(res.headers['x-pricelist-fallback']).toBe('live');
        }
        const preco = await request(app).get('/api/preco-pricing?source=active');
        expect(preco.status).toBe(200);
        expect(preco.body.data[0]['1000'].skrzynkaWlazowa).toBe(10);
        expect(preco.headers['x-pricelist-fallback']).toBe('live');
    });

    test.each([
        ['/api/products?source=bogus'],
        ['/api/products-studnie?source=bogus'],
        ['/api/preco-pricing?source=bogus']
    ])('zły source → 422 (%s)', async (url) => {
        const res = await request(app).get(url);
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_SOURCE');
    });
});
