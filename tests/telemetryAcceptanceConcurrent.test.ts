/**
 * D-FIX-3: acceptance-full idempotentne przy współbieżności.
 * Granica mocka: prismaClient (in-memory mini-DB z wierną semantyką
 * updateMany-where, w tym `wasAccepted: { not }`), auth/ownership/limitery.
 * Service + route REALNE. Dowodzi kontraktu, nie obecności wywołania:
 * równoległy double-POST = 1× increment + 1× wiersz MANUAL.
 */
import request from 'supertest';
import express from 'express';

type LogRow = Record<string, any>;
type EventRow = Record<string, any>;

const logs: LogRow[] = [];
const events: EventRow[] = [];

function matchWhere(row: LogRow, where: any): boolean {
    if (!where) return true;
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.wellId !== undefined && row.wellId !== where.wellId) return false;
    if (where.solverSource !== undefined && row.solverSource !== where.solverSource) return false;
    const notAcc = where.wasAccepted?.not;
    if (notAcc !== undefined && row.wasAccepted === notAcc) return false;
    return true;
}

function applyData(row: LogRow, data: any): void {
    for (const [k, v] of Object.entries(data)) {
        if (v !== null && typeof v === 'object' && 'increment' in (v as any)) {
            row[k] = (row[k] ?? 0) + (v as any).increment;
        } else {
            row[k] = v;
        }
    }
}

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { id: 'u1', username: 'admin', role: 'admin', subUsers: [] };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/utils/telemetryOwnership', () => ({
    assertOfferReadable: jest.fn(async () => true),
    assertTelemetryIdWritable: jest.fn(async () => true)
}));

jest.mock('../src/services/ml/FeatureExtractor', () => ({
    featureExtractor: { updateLabelByTelemetry: jest.fn(async () => undefined) },
    deriveLabelFromFlags: jest.fn(() => 'ACCEPTED')
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        ai_telemetry_logs: {
            create: jest.fn(async ({ data }: any) => {
                logs.push({ usageCount: 1, wasAccepted: false, wasRejected: false, ...data });
                return data;
            }),
            findFirst: jest.fn(async ({ where, orderBy }: any) => {
                const rows = logs.filter((r) => matchWhere(r, where));
                if (orderBy?.createdAt === 'desc')
                    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                const hit = rows[0];
                return hit ? { id: hit.id } : null;
            }),
            findMany: jest.fn(async ({ where }: any) => logs.filter((r) => matchWhere(r, where))),
            update: jest.fn(async ({ where, data }: any) => {
                const row = logs.find((r) => matchWhere(r, where));
                if (!row) throw new Error('P2025');
                applyData(row, data);
                return row;
            }),
            updateMany: jest.fn(async ({ where, data }: any) => {
                let n = 0;
                for (const row of logs) {
                    if (!matchWhere(row, where)) continue;
                    applyData(row, data);
                    n++;
                }
                return { count: n };
            })
        },
        ai_telemetry_events: {
            create: jest.fn(async ({ data }: any) => {
                events.push({ ...data });
                return data;
            })
        },
        ai_config_history: { create: jest.fn(async ({ data }: any) => data) },
        ai_transition_snapshots: { createMany: jest.fn(async () => ({ count: 0 })) },
        $transaction: jest.fn(async (fn: any) => {
            if (typeof fn === 'function') {
                const tx = {
                    ai_telemetry_logs: {
                        create: jest.fn(async ({ data }: any) => {
                            logs.push({
                                usageCount: 1,
                                wasAccepted: false,
                                wasRejected: false,
                                ...data
                            });
                            return data;
                        })
                    },
                    ai_config_history: { create: jest.fn(async ({ data }: any) => data) },
                    ai_transition_snapshots: {
                        createMany: jest.fn(async () => ({ count: 0 }))
                    }
                };
                return fn(tx);
            }
            return [];
        })
    }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const telemetryRouter = require('../src/routes/telemetryAi').default;
import { telemetryService } from '../src/services/telemetry';

function buildApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryRouter);
    return app;
}

const ACCEPT_PAYLOAD = {
    telemetryId: 'no-such-id',
    accepted: true,
    offerId: 'o1',
    wellId: 'w2',
    warehouse: 'KLB',
    configSnapshot: { dn: '1000' }
};

describe('D-FIX-3 acceptance idempotentne', () => {
    let app: express.Application;
    beforeEach(() => {
        logs.length = 0;
        events.length = 0;
        jest.clearAllMocks();
        app = buildApp();
    });

    test('powtórzony accept nie inkrementuje (poziom DB, niezależny od locka)', async () => {
        logs.push({
            id: 't1',
            wellId: 'w1',
            wasAccepted: false,
            usageCount: 0,
            createdAt: '2026-01-01'
        });
        await telemetryService.recordAcceptance('t1', true, 'w1');
        await telemetryService.recordAcceptance('t1', true, 'w1');
        const row = logs.find((r) => r.id === 't1')!;
        expect(row.wasAccepted).toBe(true);
        // BEZ fixa: 2 (każdy updateMany inkrementował). Z fixem: 1.
        expect(row.usageCount).toBe(1);
    });

    test('legalna zmiana stanu nadal liczy (accept -> reject -> accept)', async () => {
        logs.push({
            id: 't1',
            wellId: 'w1',
            wasAccepted: false,
            usageCount: 0,
            createdAt: '2026-01-01'
        });
        await telemetryService.recordAcceptance('t1', true, 'w1');
        await telemetryService.recordAcceptance('t1', false, 'w1');
        await telemetryService.recordAcceptance('t1', true, 'w1');
        expect(logs.find((r) => r.id === 't1')!.usageCount).toBe(3);
    });

    test('równoległy double-POST acceptance-full: 1× MANUAL, 1× increment', async () => {
        const [r1, r2] = await Promise.all([
            request(app).post('/api/telemetry/ai/acceptance-full').send(ACCEPT_PAYLOAD),
            request(app).post('/api/telemetry/ai/acceptance-full').send(ACCEPT_PAYLOAD)
        ]);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        const manualRows = logs.filter((r) => r.wellId === 'w2' && r.solverSource === 'MANUAL');
        // BEZ fixa (check-then-act poza lockiem): 2 wiersze. Z fixem: 1.
        expect(manualRows).toHaveLength(1);
        expect(manualRows[0].usageCount).toBe(1);
        // Oba requesty zaobserwowane jako eventy (log requestów, nie stanu).
        expect(events.filter((e) => e.wellId === 'w2')).toHaveLength(2);
    });

    test('accept bez wellId i bez rekordu: 200, brak crashu, brak wierszy', async () => {
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-full')
            .send({ telemetryId: 'ghost', accepted: true });
        expect(res.status).toBe(200);
        expect(logs).toHaveLength(0);
    });
});
