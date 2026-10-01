/**
 * P1.6 — matryca regresyjna guardów Transfer Center (HTTP, supertest).
 * AI OFF → wszystkie 6 endpointów zwraca 503 {error:"disabled"}.
 * Guardy istnieją — test chroni przed ich przypadkowym usunięciem.
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import aiTransferRouter from '../../src/routes/aiTransfer';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
}));

const mockFindUnique = jest.fn<any>();
jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        settings: {
            findUnique: (...args: unknown[]) => (mockFindUnique as any)(...args)
        }
    }
}));

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', role: 'admin' };
        next();
    },
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/telemetry', aiTransferRouter);
    return app;
}

const OFF = { value: '"0"' };

describe('P1.6 transfer guard matrix (AI OFF → 503)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (mockFindUnique as any).mockResolvedValue(OFF);
    });

    it('GET preview-export → 503', async () => {
        const res = await request(buildApp()).get(
            '/api/telemetry/ai/transfer/preview-export?modelId=x'
        );
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });

    it('POST export → 503', async () => {
        const res = await request(buildApp())
            .post('/api/telemetry/ai/transfer/export')
            .send({ modelId: 'x' });
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });

    it('POST dry-run → 503', async () => {
        const res = await request(buildApp())
            .post('/api/telemetry/ai/transfer/dry-run')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from([1, 2, 3]));
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });

    it('POST import → 503', async () => {
        const res = await request(buildApp())
            .post('/api/telemetry/ai/transfer/import?dryRunId=dry_x')
            .set('Content-Type', 'application/octet-stream')
            .send(Buffer.from([1, 2, 3]));
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });

    it('GET history → 503', async () => {
        const res = await request(buildApp()).get('/api/telemetry/ai/transfer/history');
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });

    it('GET :transferId → 503', async () => {
        const res = await request(buildApp()).get('/api/telemetry/ai/transfer/trf_x');
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ error: 'disabled' });
    });
});
