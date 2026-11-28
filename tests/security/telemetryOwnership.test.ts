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
    READ_LIMITER: (_req: any, _res: any, next: any) => next(),
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

const trainingUsersMock = { getTrainingUserIds: jest.fn(async () => ['u1']) };

jest.mock('../../src/services/ml/trainingUsers', () => trainingUsersMock);

jest.mock('../../src/services/telemetry', () => ({
    telemetryService: telemetryServiceMock
}));

jest.mock('../../src/services/telemetry/telemetryService', () => ({
    telemetryService: telemetryServiceMock
}));

const prismaMock = {
    offers_rel: { findUnique: jest.fn() },
    offers_studnie_rel: { findUnique: jest.fn() },
    ai_telemetry_logs: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    aiFeature: { findMany: jest.fn() }
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
        prismaMock.ai_telemetry_logs.findMany.mockResolvedValue([]);
        prismaMock.aiFeature.findMany.mockResolvedValue([]);
        trainingUsersMock.getTrainingUserIds.mockResolvedValue(['u1']);
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

    it('ai/offer-status: wymaga istniejącej, dostępnej oferty i zwraca tylko statusy', async () => {
        prismaMock.offers_studnie_rel.findUnique
            .mockResolvedValueOnce({ id: 'off-own' })
            .mockResolvedValueOnce({ userId: 'u1' });
        prismaMock.ai_telemetry_logs.findMany.mockResolvedValue([
            { id: 'tel-1', wellId: 'well-1', userId: 'u1', trainingEligible: true }
        ]);
        prismaMock.aiFeature.findMany.mockResolvedValue([
            { telemetryId: 'tel-1', label: 'ACCEPTED' }
        ]);

        const res = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'off-own', wellId: 'well-1' });

        expect(res.statusCode).toBe(200);
        expect(res.body.wells).toEqual([{ wellId: 'well-1', status: 'READY' }]);
        expect(res.body.counts.ready).toBe(1);
        expect(JSON.stringify(res.body)).not.toContain('tel-1');
        expect(prismaMock.ai_telemetry_logs.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { offerId: 'off-own', wellId: { in: ['well-1'] } } })
        );
    });

    it('ai/offer-status: blokuje podgląd użytkownikowi spoza listy uczenia AI', async () => {
        mockUser.id = 'u2';
        prismaMock.offers_studnie_rel.findUnique
            .mockResolvedValueOnce({ id: 'off-own' })
            .mockResolvedValueOnce({ userId: 'u2' });
        trainingUsersMock.getTrainingUserIds.mockResolvedValue(['u1']);

        const res = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'off-own', wellId: 'well-1' });

        expect(res.statusCode).toBe(403);
        expect(prismaMock.ai_telemetry_logs.findMany).not.toHaveBeenCalled();
    });

    it('ai/offer-status: blokuje podgląd, gdy lista uczenia AI jest pusta', async () => {
        prismaMock.offers_studnie_rel.findUnique
            .mockResolvedValueOnce({ id: 'off-own' })
            .mockResolvedValueOnce({ userId: 'u1' });
        trainingUsersMock.getTrainingUserIds.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'off-own', wellId: 'well-1' });

        expect(res.statusCode).toBe(403);
        expect(prismaMock.ai_telemetry_logs.findMany).not.toHaveBeenCalled();
    });

    it('ai/offer-status: nie ujawnia danych cudzej oferty ani nieznanego ID', async () => {
        prismaMock.offers_studnie_rel.findUnique
            .mockResolvedValueOnce({ id: 'off-other' })
            .mockResolvedValueOnce({ userId: 'u2' });
        const foreign = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'off-other', wellId: 'well-1' });
        expect(foreign.statusCode).toBe(403);

        prismaMock.offers_studnie_rel.findUnique.mockResolvedValueOnce(null);
        const missing = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'missing', wellId: 'well-1' });
        expect(missing.statusCode).toBe(404);
        expect(prismaMock.ai_telemetry_logs.findMany).not.toHaveBeenCalled();
    });

    it('ai/offer-status: odmawia niepełnego podsumowania po przekroczeniu limitu historii', async () => {
        prismaMock.offers_studnie_rel.findUnique
            .mockResolvedValueOnce({ id: 'off-own' })
            .mockResolvedValueOnce({ userId: 'u1' });
        prismaMock.ai_telemetry_logs.findMany.mockResolvedValue(
            Array.from({ length: 5001 }, (_, index) => ({
                id: `tel-${index}`,
                wellId: 'well-1',
                userId: 'u1',
                trainingEligible: true
            }))
        );

        const res = await request(app)
            .get('/api/telemetry/ai/offer-status')
            .query({ offerId: 'off-own', wellId: 'well-1' });

        expect(res.statusCode).toBe(503);
        expect(res.body.error).toContain('limit');
        expect(prismaMock.aiFeature.findMany).not.toHaveBeenCalled();
        expect(prismaMock.ai_telemetry_logs.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 5001 })
        );
    });

    it('acceptance-full: przekazuje ofertę do bezpiecznego powiązania telemetrii', async () => {
        prismaMock.ai_telemetry_logs.findUnique.mockResolvedValue({ userId: 'u1', offerId: null });
        prismaMock.offers_studnie_rel.findUnique.mockResolvedValue({ userId: 'u1' });
        const res = await request(app).post('/api/telemetry/ai/acceptance-full').send({
            telemetryId: 'tel-1',
            accepted: true,
            offerId: 'off-own',
            wellId: 'well-1'
        });

        expect(res.statusCode).toBe(200);
        expect(telemetryServiceMock.recordAcceptance).toHaveBeenCalledWith(
            'tel-1',
            true,
            'well-1',
            expect.objectContaining({ offerId: 'off-own' })
        );
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

    it('ai/event fallback: zapisuje wyłącznie anonimową kategorię bez właściciela', async () => {
        const res = await request(app).post('/api/telemetry/ai/event').send({
            eventType: 'fallback_triggered',
            changeReason: 'timeout',
            sequenceNo: 9
        });

        expect(res.statusCode).toBe(200);
        expect(telemetryServiceMock.recordEvent).toHaveBeenCalledWith(
            { eventType: 'fallback_triggered', changeReason: 'timeout' },
            undefined
        );
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
