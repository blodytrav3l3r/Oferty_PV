/*
 * tests/offers/followUpSearchRoute.test.ts
 * Kontrakt trybu follow-up w search route: hasMore/nextCursor/totalCount.
 * Tryb follow-up (sort=followup lub filtry LOS) nie ma realnej paginacji
 * (kursor ignorowany) — hasMore=false, nextCursor=null, totalCount liczony.
 */
import request from 'supertest';
import express from 'express';
import searchRoutes from '../../src/routes/offers/search';
import prisma from '../../src/prismaClient';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'user-id', role: 'admin' };
        next();
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../src/utils/searchCache', () => ({
    searchCache: {
        get: jest.fn(() => null),
        set: jest.fn(),
        invalidateAll: jest.fn()
    }
}));

jest.mock('../../src/prismaClient', () => {
    const renderValue = (v: unknown): string => {
        if (
            typeof v === 'object' &&
            v !== null &&
            Array.isArray((v as { strings?: unknown }).strings) &&
            Array.isArray((v as { values?: unknown }).values)
        ) {
            const nested = v as { strings: string[]; values: unknown[] };
            let out = '';
            nested.strings.forEach((s, i) => {
                out += s;
                if (i < nested.values.length) out += renderValue(nested.values[i]);
            });
            return out;
        }
        return String(v);
    };
    const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => {
        let out = '';
        strings.forEach((s, i) => {
            out += s;
            if (i < values.length) out += renderValue(values[i]);
        });
        return out;
    };
    return {
        __esModule: true,
        default: {
            $queryRaw: jest.fn().mockResolvedValue([])
        },
        Prisma: {
            raw: (s: string): string => s,
            empty: '',
            sql,
            join: (values: unknown[]): string => values.join(', ')
        }
    };
});

function row(id: string, createdAt: string) {
    return {
        id,
        userId: 'user-id',
        clientId: null,
        state: 'draft',
        createdAt,
        updatedAt: createdAt,
        offer_number: 'N-' + id,
        history: '[]',
        clientName: 'Klient',
        investName: 'Inwest',
        clientNip: '',
        clientNumber: '',
        _type: 'rury',
        transportCost: null,
        _orderCount: 0,
        _fu_outcome: null,
        _fu_next: null,
        _fu_last: null
    };
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/offers/search', searchRoutes);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe('search route: hasMore/nextCursor/totalCount', () => {
    it('tryb zwykly: wiecej niz limit -> hasMore=true + kursor; mniej -> false', async () => {
        const q = prisma.$queryRaw as jest.Mock;
        // limit=2, wierszy 3 -> hasMore, slice do 2.
        q.mockResolvedValueOnce([
            row('3', '2026-10-03T10:00:00.000Z'),
            row('2', '2026-10-02T10:00:00.000Z'),
            row('1', '2026-10-01T10:00:00.000Z')
        ]);
        q.mockResolvedValueOnce([{ cnt: 3 }]);
        const over = await request(createApp()).get('/api/offers/search?limit=2');
        expect(over.status).toBe(200);
        expect(over.body.hasMore).toBe(true);
        expect(over.body.nextCursor).toBe('2026-10-02T10:00:00.000Z');
        expect(over.body.nextCursorId).toBe('2');
        expect(over.body.data).toHaveLength(2);
        expect(over.body.totalCount).toBe(3);

        q.mockResolvedValueOnce([row('1', '2026-10-01T10:00:00.000Z')]);
        q.mockResolvedValueOnce([{ cnt: 1 }]);
        const under = await request(createApp()).get('/api/offers/search?limit=2');
        expect(under.body.hasMore).toBe(false);
        expect(under.body.nextCursor).toBeNull();
        expect(under.body.totalCount).toBe(1);
    });

    it('tryb follow-up: hasMore=false + nextCursor=null mimo nadmiaru, totalCount liczony', async () => {
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValueOnce([
            row('3', '2026-10-03T10:00:00.000Z'),
            row('2', '2026-10-02T10:00:00.000Z'),
            row('1', '2026-10-01T10:00:00.000Z')
        ]);
        q.mockResolvedValueOnce([{ cnt: 3 }]);
        const res = await request(createApp()).get('/api/offers/search?limit=2&sort=followup');
        expect(res.status).toBe(200);
        expect(res.body.hasMore).toBe(false);
        expect(res.body.nextCursor).toBeNull();
        expect(res.body.nextCursorId).toBeNull();
        expect(res.body.totalCount).toBe(3);
    });

    it('pusto: hasMore=false, data=[], totalCount=0', async () => {
        const q = prisma.$queryRaw as jest.Mock;
        q.mockResolvedValueOnce([]);
        q.mockResolvedValueOnce([{ cnt: 0 }]);
        const res = await request(createApp()).get('/api/offers/search?followupStatus=won');
        expect(res.status).toBe(200);
        expect(res.body.hasMore).toBe(false);
        expect(res.body.data).toEqual([]);
        expect(res.body.totalCount).toBe(0);
    });
});
