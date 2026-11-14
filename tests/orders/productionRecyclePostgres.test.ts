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
        const year = new Date().getFullYear();
        const counter = await prisma.production_global_order_counters.findUnique({
            where: { year }
        });
        const firstSeq = (counter?.lastNumber || 0) + Math.floor(Math.random() * 1_000_000) + 1000;
        await prisma.$executeRaw`
            INSERT INTO "production_global_order_counters" ("year", "lastNumber")
            VALUES (${year}, ${firstSeq + 1})
            ON CONFLICT ("year") DO UPDATE
            SET "lastNumber" = GREATEST("production_global_order_counters"."lastNumber", EXCLUDED."lastNumber")
        `;
        await prisma.production_global_number_claims.createMany({
            data: [firstSeq, firstSeq + 1].map((seqNumber) => ({ userId, year, seqNumber }))
        });
        const body = { userId, year, seqNumbers: [firstSeq, firstSeq + 1, firstSeq] };
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

            const rows = await prisma.recycled_production_numbers_global.findMany({
                where: { userId, year },
                orderBy: { seqNumber: 'asc' }
            });
            expect(rows.map((row) => row.seqNumber)).toEqual([firstSeq, firstSeq + 1]);
        } finally {
            await prisma.recycled_production_numbers_global.deleteMany({ where: { userId } });
            await prisma.production_global_number_claims.deleteMany({ where: { userId } });
        }
    });

    test('concurrent claims consume a recycled range once and return unique numbers', async () => {
        const userId = `pg-claim-${randomUUID()}`;
        const year = new Date().getFullYear();
        const app = createApp();
        const firstSeq = Math.floor(Math.random() * 1_000_000) + 1_000_000;

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
            seqNumber: firstSeq + index
        }));
        await prisma.recycled_production_numbers_global.createMany({
            data: recycledRange
        });

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
                Array.from({ length: 24 }, (_, index) => firstSeq + index)
            );
            expect(
                await prisma.recycled_production_numbers_global.count({ where: { userId, year } })
            ).toBe(0);
        } finally {
            await prisma.recycled_production_numbers_global.deleteMany({ where: { userId } });
            await prisma.production_global_number_claims.deleteMany({ where: { userId } });
            await prisma.users.deleteMany({ where: { id: userId } });
        }
    });

    test('a saved number cannot be recycled concurrently and then reassigned', async () => {
        const userId = `pg-save-recycle-${randomUUID()}`;
        const docId = `pg-order-${randomUUID()}`;
        const year = new Date().getFullYear();
        const seqNumber = Math.floor(Math.random() * 1_000_000) + 2_000_000;
        const productionOrderNumber = `A/${String(seqNumber).padStart(5, '0')}/${String(year).slice(-2)}`;
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
        await prisma.$executeRaw`
            INSERT INTO "production_global_order_counters" ("year", "lastNumber")
            VALUES (${year}, ${seqNumber})
            ON CONFLICT ("year") DO UPDATE
            SET "lastNumber" = GREATEST("production_global_order_counters"."lastNumber", EXCLUDED."lastNumber")
        `;
        await prisma.production_global_number_claims.create({
            data: { userId, year, seqNumber }
        });

        try {
            const [saved, recycled] = await Promise.all([
                request(app)
                    .post('/api/orders-studnie/production')
                    .send({ id: docId, userId, wellId: 'well-test', productionOrderNumber }),
                request(app)
                    .post('/api/orders-studnie/production/recycle-numbers')
                    .send({ userId, year, seqNumbers: [seqNumber] })
            ]);

            expect([saved.status, recycled.status].filter((status) => status === 200)).toHaveLength(
                1
            );
            const order = await prisma.production_orders_rel.findUnique({ where: { id: docId } });
            const recycledRow = await prisma.recycled_production_numbers_global.findUnique({
                where: { year_seqNumber: { year, seqNumber } }
            });
            expect(Boolean(order)).not.toBe(Boolean(recycledRow));
        } finally {
            await prisma.production_orders_rel.deleteMany({ where: { id: docId } });
            await prisma.recycled_production_numbers_global.deleteMany({ where: { userId, year } });
            await prisma.production_global_number_claims.deleteMany({ where: { userId, year } });
            await prisma.users.deleteMany({ where: { id: userId } });
        }
    });

    test('legacy four-part number waits until all active aliases are deleted before recycling', async () => {
        const userIdA = `pg-legacy-a-${randomUUID()}`;
        const userIdB = `pg-legacy-b-${randomUUID()}`;
        const docIdA = `pg-legacy-order-a-${randomUUID()}`;
        const docIdB = `pg-legacy-order-b-${randomUUID()}`;
        const year = new Date().getFullYear();
        const head = await prisma.production_global_order_counters.findUnique({ where: { year } });
        const seqNumber = (head?.lastNumber || 0) + Math.floor(Math.random() * 1_000_000) + 10_000;
        const productionOrderNumber = `SA/A/${String(seqNumber).padStart(5, '0')}/${String(year).slice(-2)}`;
        const app = createApp();

        await prisma.users.createMany({
            data: [userIdA, userIdB].map((id) => ({
                id,
                username: id,
                password: 'test-only',
                role: 'user',
                symbol: 'SA',
                productionOrderStartNumber: 1
            }))
        });
        await prisma.production_orders_rel.createMany({
            data: [
                {
                    id: docIdA,
                    userId: userIdA,
                    productionNumber: productionOrderNumber,
                    data: JSON.stringify({ productionOrderNumber })
                },
                {
                    id: docIdB,
                    userId: userIdB,
                    productionNumber: productionOrderNumber,
                    data: JSON.stringify({ productionOrderNumber })
                }
            ]
        });

        try {
            const firstDelete = await request(app).delete(
                `/api/orders-studnie/production/${docIdA}`
            );
            expect(firstDelete.status).toBe(200);
            expect(
                await prisma.recycled_production_numbers_global.count({
                    where: { year, seqNumber }
                })
            ).toBe(0);

            const lastDelete = await request(app).delete(
                `/api/orders-studnie/production/${docIdB}`
            );
            expect(lastDelete.status).toBe(200);
            expect(
                await prisma.recycled_production_numbers_global.count({
                    where: { year, seqNumber }
                })
            ).toBe(1);
        } finally {
            await prisma.production_orders_rel.deleteMany({
                where: { id: { in: [docIdA, docIdB] } }
            });
            await prisma.recycled_production_numbers_global.deleteMany({
                where: { year, seqNumber }
            });
            await prisma.production_global_number_claims.deleteMany({ where: { year, seqNumber } });
            await prisma.users.deleteMany({ where: { id: { in: [userIdA, userIdB] } } });
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });
});
