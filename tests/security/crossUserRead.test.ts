import request from 'supertest';
import express from 'express';
import crudRouter from '../../src/routes/offers/crud';
import prisma from '../../src/prismaClient';

/**
 * P1-2: macierz cross-user na HTTP (RED -> GREEN).
 * - user-B czyta oferte user-A -> 403 (nie 404-oracle, nie 200), body bez danych oferty.
 * - nieistniejace id -> 404.
 * - zlosliwe id 'studnie' -> 400 przed baza (bez oracle).
 * - tresc 403 nie ujawnia wlasciciela, tytulu ani danych (information disclosure).
 */

// Auth jako user-B (zwykly user, bez podwladnych).
jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        if (!req.user) {
            req.user = { id: 'user-B', role: 'user', subUsers: [] };
        }
        next();
    }
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

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: jest.fn()
        },
        offers_studnie_rel: {
            findUnique: jest.fn()
        },
        offer_items_rel: {
            findMany: jest.fn()
        },
        document_shares: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue(null)
        }
    }
}));

const SECRET_TITLE = 'SEKRETNA-BUDOWA-A-999';

describe('P1-2 cross-user read (HTTP)', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/offers', crudRouter);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.document_shares.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.document_shares.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('403 gdy user-B czyta oferte rur user-A (bez wycieku danych)', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'doc-A1',
            userId: 'user-A',
            data: JSON.stringify({ totalPrice: 12345, title: SECRET_TITLE }),
            history: '[]',
            offer_number: 'A/1',
            state: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pricelistVersionId: null
        });
        const res = await request(app).get('/api/offers/doc-A1');
        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty('error');
        const raw = JSON.stringify(res.body);
        expect(raw).not.toContain('user-A');
        expect(raw).not.toContain(SECRET_TITLE);
        expect(raw).not.toContain('12345');
        expect(res.body).not.toHaveProperty('data');
        expect(prisma.offer_items_rel.findMany).not.toHaveBeenCalled();
    });

    it('404 dla nieistniejacej oferty (tenant-oracle zamkniety)', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(null);
        const res = await request(app).get('/api/offers/nie-ma-takiej');
        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty('error');
    });

    it('400 dla zlosliwego id "studnie" przed baza', async () => {
        const res = await request(app).get('/api/offers/studnie');
        expect(res.statusCode).toBe(400);
        expect(prisma.offers_rel.findUnique).not.toHaveBeenCalled();
    });
});
