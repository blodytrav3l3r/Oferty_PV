/**
 * E5.5 — security & contract gate dla endpointów zmienionych w E2-E4.
 *
 * Read-only + runtime contract: FAIL dowodzi luki, PASS blokuje regresję.
 * Auth mockowane nagłówkami (x-test-anon / x-user-id / x-user-role),
 * DB mockowana — testy dowodzą kontraktu HTTP, nie integracji z SQLite.
 * Rate limiting i CSP weryfikowane statycznie (okablowanie bez zmian
 * zachowania) + istniejące tests/security/{headers,rateLimit,csrf}.test.ts.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/prismaClient';
import { offerItemSchema, wellComponentSchema } from '../../src/validators/offerSchemas';
import { ML_CONSTANTS } from '../../src/config/mlConstants';
import { clearPredictionCache } from '../../src/services/ml/predictionCache';
import auditRoutes from '../../src/routes/audit';
import clientsRoutes from '../../src/routes/clients';
import pricelistVersionRoutes from '../../src/routes/pricelistVersions';
import sharesRoutes from '../../src/routes/shares';
import telemetryRoutes from '../../src/routes/telemetryAiMl';
import usersRoutes from '../../src/routes/users';
import { PricelistVersionError } from '../../src/services/pricelistVersionService';

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, res: any, next: any) => {
        if (req.headers['x-test-anon']) {
            res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
            return;
        }
        req.user = {
            id: (req.headers['x-user-id'] as string) || 'u-test',
            username: 'test',
            role: (req.headers['x-user-role'] as string) || 'user',
            subUsers: []
        };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
            return;
        }
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    PRICELIST_WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    ADMIN_USERS_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/aiMlGuard', () => ({
    requireAiMlEnabled: (_req: any, _res: any, next: any) => next(),
    isAiMlEnabled: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../../src/services/auditService', () => ({ logAudit: jest.fn() }));

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
        sessions: { deleteMany: jest.fn() },
        user_preferences: { deleteMany: jest.fn() },
        document_shares: {
            deleteMany: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn()
        },
        offers_rel: { count: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
        offers_studnie_rel: {
            count: jest.fn(),
            findUnique: jest.fn(),
            updateMany: jest.fn()
        },
        orders_studnie_rel: { count: jest.fn(), findUnique: jest.fn() },
        orders_rury_rel: { count: jest.fn(), findUnique: jest.fn() },
        production_orders_rel: { count: jest.fn() },
        clients_rel: { findMany: jest.fn() },
        audit_logs: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        $executeRaw: jest.fn()
    }
}));

const mockGetActiveModel = jest.fn();

jest.mock('../../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        getActiveModel: (...args: unknown[]) => mockGetActiveModel(...args),
        getModelCount: jest.fn().mockResolvedValue(0),
        computeFeatureImportance: jest.fn().mockResolvedValue([]),
        rollbackToPrevious: jest.fn().mockResolvedValue(null)
    }
}));

jest.mock('../../src/services/ml/TrainingPipeline', () => ({
    trainingPipeline: {
        run: jest.fn().mockResolvedValue({ trained: false }),
        getStatus: jest.fn().mockReturnValue({ running: false }),
        gateStatus: jest.fn().mockResolvedValue(null)
    }
}));

jest.mock('../../src/services/ml/SelfEvaluation', () => ({
    selfEvaluation: {
        checkAndRollbackIfNeeded: jest.fn().mockResolvedValue({ rolledBack: false }),
        recordPredictionResult: jest.fn()
    }
}));

jest.mock('../../src/services/ml/RewardCalculator', () => ({
    rewardCalculator: { processAction: jest.fn().mockResolvedValue({ applied: true }) }
}));

jest.mock('../../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: jest.fn().mockResolvedValue(undefined),
        getFeatureCount: jest.fn().mockResolvedValue(24)
    }
}));

jest.mock('../../src/services/ml/AcceptanceModel', () => ({
    AcceptanceModel: jest.fn().mockImplementation(() => ({
        predict: () => {
            throw new Error('e55gate: predict mock nie ustawiony');
        }
    }))
}));

/** Podmienia predict modelu na test; zwraca mock do asercji wywołań. */
function setPredict(value: number): jest.Mock {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AcceptanceModel } = require('../../src/services/ml/AcceptanceModel');
    const predictMock = jest.fn().mockReturnValue(value);
    (AcceptanceModel as jest.Mock).mockImplementation(() => ({ predict: predictMock }));
    return predictMock;
}

