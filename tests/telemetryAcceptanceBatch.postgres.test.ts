import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import prisma from '../src/prismaClient';

jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as unknown as { user: { id: string; role: string } }).user = {
            id: 'acceptance-batch-test-user',
            role: 'user'
        };
        next();
    }
}));

jest.mock('../src/middleware/rateLimiters', () => ({
    READ_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next(),
    TELEMETRY_WRITE_LIMITER: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock('../src/utils/telemetryOwnership', () => ({
    assertTelemetryIdWritable: async (_user: unknown, telemetryId: string) =>
        !telemetryId.startsWith('blocked-telemetry-'),
    assertOfferReadable: async () => true
}));

describe('POST /ai/acceptance-batch — PostgreSQL', () => {
    const app = express();
    const telemetryIds: string[] = [];
    const featureIds: string[] = [];

    beforeAll(async () => {
        const { default: router } = await import('../src/routes/telemetryAi');
        app.use(express.json());
        app.use('/api/telemetry', router);
    });

    afterEach(async () => {
        await prisma.ai_telemetry_events.deleteMany({
            where: { telemetryId: { in: telemetryIds } }
        });
        await prisma.aiFeature.deleteMany({ where: { id: { in: featureIds } } });
        await prisma.ai_telemetry_logs.deleteMany({ where: { id: { in: telemetryIds } } });
        telemetryIds.length = 0;
        featureIds.length = 0;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('zapisuje do DB dozwolony element i odrzuca niedozwolony bez efektów ubocznych', async () => {
        const suffix = crypto.randomUUID();
        const allowedId = `acceptance-batch-allowed-${suffix}`;
        const blockedId = `blocked-telemetry-${suffix}`;
        const featureId = `acceptance-batch-feature-${suffix}`;
        telemetryIds.push(allowedId, blockedId);
        featureIds.push(featureId);

        await prisma.ai_telemetry_logs.createMany({
            data: [
                {
                    id: allowedId,
                    userId: 'acceptance-batch-test-user',
                    wellId: `acceptance-batch-well-${suffix}`,
                    wasAccepted: false,
                    wasRejected: false
                },
                {
                    id: blockedId,
                    userId: 'other-user',
                    wellId: `acceptance-batch-blocked-well-${suffix}`,
                    wasAccepted: false,
                    wasRejected: false
                }
            ]
        });
        await prisma.aiFeature.create({
            data: {
                id: featureId,
                telemetryId: allowedId,
                dn: 1000,
                heightMm: 1000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'dennica',
                topType: 'wlaz',
                season: 'winter',
                label: 'NO_FEEDBACK',
                createdAt: new Date().toISOString()
            }
        });

        const response = await request(app)
            .post('/api/telemetry/ai/acceptance-batch')
            .send({
                items: [
                    { telemetryId: allowedId, accepted: true },
                    { telemetryId: blockedId, accepted: true }
                ]
            })
            .expect(200);

        expect(response.body).toMatchObject({
            updated: [{ index: 0, telemetryId: allowedId }],
            duplicates: [],
            manual: [],
            eventsCreated: 1,
            rejected: [{ index: 1, reason: 'FORBIDDEN' }]
        });
        expect(await prisma.ai_telemetry_events.count({ where: { telemetryId: allowedId } })).toBe(
            1
        );
        expect(await prisma.ai_telemetry_events.count({ where: { telemetryId: blockedId } })).toBe(
            0
        );
        expect(await prisma.aiFeature.findUnique({ where: { id: featureId } })).toEqual(
            expect.objectContaining({ label: 'ACCEPTED', reward: 1 })
        );
        expect(await prisma.ai_telemetry_logs.findUnique({ where: { id: blockedId } })).toEqual(
            expect.objectContaining({ wasAccepted: false, wasRejected: false })
        );
    });
});
