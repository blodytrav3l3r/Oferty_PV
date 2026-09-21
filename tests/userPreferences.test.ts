/**
 * Preferencje użytkownika — GET/PUT /api/users/me/preferences (m.in. motyw light/dark).
 */
import request from 'supertest';
import express from 'express';
import userPreferencesRouter from '../src/routes/userPreferences';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'user' };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

const prismaMock = {
    user_preferences: {
        findMany: jest.fn(),
        upsert: jest.fn()
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        get user_preferences() {
            return prismaMock.user_preferences;
        }
    }
}));

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/users/me', userPreferencesRouter);
    return app;
}

describe('user-preferences', () => {
    let app: express.Express;

    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    test('GET zwraca mapę preferencji zalogowanego użytkownika', async () => {
        prismaMock.user_preferences.findMany.mockResolvedValue([
            { userId: 'u1', key: 'theme', value: 'light' }
        ]);
        const res = await request(app).get('/api/users/me/preferences');
        expect(res.status).toBe(200);
        expect(res.body.preferences).toEqual({ theme: 'light' });
        expect(prismaMock.user_preferences.findMany).toHaveBeenCalledWith({
            where: { userId: 'u1' }
        });
    });

    test('GET bez wierszy zwraca pustą mapę', async () => {
        prismaMock.user_preferences.findMany.mockResolvedValue([]);
        const res = await request(app).get('/api/users/me/preferences');
        expect(res.status).toBe(200);
        expect(res.body.preferences).toEqual({});
    });

    test('PUT zapisuje motyw przez upsert na własnym userId', async () => {
        prismaMock.user_preferences.upsert.mockResolvedValue({});
        const res = await request(app)
            .put('/api/users/me/preferences')
            .send({ key: 'theme', value: 'dark' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, key: 'theme', value: 'dark' });
        expect(prismaMock.user_preferences.upsert).toHaveBeenCalledWith({
            where: { userId_key: { userId: 'u1', key: 'theme' } },
            update: { value: 'dark' },
            create: { userId: 'u1', key: 'theme', value: 'dark' }
        });
    });

    test('PUT odrzuca nieznaną wartość motywu (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/preferences')
            .send({ key: 'theme', value: 'neon' });
        expect(res.status).toBe(400);
        expect(prismaMock.user_preferences.upsert).not.toHaveBeenCalled();
    });

    test('PUT odrzuca nieznany klucz (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/preferences')
            .send({ key: 'font', value: 'dark' });
        expect(res.status).toBe(400);
        expect(prismaMock.user_preferences.upsert).not.toHaveBeenCalled();
    });
});
