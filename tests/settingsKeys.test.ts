/**
 * Allowlista GET /api/settings/:key — znane klucze jak dotąd, obce → 404.
 */
import request from 'supertest';
import express from 'express';
import settingsRouter from '../src/routes/settings';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'user' };
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

describe('settings/:key allowlist', () => {
    let app: express.Express;

    beforeEach(() => {
        jest.clearAllMocks();
        app = createTestApp();
    });

    it('znany klucz (frontend priceDefaults) działa jak dotąd', async () => {
        prismaMock.settings.findUnique.mockResolvedValue({
            key: 'pricelist_defaults_updated_at',
            value: '"2026-09-26"'
        });
        const res = await request(app).get('/api/settings/pricelist_defaults_updated_at');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            key: 'pricelist_defaults_updated_at',
            value: '"2026-09-26"'
        });
    });

    it('wzór roku (year_letter_YYYY) przechodzi', async () => {
        prismaMock.settings.findUnique.mockResolvedValue(null);
        const res = await request(app).get('/api/settings/year_letter_2026');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ key: 'year_letter_2026', value: null });
    });

    it('obcy klucz (flaga AI) → 404 bez dotykania bazy', async () => {
        const res = await request(app).get('/api/settings/wells_ai_influence');
        expect(res.statusCode).toBe(404);
        expect(prismaMock.settings.findUnique).not.toHaveBeenCalled();
    });

    it('wstrzyknięty pattern (suffix) → 404', async () => {
        const res = await request(app).get('/api/settings/year_letter_2026x');
        expect(res.statusCode).toBe(404);
    });
});
