import request from 'supertest';
import express from 'express';
import clientRoutes from '../src/routes/clients';
import prisma from '../src/prismaClient';

// N+1 w PUT /api/clients (sprzed batcha):
//   1x SELECT + 2x NULL-uj (gdy są delety) + D x DELETE + U x upsert.
// Po batchu: 1x SELECT + 2x NULL-uj + 1x deleteMany + 1x multi-row UPSERT,
// czyli stałe ≤5 roundtripów niezależnie od D i U.
const mockUser: any = { id: 'admin-1', role: 'admin', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        clients_rel: {
            findMany: jest.fn()
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn(),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/clients', clientRoutes);
    return app;
}

function createTxMock(existing: Array<{ id: string; userId: string | null }>) {
    return {
        $queryRaw: jest.fn().mockResolvedValue(existing),
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(1),
        clients_rel: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        client_contacts_rel: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        offers_rel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        offers_studnie_rel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }
    };
}

function roundtrips(txMock: ReturnType<typeof createTxMock>) {
    return (
        txMock.$queryRaw.mock.calls.length +
        txMock.$queryRawUnsafe.mock.calls.length +
        txMock.$executeRaw.mock.calls.length +
        txMock.clients_rel.deleteMany.mock.calls.length +
        txMock.client_contacts_rel.deleteMany.mock.calls.length +
        txMock.offers_rel.updateMany.mock.calls.length +
        txMock.offers_studnie_rel.updateMany.mock.calls.length
    );
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'admin-1';
    mockUser.role = 'admin';
    mockUser.subUsers = [];
});

describe('PUT /api/clients — batch (stała liczba roundtripów)', () => {
    it('50 upsertów + 10 deletów = 6 roundtripów (przed: 63; +1 cascade kontaktów)', async () => {
        const app = createApp();
        const existing = [
            ...Array.from({ length: 50 }, (_, i) => ({ id: `c-${i}`, userId: 'admin-1' })),
            ...Array.from({ length: 10 }, (_, i) => ({ id: `gone-${i}`, userId: 'admin-1' }))
        ];
        const txMock = createTxMock(existing);
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
            fn(txMock)
        );

        const res = await request(app)
            .put('/api/clients')
            .send({ data: existing.slice(0, 50).map((c) => ({ id: c.id, name: `K ${c.id}` })) });

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ ok: true, count: 50 });
        expect(typeof res.body.updatedAt).toBe('string');
        expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
        expect(txMock.offers_rel.updateMany).toHaveBeenCalledTimes(1);
        expect(txMock.offers_studnie_rel.updateMany).toHaveBeenCalledTimes(1);
        expect(txMock.clients_rel.deleteMany).toHaveBeenCalledTimes(1);
        expect(txMock.clients_rel.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: existing.slice(50).map((c) => c.id) } }
        });
        expect(txMock.client_contacts_rel.deleteMany).toHaveBeenCalledTimes(1);
        expect(txMock.client_contacts_rel.deleteMany).toHaveBeenCalledWith({
            where: { clientId: { in: existing.slice(50).map((c) => c.id) } }
        });
        expect(txMock.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        expect(roundtrips(txMock)).toBe(6);
    });

    it('sam upsert bez deletów = 2 roundtripy, zero zapisów kasujących', async () => {
        const app = createApp();
        const existing = Array.from({ length: 20 }, (_, i) => ({
            id: `c-${i}`,
            userId: 'admin-1'
        }));
        const txMock = createTxMock(existing);
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
            fn(txMock)
        );

        const res = await request(app)
            .put('/api/clients')
            .send({ data: existing.map((c) => ({ id: c.id, name: `K ${c.id}` })) });

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ ok: true, count: 20 });
        expect(typeof res.body.updatedAt).toBe('string');
        expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
        expect(txMock.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        expect(txMock.offers_rel.updateMany).not.toHaveBeenCalled();
        expect(txMock.offers_studnie_rel.updateMany).not.toHaveBeenCalled();
        expect(txMock.clients_rel.deleteMany).not.toHaveBeenCalled();
        expect(roundtrips(txMock)).toBe(2);
    });

    it('bulk UPSERT niesie wszystkie wiersze w jednym statement (50 krotek VALUES)', async () => {
        const app = createApp();
        const existing = Array.from({ length: 50 }, (_, i) => ({
            id: `c-${i}`,
            userId: 'admin-1'
        }));
        const txMock = createTxMock(existing);
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: any) => any) =>
            fn(txMock)
        );

        await request(app)
            .put('/api/clients')
            .send({ data: existing.map((c) => ({ id: c.id, name: `K ${c.id}` })) });

        const [sql, ...params] = txMock.$queryRawUnsafe.mock.calls[0];
        expect(sql).toMatch(/ON CONFLICT\(id\) DO UPDATE/);
        expect(sql).toMatch(/excluded\.userId/);
        // 50 wierszy x 11 kolumn = 550 parametrów, 50 krotek VALUES.
        expect(params).toHaveLength(550);
        expect((sql.match(/\(\?,\?,\?,\?,\?,\?,\?,\?,\?,\?,\?\)/g) || []).length).toBe(50);
    });
});
