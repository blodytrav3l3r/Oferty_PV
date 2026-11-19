import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/prismaClient';
import { createSession } from '../../src/middleware/auth';

async function openSession(role: 'admin' | 'user'): Promise<string> {
    const id = `ops-test-${role}`;
    await prisma.users.create({ data: { id, username: id, password: 'unused', role } });
    return `authToken=${await createSession(id)}`;
}

/**
 * P0.2: publiczne endpointy diagnostyczne nie ujawniają szczegółów.
 * - GET /health -> tylko status + timestamp (bez memory/uptime/version)
 * - GET /api/version -> tylko { version } (frontend versionDisplay.js używa wyłącznie data.version)
 * - GET /health/ready -> 200 albo 503, ale nigdy klucza `error` ze szczegółami DB
 * - GET /api/admin/system-info bez auth -> 401 (szczegóły tylko dla admina)
 */
describe('P0.2 information disclosure', () => {
    it('chroni diagnostykę ML i rozmiar bazy, zachowując status dla zalogowanego użytkownika', async () => {
        const user = await openSession('user');
        const admin = await openSession('admin');
        const diagnostics = '/api/telemetry/ai/ml-status';
        const summary = '/api/telemetry/ai/ml-summary';
        await request(app).get(diagnostics).expect(401);
        await request(app).get(summary).expect(401);
        await request(app).get(diagnostics).set('Cookie', user).expect(403);
        const status = await request(app).get(summary).set('Cookie', user).expect(200);
        expect(Object.keys(status.body).sort()).toEqual([
            'activeModelCreatedAt',
            'aiInfluencePct',
            'aiMlEnabled',
            'featureVersion',
            'mlOnline',
            'modelTrained',
            'modelVersion',
            'rankingVersion'
        ]);
        const detail = await request(app).get(diagnostics).set('Cookie', admin).expect(200);
        expect(detail.body).toHaveProperty('trainingGate');
        expect(detail.headers['content-security-policy']).toMatch(/script-src[^;]*nonce-/);

        await request(app).get('/metrics').set('Cookie', user).expect(403);
        const metrics = await request(app).get('/metrics').set('Cookie', admin).expect(200);
        expect(metrics.body.storage.dbSizeStatus).toBe('ok');
        expect(Number.isSafeInteger(metrics.body.storage.dbBytes)).toBe(true);
        expect(metrics.body.storage.dbBytes).toBeGreaterThan(0);
    });
    it('/health nie ujawnia diagnostyki', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).not.toHaveProperty('memory');
        expect(res.body).not.toHaveProperty('uptime');
        expect(res.body).not.toHaveProperty('version');
    });

    it('/api/version zwraca tylko numer wersji', async () => {
        const res = await request(app).get('/api/version');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
        expect(res.body).not.toHaveProperty('commitHash');
        expect(res.body).not.toHaveProperty('branch');
        expect(res.body).not.toHaveProperty('environment');
        expect(res.body).not.toHaveProperty('dbVersion');
    });

    it('/health/ready nigdy nie ujawnia błędu DB', async () => {
        const res = await request(app).get('/health/ready');
        expect([200, 503]).toContain(res.status);
        expect(res.body).not.toHaveProperty('error');
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('db');
    });

    it('/api/admin/system-info bez auth -> 401', async () => {
        const res = await request(app).get('/api/admin/system-info');
        expect(res.status).toBe(401);
    });

    it('/health/pdf nie ujawnia diagnostyki (I-011)', async () => {
        const res = await request(app).get('/health/pdf');
        expect([200, 503]).toContain(res.status);
        expect(Object.keys(res.body).sort()).toEqual(['status']);
        expect(['ok', 'degraded']).toContain(res.body.status);
        for (const k of ['user', 'home', 'cacheDir', 'executableName', 'shmMb', 'found']) {
            expect(res.body).not.toHaveProperty(k);
        }
    });

    it('/health/pdf?smoke=1 anonimowo nie uruchamia Chromium (401)', async () => {
        const res = await request(app).get('/health/pdf?smoke=1');
        expect(res.status).toBe(401);
        expect(res.body).not.toHaveProperty('smoke');
    });
});
