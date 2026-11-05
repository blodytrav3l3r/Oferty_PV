/**
 * GET /api/audit/:entityType/:entityId — clamp limit (ujemny limit nie daje 500).
 */
import request from 'supertest';
import express from 'express';
import auditRouter from '../src/routes/audit';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        audit_logs: {
            count: jest.fn(async () => 0),
            findFirst: jest.fn(),
            findMany: jest.fn(async () => [])
        }
    }
}));

import prisma from '../src/prismaClient';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/audit', auditRouter);
    return app;
}

describe('audit limit clamp', () => {
    test('limit=-5 → 200 z limitem 1 (bez 500 z Prisma)', async () => {
        const res = await request(createApp()).get('/api/audit/offer/abc?limit=-5');
        expect(res.status).toBe(200);
    });

    test('limit=1000 → 200 (cap MAX)', async () => {
        const res = await request(createApp()).get('/api/audit/offer/abc?limit=1000');
        expect(res.status).toBe(200);
    });
});

test('rebuild rejects truncated snapshots instead of returning partial offer data', async () => {
    const log = { id: 'log1', action: 'update', newData: '{"_auditTruncated":true}' };
    (prisma.audit_logs.findFirst as jest.Mock).mockResolvedValueOnce(log);
    (prisma.audit_logs.findMany as jest.Mock).mockResolvedValueOnce([log]);

    const result = await request(createApp()).get('/api/audit/rebuild/offer/abc/log1');

    expect(result.status).toBe(422);
    expect(result.body.code).toBe('AUDIT_SNAPSHOT_INCOMPLETE');
    expect(result.body.data).toBeUndefined();
});

describe('audit entityType allowlist', () => {
    const known = [
        'offer',
        'studnia_oferta',
        'order',
        'production_order',
        'document_share',
        'settings',
        'ai_model',
        'pricelist_version'
    ];

    test.each(known)('znany typ %s → 200', async (entityType) => {
        const res = await request(createApp()).get(`/api/audit/${entityType}/abc`);
        expect(res.status).toBe(200);
    });

    test('nieznany typ → 400 INVALID_ENTITY_TYPE, baza nietknięta', async () => {
        const count = prisma.audit_logs.count as jest.Mock;
        count.mockClear();
        const res = await request(createApp()).get('/api/audit/nope_xyz/abc');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_ENTITY_TYPE');
        expect(count).not.toHaveBeenCalled();
    });

    test('rebuild z nieznanym typem → 400', async () => {
        const res = await request(createApp()).get('/api/audit/rebuild/nope_xyz/abc/log1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_ENTITY_TYPE');
    });
});
