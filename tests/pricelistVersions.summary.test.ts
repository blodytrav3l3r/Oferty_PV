/**
 * GET /api/pricelist-versions/summary + batch PRECO w GET /.
 * Route-level: auth nagłówkami, DB mockowana (kontrakt HTTP + liczba zapytań).
 */
import express from 'express';
import request from 'supertest';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (req.headers['x-test-anon']) {
            res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
            return;
        }
        req.user = {
            id: (req.headers['x-user-id'] as string) || 'u-test',
            role: (req.headers['x-user-role'] as string) || 'user'
        };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ error: 'Brak uprawnień - wymagany administrator' });
            return;
        }
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/pricelist/usage', () => {
    const actual = jest.requireActual('../src/services/pricelist/usage');
    return {
        ...actual,
        countVersionUsage: jest.fn(),
        getPrecoReferences: jest.fn()
    };
});

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    createdBy?: string | null;
}

let versions: VRow[] = [];

const versionDelegate = {
    findFirst: jest.fn(async ({ where, orderBy, select }: any) => {
        const hit = versions.filter((v) => {
            if (where.type !== undefined && v.type !== where.type) return false;
            if (typeof where.status === 'string' && v.status !== where.status) return false;
            if (where.status?.in && !where.status.in.includes(v.status)) return false;
            const ef = where.effectiveFrom;
            if (ef?.lte !== undefined && !(v.effectiveFrom <= ef.lte)) return false;
            if (ef?.gt !== undefined && !(v.effectiveFrom > ef.gt)) return false;
            return true;
        });
        const order: Array<{ effectiveFrom?: 'asc' | 'desc'; seq?: 'asc' | 'desc' }> =
            Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        hit.sort((a, b) => {
            for (const part of order) {
                if (part.effectiveFrom) {
                    const cmp =
                        a.effectiveFrom === b.effectiveFrom
                            ? 0
                            : a.effectiveFrom < b.effectiveFrom
                              ? -1
                              : 1;
                    if (cmp !== 0) return part.effectiveFrom === 'desc' ? -cmp : cmp;
                }
                if (part.seq) {
                    const cmp = a.seq - b.seq;
                    if (cmp !== 0) return part.seq === 'desc' ? -cmp : cmp;
                }
            }
            return 0;
        });
        const row = hit[0];
        if (!row || !select) return row ?? null;
        return Object.fromEntries(
            Object.keys(select)
                .filter((key) => select[key])
                .map((key) => [key, row[key as keyof VRow]])
        );
    }),
    findMany: jest.fn(async ({ where, orderBy }: any) => {
        const hit = versions.filter((v) => where?.type === undefined || v.type === where.type);
        const order: Array<{ type?: 'asc' | 'desc'; seq?: 'asc' | 'desc' }> = Array.isArray(orderBy)
            ? orderBy
            : orderBy
              ? [orderBy]
              : [];
        hit.sort((a, b) => {
            for (const part of order) {
                if (part.type) {
                    const cmp = a.type === b.type ? 0 : a.type < b.type ? -1 : 1;
                    if (cmp !== 0) return part.type === 'desc' ? -cmp : cmp;
                }
                if (part.seq) {
                    const cmp = a.seq - b.seq;
                    if (cmp !== 0) return part.seq === 'desc' ? -cmp : cmp;
                }
            }
            return 0;
        });
        return hit;
    })
};

const usersDelegate = {
    findMany: jest.fn(async () => [])
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        users: usersDelegate
    }
}));

import router from '../src/routes/pricelistVersions';
import { countVersionUsage, getPrecoReferences } from '../src/services/pricelist/usage';

const countVersionUsageMock = countVersionUsage as jest.Mock;
const getPrecoReferencesMock = getPrecoReferences as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

const ADMIN = { 'x-user-id': 'admin-1', 'x-user-role': 'admin' };
const USER = { 'x-user-id': 'u-1', 'x-user-role': 'user' };
const ANON = { 'x-test-anon': '1' };

