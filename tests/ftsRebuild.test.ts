/**
 * P1-B: FTS jako dane pochodne — status wykrywa dryf, rebuild odtwarza,
 * pad sync nie psuje zapisu biznesowego. Endpointy tylko dla admina.
 */
import request from 'supertest';
import express from 'express';

const mockUser: any = { id: 'admin-1', role: 'admin' };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if ((req.user || {}).role === 'admin') return next();
        return res.status(403).json({ error: 'Forbidden' });
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

type Row = Record<string, any>;
const ftsRows: Row[] = [];
let offersRury = 0;
let offersStudnie = 0;

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $queryRawUnsafe: jest.fn(async (sql: string, ...params: any[]) => {
            if (sql.includes("type='table'")) return [{ name: 'offers_search_fts' }];
            if (sql.startsWith('SELECT COUNT(*)')) {
                if (sql.includes('FROM offers_search_fts')) {
                    if (sql.includes("type = 'rury'"))
                        return [{ n: ftsRows.filter((r) => r.type === 'rury').length }];
                    if (sql.includes("type = 'studnie'"))
                        return [{ n: ftsRows.filter((r) => r.type === 'studnie').length }];
                    return [{ n: ftsRows.length }];
                }
                if (sql.includes('FROM offers_rel')) return [{ n: offersRury }];
                if (sql.includes('FROM offers_studnie_rel')) return [{ n: offersStudnie }];
                return [{ n: 0 }];
            }
            if (sql.includes('NOT IN (SELECT id FROM offers_search_fts')) {
                const type = sql.includes("'rury'") ? 'rury' : 'studnie';
                const inFts = new Set(ftsRows.filter((r) => r.type === type).map((r) => r.id));
                const total = type === 'rury' ? offersRury : offersStudnie;
                const out: Row[] = [];
                for (let i = 1; i <= total && out.length < 10; i++) {
                    const id = `${type}-${i}`;
                    if (!inFts.has(id)) out.push({ id, type });
                }
                return out;
            }
            if (sql.startsWith('SELECT id FROM')) {
                // backfill chunk: zwraca id z zakresu (symulacja 1 chunku na typ).
                const m = /FROM "(\w+)"/.exec(sql);
                const table = m ? m[1] : '';
                const total = table === 'offers_rel' ? offersRury : offersStudnie;
                const type = table === 'offers_rel' ? 'rury' : 'studnie';
                const after = String(params[0] || '');
                const out: Row[] = [];
                for (let i = 1; i <= total; i++) {
                    const id = `${type}-${i}`;
                    if (id > after) out.push({ id });
                }
                return out.slice(0, 500);
            }
            return [];
        }),
        $executeRawUnsafe: jest.fn(async (sql: string, ...params: any[]) => {
            if (sql.startsWith('DELETE FROM offers_search_fts WHERE id = ?')) {
                const idx = ftsRows.findIndex((r) => r.id === params[0] && r.type === params[1]);
                if (idx >= 0) ftsRows.splice(idx, 1);
                return 1;
            }
            if (sql.startsWith('DELETE FROM offers_search_fts')) {
                ftsRows.length = 0;
                return 1;
            }
            if (sql.startsWith('INSERT INTO offers_search_fts')) {
                // backfill: params to lista id (ostatni chunk).
                const ids: string[] = params.filter((p) => typeof p === 'string');
                for (const id of ids) {
                    if (!ftsRows.some((r) => r.id === id))
                        ftsRows.push({ id, type: sql.includes("'studnie'") ? 'studnie' : 'rury' });
                }
                // single sync: pełny wiersz (6 pól, type na końcu).
                if (
                    params.length === 6 &&
                    typeof params[5] === 'string' &&
                    (params[5] === 'rury' || params[5] === 'studnie')
                ) {
                    if (!ftsRows.some((r) => r.id === params[0]))
                        ftsRows.push({ id: params[0], type: params[5] });
                }
                return 1;
            }
            if (sql.startsWith('CREATE VIRTUAL TABLE')) return 1;
            throw new Error(`nieobsługiwany SQL w mocku: ${sql.slice(0, 60)}`);
        })
    }
}));

import adminRouter from '../src/routes/admin';
import { ftsSyncStatus, rebuildFts5, syncFts5 } from '../src/utils/fts5Sync';
import prisma from '../src/prismaClient';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    return app;
}

beforeEach(() => {
    ftsRows.length = 0;
    offersRury = 0;
    offersStudnie = 0;
    mockUser.role = 'admin';
});

describe('P1-B FTS derived/rebuild', () => {
    test('status inSync na zgodnych licznikach', async () => {
        offersRury = 2;
        ftsRows.push({ id: 'rury-1', type: 'rury' }, { id: 'rury-2', type: 'rury' });
        const st = await ftsSyncStatus();
        expect(st.inSync).toBe(true);
        expect(st.tables.rury).toEqual({ offers: 2, fts: 2 });
    });

    test('status wykrywa brakujący wiersz', async () => {
        offersStudnie = 2;
        ftsRows.push({ id: 'studnie-1', type: 'studnie' });
        const st = await ftsSyncStatus();
        expect(st.inSync).toBe(false);
        expect(st.missingIds).toEqual([{ id: 'studnie-2', type: 'studnie' }]);
    });

    test('rebuild odtwarza indeks i zwraca liczbę wierszy', async () => {
        offersRury = 3;
        offersStudnie = 2;
        const total = await rebuildFts5();
        expect(total).toBe(5);
        const st = await ftsSyncStatus();
        expect(st.inSync).toBe(true);
    });

    test('syncFts5: true przy OK, false przy błędzie DB (zapis biznesowy nietknięty)', async () => {
        expect(
            await syncFts5('rury', { id: 'x', offer_number: '1', clientName: 'a', investName: 'b' })
        ).toBe(true);
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValueOnce(new Error('locked'));
        expect(
            await syncFts5('rury', { id: 'y', offer_number: '1', clientName: 'a', investName: 'b' })
        ).toBe(false);
    });

    test('GET /fts-status: 200 dla admina, 403 dla usera', async () => {
        const app = createApp();
        const ok = await request(app).get('/api/admin/fts-status');
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('inSync', true);
        mockUser.role = 'user';
        const denied = await request(app).get('/api/admin/fts-status');
        expect(denied.status).toBe(403);
        mockUser.role = 'admin';
    });

    test('POST /fts-rebuild: odtwarza i raportuje wiersze', async () => {
        offersRury = 1;
        const app = createApp();
        const res = await request(app).post('/api/admin/fts-rebuild');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, rows: 1, lastProgress: 1 });
    });
});
