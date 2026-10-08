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
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        offer_follow_ups: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        audit_logs: { create: jest.fn() },
        $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => {
            // @ts-ignore
            const prismaMock = jest.requireMock('../../src/prismaClient').default;
            return cb(prismaMock);
        })
    }
}));

const mockOfferRury = { id: 'o-rury-1', userId: 'user-id' };
const mockOfferStudnie = { id: 'o-stud-1', userId: 'user-id' };

const validBody = {
    channel: 'PHONE',
    result: 'CONTACTED',
    contactedAt: '2026-10-08T09:55:00.000Z',
    durationMin: 4,
    note: 'Klient zainteresowany',
    nextContactAt: '2026-10-12T09:00:00.000Z'
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
    mockUser.role = 'user';
    mockUser.subUsers = [];
    (prisma.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) => {
        // @ts-ignore
        const prismaMock = jest.requireMock('../../src/prismaClient').default;
        return cb(prismaMock);
    });
    (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferRury);
    (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferStudnie);
    (prisma.offer_follow_ups.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.offer_follow_ups.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.offer_follow_ups.create as jest.Mock).mockImplementation((a: any) =>
        Promise.resolve(a.data)
    );
    (prisma.audit_logs.create as jest.Mock).mockResolvedValue({});
});

describe('P0.3 OfferFollowUp — POST/GET', () => {
    let app: express.Application;

    beforeEach(() => {
        app = createApp();
    });

    it('POST rury: 200 + INSERT z UTC + audyt w tej samej tx', async () => {
        const res = await request(app).post('/api/offers/rury/o-rury-1/followups').send(validBody);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.id).toBeDefined();

        const create = prisma.offer_follow_ups.create as jest.Mock;
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0].data).toMatchObject({
            offerKind: 'rury',
            offerId: 'o-rury-1',
            createdByUserId: 'user-id',
            channel: 'PHONE',
            result: 'CONTACTED',
            outcome: 'OPEN'
        });

        // tx atomowa: INSERT + audyt w jednym $transaction.
        expect(prisma.$transaction as jest.Mock).toHaveBeenCalledTimes(1);
        const audit = prisma.audit_logs.create as jest.Mock;
        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit.mock.calls[0][0].data).toMatchObject({
            entityType: 'offer_followup',
            entityId: res.body.id,
            action: 'create'
        });
    });

    it('POST studnie: 200', async () => {
        const res = await request(app)
            .post('/api/offers/studnie/o-stud-1/followups')
            .send(validBody);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        const create = prisma.offer_follow_ups.create as jest.Mock;
        expect(create.mock.calls[0][0].data.offerKind).toBe('studnie');
    });

    it('zly kind: 400 INVALID_KIND', async () => {
        const res = await request(app).post('/api/offers/xyz/o-1/followups').send(validBody);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_KIND');
    });

    it('nieistniejaca oferta: 404', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
        const res = await request(app).post('/api/offers/rury/nope/followups').send(validBody);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });

    it('cudza oferta (user): 403, admin: 200', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            ...mockOfferRury,
            userId: 'other-id'
        });
        const denied = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send(validBody);
        expect(denied.status).toBe(403);

        mockUser.role = 'admin';
        const allowed = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send(validBody);
        expect(allowed.status).toBe(200);
    });

    it.each([
        [{ ...validBody, channel: 'HELLO' }],
        [{ ...validBody, outcome: 'XYZ' }],
        [{ ...validBody, durationMin: -1 }],
        [{ ...validBody, durationMin: 99999 }],
        [{ ...validBody, durationMin: 3.5 }],
        [{ ...validBody, contactedAt: 'nie-data' }],
        [{ ...validBody, nextContactAt: '2026-13-99' }]
    ])('walidacja odrzuca zly payload: 400 (case %j)', async (body) => {
        const res = await request(app).post('/api/offers/rury/o-rury-1/followups').send(body);
        expect(res.status).toBe(400);
        expect(prisma.offer_follow_ups.create as jest.Mock).not.toHaveBeenCalled();
    });

    it('P2 twarde domkniecie: LOST_* bez powodu 400, z powodem 200', async () => {
        const lostNoReason = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, outcome: 'LOST_COMPETITION' });
        expect(lostNoReason.status).toBe(400);

        const lostBlank = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, outcome: 'LOST_OTHER', loseReason: '   ' });
        expect(lostBlank.status).toBe(400);

        const lostOk = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, outcome: 'LOST_COMPETITION', loseReason: 'cena' });
        expect(lostOk.status).toBe(200);
    });

    it('terminalna bez reopen: 409 TERMINAL_OUTCOME; z reopen: 200 + audyt reopen', async () => {
        (prisma.offer_follow_ups.findFirst as jest.Mock).mockResolvedValue({
            id: 'old',
            outcome: 'WON'
        });
        const blocked = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send(validBody);
        expect(blocked.status).toBe(409);
        expect(blocked.body.code).toBe('TERMINAL_OUTCOME');

        const reopened = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, reopen: true });
        expect(reopened.status).toBe(200);
        const audit = prisma.audit_logs.create as jest.Mock;
        expect(audit.mock.calls[0][0].data.action).toBe('reopen');
    });

    it('strefa czasowa: +02:00 normalizowane do UTC', async () => {
        const res = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, contactedAt: '2026-10-10T09:00:00+02:00' });
        expect(res.status).toBe(200);
        const create = prisma.offer_follow_ups.create as jest.Mock;
        expect(create.mock.calls[0][0].data.contactedAt).toBe('2026-10-10T07:00:00.000Z');
    });

    it('append-only: dwa POSTy to dwa INSERTy, zero update/delete', async () => {
        await request(app).post('/api/offers/rury/o-rury-1/followups').send(validBody);
        await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({
                ...validBody,
                result: 'NO_ANSWER'
            });
        expect(prisma.offer_follow_ups.create as jest.Mock).toHaveBeenCalledTimes(2);
    });

    it('XSS: notatka ze script przechodzi bez zmian (escapuje frontend w P1)', async () => {
        const note = '<script>alert(1)</script>';
        const res = await request(app)
            .post('/api/offers/rury/o-rury-1/followups')
            .send({ ...validBody, note });
        expect(res.status).toBe(200);
        const create = prisma.offer_follow_ups.create as jest.Mock;
        expect(create.mock.calls[0][0].data.note).toBe(note);
    });

    it('GET: timeline + 403 dla cudzej + 404 dla brakujacej', async () => {
        (prisma.offer_follow_ups.findMany as jest.Mock).mockResolvedValue([
            { id: 'fu-2', outcome: 'OPEN' },
            { id: 'fu-1', outcome: 'OPEN' }
        ]);
        const res = await request(app).get('/api/offers/rury/o-rury-1/followups');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        const findMany = prisma.offer_follow_ups.findMany as jest.Mock;
        expect(findMany.mock.calls[0][0].orderBy).toEqual([
            { contactedAt: 'desc' },
            { createdAt: 'desc' }
        ]);

        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            ...mockOfferRury,
            userId: 'other-id'
        });
        const denied = await request(app).get('/api/offers/rury/o-rury-1/followups');
        expect(denied.status).toBe(403);

        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
        const missing = await request(app).get('/api/offers/rury/nope/followups');
        expect(missing.status).toBe(404);
    });
});
