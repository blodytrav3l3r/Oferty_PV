import request from 'supertest';
import express from 'express';
import offerRoutes from '../../src/routes/offers/index';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'user-id', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: { get: jest.fn(), set: jest.fn(), invalidateAll: jest.fn() }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        offer_follow_ups: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        },
        audit_logs: { create: jest.fn() },
        $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => {
            // @ts-ignore
            const prismaMock = jest.requireMock('../../src/prismaClient').default;
            return cb(prismaMock);
        })
    }
}));

const mockOffer = { id: 'o-1', userId: 'user-id' };
const openFu = {
    id: 'fu-1',
    offerKind: 'rury',
    offerId: 'o-1',
    cycle: 0,
    outcome: 'OPEN',
    channel: 'PHONE',
    result: 'CONTACTED'
};
const terminalFu = { ...openFu, id: 'fu-9', outcome: 'WON' };

const validUpdate = {
    channel: 'EMAIL',
    result: 'CONTACTED',
    contactedAt: '2026-10-08T10:00:00.000Z',
    durationMin: 5,
    note: 'Poprawiona notatka',
    nextContactAt: null,
    outcome: 'OPEN',
    loseReason: null,
    competitor: null
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'user-id';
    (prisma.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) => {
        // @ts-ignore
        const prismaMock = jest.requireMock('../../src/prismaClient').default;
        return cb(prismaMock);
    });
    (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOffer);
    (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOffer);
    (prisma.offer_follow_ups.findUnique as jest.Mock).mockResolvedValue(openFu);
    (prisma.offer_follow_ups.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.offer_follow_ups.update as jest.Mock).mockImplementation((a: any) =>
        Promise.resolve(a.data)
    );
    (prisma.offer_follow_ups.delete as jest.Mock).mockResolvedValue(openFu);
    (prisma.audit_logs.create as jest.Mock).mockResolvedValue({});
});

describe('Opieka — PUT/DELETE wpisu historii', () => {
    let app: express.Application;
    beforeEach(() => {
        app = createApp();
    });

    it('PUT: 200 + update + audyt update w tx + invalidate', async () => {
        const res = await request(app).put('/api/offers/rury/o-1/followups/fu-1').send(validUpdate);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(prisma.offer_follow_ups.update as jest.Mock).toHaveBeenCalledTimes(1);
        const audit = prisma.audit_logs.create as jest.Mock;
        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit.mock.calls[0][0].data).toMatchObject({
            entityType: 'offer_followup',
            entityId: 'fu-1',
            action: 'update'
        });
    });

    it('PUT: cudzy wpis (kind/offer mismatch) → 404', async () => {
        (prisma.offer_follow_ups.findUnique as jest.Mock).mockResolvedValue({
            ...openFu,
            offerId: 'inna-oferta'
        });
        const res = await request(app).put('/api/offers/rury/o-1/followups/fu-1').send(validUpdate);
        expect(res.status).toBe(404);
    });

    it('PUT: obca oferta → 403', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            ...mockOffer,
            userId: 'obcy'
        });
        const res = await request(app).put('/api/offers/rury/o-1/followups/fu-1').send(validUpdate);
        expect(res.status).toBe(403);
    });

    it('PUT: zdjęcie terminala bez reopen → 409; z ?reopen=1 → 200', async () => {
        (prisma.offer_follow_ups.findUnique as jest.Mock).mockResolvedValue(terminalFu);
        const denied = await request(app)
            .put('/api/offers/rury/o-1/followups/fu-9')
            .send({ ...validUpdate, outcome: 'OPEN' });
        expect(denied.status).toBe(409);
        const allowed = await request(app)
            .put('/api/offers/rury/o-1/followups/fu-9?reopen=1')
            .send({ ...validUpdate, outcome: 'OPEN' });
        expect(allowed.status).toBe(200);
    });

    it('PUT: drugi terminal w cyklu → 409', async () => {
        (prisma.offer_follow_ups.findFirst as jest.Mock).mockResolvedValue({
            ...terminalFu,
            id: 'fu-inna'
        });
        const res = await request(app)
            .put('/api/offers/rury/o-1/followups/fu-1?reopen=1')
            .send({ ...validUpdate, outcome: 'WON', loseReason: 'x' });
        expect(res.status).toBe(409);
    });

    it('PUT: zły payload (zła data) → 400', async () => {
        const res = await request(app)
            .put('/api/offers/rury/o-1/followups/fu-1')
            .send({ ...validUpdate, contactedAt: '2026-13-99' });
        expect(res.status).toBe(400);
    });

    it('DELETE: 200 + delete + audyt delete', async () => {
        const res = await request(app).delete('/api/offers/rury/o-1/followups/fu-1');
        expect(res.status).toBe(200);
        expect(prisma.offer_follow_ups.delete as jest.Mock).toHaveBeenCalledTimes(1);
        const audit = prisma.audit_logs.create as jest.Mock;
        expect(audit.mock.calls[0][0].data).toMatchObject({
            entityType: 'offer_followup',
            action: 'delete'
        });
    });

    it('DELETE: wpis terminalny bez reopen → 409; z reopen → 200', async () => {
        (prisma.offer_follow_ups.findUnique as jest.Mock).mockResolvedValue(terminalFu);
        const denied = await request(app).delete('/api/offers/rury/o-1/followups/fu-9');
        expect(denied.status).toBe(409);
        const allowed = await request(app).delete('/api/offers/rury/o-1/followups/fu-9?reopen=1');
        expect(allowed.status).toBe(200);
    });

    it('DELETE: nieistniejący wpis → 404', async () => {
        (prisma.offer_follow_ups.findUnique as jest.Mock).mockResolvedValue(null);
        const res = await request(app).delete('/api/offers/rury/o-1/followups/brak');
        expect(res.status).toBe(404);
    });
});
