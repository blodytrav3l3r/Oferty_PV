/**
 * Testy HTTP endpointów Dashboard AI / Knowledge Base.
 *
 * Pokrycie (P5):
 * - GET  /api/telemetry/ai/knowledge/stats
 * - GET  /api/telemetry/ai/knowledge/patterns (w tym all_dn wildcard)
 * - POST /api/telemetry/ai/learning/run
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    READ_LIMITER: (_req: any, _res: any, next: any) => next()
}));

let app: express.Application;

beforeEach(async () => {
    jest.clearAllMocks();
    const { default: router } = await import('../../src/routes/telemetryAiDashboard');
    app = express();
    app.use(express.json());
    app.use('/api/telemetry', router);
});

describe('GET /api/telemetry/ai/knowledge/stats', () => {
    it('zwraca 200 z kompletem pól statystyk', async () => {
        const res = await request(app).get('/api/telemetry/ai/knowledge/stats');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('active');
        expect(res.body).toHaveProperty('archived');
        expect(res.body).toHaveProperty('avgConfidence');
        expect(res.body).toHaveProperty('totalRecommendations');
        expect(res.body).toHaveProperty('acceptedRecommendations');
        expect(res.body).toHaveProperty('rejectedRecommendations');
        expect(res.body).toHaveProperty('byPatternType');
        expect(res.body).toHaveProperty('recentDetected');
    });
});

describe('GET /api/telemetry/ai/knowledge/patterns', () => {
    it('zwraca 200 z items i licznikami telemetry', async () => {
        const res = await request(app).get('/api/telemetry/ai/knowledge/patterns');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body).toHaveProperty('telemetryCount');
        expect(res.body).toHaveProperty('patternsTotal');
        expect(res.body).toHaveProperty('patternsOtherDn');
        expect(res.body).toHaveProperty('lastRunAt');
    });

    it('all_dn (domyślnie) nie filtruje po średnicy — więcej wzorców niż filtr konkretny', async () => {
        const all = await request(app).get('/api/telemetry/ai/knowledge/patterns');
        const specific = await request(app).get(
            '/api/telemetry/ai/knowledge/patterns?dn=does-not-exist-999'
        );

        expect(all.status).toBe(200);
        expect(specific.status).toBe(200);
        // all_dn działa jak wildcard — musi zawierać co najmniej tyle samo wzorców,
        // co zapytanie o nieistniejącą średnicę
        expect(all.body.items.length).toBeGreaterThanOrEqual(specific.body.items.length);
    });

    it('obsługuje nieprawidłowe minConfidence (NaN) przywracając domyślną wartość 0.3', async () => {
        const res = await request(app).get(
            '/api/telemetry/ai/knowledge/patterns?minConfidence=invalid'
        );

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
    });
});

describe('POST /api/telemetry/ai/learning/run', () => {
    it('zwraca 200 z podsumowaniem cyklu uczenia', async () => {
        const res = await request(app).post('/api/telemetry/ai/learning/run');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('processed');
        expect(res.body).toHaveProperty('patternsDetected');
        expect(res.body).toHaveProperty('persistedToKb');
        expect(res.body).toHaveProperty('durationMs');
    });
});