jest.mock('../../src/services/pricelistVersionService', () => {
    class MockVersionError extends Error {
        statusCode: number;
        code: string;
        constructor(statusCode: number, code: string, message: string) {
            super(message);
            this.statusCode = statusCode;
            this.code = code;
        }
    }
    const updateDraft = jest.fn();
    return {
        PRICELIST_TYPES: ['rury', 'studnie', 'preco'],
        PricelistVersionError: MockVersionError,
        activate: jest.fn(),
        activateDue: jest.fn(),
        applyBackdate: jest.fn(),
        cloneAsDraft: jest.fn(),
        createDraft: jest.fn(),
        countVersionUsage: jest.fn(),
        deleteVersion: jest.fn(),
        getVersionDiff: jest.fn(),
        getVersionExportSheets: jest.fn(),
        updateDraft
    };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const updateDraftMock = require('../../src/services/pricelistVersionService')
    .updateDraft as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const auditMock = require('../../src/services/auditService').logAudit as jest.Mock;

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use('/api/pricelist-versions', pricelistVersionRoutes);
    app.use('/api/telemetry', telemetryRoutes);
    app.use('/api/users', usersRoutes);
    app.use('/api/clients', clientsRoutes);
    app.use('/api/shares', sharesRoutes);
    app.use('/api/audit', auditRoutes);
    return app;
}

const anon = { 'x-test-anon': '1' };
const user = { 'x-user-id': 'u-test', 'x-user-role': 'user' };
const admin = { 'x-user-id': 'admin-1', 'x-user-role': 'admin' };

const FEATS = (): number[] => new Array(ML_CONSTANTS.FEATURE_COUNT).fill(0.5);

function mockActiveModel(): void {
    const n = ML_CONSTANTS.FEATURE_COUNT;
    mockGetActiveModel.mockResolvedValue({
        id: 'model-v1',
        version: 'v1.0.0-gate',
        weights: new Array(n).fill(0.1),
        bias: 0,
        featureMins: new Array(n).fill(0),
        featureMaxs: new Array(n).fill(1)
    });
}

/** Odpowiedź nie zawiera sekretów, tokenów ani śladów stosu. */
function expectNoLeak(body: unknown): void {
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('token');
    expect(JSON.stringify(body)).not.toMatch(
        /password|secret|token|stack|trace|weights|bias|_hash/i
    );
}

function readSrc(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf-8');
}

beforeEach(() => {
    jest.clearAllMocks();
    clearPredictionCache();
});

describe('E5.5 gate: 401 bez sesji (wszystkie 6 ścieżek)', () => {
    let app: express.Application;
    beforeEach(() => {
        app = buildApp();
    });

    it('PUT /pricelist-versions/:id → 401', async () => {
        const res = await request(app)
            .put('/api/pricelist-versions/v1')
            .set(anon)
            .send({ note: 'x' });
        expect(res.status).toBe(401);
    });

    it('POST /ai/predict/batch → 401', async () => {
        const predictMock = setPredict(0.5);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set(anon)
            .send({ candidates: [{ id: 1, features: FEATS() }] });
        expect(res.status).toBe(401);
        expect(predictMock).not.toHaveBeenCalled();
    });

    it('DELETE /users/:id → 401', async () => {
        const res = await request(app).delete('/api/users/u-x').set(anon);
        expect(res.status).toBe(401);
    });

    it('PUT /clients → 401', async () => {
        const res = await request(app).put('/api/clients').set(anon).send({ data: [] });
        expect(res.status).toBe(401);
    });

    it('POST /shares/revoke → 401', async () => {
        const res = await request(app)
            .post('/api/shares/revoke')
            .set(anon)
            .send({ documentType: 'offer', documentId: 'd1', userIds: ['u2'] });
        expect(res.status).toBe(401);
    });

    it('GET /audit/:entityType/:entityId → 401', async () => {
        const res = await request(app).get('/api/audit/offer/o1').set(anon);
        expect(res.status).toBe(401);
    });
});

describe('E5.5 gate: role i ownership', () => {
    let app: express.Application;
    beforeEach(() => {
        app = buildApp();
    });

    it('versions PUT: user → 403, admin → 200 bez leaku', async () => {
        updateDraftMock.mockResolvedValue({ id: 'v1', type: 'rury', seq: 3 });
        const denied = await request(app)
            .put('/api/pricelist-versions/v1')
            .set(user)
            .send({ note: 'nota' });
        expect(denied.status).toBe(403);
        expect(updateDraftMock).not.toHaveBeenCalled();

        const ok = await request(app)
            .put('/api/pricelist-versions/v1')
            .set(admin)
            .send({ note: 'nota' });
        expect(ok.status).toBe(200);
        expect(updateDraftMock).toHaveBeenCalledWith('v1', undefined, 'nota');
        expectNoLeak(ok.body);
    });

    it('ai batch: zwykły user → 200 (kontrakt: predykcja dla każdego zalogowanego)', async () => {
        mockActiveModel();
        setPredict(0.5);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set(user)
            .send({ candidates: [{ id: 1, features: FEATS() }] });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.scores)).toBe(true);
        expectNoLeak(res.body);
    });

    it('users DELETE: user → 403; admin self → 400; admin obcy bez dokumentów → 200', async () => {
        const forbidden = await request(app).delete('/api/users/u-x').set(user);
        expect(forbidden.status).toBe(403);

        const self = await request(app).delete('/api/users/admin-1').set(admin);
        expect(self.status).toBe(400);

        (prisma.offers_rel.count as jest.Mock).mockResolvedValue(0);
        (prisma.offers_studnie_rel.count as jest.Mock).mockResolvedValue(0);
        (prisma.orders_studnie_rel.count as jest.Mock).mockResolvedValue(0);
        (prisma.orders_rury_rel.count as jest.Mock).mockResolvedValue(0);
        (prisma.production_orders_rel.count as jest.Mock).mockResolvedValue(0);
        const txMock = {
            sessions: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            user_preferences: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
            document_shares: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
            users: { delete: jest.fn().mockResolvedValue({}) }
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txMock));
        const ok = await request(app).delete('/api/users/u-x').set(admin);
        expect(ok.status).toBe(200);
        expect(prisma.$transaction).toHaveBeenCalled();
        expectNoLeak(ok.body);
    });

    it('clients PUT: user z pustą tablicą → 403 (blokada full-wipe)', async () => {
        const res = await request(app).put('/api/clients').set(user).send({ data: [] });
        expect(res.status).toBe(403);
    });

    it('clients PUT: user nie przepisuje właściciela istniejącego wiersza', async () => {
        const txMock = {
            $queryRaw: jest.fn((parts: TemplateStringsArray) =>
                String(parts.join('')).includes('SELECT')
                    ? Promise.resolve([{ id: 'c-own', userId: 'owner-db' }])
                    : Promise.resolve([{ id: 'c-own' }])
            ),
            $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'c-own' }]),
            clients_rel: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
            offers_rel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            offers_studnie_rel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txMock));
        const res = await request(app)
            .put('/api/clients')
            .set(user)
            .send({ data: [{ id: 'c-own', name: 'Cudzy' }] });
        expect(res.status).toBe(200);
        // Batch: owner z DB ląduje w parametrach jednego bulk UPSERT ($queryRawUnsafe).
        const seen = JSON.stringify(txMock.$queryRawUnsafe.mock.calls);
        expect(seen).toContain('owner-db');
        expectNoLeak(res.body);
    });

    it('shares revoke: obcy → 403; owner → 200 z audytem w tx', async () => {
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue({ userId: 'owner-1' });
        (prisma.users.findMany as jest.Mock).mockResolvedValue([{ id: 'u2', role: 'user' }]);
        const forbidden = await request(app)
            .post('/api/shares/revoke')
            .set(user)
            .send({ documentType: 'offer', documentId: 'd1', userIds: ['u2'] });
        expect(forbidden.status).toBe(403);

        const txMock = {
            document_shares: {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                findMany: jest.fn().mockResolvedValue([])
            }
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txMock));
        const ok = await request(app)
            .post('/api/shares/revoke')
            .set({ 'x-user-id': 'owner-1', 'x-user-role': 'user' })
            .send({ documentType: 'offer', documentId: 'd1', userIds: ['u2'] });
        expect(ok.status).toBe(200);
        expect(auditMock).toHaveBeenCalledWith(
            'document_share',
            'd1',
            'owner-1',
            'revoke_batch',
            expect.objectContaining({ documentType: 'offer' }),
            null,
            expect.anything()
        );
        expectNoLeak(ok.body);
    });
});

