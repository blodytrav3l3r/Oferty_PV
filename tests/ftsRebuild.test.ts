import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import adminRouter from '../src/routes/admin';
import { ftsSyncStatus, rebuildFts5, syncFts5 } from '../src/utils/fts5Sync';

const mockUser = {
    id: 'admin-1',
    username: 'pg-admin',
    role: 'admin',
    firstName: 'Postgres',
    lastName: 'Admin',
    email: 'pg-admin@example.test',
    symbol: 'PA',
    subUsers: [] as string[]
};

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (
        req: express.Request & { user?: typeof mockUser },
        _res: unknown,
        next: () => void
    ) => {
        req.user = { ...mockUser };
        next();
    },
    requireAdmin: (
        req: express.Request & { user?: typeof mockUser },
        res: express.Response,
        next: () => void
    ) => {
        if (req.user?.role === 'admin') return next();
        return res.status(403).json({ error: 'Forbidden' });
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const offerId = `pg-search-index-${process.pid}-${Date.now()}`;

function createApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    return app;
}

describe('PostgreSQL GIN search indexes', () => {
    afterAll(async () => {
        await prisma.offers_rel.deleteMany({ where: { id: { startsWith: offerId } } });
    });

    test('migrations provide both GIN indexes and source writes are reflected transactionally', async () => {
        const before = await ftsSyncStatus();
        expect(before.inSync).toBe(true);
        const created = await prisma.offers_rel.create({
            data: {
                id: `${offerId}-row`,
                clientName: 'Klient Wyszukiwanie',
                investName: 'Osiedle GIN',
                data: JSON.stringify({ offerNotes: 'indeks PostgreSQL' })
            }
        });
        await syncFts5('rury', {
            id: created.id,
            offer_number: null,
            clientName: created.clientName,
            investName: created.investName
        });
        const afterInsert = await ftsSyncStatus();
        expect(afterInsert.inSync).toBe(true);
        expect(afterInsert.tables.rury.offers).toBe(before.tables.rury.offers + 1);

        await prisma.offers_rel.delete({ where: { id: created.id } });
        await prisma.offers_rel.create({ data: { id: `${offerId}-rebuild` } });
        const rebuilt = await rebuildFts5();
        expect(rebuilt).toBeGreaterThanOrEqual(1);
        expect((await ftsSyncStatus()).inSync).toBe(true);
    });

    test('admin status endpoint remains restricted to administrators', async () => {
        const app = createApp();
        const ok = await request(app).get('/api/admin/fts-status');
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('inSync', true);

        mockUser.role = 'user';
        const denied = await request(app).get('/api/admin/fts-status');
        expect(denied.status).toBe(403);
        mockUser.role = 'admin';
    });

    test('admin rebuild endpoint reindexes both PostgreSQL indexes', async () => {
        await prisma.offers_rel.create({ data: { id: `${offerId}-endpoint` } });
        const response = await request(createApp()).post('/api/admin/fts-rebuild');
        expect(response.status).toBe(200);
        expect(response.body.rows).toBeGreaterThanOrEqual(1);
        expect(response.body.lastProgress).toBe(response.body.rows);
    });
});
