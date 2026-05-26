import request from 'supertest';
import express from 'express';
import offerRoutes from '../src/routes/offers/index';
import prisma from '../src/prismaClient';

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-id', role: 'user' };
        }
        next();
    }
}));

// Mock DB audit log and logger
jest.mock('../src/db', () => ({
    logAudit: jest.fn(),
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
            delete: jest.fn()
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

const mockOfferRury = {
    id: 'o-1',
    userId: 'user-id',
    offer_number: 'R1',
    state: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    transportCost: 0,
    history: '[]'
};

const mockItem = {
    id: 'item-1',
    offerId: 'o-1',
    productId: 'p-1',
    quantity: 2,
    discount: 0,
    price: 50
};

const mockOfferStudnie = {
    id: 'offer_studnie_s-1',
    userId: 'user-id',
    offer_number: 'S1',
    state: 'draft',
    data: JSON.stringify({ totalPrice: 500 }),
    history: '[]',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

describe('Offers CRUD Routes', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = createApp();
    });

    describe('GET /api/offers', () => {
        it('powinien pobrać listy ofert rury i je przemapować', async () => {
            (prisma.offers_rel.findMany as jest.Mock).mockResolvedValue([mockOfferRury]);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([mockItem]);

            const res = await request(app).get('/api/offers');
            expect(res.statusCode).toBe(200);
            expect(res.body.data[0].id).toBe('o-1');
            expect(res.body.data[0].price).toBe(100);
        });

        it('powinien zwrócić pusty array jeśli błąd (lub obsłużyć HTTP 500)', async () => {
            (prisma.offers_rel.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));
            const res = await request(app).get('/api/offers');
            expect(res.statusCode).toBe(500);
        });
    });

    describe('GET /api/offers/studnie', () => {
        it('powinien pobrać oferty studni', async () => {
            (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([mockOfferStudnie]);

            const res = await request(app).get('/api/offers/studnie');
            expect(res.statusCode).toBe(200);
            expect(res.body.data[0].type).toBe('studnia_oferta');
            expect(res.body.data[0].price).toBe(500);
        });
    });

    describe('GET /api/offers/:id', () => {
        it('powinien pobrać konkretną ofertę rury', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferRury);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([mockItem]);

            const res = await request(app).get('/api/offers/o-1');
            expect(res.statusCode).toBe(200);
            expect(res.body.data.id).toBe('o-1');
        });

        it('powinien zablokować dostęp do oferty innego użytkownika jeśli nie jest się adminem', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
                ...mockOfferRury,
                userId: 'other-user'
            });

            const res = await request(app).get('/api/offers/o-1');
            expect(res.statusCode).toBe(403);
        });

        it('powinien zwrócić 404 dla braku oferty', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/offers/nonexistent');
            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/offers', () => {
        it('powinien utworzyć lub zaktualizować ofertę rury (upsert)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferRury);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([mockItem]);
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .post('/api/offers')
                .set('x-user-id', 'user-id')
                .send({
                    data: [{
                        id: 'o-1',
                        clientId: 'client-1',
                        status: 'active',
                        items: [ { productId: 'p-1', quantity: 2, price: 50, unitPrice: 50 } ]
                    }]
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(prisma.offers_rel.upsert).toHaveBeenCalled();
            expect(prisma.offer_items_rel.deleteMany).toHaveBeenCalled();
        });
    });

    describe('PUT /api/offers/studnie i DELETE', () => {
        it('powinien usunąć ofertę studni', async () => {
            (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferStudnie);
            (prisma.offers_studnie_rel.delete as jest.Mock).mockResolvedValue({});

            const res = await request(app)
                .delete('/api/offers/studnie/s-1')
                .set('x-user-id', 'user-id')
                .set('x-user-role', 'admin');

            expect(res.statusCode).toBe(200);
            expect(res.body.ok).toBe(true);
        });
    });

    describe('PUT bulk routes i DELETE', () => {
        it('powinien usunąć ofertę rury (DELETE /:id)', async () => {
            (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockOfferRury);
            (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue([mockItem]);
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offers_rel.delete as jest.Mock).mockResolvedValue({});
            const res = await request(app)
                .delete('/api/offers/o-1')
                .set('x-user-id', 'user-id')
                .set('x-user-role', 'admin');
            expect(res.statusCode).toBe(200);
        });

        it('powinien zaktualizować grupowo oferty rur (PUT /)', async () => {
            (prisma.offers_rel.upsert as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.deleteMany as jest.Mock).mockResolvedValue({});
            (prisma.offer_items_rel.create as jest.Mock).mockResolvedValue({});
            const res = await request(app)
                .put('/api/offers')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 'o-1', status: 'draft', items: [] }] });
            expect(res.statusCode).toBe(200);
        });

        it('powinien zaktualizować grupowo oferty studni (PUT /studnie)', async () => {
            (prisma.offers_studnie_rel.upsert as jest.Mock).mockResolvedValue({});
            const res = await request(app)
                .put('/api/offers/studnie')
                .set('x-user-id', 'user-id')
                .send({ data: [{ id: 's-1', status: 'draft' }] });
            expect(res.statusCode).toBe(200);
        });
    });
});