describe('E5.5 gate: kontrakt + autoryzacja POST /ai/predict/batch', () => {
    let app: express.Application;
    beforeEach(() => {
        app = buildApp();
    });

    it('graniczne dane → 4xx nie 500 (string/object/brak/puste/null/za mało cech)', async () => {
        mockActiveModel();
        setPredict(0.5);
        const payloads = [
            { candidates: 'nie-tablica' },
            { candidates: [{ id: 1 }] },
            { candidates: [] },
            { candidates: [{ id: 1, features: [...FEATS().slice(0, -1), null] }] },
            { candidates: [{ id: 1, features: [0.1, 0.2] }] }
        ];
        for (const p of payloads) {
            const res = await request(app)
                .post('/api/telemetry/ai/predict/batch')
                .set(user)
                .send(p);
            expect([400, 422]).toContain(res.status);
            expect(res.status).not.toBe(500);
            expect(res.body).not.toHaveProperty('scores');
            expectNoLeak(res.body);
        }
    });

    it('brak modelu → 503 (nie 500), odpowiedź bez wag', async () => {
        mockGetActiveModel.mockResolvedValue(null);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set(user)
            .send({ candidates: [{ id: 1, features: FEATS() }] });
        expect(res.status).toBe(503);
        expectNoLeak(res.body);
    });

    it('200 zwraca tylko id/score/version(+cached) — zero wag i biasu', async () => {
        mockActiveModel();
        setPredict(0.7);
        const res = await request(app)
            .post('/api/telemetry/ai/predict/batch')
            .set(user)
            .send({ candidates: [{ id: 1, features: FEATS() }] });
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['scores']);
        for (const s of res.body.scores) {
            expect(Object.keys(s).sort()).toEqual(
                expect.arrayContaining(['id', 'score', 'version'])
            );
            expect(JSON.stringify(s)).not.toMatch(/weight|bias/i);
        }
    });
});

