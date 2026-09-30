/**
 * P1.3 — kontrakt błędów POST /ai/transfer/export (HTTP, supertest).
 * Zły kształt body → 400 INVALID_BODY (nie MODEL_NOT_FOUND).
 * MODEL_NOT_FOUND zarezerwowane dla: modelId poprawny, model nie istnieje.
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

describe('P1.3 export body', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Kill-switch ON (prawdziwy requireAiMlEnabled na mocku DB).
        (mockFindUnique as any).mockResolvedValue({ value: '"1"' });
    });

    it.each([{}, { modelId: '' }, { modelId: 'x', dataset: 'bogus' }])(
        'złe body %j → 400 INVALID_BODY',
        async (body) => {
            const res = await request(buildApp())
                .post('/api/telemetry/ai/transfer/export')
                .send(body);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_BODY');
            expect(res.body.code).not.toBe('MODEL_NOT_FOUND');
        }
    );
});
