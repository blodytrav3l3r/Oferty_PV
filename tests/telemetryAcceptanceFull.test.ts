import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

/**
 * Test regresyjny (A3): POST /api/telemetry/ai/acceptance-full nie może
 * tworzyć duplikatu rekordu MANUAL dla studni, która ma już rekord telemetrii.
 *
 * Tło: recordAcceptance oznacza oryginalny rekord jako zaakceptowany; dodatkowy
 * recordConfig MANUAL o minimalnym kontekście (ringCount dn warehouse) tylko
 * zawyżał liczniki i mnożył wiersze bez wartości treningowej. Rekord MANUAL
 * zapisujemy WYŁĄCZNIE gdy studnia nie ma żadnego rekordu (pełna manualna).
 */

jest.mock('../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    WRITE_LIMITER: (_req: any, _res: any, next: any) => next(),
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

const mockRecordAcceptance = jest.fn<any>().mockResolvedValue(undefined);
// D-FIX-3: route woła recordManualIfAbsent (check+insert pod lockiem serwisu)
// zamiast findFirst + recordConfig wprost.
const mockRecordManualIfAbsent = jest.fn<any>().mockResolvedValue({ created: false });
const mockRecordEvent = jest.fn<any>().mockResolvedValue(undefined);

jest.mock('../src/services/telemetry', () => ({
    telemetryService: {
        recordAcceptance: (...args: any[]) => mockRecordAcceptance(...args),
        recordManualIfAbsent: (...args: any[]) => mockRecordManualIfAbsent(...args),
        recordEvent: (...args: any[]) => mockRecordEvent(...args)
    }
}));

let mockTelemetryLogsFindFirst = jest.fn<any>().mockResolvedValue(null);
let mockTelemetryLogsFindUnique = jest.fn<any>().mockResolvedValue(null);
let mockOffersFindUnique = jest.fn<any>().mockResolvedValue(null);

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: {
            findUnique: (...args: any[]) => mockOffersFindUnique(...args)
        },
        offers_studnie_rel: {
            findUnique: (...args: any[]) => mockOffersFindUnique(...args)
        },
        ai_telemetry_logs: {
            findFirst: (...args: any[]) => mockTelemetryLogsFindFirst(...args),
            findUnique: (...args: any[]) => mockTelemetryLogsFindUnique(...args)
        }
    }
}));

describe('POST /api/telemetry/ai/acceptance-full (A3)', () => {
    beforeEach(() => {
        mockRecordAcceptance.mockClear();
        mockRecordManualIfAbsent.mockClear();
        mockRecordEvent.mockClear();
    });

    async function postAcceptanceFull(body: any) {
        const app = express();
        const router = (await import('../src/routes/telemetryAi')).default;
        app.use(express.json());
        app.use('/api/telemetry', router);
        const res = await request(app).post('/api/telemetry/ai/acceptance-full').send(body);
        return res;
    }

    const baseBody = {
        telemetryId: 'well-w1',
        accepted: true,
        offerId: 'offer-1',
        wellId: 'well-w1',
        warehouse: 'Kluczbork',
        configSnapshot: {
            dn: '1000',
            ringCount: 3,
            allComponentIds: ['a', 'b', 'c']
        }
    };

    it('accept z configSnapshot → recordManualIfAbsent raz (decyzja serwisu, nie route)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue({ id: 'rec-1' });

        const res = await postAcceptanceFull(baseBody);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(mockRecordAcceptance).toHaveBeenCalledTimes(1);
        expect(mockRecordManualIfAbsent).toHaveBeenCalledTimes(1);
        const [wellId, config, userId] = mockRecordManualIfAbsent.mock.calls[0] as any[];
        expect(wellId).toBe('well-w1');
        expect(config.wellId).toBe('well-w1');
        expect(config.solverSource).toBe('MANUAL');
        expect(config.selectionReason).toBe('user_accepted_post_solver');
        expect(userId).toBeUndefined();
        expect(mockRecordEvent).toHaveBeenCalledTimes(1);
    });

    it('wellId undefined → brak capture (guard wellId, brak wołania serwisu)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue(null);

        const bodyWithoutWellId = { ...baseBody, wellId: undefined };
        const res = await postAcceptanceFull(bodyWithoutWellId);

        expect(res.status).toBe(200);
        expect(mockRecordAcceptance).toHaveBeenCalledTimes(1);
        expect(mockRecordManualIfAbsent).not.toHaveBeenCalled();
    });

    it('rejected → recordManualIfAbsent nigdy nie wywoływany (niezależnie od rekordu)', async () => {
        mockTelemetryLogsFindFirst.mockResolvedValue(null);

        const res = await postAcceptanceFull({ ...baseBody, accepted: false });

        expect(res.status).toBe(200);
        expect(mockRecordAcceptance).toHaveBeenCalledTimes(1);
        expect(mockRecordManualIfAbsent).not.toHaveBeenCalled();
    });
});
