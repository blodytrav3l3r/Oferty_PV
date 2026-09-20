/**
 * E3b: walidacja zod na 4 endpointach (wzorzec telemetryAiMl.ts — safeParse → 400).
 * - POST /api/export-combined/{pdf,docx}: kształt ID (min/max + allow-list),
 *   BEZ wymogu UUID — bazy z historią mają legacy ID (offer_*, offer_studnie_*)
 * - PUT /api/feature-flags/import-export: strict { enabled: boolean }
 * - POST /api/feature-flags/audit: limit rozmiaru/kształtu details
 * - POST claim-production-numbers: count int + ignore-unknown
 */
import request from 'supertest';
import express from 'express';
import exportCombinedRouter from '../src/routes/exportCombined';
import featureFlagsRouter from '../src/routes/featureFlags';
import numberingRouter from '../src/routes/orders/numbering';

const RURY_UUID = '123e4567-e89b-12d3-a456-426614174001';
const STUDNIE_UUID = '123e4567-e89b-12d3-a456-426614174002';

let currentRole: 'admin' | 'user' = 'admin';
const mockUser: any = { id: 'admin-1', role: 'admin', subUsers: [] };

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser, role: currentRole };
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

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    EXPORT_LIMITER: (_req: any, _res: any, next: any) => next(),
    LOGIN_LIMITER: (_req: any, _res: any, next: any) => next(),
    Cennik_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/auditService', () => ({
    logAudit: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/utils/ownership', () => ({
    canWriteDoc: jest.fn().mockReturnValue(true),
    canReadDoc: jest.fn().mockReturnValue(true),
    canClaimNumber: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/services/combinedExport', () => ({
    generateCombinedOfferPDF: jest.fn().mockResolvedValue(Buffer.from('PDF-MOCK')),
    generateCombinedOfferDOCX: jest.fn().mockResolvedValue(Buffer.from('DOCX-MOCK'))
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn(async () => ({ userId: 'admin-1' })) },
        offers_studnie_rel: { findUnique: jest.fn(async () => ({ userId: 'admin-1' })) },
        users: {
            findUnique: jest.fn(async () => ({
                symbol: 'T',
                productionOrderStartNumber: 1
            }))
        },
        settings: {
            findUnique: jest.fn(async () => null),
            upsert: jest.fn(async () => ({}))
        },
        recycled_production_numbers: { findMany: jest.fn(async () => []) },
        $transaction: jest.fn(async (cb: any) =>
            cb({
                recycled_production_numbers: {
                    findMany: async () => [],
                    deleteMany: async () => ({ count: 0 })
                },
                $executeRaw: async () => 1,
                $queryRaw: async () => [{ lastNumber: 5 }]
            })
        )
    }
}));

import {
    generateCombinedOfferPDF,
    generateCombinedOfferDOCX
} from '../src/services/combinedExport';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/export-combined', exportCombinedRouter);
    app.use('/api/feature-flags', featureFlagsRouter);
    app.use('/api/orders-studnie', numberingRouter);
    return app;
}

describe('E3b: export-combined kształt ID (UUID i legacy)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentRole = 'admin';
    });

    it.each(['/api/export-combined/pdf', '/api/export-combined/docx'])(
        '%s: legacy ID (nie-UUID) przechodzą walidację -> 200',
        async (url) => {
            const app = buildApp();
            const res = await request(app)
                .post(url)
                .send({ offerRuryId: 'offer_rury_1', offerStudnieId: 'offer_studnie_1' });
            expect(res.status).toBe(200);
            if (url.endsWith('/pdf')) {
                expect(generateCombinedOfferPDF).toHaveBeenCalled();
            } else {
                expect(generateCombinedOfferDOCX).toHaveBeenCalled();
            }
        }
    );

    it('pdf: oversize id (>64) -> 400', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/export-combined/pdf')
            .send({ offerRuryId: 'a'.repeat(65), offerStudnieId: STUDNIE_UUID });
        expect(res.status).toBe(400);
    });

    it('pdf: poprawne UUID -> 200 (zachowanie bez zmian)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/export-combined/pdf')
            .send({ offerRuryId: RURY_UUID, offerStudnieId: STUDNIE_UUID });
        expect(res.status).toBe(200);
    });
});

describe('E3b: PUT import-export strict boolean', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentRole = 'admin';
    });

    it('"true" (string) -> 400', async () => {
        const app = buildApp();
        const res = await request(app)
            .put('/api/feature-flags/import-export')
            .send({ enabled: 'true' });
        expect(res.status).toBe(400);
    });

    it('1 (number) -> 400', async () => {
        const app = buildApp();
        const res = await request(app).put('/api/feature-flags/import-export').send({ enabled: 1 });
        expect(res.status).toBe(400);
    });

    it('brak pola -> 400', async () => {
        const app = buildApp();
        const res = await request(app).put('/api/feature-flags/import-export').send({});
        expect(res.status).toBe(400);
    });

    it.each([true, false])('poprawne %s -> 200 (zachowanie bez zmian)', async (enabled) => {
        const app = buildApp();
        const res = await request(app).put('/api/feature-flags/import-export').send({ enabled });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, enabled });
    });
});

describe('E3b: POST audit limit details', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentRole = 'admin';
    });

    it('oversize details -> 400', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/feature-flags/audit')
            .send({
                entityType: 'offer',
                entityId: 'x1',
                action: 'export.transfer',
                details: { blob: 'x'.repeat(3000) }
            });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('details');
    });

    it('details nie-obiekt (string) -> 400', async () => {
        const app = buildApp();
        const res = await request(app).post('/api/feature-flags/audit').send({
            entityType: 'offer',
            entityId: 'x1',
            action: 'export.transfer',
            details: 'boom'
        });
        expect(res.status).toBe(400);
    });

    it('małe details jak z frontendu -> 200 (zachowanie bez zmian)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/feature-flags/audit')
            .send({
                entityType: 'offer',
                entityId: 'x1',
                action: 'export.transfer',
                details: { module: 'rury', offerNumber: 'OF-1', ordersCount: 2 }
            });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});

describe('E3b: claim-production-numbers count', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentRole = 'admin';
    });

    it('count string "5" -> 400 (jak typeof-check)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .send({ count: '5' });
        expect(res.status).toBe(400);
    });

    it('unknown keys ignorowane -> 200 (zachowanie bez zmian)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .send({ count: 2, foo: 'bar' });
        expect(res.status).toBe(200);
        expect(res.body.seqs).toEqual([4, 5]);
    });

    it('poprawne count -> 200 (zachowanie bez zmian)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/orders-studnie/claim-production-numbers/admin-1')
            .send({ count: 1 });
        expect(res.status).toBe(200);
        expect(res.body.numbers).toHaveLength(1);
    });
});
