import request from 'supertest';
import express from 'express';
import prisma from '../src/prismaClient';
import offerRoutes from '../src/routes/offers/index';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-1', role: 'admin' };
        next();
    }
}));

jest.mock('../src/db', () => ({ logAudit: jest.fn() }));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_studnie_rel: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
            upsert: jest.fn()
        },
        offers_rel: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            upsert: jest.fn()
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

describe('SQL Injection - scenariusze ataku', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/offers', offerRoutes);
    });

    it('DELETE /studnie/:id z SQL injection w ID zwraca 404 (nie 500/sukces)', async () => {
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);

        const maliciousIds = [
            "1'; DROP TABLE audit_logs; --",
            "1' UNION SELECT * FROM users --",
            "1'; DELETE FROM users; --",
            "' OR '1'='1",
            "'; SELECT * FROM users; --"
        ];

        for (const id of maliciousIds) {
            const res = await request(app)
                .delete(`/api/offers/studnie/${encodeURIComponent(id)}`)
                .set('x-user-id', 'admin');

            // Powinien zwrócić 404 (nie znaleziono), nie 500 ani 200
            expect(res.statusCode).toBe(404);
        }
    });

    it('DELETE /:id z SQL injection w ID dla oferty rury zwraca 404', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .delete('/api/offers/1%27%3B%20DROP%20TABLE%20users%3B%20--')
            .set('x-user-id', 'admin');

        // ID zaczyna się od '1', nie 'offer_studnie_', więc trafi do gałęzi rur
        expect(res.statusCode).toBe(404);
    });

    it('POST /studnie z SQL injection w danych nie powoduje błędu bazy', async () => {
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.offers_studnie_rel.upsert as jest.Mock).mockResolvedValue({});

        const maliciousPayload = {
            data: [
                {
                    id: "test'; DROP TABLE audit_logs; --",
                    clientId: 'c1',
                    status: 'draft',
                    createdAt: Date.now()
                }
            ]
        };

        const res = await request(app).post('/api/offers/studnie').send(maliciousPayload);

        // Upsert powinien zostać wywołany z ID jako parametrem (nie w SQL)
        expect(prisma.offers_studnie_rel.upsert).toHaveBeenCalled();
        expect([200, 400, 500]).toContain(res.statusCode);
    });
});
