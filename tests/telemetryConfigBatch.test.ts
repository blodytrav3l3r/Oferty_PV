import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/telemetryOwnership', () => ({
    assertOfferReadable: (_user: any, offerId: string | null | undefined) =>
        Promise.resolve(offerId !== 'forbidden-offer'),
    assertTelemetryIdWritable: () => Promise.resolve(true),
    assertTelemetryRowWritable: () => Promise.resolve(true)
}));

const mockUpdateLabel = jest.fn<any>().mockResolvedValue(undefined);

jest.mock('../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: (...args: any[]) => mockUpdateLabel(...args)
    },
    deriveLabelFromFlags: jest.fn<any>().mockReturnValue('MODIFIED')
}));

let mockLogsFindMany = jest.fn<any>().mockResolvedValue([]);
const mockLogsUpdate = jest.fn<any>().mockResolvedValue({});
const mockLogsUpdateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockLogsCreateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockHistoryCreateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockTransitionsCreateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
const mockTransaction = jest.fn<any>().mockImplementation(async (fn: any) =>
    fn({
        ai_telemetry_logs: { update: mockLogsUpdate, createMany: mockLogsCreateMany },
        ai_config_history: { createMany: mockHistoryCreateMany },
        ai_transition_snapshots: { createMany: mockTransitionsCreateMany }
    })
);

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: {
            findMany: (...args: any[]) => mockLogsFindMany(...args),
            update: (...args: any[]) => (mockLogsUpdate as any)(...args),
            updateMany: (...args: any[]) => (mockLogsUpdateMany as any)(...args),
            createMany: (...args: any[]) => (mockLogsCreateMany as any)(...args)
        },
        ai_config_history: {
            createMany: (...args: any[]) => (mockHistoryCreateMany as any)(...args)
        },
        ai_transition_snapshots: {
            createMany: (...args: any[]) => (mockTransitionsCreateMany as any)(...args)
        },
        $transaction: (...args: any[]) => (mockTransaction as any)(...args)
    }
}));

const item = (wellId: string, extra: Record<string, unknown> = {}) => ({
    solverSource: 'AUTO_JS',
    wellId,
    featureSnapshot: { a: 1 },
    allComponentIds: ['x'],
    ...extra
});

describe('POST /api/telemetry/ai/config-batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockLogsFindMany.mockResolvedValue([]);
        const { default: router } = await import('../src/routes/telemetryAi');
        app = express();
        app.use(express.json({ limit: '50mb' }));
        app.use('/api/telemetry', router);
    });

    it('2 itemy → 1 transakcja, createMany ×2, indeksy w odpowiedzi', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({ items: [item('w1'), item('w2')] });
        expect(res.status).toBe(200);
        expect(res.body.created).toHaveLength(2);
        expect(res.body.created[0].index).toBe(0);
        expect(res.body.created[1].index).toBe(1);
        expect(typeof res.body.created[0].telemetryId).toBe('string');
        expect(res.body.duplicates).toEqual([]);
        expect(res.body.rejected).toEqual([]);
        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockLogsCreateMany).toHaveBeenCalledTimes(1);
        expect((mockLogsCreateMany.mock.calls[0][0] as any).data).toHaveLength(2);
        expect(mockHistoryCreateMany).toHaveBeenCalledTimes(1);
        expect(mockTransitionsCreateMany).not.toHaveBeenCalled();
        // 1 prefetch findMany zamiast N findFirst
        expect(mockLogsFindMany).toHaveBeenCalledTimes(1);
    });

    it('duplikat w batchu: 1 created + 1 duplicate, usageCount=2', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({ items: [item('w1'), item('w1')] });
        expect(res.status).toBe(200);
        expect(res.body.created).toHaveLength(1);
        expect(res.body.duplicates).toHaveLength(1);
        expect(res.body.duplicates[0].index).toBe(1);
        expect(res.body.duplicates[0].telemetryId).toBe(res.body.created[0].telemetryId);
        expect((mockLogsCreateMany.mock.calls[0][0] as any).data[0].usageCount).toBe(2);
    });

    it('dedup z bazy: istniejący klucz → duplicate z update, nowy → created', async () => {
        mockLogsFindMany.mockResolvedValue([
            {
                id: 'old-1',
                wellId: 'w1',
                featureSnapshot: '{"a":1}',
                allComponentIds: '["x"]'
            }
        ]);
        const res = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({ items: [item('w1'), item('w2')] });
        expect(res.status).toBe(200);
        expect(res.body.duplicates).toEqual([{ index: 0, telemetryId: 'old-1' }]);
        expect(res.body.created).toHaveLength(1);
        expect(res.body.created[0].index).toBe(1);
        expect(mockLogsUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'old-1' } })
        );
    });

    it('51 itemów → 400; pusto → 400', async () => {
        const tooMany = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({ items: Array.from({ length: 51 }, (_, i) => item(`w${i}`)) });
        expect(tooMany.status).toBe(400);
        const empty = await request(app).post('/api/telemetry/ai/config-batch').send({ items: [] });
        expect(empty.status).toBe(400);
    });

    it('FORBIDDEN per item nie uwala reszty', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({ items: [item('w-ok'), item('w-f', { offerId: 'forbidden-offer' })] });
        expect(res.status).toBe(200);
        expect(res.body.created).toHaveLength(1);
        expect(res.body.created[0].index).toBe(0);
        expect(res.body.rejected).toEqual([{ index: 1, wellId: 'w-f', reason: 'FORBIDDEN' }]);
        expect((mockLogsCreateMany.mock.calls[0][0] as any).data).toHaveLength(1);
    });

    it('parentConfigId propaguje etykietę (updateLabelByTelemetry)', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/config-batch')
            .send({
                items: [
                    {
                        solverSource: 'MANUAL',
                        wellId: 'w9',
                        parentConfigId: 'par-1',
                        wasAccepted: true
                    }
                ]
            });
        expect(res.status).toBe(200);
        expect(res.body.created).toHaveLength(1);
        expect(mockUpdateLabel).toHaveBeenCalledWith('par-1', 'MODIFIED');
    });
});