describe('E5.5 gate: brak 500 na danych granicznych E2/E5', () => {
    let app: express.Application;
    beforeEach(() => {
        app = buildApp();
    });

    it('rabat string/obiekt/tablica → safeParse false (E2: finite 0-100)', () => {
        for (const schema of [offerItemSchema, wellComponentSchema]) {
            const base = schema === offerItemSchema ? { productId: 'p1', quantity: 1 } : {};
            for (const discount of ['50', { v: 50 }, [50], NaN, Infinity, 101, -1]) {
                expect(schema.safeParse({ ...base, discount }).success).toBe(false);
            }
            expect(schema.safeParse({ ...base, discount: 50 }).success).toBe(true);
        }
    });

    it('audit zły typ encji → 400 INVALID_ENTITY_TYPE bez dotykania bazy (nie 500)', async () => {
        (prisma.audit_logs.count as jest.Mock).mockResolvedValue(0);
        (prisma.audit_logs.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.users.findMany as jest.Mock).mockResolvedValue([]);
        const ok = await request(app).get('/api/audit/offer/o1').set(admin);
        expect(ok.status).toBe(200);
        expectNoLeak(ok.body);
        for (const entityType of [
            'no_such_type__123',
            encodeURIComponent("x' OR '1'='1"),
            encodeURIComponent('{$ne:null}')
        ]) {
            (prisma.audit_logs.count as jest.Mock).mockClear();
            const res = await request(app).get(`/api/audit/${entityType}/o1`).set(admin);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_ENTITY_TYPE');
            expect(prisma.audit_logs.count).not.toHaveBeenCalled();
            expectNoLeak(res.body);
        }
    });

    it('versions zły id → 404, nota-nie-string → 400 INVALID_BODY (nie 500)', async () => {
        updateDraftMock.mockRejectedValueOnce(
            new PricelistVersionError(404, 'NOT_FOUND', 'Wersja nope nie istnieje')
        );
        const notFound = await request(app)
            .put('/api/pricelist-versions/nope')
            .set(admin)
            .send({ note: 'nota' });
        expect(notFound.status).toBe(404);
        expect(notFound.body).not.toHaveProperty('stack');

        updateDraftMock.mockRejectedValueOnce(
            new PricelistVersionError(422, 'INVALID_NOTE', 'Nieprawidłowa nota')
        );
        const badNote = await request(app)
            .put('/api/pricelist-versions/v1')
            .set(admin)
            .send({ note: 12345 });
        expect(badNote.status).toBe(400);
        expect(badNote.body.code).toBe('INVALID_BODY');
        expect(updateDraftMock).toHaveBeenCalledTimes(1);
        expect(badNote.status).not.toBe(500);
    });

    it('shares revoke / clients ze złym kształtem → 400 (validateData), nie 500', async () => {
        const revoke = await request(app)
            .post('/api/shares/revoke')
            .set(user)
            .send({ documentType: 'offer', documentId: 'd1', userIds: 'u2' });
        expect(revoke.status).toBe(400);

        const clients = await request(app).put('/api/clients').set(admin).send({ data: 'x' });
        expect(clients.status).toBe(400);
    });
});