function version(partial: Partial<VRow> & Pick<VRow, 'id' | 'type'>): VRow {
    return {
        seq: 1,
        version: 'v1',
        status: 'APPROVED',
        effectiveFrom: '2020-01-01T00:00:00.000Z',
        ...partial
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    versions = [];
    countVersionUsageMock.mockResolvedValue({ offers: 0, orders: 0, total: 0 });
    getPrecoReferencesMock.mockResolvedValue(new Map());
});

describe('GET /api/pricelist-versions/summary — dostęp', () => {
    test('401 bez sesji, 403 dla usera, 200 dla admina, no-store', async () => {
        expect((await request(app).get('/api/pricelist-versions/summary').set(ANON)).status).toBe(
            401
        );
        expect((await request(app).get('/api/pricelist-versions/summary').set(USER)).status).toBe(
            403
        );
        const ok = await request(app).get('/api/pricelist-versions/summary').set(ADMIN);
        expect(ok.status).toBe(200);
        expect(ok.headers['cache-control']).toBe('no-store');
    });
});

describe('GET /api/pricelist-versions/summary — kształt', () => {
    test('3 typy: active = najnowsza APPROVED <= now, nextScheduled = najwcześniejsza przyszła APPROVED', async () => {
        versions = [
            version({ id: 'r-old', type: 'rury', seq: 1, effectiveFrom: '2020-01-01T00:00:00Z' }),
            version({ id: 'r-new', type: 'rury', seq: 2, effectiveFrom: '2021-01-01T00:00:00Z' }),
            version({
                id: 'r-draft-newest',
                type: 'rury',
                seq: 6,
                status: 'DRAFT',
                effectiveFrom: '2025-01-01T00:00:00Z'
            }),
            version({
                id: 'r-future-active',
                type: 'rury',
                seq: 3,
                effectiveFrom: '2999-05-01T00:00:00Z'
            }),
            version({
                id: 'r-active-2998',
                type: 'rury',
                seq: 7,
                effectiveFrom: '2998-01-01T00:00:00Z'
            }),
            version({
                id: 'r-sched-past',
                type: 'rury',
                seq: 4,
                status: 'APPROVED',
                effectiveFrom: '2020-06-01T00:00:00Z'
            }),
            version({
                id: 'r-sched-late',
                type: 'rury',
                seq: 5,
                status: 'APPROVED',
                effectiveFrom: '2999-02-01T00:00:00Z'
            }),
            version({
                id: 'r-sched-early',
                type: 'rury',
                seq: 2,
                status: 'APPROVED',
                effectiveFrom: '2999-01-01T00:00:00Z'
            }),
            version({
                id: 's-active',
                type: 'studnie',
                seq: 1,
                status: 'APPROVED',
                effectiveFrom: '2021-01-01T00:00:00Z'
            }),
            version({
                id: 's-sched',
                type: 'studnie',
                seq: 2,
                status: 'APPROVED',
                effectiveFrom: '2999-03-01T00:00:00Z'
            }),
            version({
                id: 'p-active',
                type: 'preco',
                seq: 1,
                effectiveFrom: '2022-01-01T00:00:00Z'
            }),
            version({
                id: 'p-sched',
                type: 'preco',
                seq: 2,
                status: 'APPROVED',
                effectiveFrom: '2999-04-01T00:00:00Z'
            })
        ];

        const res = await request(app).get('/api/pricelist-versions/summary').set(ADMIN);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['generatedAt', 'types']);
        expect(typeof res.body.generatedAt).toBe('string');
        expect(Number.isNaN(Date.parse(res.body.generatedAt))).toBe(false);
        expect(Object.keys(res.body.types).sort()).toEqual(['preco', 'rury', 'studnie']);

        expect(res.body.types.rury.active).toEqual({
            id: 'r-new',
            version: 'v1',
            seq: 2,
            effectiveFrom: '2021-01-01T00:00:00Z',
            status: 'APPROVED',
            state: 'ACTIVE'
        });
        expect(res.body.types.rury.nextScheduled).toEqual({
            id: 'r-active-2998',
            version: 'v1',
            seq: 7,
            effectiveFrom: '2998-01-01T00:00:00Z',
            status: 'APPROVED',
            state: 'SCHEDULED'
        });
        expect(res.body.types.studnie.active.id).toBe('s-active');
        expect(res.body.types.studnie.nextScheduled.id).toBe('s-sched');
        expect(res.body.types.preco.active.id).toBe('p-active');
        expect(res.body.types.preco.nextScheduled.id).toBe('p-sched');
        expect(Object.keys(res.body.types.rury.active).sort()).toEqual([
            'effectiveFrom',
            'id',
            'seq',
            'state',
            'status',
            'version'
        ]);
    });

    test('pusty stan: active i nextScheduled = null dla 3 typów', async () => {
        const res = await request(app).get('/api/pricelist-versions/summary').set(ADMIN);
        expect(res.status).toBe(200);
        for (const type of ['rury', 'studnie', 'preco']) {
            expect(res.body.types[type]).toEqual({
                active: null,
                nextScheduled: null,
                draftCount: 0,
                approvedCount: 0,
                collisionCount: 0
            });
        }
    });

    test('dokładnie 6 findFirst (3× active + 3× scheduled), brak N+1', async () => {
        versions = [
            version({ id: 'r1', type: 'rury' }),
            version({ id: 's1', type: 'studnie' }),
            version({ id: 'p1', type: 'preco' })
        ];
        await request(app).get('/api/pricelist-versions/summary').set(ADMIN);
        expect(versionDelegate.findFirst).toHaveBeenCalledTimes(6);
    });
});

