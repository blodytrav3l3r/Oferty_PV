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
        offers_rel: { findUnique: jest.fn(), updateMany: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn(), updateMany: jest.fn() },
        offer_follow_ups: { findFirst: jest.fn(), findMany: jest.fn() },
        audit_logs: { create: jest.fn() },
        $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => {
            // @ts-ignore
            const prismaMock = jest.requireMock('../../src/prismaClient').default;
            return cb(prismaMock);
        })
    }
}));

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
    (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
        id: 'o-1',
        userId: 'user-id',
        data: JSON.stringify({ clientName: 'Budimex' })
    });
    (prisma.offers_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
        id: 'o-s',
        userId: 'user-id',
        data: JSON.stringify({})
    });
    (prisma.offers_studnie_rel.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.audit_logs.create as jest.Mock).mockResolvedValue({});
});

describe('Kontakt klienta oferty — PUT client-contact', () => {
    let app: express.Application;
    beforeEach(() => {
        app = createApp();
    });

    it('zapisuje 3 pola w blobie + bump wersji + audyt', async () => {
        const res = await request(app).put('/api/offers/rury/o-1/client-contact').send({
            contactPerson: 'Jan Kowalski',
            clientPhone: '600000000',
            clientEmail: 'jan@firma.pl'
        });
        expect(res.status).toBe(200);
        const upd = prisma.offers_rel.updateMany as jest.Mock;
        expect(upd).toHaveBeenCalledTimes(1);
        const blob = JSON.parse(upd.mock.calls[0][0].data.data);
        expect(blob.contactPerson).toBe('Jan Kowalski');
        expect(blob.clientPhone).toBe('600000000');
        expect(blob.clientEmail).toBe('jan@firma.pl');
        expect(upd.mock.calls[0][0].data.version).toEqual({ increment: 1 });
        // Rury: pusty clientContact uzupełniony telefonem (ścieżka PDF).
        expect(blob.clientContact).toBe('600000000');
        const audit = prisma.audit_logs.create as jest.Mock;
        expect(audit.mock.calls[0][0].data.action).toBe('update-client-contact');
    });

    it('puste pola czyszczą klucze, nie nadpisują clientContact', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'o-1',
            userId: 'user-id',
            data: JSON.stringify({ clientContact: 'stary', contactPerson: 'X' })
        });
        const res = await request(app).put('/api/offers/rury/o-1/client-contact').send({
            contactPerson: null,
            clientPhone: '',
            clientEmail: null
        });
        expect(res.status).toBe(200);
        const blob = JSON.parse(
            (prisma.offers_rel.updateMany as jest.Mock).mock.calls[0][0].data.data
        );
        expect('contactPerson' in blob).toBe(false);
        expect(blob.clientContact).toBe('stary');
    });

    it('zły e-mail → 400', async () => {
        const res = await request(app).put('/api/offers/rury/o-1/client-contact').send({
            clientEmail: 'nie-email'
        });
        expect(res.status).toBe(400);
    });

    it('obca oferta → 403; brak oferty → 404; zły kind → 400', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'o-1',
            userId: 'obcy',
            data: '{}'
        });
        expect(
            (await request(app).put('/api/offers/rury/o-1/client-contact').send({})).status
        ).toBe(403);
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
        expect(
            (await request(app).put('/api/offers/rury/o-1/client-contact').send({})).status
        ).toBe(404);
        expect((await request(app).put('/api/offers/xxx/o-1/client-contact').send({})).status).toBe(
            400
        );
    });

    it('studnie: zapis w offers_studnie_rel', async () => {
        const res = await request(app).put('/api/offers/studnie/o-s/client-contact').send({
            clientPhone: '700700700'
        });
        expect(res.status).toBe(200);
        expect(prisma.offers_studnie_rel.updateMany as jest.Mock).toHaveBeenCalledTimes(1);
    });

    it('contacts[]: zapis tablicy + mirror legacy z pierwszej osoby', async () => {
        const res = await request(app)
            .put('/api/offers/rury/o-1/client-contact')
            .send({
                contacts: [
                    { name: 'Jan Kowalski', phone: '600000000', email: 'jan@firma.pl' },
                    { name: 'Anna Nowak', phone: '601000000', email: '' },
                    { name: '', phone: '', email: '' }
                ]
            });
        expect(res.status).toBe(200);
        const blob = JSON.parse(
            (prisma.offers_rel.updateMany as jest.Mock).mock.calls[0][0].data.data
        );
        expect(blob.clientContacts).toEqual([
            { name: 'Jan Kowalski', phone: '600000000', email: 'jan@firma.pl' },
            { name: 'Anna Nowak', phone: '601000000', email: '' }
        ]);
        expect(blob.contactPerson).toBe('Jan Kowalski');
        expect(blob.clientPhone).toBe('600000000');
        expect(blob.clientContact).toBe('600000000');
    });

    it('contacts[]: pusta tablica czyści listę; >10 → 400; zły email → 400', async () => {
        const empty = await request(app).put('/api/offers/rury/o-1/client-contact').send({
            contacts: []
        });
        expect(empty.status).toBe(200);
        const blob = JSON.parse(
            (prisma.offers_rel.updateMany as jest.Mock).mock.calls[0][0].data.data
        );
        expect('clientContacts' in blob).toBe(false);

        const tooMany = await request(app)
            .put('/api/offers/rury/o-1/client-contact')
            .send({ contacts: Array.from({ length: 11 }, (_, i) => ({ name: `O${i}` })) });
        expect(tooMany.status).toBe(400);

        const badMail = await request(app)
            .put('/api/offers/rury/o-1/client-contact')
            .send({ contacts: [{ name: 'Jan', email: 'zły' }] });
        expect(badMail.status).toBe(400);
    });
});
