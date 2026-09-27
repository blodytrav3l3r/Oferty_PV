import request from 'supertest';
import app from '../../src/app';

/**
 * P0.2: publiczne endpointy diagnostyczne nie ujawniają szczegółów.
 * - GET /health -> tylko status + timestamp (bez memory/uptime/version)
 * - GET /api/version -> tylko { version } (frontend versionDisplay.js używa wyłącznie data.version)
 * - GET /health/ready -> 200 albo 503, ale nigdy klucza `error` ze szczegółami DB
 * - GET /api/admin/system-info bez auth -> 401 (szczegóły tylko dla admina)
 */
describe('P0.2 information disclosure', () => {
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
});
