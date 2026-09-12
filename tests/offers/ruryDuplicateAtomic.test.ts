/**
 * P0 atomowość POST /api/offers/:id/duplicate na PRAWDZIWEJ bazie.
 * Pad createMany po create nagłówka NIE może zostawić sieroty (rollback tx).
 * Wzorzec sprzątania jak w telemetryRoutes.test.ts (unikalne id + finally).
 */
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import offerRoutes from '../../src/routes/offers/index';
import prisma from '../../src/prismaClient';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: 'user', subUsers: [] };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next(),
    writeOffersLimiter: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../src/utils/fts5Sync', () => ({
    syncFts5: jest.fn().mockResolvedValue(true),
    removeFts5: jest.fn().mockResolvedValue(true)
}));

const app = express();
app.use(express.json());
app.use('/api/offers', offerRoutes);

describe('POST /:id/duplicate — atomowość (prawdziwa DB)', () => {
    const srcId = 'dup-src-' + crypto.randomUUID().slice(0, 8);
    const srcNumber = 'DUP-' + crypto.randomUUID().slice(0, 6);

    beforeAll(async () => {
        await prisma.offers_rel.create({
            data: {
                id: srcId,
                userId: 'user-id',
                offer_number: srcNumber,
                state: 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1
            }
        });
        await prisma.offer_items_rel.createMany({
            data: [
                {
                    id: 'dup-item-' + crypto.randomUUID().slice(0, 8),
                    offerId: srcId,
                    productId: 'p-1',
                    quantity: 2,
                    discount: 0,
                    price: 10
                }
            ]
        });
    });

    afterAll(async () => {
        await prisma.offer_items_rel.deleteMany({ where: { offerId: srcId } });
        await prisma.offers_rel.deleteMany({ where: { id: srcId } });
        await prisma.offer_items_rel.deleteMany({
            where: { offerId: { startsWith: 'dup-kopia-check' } }
        });
        await prisma.offers_rel.deleteMany({
            where: { offer_number: srcNumber + '-KOPIA' }
        });
    });

    it('semantyka rollbacku na tym stosie: błąd w tx wycofuje create', async () => {
        // Dowód własności mechanizmu (nie mock): ten sam silnik/transakcja co
        // w route — pad drugiego statementu nie zostawia pierwszego.
        const tmpId = 'dup-tmp-' + crypto.randomUUID().slice(0, 8);
        await expect(
            prisma.$transaction(async (tx) => {
                await tx.offers_rel.create({
                    data: {
                        id: tmpId,
                        userId: 'user-id',
                        offer_number: 'DUPTMP',
                        state: 'draft',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        version: 1
                    }
                });
                await tx.$executeRawUnsafe('INSERT INTO no_such_table (id) VALUES (1)');
            })
        ).rejects.toThrow();
        expect(await prisma.offers_rel.findUnique({ where: { id: tmpId } })).toBeNull();
    });

    it('pad syncFts5 nie wycofuje commita (warn-only, wzorzec pliku)', async () => {
        const { syncFts5 } = jest.requireMock('../../src/utils/fts5Sync') as {
            syncFts5: jest.Mock;
        };
        // Rzeczywisty tryb awarii syncFts5: resolve false, nigdy throw.
        syncFts5.mockResolvedValueOnce(false);
        const res = await request(app)
            .post(`/api/offers/${srcId}/duplicate`)
            .set('x-user-id', 'user-id');

        expect(res.statusCode).toBe(200);
        const kopia = await prisma.offers_rel.findMany({
            where: {
                offer_number:
                    (await prisma.offers_rel.findUnique({ where: { id: srcId } }))?.offer_number +
                    '-KOPIA'
            }
        });
        expect(kopia.length).toBeGreaterThanOrEqual(1);
        const newId = kopia[kopia.length - 1].id;
        await prisma.offer_items_rel.deleteMany({ where: { offerId: newId } });
        await prisma.offers_rel.delete({ where: { id: newId } });
    });

    it('happy path: KOPIA z pozycjami w jednej transakcji', async () => {
        const res = await request(app)
            .post(`/api/offers/${srcId}/duplicate`)
            .set('x-user-id', 'user-id');

        expect(res.statusCode).toBe(200);
        const newId = res.body?.data?.id as string;
        expect(newId).toBeTruthy();
        const header = await prisma.offers_rel.findUnique({ where: { id: newId } });
        expect(header?.offer_number).toBe(srcNumber + '-KOPIA');
        expect(await prisma.offer_items_rel.findMany({ where: { offerId: newId } })).toHaveLength(
            1
        );
        await prisma.offer_items_rel.deleteMany({ where: { offerId: newId } });
        await prisma.offers_rel.delete({ where: { id: newId } });
    });
});
