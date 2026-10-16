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
    assertTelemetryIdWritable: (_user: any, telemetryId: string | null | undefined) =>
        Promise.resolve(telemetryId !== 'forbidden-t'),
    assertTelemetryRowWritable: () => Promise.resolve(true)
}));

const mockUpdateLabel = jest.fn<any>().mockResolvedValue(undefined);

jest.mock('../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: {
        updateLabelByTelemetry: (...args: any[]) => mockUpdateLabel(...args)
    },
    deriveLabelFromFlags: jest.fn<any>().mockReturnValue('MODIFIED')
}));

let byIdRows: any[] = [];
let latestRows: any[] = [];
let manualExists: any = null;
const mockUpdateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockEventsCreateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockLogsCreateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockHistoryCreateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockTransitionsCreateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
const mockLogsCreate = jest.fn<any>().mockResolvedValue({});
const mockHistoryCreate = jest.fn<any>().mockResolvedValue({});
const mockTransaction = jest.fn<any>().mockImplementation(async (fn: any) =>
    fn({
        ai_telemetry_logs: {
            create: (...args: any[]) => (mockLogsCreate as any)(...args),
            update: jest.fn<any>().mockResolvedValue({}),
            updateMany: (...args: any[]) => (mockUpdateMany as any)(...args),
            createMany: (...args: any[]) => (mockLogsCreateMany as any)(...args)
        },
        ai_telemetry_events: {
            createMany: (...args: any[]) => (mockEventsCreateMany as any)(...args)
        },
        ai_config_history: {
            create: (...args: any[]) => (mockHistoryCreate as any)(...args),
            createMany: (...args: any[]) => (mockHistoryCreateMany as any)(...args)
        },
        ai_transition_snapshots: {
            createMany: (...args: any[]) => (mockTransitionsCreateMany as any)(...args)
        }
    })
);

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: {
            findMany: (args: any) => {
                if (args?.where?.id?.in) return Promise.resolve(byIdRows);
                if (args?.where?.wellId?.in) return Promise.resolve(latestRows);
                return Promise.resolve([]);
            },
            findFirst: () => Promise.resolve(manualExists),
            update: jest.fn<any>().mockResolvedValue({}),
            updateMany: (...args: any[]) => (mockUpdateMany as any)(...args),
            createMany: (...args: any[]) => (mockLogsCreateMany as any)(...args)
        },
        ai_telemetry_events: {
            createMany: (...args: any[]) => (mockEventsCreateMany as any)(...args)
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

const item = (telemetryId: string, wellId: string, extra: Record<string, unknown> = {}) => ({
    telemetryId,
    accepted: true,
    offerId: 'o1',
    wellId,
    warehouse: 'Kluczbork',
    configSnapshot: { dn: '1000', ringCount: 2, warehouse: 'Kluczbork' },
    ...extra
});

describe('POST /api/telemetry/ai/acceptance-batch', () => {
    let app: express.Application;

    beforeEach(async () => {
        jest.clearAllMocks();
        byIdRows = [];
        latestRows = [];
        manualExists = null;
        const { default: router } = await import('../src/routes/telemetryAi');
        app = express();
        app.use(express.json({ limit: '50mb' }));
        app.use('/api/telemetry', router);
    });

    it('2 itemy ze zmiana stanu → 1 updateMany grupowy + 1 createMany eventów', async () => {
        byIdRows = [
            { id: 't1', wasAccepted: false },
            { id: 't2', wasAccepted: false }
        ];
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({ items: [item('t1', 'w1'), item('t2', 'w2')] });
        expect(res.status).toBe(200);
        expect(res.body.updated).toHaveLength(2);
        expect(res.body.updated[0]).toEqual({ index: 0, telemetryId: 't1' });
        expect(res.body.duplicates).toEqual([]);
        expect(res.body.rejected).toEqual([]);
        // jeden updateMany z id IN (grupowanie po fladze), nie 2× update
        expect(mockUpdateMany).toHaveBeenCalledTimes(1);
        expect(mockUpdateMany.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                where: { id: { in: ['t1', 't2'] }, wasAccepted: { not: true } }
            })
        );
        expect(mockEventsCreateMany).toHaveBeenCalledTimes(1);
        expect((mockEventsCreateMany.mock.calls[0][0] as any).data).toHaveLength(2);
        expect(mockUpdateLabel).toHaveBeenCalledTimes(2);
        expect(res.body.eventsCreated).toBe(2);
    });

    it('powtórka tego samego stanu → duplicates, eventy i etykiety dalej lecą', async () => {
        byIdRows = [
            { id: 't1', wasAccepted: true },
            { id: 't2', wasAccepted: true }
        ];
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({ items: [item('t1', 'w1'), item('t2', 'w2')] });
        expect(res.status).toBe(200);
        expect(res.body.updated).toEqual([]);
        expect(res.body.duplicates).toHaveLength(2);
        expect(mockUpdateMany).not.toHaveBeenCalled();
        expect(mockEventsCreateMany).toHaveBeenCalledTimes(1);
        expect(mockUpdateLabel).toHaveBeenCalledTimes(2);
    });

    it('brak rekordu + snapshot → MANUAL capture przez recordConfigs', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({ items: [item('t9', 'w9')] });
        expect(res.status).toBe(200);
        expect(res.body.updated).toEqual([]);
        expect(res.body.manual).toHaveLength(1);
        expect(res.body.manual[0].index).toBe(0);
        expect(typeof res.body.manual[0].telemetryId).toBe('string');
        // MANUAL wiersz przez single-create w recordConfig (recordManualIfAbsent)
        const row = (mockLogsCreate.mock.calls[0][0] as any).data;
        expect(row.solverSource).toBe('MANUAL');
        expect(row.wellId).toBe('w9');
    });

    it('51 itemów → 400; pusto → 400', async () => {
        const tooMany = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({
                items: Array.from({ length: 51 }, (_, i) => item(`t${i}`, `w${i}`))
            });
        expect(tooMany.status).toBe(400);
        const empty = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({ items: [] });
        expect(empty.status).toBe(400);
    });

    it('FORBIDDEN per item nie uwala reszty', async () => {
        byIdRows = [{ id: 't1', wasAccepted: false }];
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({ items: [item('t1', 'w1'), item('forbidden-t', 'w2')] });
        expect(res.status).toBe(200);
        expect(res.body.updated).toHaveLength(1);
        expect(res.body.updated[0].index).toBe(0);
        expect(res.body.rejected).toEqual([{ index: 1, wellId: 'w2', reason: 'FORBIDDEN' }]);
    });
});
