/**
 * GET /api/pricelist-versions/:id/preview — podgląd wersji (read-only JSON).
 * Route-level: auth mock nagłówkami, DB mockowana (kontrakt HTTP + kształt).
 * Cap 5000/arkusz, liczniki sprzed capa, PRECO tylko jako precoIncluded/precoVersion.
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

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    createdBy?: string | null;
    note?: string | null;
    sha256?: string;
}

let versions: VRow[] = [];
let itemsRury: Array<Record<string, unknown>> = [];
let itemsStudnie: Array<Record<string, unknown>> = [];
let itemsKonfig: Array<Record<string, unknown>> = [];
let itemsKinety: Array<Record<string, unknown>> = [];
let itemsZakresy: Array<Record<string, unknown>> = [];

const versionDelegate = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const maxSeq =
            typeof where.seq === 'object' && where.seq !== null
                ? (where.seq.lte ?? Number.POSITIVE_INFINITY)
                : (where.seq ?? Number.POSITIVE_INFINITY);
        const maxEffectiveFrom = where.effectiveFrom?.lte;
        const statuses = where.status?.in;
        const hit = versions.filter(
            (v) =>
                (where.type === undefined || v.type === where.type) &&
                (statuses === undefined || statuses.includes(v.status)) &&
                (where.seq === undefined || v.seq <= maxSeq) &&
                (maxEffectiveFrom === undefined ||
                    (typeof v.effectiveFrom === 'string' && v.effectiveFrom <= maxEffectiveFrom))
        );
        const order: Array<{ effectiveFrom?: 'asc' | 'desc'; seq?: 'asc' | 'desc' }> =
            Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        hit.sort((a, b) => {
            for (const part of order) {
                if (part.effectiveFrom) {
                    const ae = a.effectiveFrom ?? '';
                    const be = b.effectiveFrom ?? '';
                    const cmp = ae === be ? 0 : ae < be ? -1 : 1;
                    if (cmp !== 0) return part.effectiveFrom === 'desc' ? -cmp : cmp;
                }
                if (part.seq) {
                    const cmp = a.seq - b.seq;
                    if (cmp !== 0) return part.seq === 'desc' ? -cmp : cmp;
                }
            }
            return 0;
        });
        return hit[0] ?? null;
    })
};

const ruryDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsRury.filter((r) => r.versionId === where.versionId)
    )
};
const studnieDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsStudnie.filter((r) => r.versionId === where.versionId)
    )
};
const konfigDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsKonfig.filter((r) => r.versionId === where.versionId)
    )
};
const kinetyDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsKinety.filter((r) => r.versionId === where.versionId)
    )
};
const zakresyDelegate = {
    findMany: jest.fn(async ({ where }: { where: { versionId: string } }) =>
        itemsZakresy.filter((r) => r.versionId === where.versionId)
    )
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: versionDelegate,
        pricelistItemRury: ruryDelegate,
        pricelistItemStudnie: studnieDelegate,
        pricelistItemPrecoKonfig: konfigDelegate,
        pricelistItemPrecoKinety: kinetyDelegate,
        pricelistItemPrecoZakresy: zakresyDelegate
    }
}));

import router from '../src/routes/pricelistVersions';

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
        status: 'ACTIVE',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        sha256: 'sha',
        ...partial
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    versions = [
        version({ id: 'rury-1', type: 'rury' }),
        version({
            id: 'studnie-1',
            type: 'studnie',
            seq: 2,
            effectiveFrom: '2026-02-01T00:00:00.000Z'
        }),
        version({
            id: 'studnie-nopreco',
            type: 'studnie',
            seq: 1,
            effectiveFrom: '2025-01-01T00:00:00.000Z'
        }),
        version({ id: 'preco-1', type: 'preco', status: 'ACTIVE' }),
        version({ id: 'empty-1', type: 'rury', seq: 9 })
    ];
    itemsRury = [
        {
            id: 'rury-1:R1',
            versionId: 'rury-1',
            name: 'Rura A',
            price: 10,
            category: 'K1',
            weight: 2,
            transport: 5,
            area: 1.5
        }
    ];
    itemsStudnie = [
        {
            id: 'studnie-1:K1',
            versionId: 'studnie-1',
            name: 'Krąg',
            category: 'Kręgi',
            componentType: 'krag',
            dn: '1000',
            price: 100
        },
        {
            id: 'studnie-nopreco:A1',
            versionId: 'studnie-nopreco',
            name: 'Właz',
            category: 'Akcesoria',
            componentType: 'wlaz',
            price: 50
        }
    ];
    itemsKonfig = [];
    itemsKinety = [
        {
            id: 'preco-1:k1',
            versionId: 'preco-1',
            order: 0,
            dn: 160,
            wellDn: 1000,
            height: 500,
            cena: 11
        }
    ];
    itemsZakresy = [];
});

describe('GET /api/pricelist-versions/:id/preview — dostęp', () => {
    test('401 bez sesji, 403 dla usera, 200 dla admina', async () => {
        expect(
            (await request(app).get('/api/pricelist-versions/rury-1/preview').set(ANON)).status
        ).toBe(401);
        expect(
            (await request(app).get('/api/pricelist-versions/rury-1/preview').set(USER)).status
        ).toBe(403);
        expect(
            (await request(app).get('/api/pricelist-versions/rury-1/preview').set(ADMIN)).status
        ).toBe(200);
    });

    test('400 INVALID_ID bez echa surowego id', async () => {
        const bad = [
            '..%2Fevil',
            encodeURIComponent('<script>alert(1)</script>'),
            '%00',
            'x'.repeat(65),
            'x'.repeat(10000)
        ];
        for (const id of bad) {
            const res = await request(app).get(`/api/pricelist-versions/${id}/preview`).set(ADMIN);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_ID');
            expect(res.headers['cache-control']).toBe('no-store');
            expect(JSON.stringify(res.body)).not.toContain('script');
            expect(JSON.stringify(res.body)).not.toContain('evil');
        }
    });

    test('404 NOT_FOUND dla nieistniejącej wersji', async () => {
        const res = await request(app).get('/api/pricelist-versions/nie-ma/preview').set(ADMIN);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
        expect(res.headers['cache-control']).toBe('no-store');
    });
});

describe('GET /api/pricelist-versions/:id/preview — kształt', () => {
    test('rury: sheets + counts + totalRows, brak pól PRECO, no-store', async () => {
        const res = await request(app).get('/api/pricelist-versions/rury-1/preview').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.version.id).toBe('rury-1');
        expect(res.body.sheets['Cennik Rury']).toHaveLength(1);
        expect(res.body.counts).toEqual({
            totalRows: 1,
            bySheet: { 'Cennik Rury': 1 }
        });
        expect(res.body.totalRows).toBe(1);
        expect(res.body.truncated).toBe(false);
        expect(res.body.precoIncluded).toBeUndefined();
        expect(res.body.precoVersion).toBeUndefined();
    });

    test('studnie: PRECO tylko jako precoIncluded/precoVersion, nie w sheets', async () => {
        const res = await request(app).get('/api/pricelist-versions/studnie-1/preview').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.precoIncluded).toBe(true);
        expect(res.body.precoVersion).toEqual({
            id: 'preco-1',
            version: 'v1',
            seq: 1
        });
        const sheetNames = Object.keys(res.body.sheets);
        expect(sheetNames).toEqual(['DN1000']);
        expect(sheetNames).not.toContain('PRECO_Kinety');
    });

    test('studnie bez kwalifikującej się PRECO: false + null', async () => {
        const res = await request(app)
            .get('/api/pricelist-versions/studnie-nopreco/preview')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.precoIncluded).toBe(false);
        expect(res.body.precoVersion).toBeNull();
    });

    test('studnie: DRAFT/SCHEDULED/BACKDATE_REQUESTED PRECO nie są referencją (D1)', async () => {
        versions = versions.filter((v) => v.id !== 'preco-1');
        versions.push(
            version({
                id: 'studnie-draftpreco',
                type: 'studnie',
                seq: 3,
                effectiveFrom: '2026-03-01T00:00:00.000Z'
            }),
            version({
                id: 'preco-draft',
                type: 'preco',
                status: 'DRAFT',
                seq: 2,
                effectiveFrom: '2026-01-01T00:00:00.000Z'
            }),
            version({
                id: 'preco-scheduled',
                type: 'preco',
                status: 'SCHEDULED',
                seq: 3,
                effectiveFrom: '2026-01-01T00:00:00.000Z'
            }),
            version({
                id: 'preco-bdr',
                type: 'preco',
                status: 'BACKDATE_REQUESTED',
                seq: 4,
                effectiveFrom: '2026-01-01T00:00:00.000Z'
            })
        );
        const res = await request(app)
            .get('/api/pricelist-versions/studnie-draftpreco/preview')
            .set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.precoIncluded).toBe(false);
        expect(res.body.precoVersion).toBeNull();
    });

    test('preco: arkusze PRECO, pola preco* pominięte', async () => {
        const res = await request(app).get('/api/pricelist-versions/preco-1/preview').set(ADMIN);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body.sheets)).toEqual(['PRECO_Kinety']);
        expect(res.body.counts.bySheet).toEqual({ PRECO_Kinety: 1 });
        expect(res.body.precoIncluded).toBeUndefined();
        expect(res.body.precoVersion).toBeUndefined();
    });

    test('puste sekcje: sheets {} i zerowe liczniki', async () => {
        const res = await request(app).get('/api/pricelist-versions/empty-1/preview').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sheets).toEqual({});
        expect(res.body.counts).toEqual({ totalRows: 0, bySheet: {} });
        expect(res.body.totalRows).toBe(0);
        expect(res.body.truncated).toBe(false);
    });

    test('cap 5000/arkusz: truncated=true, totalRows sprzed capa', async () => {
        versions.push(version({ id: 'rury-big', type: 'rury', seq: 10 }));
        itemsRury = Array.from({ length: 5001 }, (_, i) => ({
            id: `rury-big:R${i}`,
            versionId: 'rury-big',
            name: `Rura ${i}`,
            price: i
        }));
        const res = await request(app).get('/api/pricelist-versions/rury-big/preview').set(ADMIN);
        expect(res.status).toBe(200);
        expect(res.body.sheets['Cennik Rury']).toHaveLength(5000);
        expect(res.body.counts).toEqual({
            totalRows: 5001,
            bySheet: { 'Cennik Rury': 5001 }
        });
        expect(res.body.totalRows).toBe(5001);
        expect(res.body.truncated).toBe(true);
    });

    test('413 VERSION_TOO_LARGE powyżej 20000 wierszy (przed cięciem)', async () => {
        versions.push(version({ id: 'rury-huge', type: 'rury', seq: 11 }));
        itemsRury = Array.from({ length: 20001 }, (_, i) => ({
            id: `rury-huge:R${i}`,
            versionId: 'rury-huge',
            name: `Rura ${i}`,
            price: i
        }));
        const res = await request(app).get('/api/pricelist-versions/rury-huge/preview').set(ADMIN);
        expect(res.status).toBe(413);
        expect(res.body.code).toBe('VERSION_TOO_LARGE');
        expect(res.body.sheets).toBeUndefined();
        expect(res.headers['cache-control']).toBe('no-store');
    });

    test('422 INVALID_TYPE dla typu spoza allowlisty', async () => {
        versions.push(version({ id: 'zly-typ', type: 'nieznany' }));
        const res = await request(app).get('/api/pricelist-versions/zly-typ/preview').set(ADMIN);
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_TYPE');
    });
});
