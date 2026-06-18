import request from 'supertest';
import express from 'express';
import offerRoutes from '../src/routes/offers/index';
import prisma from '../src/prismaClient';

interface MockUser {
    id: string;
    role: 'admin' | 'pro' | 'user';
    subUsers: string[];
}

let currentUser: MockUser = { id: 'user1', role: 'user', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...currentUser };
        next();
    }
}));

jest.mock('../src/db', () => ({
    logAudit: jest.fn()
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
        offers_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
            create: jest.fn()
        },
        offers_studnie_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn()
        },
        offer_items_rel: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            create: jest.fn()
        },
        $queryRawUnsafe: jest.fn(),
        $executeRaw: jest.fn()
    }
}));

const otherUsersOffer = {
    id: 'o-other',
    userId: 'other-user',
    offer_number: 'R2',
    state: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transportCost: 0,
    history: '[]'
};

const myOffer = {
    id: 'o-mine',
    userId: 'user1',
    offer_number: 'R1',
    state: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transportCost: 0,
    history: '[]'
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

describe('Ownership E2E — offers routes', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        currentUser = { id: 'user1', role: 'user', subUsers: [] };
        app = createApp();
    });

    describe('GET /api/offers/:id', () => {
        it('regular user CANNOT read another user offer (403)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);
            const res = await request(app).get('/api/offers/o-other');
            expect(res.statusCode).toBe(403);
        });

        it('owner CAN read own offer (200)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(myOffer);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            const res = await request(app).get('/api/offers/o-mine');
            expect(res.statusCode).toBe(200);
        });

        it('admin CAN read any offer (200)', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            const res = await request(app).get('/api/offers/o-other');
            expect(res.statusCode).toBe(200);
        });

        it('pro CAN read sub-user offer (200)', async () => {
            currentUser = { id: 'pro1', role: 'pro', subUsers: ['sub-user'] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
                ...otherUsersOffer,
                userId: 'sub-user'
            });
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            const res = await request(app).get('/api/offers/o-sub');
            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /api/offers — userId injection attack', () => {
        it('regular user CANNOT create offer for another userId via body', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .send({
                    data: [{
                        id: 'o-new',
                        userId: 'other-user',
                        clientId: 'client-1',
                        status: 'active',
                        items: []
                    }]
                });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_rel.upsert).not.toHaveBeenCalled();
        });

        it('owner CAN create own offer (200)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .send({
                    data: [{
                        id: 'o-new',
                        clientId: 'client-1',
                        status: 'active',
                        items: []
                    }]
                });

            expect(res.statusCode).toBe(200);
            expect(prisma.offers_rel.upsert).toHaveBeenCalled();
            const upsertCall = (prisma.offers_rel.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertCall.create.userId).toBe('user1');
        });

        it('admin CAN create offer for any userId via body', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .send({
                    data: [{
                        id: 'o-new',
                        userId: 'sub-user',
                        clientId: 'client-1',
                        status: 'active',
                        items: []
                    }]
                });

            expect(res.statusCode).toBe(200);
            expect(prisma.offers_rel.upsert).toHaveBeenCalled();
            const upsertCall = (prisma.offers_rel.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertCall.create.userId).toBe('sub-user');
        });

        it('pro CAN create offer for sub-user', async () => {
            currentUser = { id: 'pro1', role: 'pro', subUsers: ['sub-user'] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .send({
                    data: [{
                        id: 'o-new',
                        userId: 'sub-user',
                        clientId: 'client-1',
                        status: 'active',
                        items: []
                    }]
                });

            expect(res.statusCode).toBe(200);
            const upsertCall = (prisma.offers_rel.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertCall.create.userId).toBe('sub-user');
        });

        it('pro CANNOT create offer for unrelated user', async () => {
            currentUser = { id: 'pro1', role: 'pro', subUsers: ['sub-user'] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .send({
                    data: [{
                        id: 'o-new',
                        userId: 'random-user',
                        clientId: 'client-1',
                        status: 'active',
                        items: []
                    }]
                });

            expect(res.statusCode).toBe(403);
            expect(prisma.offers_rel.upsert).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /api/offers/:id', () => {
        it('regular user CANNOT delete another user offer', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);
            const res = await request(app).delete('/api/offers/o-other');
            expect(res.statusCode).toBe(403);
            expect(prisma.offers_rel.delete).not.toHaveBeenCalled();
        });

        it('owner CAN delete own offer', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(myOffer);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offers_rel.delete as jest.Mock).mockResolvedValue({});
            const res = await request(app).delete('/api/offers/o-mine');
            expect(res.statusCode).toBe(200);
            expect(prisma.offers_rel.delete).toHaveBeenCalled();
        });

        it('admin CAN delete any offer', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offers_rel.delete as jest.Mock).mockResolvedValue({});
            const res = await request(app).delete('/api/offers/o-other');
            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /api/offers/:id/duplicate', () => {
        const sourceOfferWithItems = {
            ...myOffer,
            offer_number: 'R1',
            data: JSON.stringify({ foo: 'bar' })
        };
        const sourceItem = {
            id: 'item-1',
            offerId: 'o-mine',
            productId: 'p-1',
            quantity: 3,
            discount: 5,
            price: 100
        };

        it('owner CAN duplicate own offer (200, new id returned)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(sourceOfferWithItems);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([sourceItem]);
            (prisma.offers_rel.create as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app).post('/api/offers/o-mine/duplicate');
            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.id).not.toBe('o-mine');

            const createCall = (prisma.offers_rel.create as jest.Mock).mock.calls[0][0];
            expect(createCall.data.userId).toBe('user1');
            expect(createCall.data.offer_number).toBe('R1-KOPIA');
            expect(createCall.data.state).toBe('draft');
            expect(createCall.data.data).toBe(JSON.stringify({ foo: 'bar' }));
        });

        it('duplicate copies all items', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(sourceOfferWithItems);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([
                sourceItem,
                { ...sourceItem, id: 'item-2', productId: 'p-2' }
            ]);
            (prisma.offers_rel.create as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            await request(app).post('/api/offers/o-mine/duplicate');
            expect(prisma.offer_items_rel.create).toHaveBeenCalledTimes(2);
        });

        it('regular user CANNOT duplicate another user offer (403)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);

            const res = await request(app).post('/api/offers/o-other/duplicate');
            expect(res.statusCode).toBe(403);
            expect(prisma.offers_rel.create).not.toHaveBeenCalled();
        });

        it('admin CAN duplicate any offer', async () => {
            currentUser = { id: 'admin1', role: 'admin', subUsers: [] };
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(otherUsersOffer);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.offers_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app).post('/api/offers/o-other/duplicate');
            expect(res.statusCode).toBe(200);
        });

        it('returns 404 for nonexistent source offer', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app).post('/api/offers/nonexistent/duplicate');
            expect(res.statusCode).toBe(404);
        });
    });
});
