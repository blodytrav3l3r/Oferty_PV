/**
 * GET /api/pricelist-versions/labels — etykiety bez cen (dostępne dla zalogowanych).
 * Bez ?ids: tylko APPROVED z effectiveFrom <= now. Z ?ids=a,b,c (max 50): te wersje BEZ filtra
 * statusu (pieczątka archiwalna nie kłamie „legacy"); zły format → 422.
 */
import request from 'supertest';
import express from 'express';

const mockUser: { id: string; role: string } = { id: 'user-1', role: 'user' };

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
}

const versions: VRow[] = [
    {
        id: 'rury-active',
        type: 'rury',
        seq: 2,
        version: 'v2-20200102',
        status: 'APPROVED',
        effectiveFrom: '2020-01-02T00:00:00.000Z'
    },
    {
        id: 'rury-arch',
        type: 'rury',
        seq: 1,
        version: 'v1-20200101',
        status: 'APPROVED',
        effectiveFrom: '2020-01-01T00:00:00.000Z'
    },
    {
        id: 'rury-draft',
        type: 'rury',
        seq: 3,
        version: 'v3-20200103',
        status: 'DRAFT',
        effectiveFrom: '2020-01-03T00:00:00.000Z'
    }
];

let lastWhere: unknown = null;

const versionDelegate = {
    findMany: jest.fn(
        async ({
            where,
            select
        }: {
            where?: Record<string, unknown>;
            select?: Record<string, boolean>;
        }) => {
            lastWhere = where;
            let out = [...versions];
            if (where?.type !== undefined) out = out.filter((v) => v.type === where.type);
            const status = where?.status as string | { in: string[] } | undefined;
            if (typeof status === 'string') out = out.filter((v) => v.status === status);
            else if (status !== undefined) out = out.filter((v) => status.in.includes(v.status));
            const ef = (where as { effectiveFrom?: { lte: string } })?.effectiveFrom;
            if (ef?.lte !== undefined) out = out.filter((v) => v.effectiveFrom <= ef.lte);
            const idIn = (where as { id?: { in: string[] } })?.id;
            if (idIn !== undefined) out = out.filter((v) => idIn.in.includes(v.id));
            // Prisma select: zwraca tylko wybrane pola (tu: 5 bez cen).
            if (select !== undefined) {
                const keys = Object.keys(select).filter((k) => select[k]);
                return out.map((v) => {
                    const row: Record<string, unknown> = {};
                    for (const k of keys) row[k] = (v as unknown as Record<string, unknown>)[k];
                    return row;
                });
            }
            return out.map((v) => ({ ...v }));
        }
    )
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: { pricelistVersion: versionDelegate }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

beforeEach(() => {
    jest.clearAllMocks();
    lastWhere = null;
});

describe('GET /api/pricelist-versions/labels', () => {
    test('bez ids: tylko APPROVED z effectiveFrom <= now (starsza też wraca)', async () => {
        const res = await request(app).get('/api/pricelist-versions/labels?type=rury');
        expect(res.status).toBe(200);
        const ids = (res.body.versions as VRow[]).map((v) => v.id);
        expect(ids).toContain('rury-active');
        expect(ids).toContain('rury-arch');
        expect(ids).not.toContain('rury-draft');
        expect(lastWhere).toMatchObject({
            type: 'rury',
            status: 'APPROVED',
            effectiveFrom: { lte: expect.any(String) }
        });
    });

    test('z ids: zwraca APPROVED (te same 5 pól, bez cen)', async () => {
        const res = await request(app).get(
            '/api/pricelist-versions/labels?type=rury&ids=rury-arch,rury-active,rury-draft'
        );
        expect(res.status).toBe(200);
        const got = res.body.versions as VRow[];
        expect(got.map((v) => v.id).sort()).toEqual(['rury-active', 'rury-arch']);
        for (const v of got) {
            expect(Object.keys(v).sort()).toEqual(
                ['effectiveFrom', 'id', 'seq', 'type', 'version'].sort()
            );
        }
        expect(lastWhere).toEqual({
            type: 'rury',
            status: 'APPROVED',
            id: { in: ['rury-arch', 'rury-active', 'rury-draft'] }
        });
    });

    test('zły format ids → 422 (puste, duplikat przecinka, >50)', async () => {
        for (const bad of ['ids=', 'ids=%20%20', 'ids=a,,b', 'ids=a,']) {
            const res = await request(app).get(`/api/pricelist-versions/labels?type=rury&${bad}`);
            expect(res.status).toBe(422);
            expect(res.body.code).toBe('INVALID_IDS');
        }
        const many = Array.from({ length: 51 }, (_, i) => `id-${i}`).join(',');
        const resMany = await request(app).get(
            `/api/pricelist-versions/labels?type=rury&ids=${many}`
        );
        expect(resMany.status).toBe(422);
        expect(resMany.body.code).toBe('INVALID_IDS');
    });

    test('zły typ → 422 także z ids', async () => {
        const res = await request(app).get('/api/pricelist-versions/labels?type=zly&ids=a');
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_TYPE');
    });
});
