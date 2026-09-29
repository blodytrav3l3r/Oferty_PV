/**
 * GET /api/pricelist-versions/ — kolumna Autor pokazuje nazwę, nie id.
 * createdByName: "Imię Nazwisko" || username || id (nie-user / usunięty).
 * Bez leaku: odpowiedź nie niesie haseł ani maili.
 */
import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const versions = [
    {
        id: 'v1',
        type: 'rury',
        seq: 1,
        version: 'v1',
        status: 'ACTIVE',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        createdBy: 'usr_admin',
        sha256: 'x'
    },
    {
        id: 'v2',
        type: 'rury',
        seq: 2,
        version: 'v2',
        status: 'DRAFT',
        effectiveFrom: '2026-01-02T00:00:00.000Z',
        createdBy: 'auto-ensure',
        sha256: 'x'
    },
    {
        id: 'v3',
        type: 'rury',
        seq: 3,
        version: 'v3',
        status: 'DRAFT',
        effectiveFrom: '2026-01-03T00:00:00.000Z',
        createdBy: 'user-gone',
        sha256: 'x'
    }
];

const users = [{ id: 'usr_admin', username: 'admin', firstName: 'System', lastName: 'Admin' }];

const zero = { count: jest.fn(async () => 0) };

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: { findMany: jest.fn(async () => versions.map((v) => ({ ...v }))) },
        users: {
            findMany: jest.fn(async ({ where }: any) => {
                const ids: string[] = where?.id?.in ?? [];
                return users.filter((u) => ids.includes(u.id));
            })
        },
        offers_rel: zero,
        offers_studnie_rel: zero,
        orders_rury_rel: zero,
        orders_studnie_rel: zero
    }
}));

import router from '../src/routes/pricelistVersions';

const app = express();
app.use(express.json());
app.use('/api/pricelist-versions', router);

describe('GET /api/pricelist-versions/ — createdByName', () => {
    test('nazwa zamiast id; fallback id dla systemowego i usuniętego', async () => {
        const res = await request(app).get('/api/pricelist-versions?type=rury');
        expect(res.status).toBe(200);
        const got = res.body.versions as Array<{ id: string; createdByName: string }>;
        expect(got.find((v) => v.id === 'v1')?.createdByName).toBe('System Admin');
        expect(got.find((v) => v.id === 'v2')?.createdByName).toBe('auto-ensure');
        expect(got.find((v) => v.id === 'v3')?.createdByName).toBe('user-gone');
    });

    test('brak leaku PII/haseł w odpowiedzi', async () => {
        const res = await request(app).get('/api/pricelist-versions?type=rury');
        const body = JSON.stringify(res.body);
        expect(body).not.toMatch(/password/i);
        expect(body).not.toMatch(/email/i);
    });
});
