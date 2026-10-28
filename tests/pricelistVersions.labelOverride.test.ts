/**
 * Ręczna korekta etykiety wersji cennika (labelOverride): PATCH /:id/label.
 * Kontrakt: admin only, `version` (etykieta pochodna) i seq/effectiveFrom
 * nietknięte, `label: null` przywraca pochodną, kolizja w typie → 409,
 * znaki/długość → 422, każda zmiana w audycie (old/new).
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

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

interface VRow {
    id: string;
    type: string;
    seq: number;
    version: string;
    labelOverride?: string | null;
    status: string;
    effectiveFrom: string;
    sha256: string;
    updatedAt?: string;
}

const versions: VRow[] = [];
const audits: Array<Record<string, unknown>> = [];

type Where = {
    id?: string | { not: string };
    type?: string;
    status?: string | { in: string[] };
    effectiveFrom?: { lte: string };
};

function matchWhere(v: VRow, where: Where | undefined): boolean {
    if (!where) return true;
    if (where.type !== undefined && v.type !== where.type) return false;
    if (typeof where.status === 'string' && v.status !== where.status) return false;
    if (where.status && typeof where.status === 'object') {
        if (!where.status.in.includes(v.status)) return false;
    }
    if (where.effectiveFrom?.lte !== undefined && !(v.effectiveFrom <= where.effectiveFrom.lte)) {
        return false;
    }
    if (where.id !== undefined) {
        if (typeof where.id === 'string') return v.id === where.id;
        return v.id !== where.id.not;
    }
    return true;
}

const versionDelegate = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return versions.find((v) => v.id === where.id) ?? null;
    }),
    findFirst: jest.fn(async ({ where }: { where?: Where } = {}) => {
        const hit = versions
            .filter((v) => matchWhere(v, where))
            .sort((a, b) =>
                a.effectiveFrom === b.effectiveFrom
                    ? b.seq - a.seq
                    : a.effectiveFrom < b.effectiveFrom
                      ? 1
                      : -1
            );
        return hit[0] ? { ...hit[0] } : null;
    }),
    findMany: jest.fn(async ({ where }: { where?: Where } = {}) => {
        return versions.filter((v) => matchWhere(v, where)).map((v) => ({ ...v }));
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<VRow> }) => {
        const row = versions.find((v) => v.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return { ...row };
    })
};

const txMock = {
    pricelistVersion: versionDelegate,
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
        settings: {
            findMany: jest.fn(async () => []),
            findUnique: jest.fn(async () => null)
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock))
    }
}));

import pricelistVersionsRouter from '../src/routes/pricelistVersions';
import { effectiveLabel, setLabelOverride } from '../src/services/pricelistVersionService';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', pricelistVersionsRouter);

function seed(input: Partial<VRow> & Pick<VRow, 'id' | 'version'>): VRow {
    const row: VRow = {
        type: 'studnie',
        seq: 5,
        status: 'APPROVED',
        effectiveFrom: '2026-10-22T00:00:00.000Z',
        sha256: 'sha-x',
        labelOverride: null,
        ...input
    };
    versions.push(row);
    return row;
}

beforeEach(() => {
    versions.length = 0;
    audits.length = 0;
    mockUser.role = 'admin';
    jest.clearAllMocks();
});

describe('PATCH /api/pricelist-versions/:id/label', () => {
    test('ustawia ręczną etykietę: version/seq/data nietknięte + audit old/new', async () => {
        const row = seed({ id: 'sv5', version: 'Sv5-20261022' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'Sv5-20261022 korekta' });

        expect(res.status).toBe(200);
        expect(res.body.label).toBe('Sv5-20261022 korekta');
        expect(res.body.version.labelOverride).toBe('Sv5-20261022 korekta');
        expect(res.body.version.version).toBe('Sv5-20261022');
        expect(row.version).toBe('Sv5-20261022');
        expect(row.seq).toBe(5);
        expect(row.effectiveFrom).toBe('2026-10-22T00:00:00.000Z');

        const audit = audits.find((a) => a['action'] === 'UPDATE');
        expect(audit).toBeDefined();
        expect(String(audit?.['oldData'])).toContain('Sv5-20261022');
        expect(String(audit?.['newData'])).toContain('Sv5-20261022 korekta');
    });

    test('label: null przywraca etykietę pochodną (override wyczyszczony)', async () => {
        seed({ id: 'sv5', version: 'Sv5-20261022', labelOverride: 'Sv5-20261022 korekta' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: null });

        expect(res.status).toBe(200);
        expect(res.body.version.labelOverride).toBeNull();
        expect(res.body.label).toBe('Sv5-20261022');
    });

    test('override równy etykiecie pochodnej nie jest zapisywany jako override', async () => {
        const row = seed({ id: 'sv5', version: 'Sv5-20261022' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'Sv5-20261022' });

        expect(res.status).toBe(200);
        expect(row.labelOverride).toBeNull();
        expect(res.body.label).toBe('Sv5-20261022');
    });

    test('kolizja z etykietą innej wersji tego samego typu → 409 LABEL_COLLISION', async () => {
        seed({ id: 'sv5', version: 'Sv5-20261022' });
        seed({ id: 'sv6', version: 'Sv6-20261023' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'Sv6-20261023' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('LABEL_COLLISION');
    });

    test('kolizja z ręczną etykietą innej wersji → 409 LABEL_COLLISION', async () => {
        seed({ id: 'sv5', version: 'Sv5-20261022' });
        seed({
            id: 'sv6',
            version: 'Sv6-20261023',
            labelOverride: 'Cennik studnie 2026'
        });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'Cennik studnie 2026' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('LABEL_COLLISION');
    });

    test('znaki spoza dozwolonych → 422 INVALID_LABEL', async () => {
        seed({ id: 'sv5', version: 'Sv5-20261022' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: '<script>alert(1)</script>' });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVALID_LABEL');
    });

    test('dłuższa niż 64 znaki → 422 LABEL_TOO_LONG', async () => {
        seed({ id: 'sv5', version: 'Sv5-20261022' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'a'.repeat(65) });

        expect(res.status).toBe(422);
        expect(res.body.code).toBe('LABEL_TOO_LONG');
    });

    test('nie-admin → 403 (bez zapisu i bez audytu)', async () => {
        mockUser.role = 'user';
        const row = seed({ id: 'sv5', version: 'Sv5-20261022' });

        const res = await request(app)
            .patch('/api/pricelist-versions/sv5/label')
            .send({ label: 'Cokolwiek' });

        expect(res.status).toBe(403);
        expect(row.labelOverride).toBeNull();
        expect(audits).toHaveLength(0);
    });

    test('GET /labels zwraca etykietę efektywną (override nad pochodną)', async () => {
        seed({
            id: 'sv5',
            version: 'Sv5-20261022',
            labelOverride: 'Sv5-20261022 korekta',
            effectiveFrom: '2020-01-01T00:00:00.000Z'
        });

        const res = await request(app).get('/api/pricelist-versions/labels?type=studnie');

        expect(res.status).toBe(200);
        expect(res.body.versions[0].label).toBe('Sv5-20261022 korekta');
        expect(res.body.versions[0].version).toBe('Sv5-20261022');
    });
});

describe('setLabelOverride (serwis)', () => {
    test('effectiveLabel preferuje override, inaczej etykietę pochodną', () => {
        expect(effectiveLabel({ version: 'Sv5-20261022' })).toBe('Sv5-20261022');
        expect(effectiveLabel({ version: 'Sv5-20261022', labelOverride: null })).toBe(
            'Sv5-20261022'
        );
        expect(effectiveLabel({ version: 'Sv5-20261022', labelOverride: '  ' })).toBe(
            'Sv5-20261022'
        );
        expect(effectiveLabel({ version: 'Sv5-20261022', labelOverride: 'Cennik 2026/10' })).toBe(
            'Cennik 2026/10'
        );
    });

    test('nieznana wersja → 404 NOT_FOUND', async () => {
        await expect(setLabelOverride('brak', 'X')).rejects.toMatchObject({
            statusCode: 404,
            code: 'NOT_FOUND'
        });
    });
});
