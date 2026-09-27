/**
 * Faza B: POST /api/pricelist-versions/:id/clone-draft (rollback).
 * 403 nie-admin, 404 zły id, 200 klonuje wiersze (count + wartości),
 * nowy draft ma status DRAFT i nie nadpisuje aktywnej.
 */
import request from 'supertest';
import express from 'express';

const mockUser: { id: string; role: string } = { id: 'admin-1', role: 'admin' };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if ((req.user || {}).role === 'admin') return next();
        return res.status(403).json({ error: 'Brak uprawnień administratora' });
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    PRICELIST_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
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
    createdBy?: string;
    note?: string;
    sha256: string;
    createdAt?: string;
}

const versions: VRow[] = [];
const itemsRury: Array<Record<string, unknown>> = [];
const audits: Array<Record<string, unknown>> = [];

const versionDelegate = {
    aggregate: jest.fn(async ({ where }: { where: { type: string } }) => {
        const vs = versions.filter((v) => v.type === where.type);
        return {
            _max: {
                seq: vs.length > 0 ? Math.max(...vs.map((v) => v.seq)) : null,
                effectiveFrom:
                    vs.length > 0
                        ? vs
                              .map((v) => v.effectiveFrom)
                              .sort()
                              .reverse()[0]
                        : null
            }
        };
    }),
    create: jest.fn(async ({ data }: { data: VRow }) => {
        versions.push({ ...data });
        return { ...data };
    }),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    })
};

function itemDelegate(store: Array<Record<string, unknown>>) {
    return {
        createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            store.push(...data);
            return { count: data.length };
        }),
        deleteMany: jest.fn(async ({ where }: { where?: { versionId?: string } }) => {
            let n = 0;
            for (let i = store.length - 1; i >= 0; i--) {
                if (!where?.versionId || store[i].versionId === where.versionId) {
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

const itemsRuryDelegate = itemDelegate(itemsRury);

const txMock = {
    pricelistVersion: versionDelegate,
    pricelistItemRury: itemsRuryDelegate,
    pricelistItemStudnie: itemDelegate([]),
    pricelistItemPrecoKonfig: itemDelegate([]),
    pricelistItemPrecoKinety: itemDelegate([]),
    pricelistItemPrecoZakresy: itemDelegate([]),
    audit_logs: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            audits.push({ ...data });
            return { ...data };
        })
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        pricelistItemRury: itemsRuryDelegate,
        pricelistItemStudnie: itemDelegate([]),
        pricelistItemPrecoKonfig: itemDelegate([]),
        pricelistItemPrecoKinety: itemDelegate([]),
        pricelistItemPrecoZakresy: itemDelegate([]),
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
            const snap = JSON.stringify({ versions, itemsRury });
            try {
                return await fn(txMock);
            } catch (err) {
                const back = JSON.parse(snap) as {
                    versions: VRow[];
                    itemsRury: Array<Record<string, unknown>>;
                };
                versions.length = 0;
                versions.push(...back.versions);
                itemsRury.length = 0;
                itemsRury.push(...back.itemsRury);
                throw err;
            }
        })
    }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

const rura = (id: string, price = 100) => ({
    id,
    name: `Rura ${id}`,
    category: 'Rury Betonowe',
    price
});

function seedActive(): VRow {
    const row: VRow = {
        id: 'rury-active-1',
        type: 'rury',
        seq: 1,
        version: 'v1-20260801',
        status: 'ACTIVE',
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        sha256: 'seed',
        createdAt: '2026-08-01T00:00:00.000Z'
    };
    versions.push(row);
    itemsRury.push(
        { ...rura('r1', 110), id: `${row.id}:r1`, versionId: row.id },
        { ...rura('r2', 220), id: `${row.id}:r2`, versionId: row.id }
    );
    return { ...row };
}

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    audits.length = 0;
    mockUser.id = 'admin-1';
    mockUser.role = 'admin';
    jest.clearAllMocks();
});

describe('POST /:id/clone-draft', () => {
    test('403 dla nie-admina', async () => {
        seedActive();
        mockUser.role = 'user';
        const res = await request(app).post('/api/pricelist-versions/rury-active-1/clone-draft');
        expect(res.status).toBe(403);
        expect(versions).toHaveLength(1);
    });

    test('404 dla nieistniejącego id', async () => {
        const res = await request(app).post('/api/pricelist-versions/nie-ma-takiej/clone-draft');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
        expect(versions).toHaveLength(0);
    });

    test('200 klonuje wiersze; nowy DRAFT nie rusza ACTIVE', async () => {
        const src = seedActive();
        const res = await request(app).post(`/api/pricelist-versions/${src.id}/clone-draft`);
        expect(res.status).toBe(201);
        const clone = res.body.version as VRow;
        expect(clone.status).toBe('DRAFT');
        expect(clone.type).toBe('rury');
        expect(clone.seq).toBe(2);
        expect(clone.id).not.toBe(src.id);

        // count + wartości wierszy identyczne (biznesowe id bez prefiksu)
        const clonedItems = itemsRury.filter((i) => i.versionId === clone.id);
        expect(clonedItems).toHaveLength(2);
        const byId = new Map(clonedItems.map((i) => [String(i.id).split(':')[1], i]));
        expect(byId.get('r1')).toMatchObject({ name: 'Rura r1', price: 110 });
        expect(byId.get('r2')).toMatchObject({ name: 'Rura r2', price: 220 });

        // aktywna nietknięta
        expect(versions.find((v) => v.id === src.id)?.status).toBe('ACTIVE');
        expect(itemsRury.filter((i) => i.versionId === src.id)).toHaveLength(2);

        // audit CLONE
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ entityType: 'pricelist_version', action: 'CLONE' });
    });

    test('klonowanie z DRAFTu też dozwolone (dowolna wersja źródłowa)', async () => {
        const src = seedActive();
        const first = await request(app).post(`/api/pricelist-versions/${src.id}/clone-draft`);
        expect(first.status).toBe(201);
        const second = await request(app).post(
            `/api/pricelist-versions/${first.body.version.id}/clone-draft`
        );
        expect(second.status).toBe(201);
        expect(second.body.version.status).toBe('DRAFT');
        expect(second.body.version.seq).toBe(3);
        expect(versions.filter((v) => v.status === 'DRAFT')).toHaveLength(2);
    });
});
