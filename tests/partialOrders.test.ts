import request from 'supertest';
import express from 'express';
import orderRoutes from '../src/routes/orders/studnieOrders';
import prisma from '../src/prismaClient';

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'test-user', role: 'admin' };
        next();
    }
}));

// Mock DB audit log
jest.mock('../src/db', () => ({
    logAudit: jest.fn(),
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
            update: jest.fn()
        },
        production_orders_rel: {
            findMany: jest.fn()
        },
        // Raw SQL methods used in studnieOrders.ts
        $queryRawUnsafe: jest.fn(),
        $executeRawUnsafe: jest.fn()
    }
}));

describe('Partial Orders Backend Logic', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/orders-studnie', orderRoutes);
    });

    it('should support multiple orders for the same offerStudnieId', async () => {
        const offerId = 'offer-123';
        const order1 = {
            id: 'order-1',
            offerStudnieId: offerId,
            wells: [{ id: 'well-1', name: 'S1' }]
        };
        const order2 = {
            id: 'order-2',
            offerStudnieId: offerId,
            wells: [{ id: 'well-2', name: 'S2' }]
        };

        // Mock raw SQL for find (no existing orders) and execute
        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const res = await request(app)
            .put('/api/orders-studnie')
            .send({ data: [order1, order2] });

        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(true);
        // Should execute 2 INSERTs (one for each order)
        expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('should correctly filter orders by user role', async () => {
        const mockOrders = [
            { id: 'o1', userId: 'test-user', offerStudnieId: 'off1', data: '{}', createdAt: new Date().toISOString() },
            { id: 'o2', userId: 'other-user', offerStudnieId: 'off1', data: '{}', createdAt: new Date().toISOString() }
        ];
        // Mock raw SQL for GET
        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockOrders);

        const res = await request(app).get('/api/orders-studnie');
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].id).toBe('o1');
    });
});
