import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import prisma from '../../src/prismaClient';
import numberingRouter from '../../src/routes/orders/numbering';
import productionRouter from '../../src/routes/orders/production';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: express.Request & { user?: unknown }, _res: unknown, next: () => void) => {
        req.user = { id: 'pg-test-admin', username: 'pg-test-admin', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

function createApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use('/api/orders-studnie', numberingRouter);
    app.use('/api/orders-studnie/production', productionRouter);
    return app;
}

describe('POST /production/recycle-numbers on PostgreSQL', () => {
    test('concurrent duplicate returns are idempotent and preserve the unique key', async () => {
        const userId = `pg-recycle-${randomUUID()}`;
        const year = 2026;
        const body = { userId, year, seqNumbers: [7001, 7002, 7001] };
        const app = createApp();

        try {
            const [first, second] = await Promise.all([
                request(app).post('/api/orders-studnie/production/recycle-numbers').send(body),
                request(app).post('/api/orders-studnie/production/recycle-numbers').send(body)
            ]);

            expect(first.status).toBe(200);
            expect(first.body).toEqual({ ok: true, returned: 2 });
            expect(second.status).toBe(200);
            expect(second.body).toEqual({ ok: true, returned: 2 });

            const rows = await prisma.recycled_production_numbers.findMany({
                where: { userId, year },
                orderBy: { seqNumber: 'asc' }
            });
            expect(rows.map((row) => row.seqNumber)).toEqual([7001, 7002]);
        } finally {
            await prisma.recycled_production_numbers.deleteMany({ where: { userId } });
        }
    });

    test('concurrent claims consume a recycled range once and return unique numbers', async () => {
        const userId = `pg-claim-${randomUUID()}`;
        const year = new Date().getFullYear();
        const app = createApp();

        await prisma.users.create({
            data: {
                id: userId,
                username: userId,
                password: 'test-only',
                role: 'user',
                symbol: 'T',
                productionOrderStartNumber: 1
            }
        });
        const recycledRange = Array.from({ length: 24 }, (_, index) => ({
            userId,
            year,
            seqNumber: index + 1
        }));
        await prisma.recycled_production_numbers.createMany({
            data: recycledRange
        });
        await prisma.production_order_counters.create({ data: { userId, year, lastNumber: 24 } });

        try {
            const claims = await Promise.all(
                Array.from({ length: 24 }, () =>
                    request(app)
                        .post(`/api/orders-studnie/claim-production-number/${userId}`)
                        .send({})
                )
            );

            expect(claims.map((claim) => claim.status)).toEqual(Array(24).fill(200));
            const seqNumbers = claims.map((claim) => claim.body.nextSeq);
            expect(new Set(seqNumbers).size).toBe(24);
            expect(seqNumbers.sort((a, b) => a - b)).toEqual(
                Array.from({ length: 24 }, (_, index) => index + 1)
            );
            expect(
                await prisma.recycled_production_numbers.count({ where: { userId, year } })
            ).toBe(0);
        } finally {
            await prisma.recycled_production_numbers.deleteMany({ where: { userId } });
            await prisma.production_order_counters.deleteMany({ where: { userId } });
            await prisma.users.deleteMany({ where: { id: userId } });
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });
});
