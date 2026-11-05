import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import adminRouter from '../src/routes/admin';
import { ftsSyncStatus } from '../src/utils/postgresOfferSearchIndexes';
import { Prisma } from '../generated/prisma-postgres/client';
import { buildWhereParts } from '../src/utils/searchUtils';

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
        const afterInsert = await ftsSyncStatus();
        expect(afterInsert.inSync).toBe(true);
        expect(afterInsert.tables.rury.offers).toBe(before.tables.rury.offers + 1);

        await prisma.offers_rel.delete({ where: { id: created.id } });
        await prisma.offers_rel.create({ data: { id: `${offerId}-rebuild` } });
        expect((await ftsSyncStatus()).inSync).toBe(true);
    });

    test('updates search results inside a PostgreSQL transaction and rolls back the change', async () => {
        const id = offerId + '-transaction';
        const filter = buildWhereParts({
            q: 'przykladgin',
            dateFrom: '',
            dateTo: '',
            userId: '',
            cursor: '',
            cursorId: '',
            sort: 'createdAt',
            order: 'desc'
        });
        const sql = Prisma.sql`SELECT id FROM offers_rel o WHERE o.id = ${id} AND ${Prisma.join(filter, ' AND ')}`;
        await prisma.offers_rel.create({ data: { id, clientName: 'Pierwotny', data: '{}' } });
        const rollback = new Error('fixture rollback');
        await expect(
            prisma.$transaction(async (tx) => {
                await tx.offers_rel.update({ where: { id }, data: { clientName: 'przykladgin' } });
                expect(await tx.$queryRaw(sql)).toEqual([{ id }]);
                throw rollback;
            })
        ).rejects.toBe(rollback);
        expect(await prisma.$queryRaw(sql)).toEqual([]);
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

    test('runtime does not request PostgreSQL index DDL', async () => {
        const response = await request(createApp()).post('/api/admin/fts-rebuild');
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('POSTGRES_INDEX_MAINTENANCE_REQUIRED');
    });
});
