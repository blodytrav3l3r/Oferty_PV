import request from 'supertest';
import express from 'express';
import offerRoutes from '../../src/routes/offers/index';
import prisma from '../../src/prismaClient';

const mockUser: any = { id: 'admin-1', role: 'admin', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/utils/ownership', () => ({
    canReadWithShare: jest.fn().mockResolvedValue(true),
    canWriteDoc: jest.fn().mockReturnValue(true),
    getSharedIdsForUser: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/prismaClient', () => {
    // Prawdziwy Prisma.sql/join do budowy zapytań (moku jemy tylko wykonanie).
    const real = jest.requireActual('../../generated/prisma');
    return {
        __esModule: true,
        Prisma: real.Prisma,
        default: {
            offers_rel: { findUnique: jest.fn() },
            offers_studnie_rel: { findUnique: jest.fn() },
            offer_follow_ups: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
            audit_logs: { create: jest.fn() },
            $queryRaw: jest.fn()
        }
    };
});

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers', offerRoutes);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    mockUser.id = 'admin-1';
    mockUser.role = 'admin';
    mockUser.subUsers = [];
    const ownership = jest.requireMock('../../src/utils/ownership') as {
        getSharedIdsForUser: jest.Mock;
    };
    ownership.getSharedIdsForUser.mockResolvedValue([]);
});

describe('P3 GET /followups/stats', () => {
    it('agreguje: konwersja, wartosci, причини, konkurencja, perRep', async () => {
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValueOnce([
            { outcome: 'OPEN', c: 5 },
            { outcome: 'WON', c: 3n },
            { outcome: 'LOST_COMPETITION', c: 2 }
        ]);
        q.mockResolvedValueOnce([{ total: 8, nocontact: 1 }]);
        q.mockResolvedValueOnce([{ total: 2, nocontact: 0 }]);
        q.mockResolvedValueOnce([
            { r: 'cena', c: 2 },
            { r: null, c: 1 }
        ]);
        q.mockResolvedValueOnce([{ cp: 'Firma A', c: 2, avg: 1500.5 }]);
        q.mockResolvedValueOnce([
            { k: 'won', v: 9000 },
            { k: 'won', v: 1000 },
            { k: 'lost', v: 2500.25 },
            { k: 'lost', v: null }
        ]);
        q.mockResolvedValueOnce([
            { u: 'rep-1', contacts: 6, offers: 4n, wins: 2 },
            { u: 'rep-2', contacts: 1, offers: 1, wins: null }
        ]);
        q.mockResolvedValueOnce([{ h: 30.5 }]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        const s = res.body.stats;
        expect(s.outcomes).toEqual({ OPEN: 5, WON: 3, LOST_COMPETITION: 2 });
        expect(s.offersTotal).toBe(10);
        expect(s.noContact).toBe(1);
        expect(s.conversion).toBeCloseTo(0.3);
        expect(s.wonValue).toBe(10000);
        expect(s.lostValue).toBe(2500.25);
        expect(s.lossReasons).toEqual([
            { reason: 'cena', count: 2 },
            { reason: 'Nie podano', count: 1 }
        ]);
        expect(s.competitors).toEqual([{ competitor: 'Firma A', count: 2, avgPrice: 1500.5 }]);
        expect(s.perRep).toEqual([
            { userId: 'rep-1', contacts: 6, offers: 4, wins: 2 },
            { userId: 'rep-2', contacts: 1, offers: 1, wins: 0 }
        ]);
        expect(s.avgFirstContactH).toBe(30.5);
        expect(q).toHaveBeenCalledTimes(8);
    });

    it('pusta baza: zera bez dzielenia przez zero', async () => {
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ total: 0, nocontact: 0 }]);
        q.mockResolvedValueOnce([{ total: 0, nocontact: 0 }]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ h: null }]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(res.body.stats.conversion).toBe(0);
        expect(res.body.stats.avgFirstContactH).toBeNull();
        expect(res.body.stats.perRep).toEqual([]);
    });

    it('user nie-admin: scope bez 1=1 (8 zapytan z filtrem)', async () => {
        mockUser.role = 'user';
        mockUser.id = 'rep-9';
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValue([]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(q).toHaveBeenCalled();
    });
});
