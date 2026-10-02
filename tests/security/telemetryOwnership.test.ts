import request from 'supertest';
import express from 'express';

const mockUser: any = { id: 'u1', username: 'u1', role: 'user', subUsers: [] };

jest.mock('../../src/middleware/auth', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...mockUser };
        next();
    }
}));

jest.mock('../../src/middleware/rateLimiters', () => ({
    TELEMETRY_WRITE_LIMITER: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

const telemetryServiceMock = {
    recordConfig: jest.fn(),
    recordEvent: jest.fn(),
    recordAcceptance: jest.fn()
};

jest.mock('../../src/services/telemetry', () => ({
    telemetryService: telemetryServiceMock
}));

jest.mock('../../src/services/telemetry/telemetryService', () => ({
    telemetryService: telemetryServiceMock
}));

const prismaMock = {
    offers_rel: { findUnique: jest.fn() },
    offers_studnie_rel: { findUnique: jest.fn() },
    ai_telemetry_logs: { findUnique: jest.fn(), findFirst: jest.fn() }
};

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: prismaMock
}));

import telemetryAiRouter from '../../src/routes/telemetryAi';
import { assertOfferReadable, assertTelemetryIdWritable } from '../../src/utils/telemetryOwnership';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryAiRouter);
    return app;
}

/**
 * P1.1: telemetria pasywna nie dopisuje sygnałów ML do cudzych dokumentów.
 * - offerId istniejącej cudzej oferty → 403, service nie wołany.
 * - offerId własne / draft (nieznane) → pass.
 * - telemetryId cudzego wiersza → 403.
 */
describe('P1.1 telemetry ownership', () => {
    let app: express.Application;

    beforeEach(() => {
        jest.resetAllMocks();
        mockUser.id = 'u1';
        mockUser.role = 'user';
        mockUser.subUsers = [];
        prismaMock.offers_rel.findUnique.mockResolvedValue(null);
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(null);
        prismaMock.ai_telemetry_logs.findUnique.mockResolvedValue(null);
        prismaMock.ai_telemetry_logs.findFirst.mockResolvedValue(null);
        telemetryServiceMock.recordConfig.mockResolvedValue({ success: true });
        telemetryServiceMock.recordEvent.mockResolvedValue({ success: true });
        telemetryServiceMock.recordAcceptance.mockResolvedValue(undefined);
        app = createApp();
    });

    it('ai/config: cudza istniejąca oferta → 403, brak zapisu', async () => {
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue({ userId: 'u2' });
        const res = await request(app)
            .post('/api/telemetry/ai/config')
            .send({ solverSource: 'AUTO_JS', offerId: 'off-cudza' });
        expect(res.statusCode).toBe(403);
        expect(telemetryServiceMock.recordConfig).not.toHaveBeenCalled();
    });

    it('ai/config: własna oferta i draft (nieznane id) → pass', async () => {
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue({ userId: 'u1' });
        const own = await request(app)
            .post('/api/telemetry/ai/config')
            .send({ solverSource: 'AUTO_JS', offerId: 'off-moja' });
        expect(own.statusCode).toBe(200);
        expect(telemetryServiceMock.recordConfig).toHaveBeenCalledTimes(1);

        prismaMock.offers_rel.findUnique.mockResolvedValue(null);
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue(null);
        const draft = await request(app)
            .post('/api/telemetry/ai/config')
            .send({ solverSource: 'AUTO_JS', offerId: 'draft-niezapisany' });
        expect(draft.statusCode).toBe(200);
    });

    it('ai/event: cudzy wiersz telemetry → 403', async () => {
        prismaMock.ai_telemetry_logs.findUnique.mockResolvedValue({
            userId: 'u2',
            offerId: null
        });
        const res = await request(app)
            .post('/api/telemetry/ai/event')
            .send({ eventType: 'accept', telemetryId: 'tel-cudzy' });
        expect(res.statusCode).toBe(403);
        expect(telemetryServiceMock.recordEvent).not.toHaveBeenCalled();
    });

    it('acceptance-full: cudza studnia → 403, brak acceptance i eventu', async () => {
        prismaMock.ai_telemetry_logs.findUnique.mockResolvedValue({
            userId: 'u2',
            offerId: null
        });
        const res = await request(app)
            .post('/api/telemetry/ai/acceptance-full')
            .send({ telemetryId: 'tel-cudzy', accepted: true, wellId: 'well-1' });
        expect(res.statusCode).toBe(403);
        expect(telemetryServiceMock.recordAcceptance).not.toHaveBeenCalled();
        expect(telemetryServiceMock.recordEvent).not.toHaveBeenCalled();
    });

    it('helper: nieznane id nie blokują (draft / wellId bez rekordu)', async () => {
        await expect(assertOfferReadable({ ...mockUser }, 'draft-xyz')).resolves.toBe(true);
        await expect(
            assertTelemetryIdWritable({ ...mockUser }, 'nieznane', 'well-x')
        ).resolves.toBe(true);
    });

    it('helper: wiersz legacy bez właściciela → pass', async () => {
        prismaMock.ai_telemetry_logs.findUnique.mockResolvedValue({
            userId: null,
            offerId: null
        });
        await expect(assertTelemetryIdWritable({ ...mockUser }, 'legacy')).resolves.toBe(true);
    });
});
