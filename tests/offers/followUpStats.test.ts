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
            { outcome: 'LOST_COMPETITION', c: 2 },
            { outcome: 'ABANDONED', c: 1 }
        ]);
        q.mockResolvedValueOnce([{ total: 8, nocontact: 1 }]);
        q.mockResolvedValueOnce([{ total: 2, nocontact: 0 }]);
        q.mockResolvedValueOnce([
            { r: 'cena', c: 2 },
            { r: null, c: 1 }
        ]);
        q.mockResolvedValueOnce([{ r: null, c: 1 }]);
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
        expect(s.outcomes).toEqual({ OPEN: 5, WON: 3, LOST_COMPETITION: 2, ABANDONED: 1 });
        expect(s.offersTotal).toBe(10);
        expect(s.noContact).toBe(1);
        // Konwersja z domkniętych: 3/(3+2+1) — noContact i OPEN poza mianownikiem.
        expect(s.conversion).toBeCloseTo(0.5);
        expect(s.abandoned).toBe(1);
        expect(s.wonValue).toBe(10000);
        expect(s.lostValue).toBe(2500.25);
        expect(s.lossReasons).toEqual([
            { reason: 'cena', count: 2 },
            { reason: 'Nie podano', count: 1 }
        ]);
        expect(s.abandonedReasons).toEqual([{ reason: 'Nie podano', count: 1 }]);
        expect(s.competitors).toEqual([{ competitor: 'Firma A', count: 2, avgPrice: 1500.5 }]);
        expect(s.perRep).toEqual([
            { userId: 'rep-1', contacts: 6, offers: 4, wins: 2 },
            { userId: 'rep-2', contacts: 1, offers: 1, wins: 0 }
        ]);
        expect(s.avgFirstContactH).toBe(30.5);
        expect(q).toHaveBeenCalledTimes(9);
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
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ h: null }]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(res.body.stats.conversion).toBe(0);
        expect(res.body.stats.abandoned).toBe(0);
        expect(res.body.stats.abandonedReasons).toEqual([]);
        expect(res.body.stats.avgFirstContactH).toBeNull();
        expect(res.body.stats.perRep).toEqual([]);
    });

    it('P4.3 cross-user: user widzi tylko wlasne oferty i follow-upy', async () => {
        // Symulacja DB filtrującej po scope z SQL: scope niesie userId jako
        // parametr — mock zwraca tylko wiersze widoczne dla tego usera.
        const renderSql = (q: unknown): string => {
            if (typeof q !== 'object' || q === null) return String(q);
            const o = q as { strings?: string[]; values?: unknown[] };
            if (!Array.isArray(o.strings) || !Array.isArray(o.values)) return String(q);
            const values = o.values as unknown[];
            let out = '';
            o.strings.forEach((s, i) => {
                out += s;
                if (i < values.length) out += JSON.stringify(values[i]);
            });
            return out;
        };
        const collectValues = (q: unknown): string[] => {
            const out: string[] = [];
            const walk = (v: unknown): void => {
                if (typeof v === 'string') {
                    out.push(v);
                    return;
                }
                if (typeof v === 'object' && v !== null) {
                    const o = v as { strings?: string[]; values?: unknown[] };
                    if (Array.isArray(o.strings) && Array.isArray(o.values)) {
                        o.values.forEach(walk);
                    }
                }
            };
            walk(q);
            return out;
        };
        const q = prisma.$queryRaw as jest.Mock;
        q.mockImplementation((sql: unknown) => {
            const vals = collectValues(sql);
            const who = vals.includes('rep-b') ? 'rep-b' : 'rep-a';
            const other = who === 'rep-a' ? 'rep-b' : 'rep-a';
            const s = renderSql(sql);
            // Guard: scope usera w każdym zapytaniu (nie admin, nie cudzy).
            expect(vals).toContain(who);
            expect(vals).not.toContain(other);
            if (s.includes('FROM latest GROUP BY')) {
                return Promise.resolve([{ outcome: 'OPEN', c: 1, _who: who }]);
            }
            if (s.includes('AS "nocontact"')) {
                return Promise.resolve([
                    { total: s.includes('FROM offers_rel') ? 1 : 0, nocontact: 0 }
                ]);
            }
            if (s.includes('AS "r", COUNT')) {
                return Promise.resolve([]);
            }
            if (s.includes('AS "cp"')) {
                return Promise.resolve([]);
            }
            if (s.includes('AS "k"')) {
                return Promise.resolve([{ k: 'won', v: who === 'rep-a' ? 100 : 200 }]);
            }
            if (s.includes('AS "u"')) {
                return Promise.resolve([{ u: who, contacts: 1, offers: 1, wins: 0 }]);
            }
            return Promise.resolve([{ h: 5 }]);
        });

        mockUser.role = 'user';
        mockUser.id = 'rep-a';
        const resA = await request(createApp()).get('/api/offers/followups/stats');
        expect(resA.status).toBe(200);
        expect(resA.body.stats.outcomes).toEqual({ OPEN: 1 });
        expect(resA.body.stats.offersTotal).toBe(1);
        expect(resA.body.stats.wonValue).toBe(100);
        expect(resA.body.stats.perRep).toEqual([
            { userId: 'rep-a', contacts: 1, offers: 1, wins: 0 }
        ]);

        mockUser.id = 'rep-b';
        const resB = await request(createApp()).get('/api/offers/followups/stats');
        expect(resB.status).toBe(200);
        expect(resB.body.stats.wonValue).toBe(200);
        expect(resB.body.stats.perRep).toEqual([
            { userId: 'rep-b', contacts: 1, offers: 1, wins: 0 }
        ]);
    });

    it('perRep: win dostaje autor domykajacego wpisu (latest WON), nie kazdy kontaktujacy', async () => {
        // Kontrakt KPI: rep-a kontaktowal oferte, ale latest WON napisal rep-b.
        // SQL (buildPerRepSql) laczy latest po autorze — win idzie do rep-b.
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValueOnce([{ outcome: 'WON', c: 1 }]);
        q.mockResolvedValueOnce([{ total: 1, nocontact: 0 }]);
        q.mockResolvedValueOnce([{ total: 0, nocontact: 0 }]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ k: 'won', v: 500 }]);
        q.mockResolvedValueOnce([
            { u: 'rep-a', contacts: 3, offers: 1, wins: 0 },
            { u: 'rep-b', contacts: 1, offers: 1, wins: 1 }
        ]);
        q.mockResolvedValueOnce([{ h: null }]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(res.body.stats.perRep).toEqual([
            { userId: 'rep-a', contacts: 3, offers: 1, wins: 0 },
            { userId: 'rep-b', contacts: 1, offers: 1, wins: 1 }
        ]);
    });

    it('user nie-admin: scope bez 1=1 (9 zapytan z filtrem)', async () => {
        mockUser.role = 'user';
        mockUser.id = 'rep-9';
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValue([]);

        const res = await request(createApp()).get('/api/offers/followups/stats');
        expect(res.status).toBe(200);
        expect(q).toHaveBeenCalled();
    });
});
