/**
 * POST /api/shares — limit 50 atomowo w transakcji, idempotentny re-POST.
 */
import request from 'supertest';
import express from 'express';

type ShareRow = {
    id: string;
    documentType: string;
    documentId: string;
    sharedWithUserId: string;
};
const store: { shares: ShareRow[]; users: Record<string, { role: string }> } = {
    shares: [],
    users: {}
};

function matches(row: ShareRow, where: any): boolean {
    return Object.entries(where).every(([k, v]: [string, any]) => {
        if (v && typeof v === 'object' && 'in' in v) return v.in.includes((row as any)[k]);
        return (row as any)[k] === v;
    });
}

const sharesModel = {
    count: jest.fn(async ({ where }: any) => store.shares.filter((r) => matches(r, where)).length),
    findMany: jest.fn(async ({ where, select }: any) => {
        const rows = store.shares.filter((r) => matches(r, where));
        if (!select) return rows.map((r) => ({ ...r }));
        return rows.map((r) => {
            const o: any = {};
            for (const k of Object.keys(select)) o[k] = (r as any)[k];
            return o;
        });
    }),
    createMany: jest.fn(async ({ data }: any) => {
        for (const d of data) store.shares.push({ ...d });
        return { count: data.length };
    })
};

import sharesRouter from '../src/routes/shares';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/validators/authSchema', () => ({
    validateData: () => (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findMany: jest.fn(async ({ where }: any) =>
                Object.entries(store.users)
                    .filter(([id]) => where.id.in.includes(id))
                    .map(([id, u]) => ({ id, role: u.role }))
            )
        },
        offers_rel: {
            findUnique: jest.fn(async () => ({ userId: 'u1' }))
        },
        offers_studnie_rel: { findUnique: jest.fn(async () => null) },
        orders_rury_rel: { findUnique: jest.fn(async () => null) },
        orders_studnie_rel: { findUnique: jest.fn(async () => null) },
        document_shares: sharesModel,
        $transaction: jest.fn(async (fn: any) =>
            typeof fn === 'function' ? fn((global as any).__txPrisma) : fn
        )
    }
}));

// Transakcja widzi te same dane (współdzielony store — jak single-conn SQLite).
(global as any).__txPrisma = {
    document_shares: sharesModel
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/shares', sharesRouter);
    return app;
}

const DOC = { documentType: 'offer', documentId: 'doc1' };

beforeEach(() => {
    store.shares = [];
    store.users = { u2: { role: 'user' }, u3: { role: 'user' }, u4: { role: 'user' } };
    jest.clearAllMocks();
});

describe('POST /api/shares limit 50 atomowo', () => {
    test('dodaje udziały i zwraca added', async () => {
        const res = await request(createApp())
            .post('/api/shares')
            .send({ ...DOC, userIds: ['u2', 'u3'] });
        expect(res.status).toBe(200);
        expect(res.body.added).toBe(2);
        expect(store.shares).toHaveLength(2);
    });

    test('re-POST tych samych → added 0 bez duplikatów', async () => {
        const app = createApp();
        await request(app)
            .post('/api/shares')
            .send({ ...DOC, userIds: ['u2'] });
        const res = await request(app)
            .post('/api/shares')
            .send({ ...DOC, userIds: ['u2'] });
        expect(res.status).toBe(200);
        expect(res.body.added).toBe(0);
        expect(store.shares).toHaveLength(1);
    });

    test('limit 50 egzekwowany (49 + 2 → 400, stan bez zmian)', async () => {
        store.users = Object.fromEntries(
            Array.from({ length: 60 }, (_, i) => ['ux' + i, { role: 'user' }])
        );
        const app = createApp();
        const first49 = Array.from({ length: 49 }, (_, i) => 'ux' + i);
        const r1 = await request(app)
            .post('/api/shares')
            .send({ ...DOC, userIds: first49 });
        expect(r1.status).toBe(200);
        const r2 = await request(app)
            .post('/api/shares')
            .send({ ...DOC, userIds: ['ux49', 'ux50'] });
        expect(r2.status).toBe(400);
        expect(r2.body.error).toMatch(/Limit 50/);
        expect(store.shares).toHaveLength(49);
    });

    test('nieznany dokument → 404', async () => {
        const prisma = (await import('../src/prismaClient')).default as any;
        prisma.offers_rel.findUnique.mockResolvedValueOnce(null);
        const res = await request(createApp())
            .post('/api/shares')
            .send({ ...DOC, userIds: ['u2'] });
        expect(res.status).toBe(404);
    });
});
