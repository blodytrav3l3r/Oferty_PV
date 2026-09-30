import request from 'supertest';
import express from 'express';
import telemetryRoutes from '../src/routes/telemetry';

/**
 * P1.5: kontrakt API telemetrii (wczesniej placeholder [200,201,400,404]).
 * POST /override: 200 + invariant zapisu; invalid body -> 400 (prawdziwa walidacja Zod).
 * GET /logs: admin 200 z deserializacja JSON; user -> 403.
 */

const store = {
    created: [] as Array<Record<string, unknown>>,
    logs: [] as Array<Record<string, unknown>>
};

let currentUser: { id: string; role: string } | null = { id: 'u1', role: 'admin' };

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: {
            create: jest.fn(async ({ data }: any) => {
                store.created.push(data);
                return data;
            }),
            findMany: jest.fn(async () => store.logs.map((l) => ({ ...l })))
        }
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
        req.user = currentUser;
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryRoutes);
    return app;
}

beforeEach(() => {
    store.created = [];
    store.logs = [];
    currentUser = { id: 'u1', role: 'admin' };
    jest.clearAllMocks();
});

describe('telemetry POST /override', () => {
    it('valid body -> 200 {success, id} + zapis z userId i wasModified', async () => {
        const res = await request(createApp())
            .post('/api/telemetry/override')
            .send({ originalConfig: [{ a: 1 }], finalConfig: [{ a: 2 }], overrideReason: 'test' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.id).toBe('string');
        expect(store.created).toHaveLength(1);
        expect(store.created[0]).toMatchObject({ userId: 'u1', wasModified: true });
    });

    it('brak overrideReason -> 400 (Zod, nie 500)', async () => {
        const res = await request(createApp())
            .post('/api/telemetry/override')
            .send({ originalConfig: [], finalConfig: [] });
        expect(res.status).toBe(400);
        expect(store.created).toHaveLength(0);
    });

    it('bez sesji -> 401', async () => {
        currentUser = null;
        const res = await request(createApp())
            .post('/api/telemetry/override')
            .send({ overrideReason: 'x' });
        expect(res.status).toBe(401);
    });
});

describe('telemetry GET /logs', () => {
    it('admin -> 200 z deserializacja JSON configow', async () => {
        store.logs = [
            {
                id: 'l1',
                original_auto_config: JSON.stringify([{ a: 1 }]),
                final_user_config: JSON.stringify([{ a: 2 }])
            }
        ];
        const res = await request(createApp()).get('/api/telemetry/logs');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].original_auto_config).toEqual([{ a: 1 }]);
        expect(res.body[0].final_user_config).toEqual([{ a: 2 }]);
    });

    it('user (nie admin) -> 403 bez wycieku', async () => {
        currentUser = { id: 'u2', role: 'user' };
        store.logs = [{ id: 'l1' }];
        const res = await request(createApp()).get('/api/telemetry/logs');
        expect(res.status).toBe(403);
    });
});
