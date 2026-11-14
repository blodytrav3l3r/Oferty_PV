import express from 'express';
import request from 'supertest';
import settingsRouter from '../src/routes/settings';

let mockRole = 'admin';
const mockSetting = { value: '7' };
const mockPrisma = {
    settings: {
        findUnique: jest.fn(async () => mockSetting),
        upsert: jest.fn(async ({ update }: any) => {
            mockSetting.value = update.value;
            return mockSetting;
        })
    }
};

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'settings-test', role: mockRole };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        get settings() {
            return mockPrisma.settings;
        }
    }
}));

function createApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    return app;
}

describe('global production start setting', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRole = 'admin';
        mockSetting.value = '7';
    });

    it('allows signed-in users to read the global start', async () => {
        const response = await request(createApp()).get('/api/settings/production-start-number');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ startNumber: 7 });
    });

    it('restricts updates to admins and validates a positive integer', async () => {
        const app = createApp();
        mockRole = 'user';
        expect(
            (
                await request(app)
                    .put('/api/settings/production-start-number')
                    .send({ startNumber: 12 })
            ).status
        ).toBe(403);
        mockRole = 'admin';
        expect(
            (
                await request(app)
                    .put('/api/settings/production-start-number')
                    .send({ startNumber: 0 })
            ).status
        ).toBe(400);
        const updated = await request(app)
            .put('/api/settings/production-start-number')
            .send({ startNumber: 12 });
        expect(updated.status).toBe(200);
        expect(updated.body).toEqual({ ok: true, startNumber: 12 });
    });
});
