/**
 * S2b: POST /:id/approve + naglowki deprecacji aliasow.
 * Warstwa route: mapowanie body, checksStale (audyt UPDATE), Deprecation/Sunset.
 */
import request from 'supertest';
import express from 'express';
import { PricelistVersionError } from '../src/services/pricelist/validation';

const mockUser: { id: string; role: string } = { id: 'admin-1', role: 'admin' };
const mockApproveVersion = jest.fn();
const mockPublishDraft = jest.fn();
const mockActivate = jest.fn();
const mockApplyBackdate = jest.fn();
const mockAuditFindFirst = jest.fn();

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    },
    requireAdmin: (req: any, res: any, next: any) => {
        if ((req.user || {}).role === 'admin') return next();
        return res.status(403).json({ error: 'Brak uprawnien administratora' });
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('../src/services/pricelistVersionService', () => ({
    PricelistVersionError,
    PRICELIST_TYPES: ['rury', 'studnie', 'preco'],
    approveVersion: mockApproveVersion,
    publishDraft: mockPublishDraft,
    activate: mockActivate,
    applyBackdate: mockApplyBackdate
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        audit_logs: { findFirst: mockAuditFindFirst }
    }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

const version = { id: 'v1', status: 'APPROVED', effectiveFrom: '2026-11-01T00:00:00.000Z' };

beforeEach(() => {
    jest.clearAllMocks();
    mockUser.role = 'admin';
    mockApproveVersion.mockResolvedValue(version);
    mockPublishDraft.mockResolvedValue(version);
    mockActivate.mockResolvedValue(version);
    mockApplyBackdate.mockResolvedValue(version);
});

describe('POST /api/pricelist-versions/:id/approve', () => {
    test('przekazuje effectiveFrom/note i wymusza note dla daty z przeszlosci', async () => {
        const res = await request(app)
            .post('/api/pricelist-versions/v1/approve')
            .send({ effectiveFrom: '2026-11-01', note: 'korekta wsteczna' });

        expect(res.status).toBe(200);
        expect(res.body.checksStale).toBe(false);
        expect(mockApproveVersion).toHaveBeenCalledWith('v1', {
            userId: 'admin-1',
            effectiveFrom: '2026-11-01',
            note: 'korekta wsteczna',
            requirePastNote: true
        });
        expect(mockAuditFindFirst).not.toHaveBeenCalled();
    });

    test('checksCheckedAt starszy niz UPDATE w audycie -> checksStale=true, nadal 200', async () => {
        mockAuditFindFirst.mockResolvedValue({ createdAt: '2026-10-21T12:00:00.000Z' });
        const res = await request(app)
            .post('/api/pricelist-versions/v1/approve')
            .send({ checksCheckedAt: '2026-10-21T10:00:00.000Z' });

        expect(res.status).toBe(200);
        expect(res.body.checksStale).toBe(true);
        expect(mockAuditFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    entityId: 'v1',
                    entityType: 'pricelist_version',
                    action: 'UPDATE'
                })
            })
        );
    });

    test('checksCheckedAt nowszy niz UPDATE -> checksStale=false', async () => {
        mockAuditFindFirst.mockResolvedValue({ createdAt: '2026-10-21T10:00:00.000Z' });
        const res = await request(app)
            .post('/api/pricelist-versions/v1/approve')
            .send({ checksCheckedAt: '2026-10-21T12:00:00.000Z' });

        expect(res.status).toBe(200);
        expect(res.body.checksStale).toBe(false);
    });

    test('brak UPDATE w audycie -> checksStale=false', async () => {
        mockAuditFindFirst.mockResolvedValue(null);
        const res = await request(app)
            .post('/api/pricelist-versions/v1/approve')
            .send({ checksCheckedAt: '2026-10-21T12:00:00.000Z' });

        expect(res.status).toBe(200);
        expect(res.body.checksStale).toBe(false);
    });

    test('zla data / note nie-tekst -> 400 bez wywolania serwisu', async () => {
        for (const body of [
            { effectiveFrom: 'nie-data' },
            { checksCheckedAt: 'nie-data' },
            { note: 123 }
        ]) {
            const res = await request(app).post('/api/pricelist-versions/v1/approve').send(body);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_BODY');
        }
        expect(mockApproveVersion).not.toHaveBeenCalled();
    });

    test('zle id -> 400 INVALID_ID', async () => {
        const res = await request(app).post('/api/pricelist-versions/zle%20id/approve').send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_ID');
    });

    test('blad domenowy serwisu -> status i kod bez zmian', async () => {
        mockApproveVersion.mockRejectedValue(
            new PricelistVersionError(409, 'APPROVE_NOT_DRAFT', 'nie DRAFT')
        );
        const res = await request(app).post('/api/pricelist-versions/v1/approve').send({});
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('APPROVE_NOT_DRAFT');
    });

    test('non-admin -> 403 bez wywolania serwisu', async () => {
        mockUser.role = 'user';
        const res = await request(app).post('/api/pricelist-versions/v1/approve').send({});
        expect(res.status).toBe(403);
        expect(mockApproveVersion).not.toHaveBeenCalled();
    });
});

describe('aliasy publish/activate/backdate', () => {
    test.each([
        ['publish', {}],
        ['activate', {}],
        ['backdate', { note: 'korekta wsteczna' }]
    ])('POST /:id/%s niesie Deprecation i Sunset', async (path, body) => {
        const res = await request(app).post(`/api/pricelist-versions/v1/${path}`).send(body);
        expect(res.status).toBe(200);
        expect(res.headers.deprecation).toBe('true');
        expect(res.headers.sunset).toBe('Wed, 31 Mar 2027 23:59:59 GMT');
    });
});