describe('GET /api/pricelist-versions/ — batch PRECO', () => {
    test('PRECO: usedBy z jednej mapy referencji, usedByKind=studnieVersions, bez countVersionUsage', async () => {
        versions = [
            version({ id: 'p1', type: 'preco', seq: 1 }),
            version({ id: 'p2', type: 'preco', seq: 2, status: 'DRAFT' }),
            version({ id: 's1', type: 'studnie', seq: 1 })
        ];
        getPrecoReferencesMock.mockResolvedValue(new Map([['p1', { count: 1, labels: ['v2'] }]]));
        countVersionUsageMock.mockResolvedValue({ offers: 2, orders: 1, total: 3 });

        const res = await request(app).get('/api/pricelist-versions').set(ADMIN);
        expect(res.status).toBe(200);
        const byId = new Map(
            (res.body.versions as Array<Record<string, unknown>>).map((v) => [v.id, v])
        );

        expect(byId.get('p1')).toMatchObject({
            usedBy: 1,
            usedByKind: 'studnieVersions',
            state: 'ACTIVE'
        });
        expect(byId.get('p2')).toMatchObject({
            usedBy: 0,
            usedByKind: 'studnieVersions'
        });
        expect(byId.get('s1')).toMatchObject({ usedBy: 3, usedByKind: 'offers' });

        expect(getPrecoReferencesMock).toHaveBeenCalledTimes(1);
        expect(countVersionUsageMock).toHaveBeenCalledTimes(1);
        expect(countVersionUsageMock).toHaveBeenCalledWith('s1');
        expect(versionDelegate.findMany).toHaveBeenCalledTimes(1);
    });

    test('brak PRECO: zero zapytań referencji', async () => {
        versions = [version({ id: 's1', type: 'studnie' })];
        countVersionUsageMock.mockResolvedValue({ offers: 0, orders: 0, total: 0 });

        const res = await request(app).get('/api/pricelist-versions').set(ADMIN);
        expect(res.status).toBe(200);
        expect(getPrecoReferencesMock).not.toHaveBeenCalled();
        expect(countVersionUsageMock).toHaveBeenCalledWith('s1');
    });
});
