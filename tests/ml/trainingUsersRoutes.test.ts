/**
 * Endpointy allowlisty treningowej: GET/PUT /api/telemetry/ai/training-users.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/services/auditService', () => ({
    logAudit: jest.fn<any>().mockResolvedValue(undefined)
}));

const settingsStore = new Map<string, string>();
const deletedUserIds = new Set<string>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        users: {
            findMany: jest.fn<any>(async ({ where }: any) =>
                where.id.in
                    .filter((id: string) => !deletedUserIds.has(id))
                    .map((id: string) => ({ id }))
            )
        },
        settings: {
            findUnique: jest.fn<any>(async ({ where }: any) =>
                settingsStore.has(where.key)
                    ? { key: where.key, value: settingsStore.get(where.key) }
                    : null
            ),
            upsert: jest.fn<any>(async ({ where, update, create }: any) => {
                const v = settingsStore.has(where.key) ? update.value : create.value;
                settingsStore.set(where.key, v);
                return { key: where.key, value: v };
            })
        }
    }
}));

let app: express.Application;

beforeEach(async () => {
    jest.clearAllMocks();
    settingsStore.clear();
    deletedUserIds.clear();
    // P0.5 fail-closed: PUT wymaga flagi ON; testy logiki pracuja przy ON.
    settingsStore.set('feature_ai_ml_enabled', '"1"');
    const { default: router } = await import('../../src/routes/telemetryAiMl');
    app = express();
    app.use(express.json());
    app.use('/api/telemetry', router);
});

describe('GET /ai/training-users', () => {
    it('brak klucza → UNCONFIGURED i pusta lista', async () => {
        const res = await request(app).get('/api/telemetry/ai/training-users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'UNCONFIGURED',
            configured: false,
            userIds: [],
            legacyMigrated: false
        });
    });

    it('ustawiona lista → configured:true + ids', async () => {
        settingsStore.set('ai_training_user_ids', JSON.stringify(['A', 'B']));
        const res = await request(app).get('/api/telemetry/ai/training-users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'CONFIGURED',
            configured: true,
            userIds: ['A', 'B'],
            legacyMigrated: false
        });
    });

    it('nie zwraca usuniętych kont jako efektywnie dozwolonych', async () => {
        settingsStore.set('ai_training_user_ids', JSON.stringify(['A', 'deleted-user']));
        deletedUserIds.add('deleted-user');
        const res = await request(app).get('/api/telemetry/ai/training-users');

        expect(res.status).toBe(200);
        expect(res.body.userIds).toEqual(['A']);
    });

    it('oznacza listę odziedziczoną migracją do sprawdzenia przez admina', async () => {
        settingsStore.set('ai_training_user_ids', JSON.stringify(['A']));
        settingsStore.set('ai_training_user_ids_migrated', '1');
        const res = await request(app).get('/api/telemetry/ai/training-users');
        expect(res.body.legacyMigrated).toBe(true);
    });

    it('uszkodzona konfiguracja → UNAVAILABLE i bez autorów', async () => {
        settingsStore.set('ai_training_user_ids', 'not-json');
        const res = await request(app).get('/api/telemetry/ai/training-users');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'INVALID',
            configured: false,
            userIds: [],
            legacyMigrated: false
        });
    });
});

describe('PUT /ai/training-users', () => {
    it('zapisuje listę (z deduplikacją)', async () => {
        const res = await request(app)
            .put('/api/telemetry/ai/training-users')
            .send({ userIds: ['A', 'B', 'A'] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'CONFIGURED',
            configured: true,
            userIds: ['A', 'B'],
            legacyMigrated: false
        });
        expect(settingsStore.get('ai_training_user_ids')).toBe(JSON.stringify(['A', 'B']));
        expect(settingsStore.get('ai_training_user_ids_migrated')).toBe('0');
    });

    it('pusta lista = tryb nikt', async () => {
        const res = await request(app)
            .put('/api/telemetry/ai/training-users')
            .send({ userIds: [] });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            status: 'CONFIGURED',
            configured: true,
            userIds: [],
            legacyMigrated: false
        });
    });

    it('nie-tablica → 400', async () => {
        const res = await request(app)
            .put('/api/telemetry/ai/training-users')
            .send({ userIds: 'A' });
        expect(res.status).toBe(400);
    });

    it('kill-switch OFF → 503', async () => {
        settingsStore.set('feature_ai_ml_enabled', '"0"');
        const res = await request(app)
            .put('/api/telemetry/ai/training-users')
            .send({ userIds: ['A'] });
        expect(res.status).toBe(503);
    });

    it('P0.5 guard: brak flagi → 503 OFF fail-closed', async () => {
        settingsStore.delete('feature_ai_ml_enabled');
        const res = await request(app)
            .put('/api/telemetry/ai/training-users')
            .send({ userIds: ['A'] });
        expect(res.status).toBe(503);
    });
});
