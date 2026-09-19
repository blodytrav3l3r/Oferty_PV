/**
 * Kody magazynów (MAGAZYN dennica/nadbudowa) — GET/PUT /api/settings/magazyn-codes.
 */
import request from 'supertest';
import express from 'express';
import settingsRouter from '../src/routes/settings';

const userRole = { role: 'admin' as 'admin' | 'user' };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: userRole.role };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user?.role !== 'admin') {
            res.status(403).json({ error: 'Brak uprawnień' });
            return;
        }
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

const prismaMock = {
    settings: {
        findUnique: jest.fn(),
        upsert: jest.fn()
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        get settings() {
            return prismaMock.settings;
        }
    }
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    return app;
}

const CODES = {
    dennicaWl: 'WL',
    dennicaKlb: 'M0',
    nadbudowaWl: 'WL',
    nadbudowaKlb: 'M0'
};

describe('magazyn-codes', () => {
    let app: express.Express;

    beforeEach(() => {
        app = createTestApp();
        userRole.role = 'admin';
        jest.clearAllMocks();
    });

    test('GET bez wpisu → domyślne WL/M0', async () => {
        prismaMock.settings.findUnique.mockResolvedValue(null);
        const res = await request(app).get('/api/settings/magazyn-codes');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(CODES);
    });

    test('GET ze zapisem → zapisane kody', async () => {
        const stored = {
            dennicaWl: 'W1',
            dennicaKlb: 'K1',
            nadbudowaWl: 'W2',
            nadbudowaKlb: 'K2'
        };
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'magazyn_codes',
            value: JSON.stringify(stored)
        });
        const res = await request(app).get('/api/settings/magazyn-codes');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(stored);
    });

    test('GET z uszkodzonym JSON → domyślne', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'magazyn_codes',
            value: 'nie-json{{{'
        });
        const res = await request(app).get('/api/settings/magazyn-codes');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(CODES);
    });

    test('PUT admin → 200, kody upper-case', async () => {
        prismaMock.settings.upsert.mockResolvedValue({});
        const res = await request(app).put('/api/settings/magazyn-codes').send({
            dennicaWl: 'w1',
            dennicaKlb: 'k1',
            nadbudowaWl: 'w2',
            nadbudowaKlb: 'k2'
        });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            dennicaWl: 'W1',
            dennicaKlb: 'K1',
            nadbudowaWl: 'W2',
            nadbudowaKlb: 'K2'
        });
        expect(prismaMock.settings.upsert).toHaveBeenCalledTimes(1);
    });

    test('PUT non-admin → 403, zero zapisów', async () => {
        userRole.role = 'user';
        const res = await request(app).put('/api/settings/magazyn-codes').send(CODES);
        expect(res.status).toBe(403);
        expect(prismaMock.settings.upsert).not.toHaveBeenCalled();
    });

    test('PUT dowolne znaki (spacja, PL, myślnik) → 200', async () => {
        prismaMock.settings.upsert.mockResolvedValue({});
        const res = await request(app).put('/api/settings/magazyn-codes').send({
            dennicaWl: 'W Ł',
            dennicaKlb: 'łódź-1',
            nadbudowaWl: 'wl/2',
            nadbudowaKlb: 'M0'
        });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            dennicaWl: 'W Ł',
            dennicaKlb: 'ŁÓDŹ-1',
            nadbudowaWl: 'WL/2',
            nadbudowaKlb: 'M0'
        });
    });

    test('PUT kolizja WL=KLB w części → 400', async () => {
        for (const bad of [
            { ...CODES, dennicaKlb: 'wl' },
            { ...CODES, nadbudowaWl: 'm0' }
        ]) {
            const res = await request(app).put('/api/settings/magazyn-codes').send(bad);
            expect(res.status).toBe(400);
        }
        expect(prismaMock.settings.upsert).not.toHaveBeenCalled();
    });

    test('PUT ten sam kod w obu częściach → 200 (kolizja tylko w obrębie części)', async () => {
        prismaMock.settings.upsert.mockResolvedValue({});
        const res = await request(app).put('/api/settings/magazyn-codes').send({
            dennicaWl: 'A',
            dennicaKlb: 'B',
            nadbudowaWl: 'A',
            nadbudowaKlb: 'B'
        });
        expect(res.status).toBe(200);
    });

    test('PUT niepoprawne kody → 400', async () => {
        for (const bad of [
            { ...CODES, dennicaWl: '' },
            { ...CODES, nadbudowaKlb: '   ' },
            { ...CODES, dennicaKlb: 'x'.repeat(21) },
            { ...CODES, dennicaWl: 'A\nB' }
        ]) {
            const res = await request(app).put('/api/settings/magazyn-codes').send(bad);
            expect(res.status).toBe(400);
        }
        expect(prismaMock.settings.upsert).not.toHaveBeenCalled();
    });
});