describe('E5.5 gate: okablowanie bez zmian zachowania', () => {
    it('rate limiting wpięty na wszystkich 5 ścieżkach (plus audit-auth)', () => {
        const wiring: Array<[string, string]> = [
            ['src/routes/telemetryAiMl.ts', 'TELEMETRY_WRITE_LIMITER'],
            ['src/routes/pricelistVersions.ts', 'PRICELIST_WRITE_LIMITER'],
            ['src/routes/users.ts', 'ADMIN_USERS_LIMITER'],
            ['src/routes/shares.ts', 'WRITE_LIMITER'],
            ['src/routes/clients.ts', 'WRITE_LIMITER']
        ];
        for (const [file, limiter] of wiring) {
            expect(readSrc(file)).toContain(limiter);
        }
    });

    it('CSP enforce: nonce per-request, zero unsafe-inline dla skryptów', () => {
        const appSrc = readSrc('src/app.ts');
        expect(appSrc).toContain('cspNonceMiddleware');
        expect(appSrc).toContain('nonce-');
        expect(appSrc).not.toContain(`scriptSrc: ["'self'", "'unsafe-inline'"]`);
        expect(appSrc).toContain(`frameAncestors: ["'self'"]`);
        const helmetBlock = appSrc.slice(
            appSrc.indexOf('helmet({'),
            appSrc.indexOf('})', appSrc.indexOf('helmet({')) + 2
        );
        expect(helmetBlock).not.toMatch(/https?:\/\//);
    });

    it('nagłówki twarde bez zmian (HSTS 2 lata, Permissions-Policy, nosniff)', () => {
        const sec = readSrc('src/middleware/security.ts');
        expect(sec).toContain('max-age=63072000; includeSubDomains; preload');
        expect(sec).toContain('camera=(), microphone=(), geolocation=()');
        expect(sec).toContain('nosniff');
    });
});
