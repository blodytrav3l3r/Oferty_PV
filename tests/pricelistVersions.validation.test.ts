/**
 * Walidacja tras PUT /:id i DELETE /:id (Zod na krawędzi, wzorzec clone-draft):
 * kształt body → 400 INVALID_BODY, :id → 400 INVALID_ID, domena (nota,
 * wiersze, NO_CHANGES) zostaje w serwisie → 422, bez dublowania błędów.
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
    note?: string | null;
    sha256: string;
}

const versions: VRow[] = [];
const itemsRury: Array<Record<string, unknown>> = [];
const audits: Array<Record<string, unknown>> = [];

function zeroCount() {
    return jest.fn(async () => 0);
}

const txMock = {
    pricelistVersion: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
            return versions.find((v) => v.id === where.id) ?? null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<VRow> }) => {
            const v = versions.find((x) => x.id === where.id);
            if (!v) throw new Error('Not found');
            Object.assign(v, data);
            return { ...v };
        }),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
            const idx = versions.findIndex((v) => v.id === where.id);
            if (idx === -1) throw new Error('Not found');
            const [gone] = versions.splice(idx, 1);
            return gone;
        })
    },
    pricelistItemRury: {
        deleteMany: jest.fn(async ({ where }: { where: { versionId: string } }) => {
            let n = 0;
            for (let i = itemsRury.length - 1; i >= 0; i--) {
                if (itemsRury[i]['versionId'] === where.versionId) {
                    itemsRury.splice(i, 1);
                    n++;
                }
            }
            return { count: n };
        })
    },
    offers_rel: { count: zeroCount() },
    offers_studnie_rel: { count: zeroCount() },
    orders_rury_rel: { count: zeroCount() },
    orders_studnie_rel: { count: zeroCount() },
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
        pricelistVersion: {
            findUnique: (...a: unknown[]) =>
                (txMock.pricelistVersion.findUnique as (...x: unknown[]) => Promise<unknown>)(...a)
        },
        offers_rel: { count: zeroCount() },
        offers_studnie_rel: { count: zeroCount() },
        orders_rury_rel: { count: zeroCount() },
        orders_studnie_rel: { count: zeroCount() },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

function seedDraft(id = 'v-draft-1'): VRow {
    const v: VRow = {
        id,
        type: 'rury',
        seq: 3,
        version: 'v3-20260927',
        status: 'DRAFT',
        effectiveFrom: '2026-09-27T00:00:00.000Z',
        note: 'start',
        sha256: 'x'
    };
    versions.push({ ...v });
    return v;
}

beforeEach(() => {
    versions.length = 0;
    itemsRury.length = 0;
    audits.length = 0;
    mockUser.role = 'admin';
    jest.clearAllMocks();
});

describe('PUT /:id walidacja', () => {
    test('note liczbą → 400 INVALID_BODY (krawędź, przed serwisem)', async () => {
        const v = seedDraft();
        const res = await request(app).put(`/api/pricelist-versions/${v.id}`).send({ note: 123 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_BODY');
        expect(versions.find((x) => x.id === v.id)?.note).toBe('start');
    });

    test('body tablicą → 400 INVALID_BODY', async () => {
        const v = seedDraft();
        const res = await request(app)
            .put(`/api/pricelist-versions/${v.id}`)
            .send([1, 2, 3] as unknown as Record<string, unknown>);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_BODY');
    });

    test('puste body → 422 NO_CHANGES (serwis, brak dubla 400)', async () => {
        const v = seedDraft();
        const res = await request(app).put(`/api/pricelist-versions/${v.id}`).send({});
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('NO_CHANGES');
    });

    test('nota 501 znaków → 422 NOTE_TOO_LONG (serwis, nie krawędź)', async () => {
        const v = seedDraft();
        const res = await request(app)
            .put(`/api/pricelist-versions/${v.id}`)
            .send({ note: 'x'.repeat(501) });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('NOTE_TOO_LONG');
    });

    test('złe wiersze → 422 INVALID_ROWS (serwis, krawędź nie preemptuje)', async () => {
        const v = seedDraft();
        const res = await request(app)
            .put(`/api/pricelist-versions/${v.id}`)
            .send({ rows: [{ bogus: 1 }] });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_ROWS');
    });

    test('sama nota → 200, trim po stronie serwisu', async () => {
        const v = seedDraft();
        const res = await request(app)
            .put(`/api/pricelist-versions/${v.id}`)
            .send({ note: '  korekta  ' });
        expect(res.status).toBe(200);
        expect(res.body.version.note).toBe('korekta');
    });

    test('nieistniejące id → 404 NOT_FOUND', async () => {
        const res = await request(app).put('/api/pricelist-versions/nie-ma').send({ note: 'x' });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });
});

describe('DELETE /:id walidacja', () => {
    test('DRAFT kasuje → 200 { id }', async () => {
        const v = seedDraft();
        const res = await request(app).delete(`/api/pricelist-versions/${v.id}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: v.id });
        expect(versions.find((x) => x.id === v.id)).toBeUndefined();
    });

    test('nieistniejące id → 404 NOT_FOUND', async () => {
        const res = await request(app).delete('/api/pricelist-versions/nie-ma');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });
});
