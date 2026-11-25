import express from 'express';
import request from 'supertest';
import prisma from '../src/prismaClient';
import { withRuryPricelistWriteLock } from '../src/routes/offers/ruryCrud';
import { activeOverrideKey, resolveActiveForStamp } from '../src/services/pricelist/usage';
import { requestLogger } from '../src/middleware/requestLogger';
import { getMetricsSnapshot, resetMetrics } from '../src/utils/metrics';

const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const versionId = `lock_measure_version_${suffix}`;
const offerIds = [0, 1, 2, 3].flatMap((index) => [
    `lock_measure_serial_${index}_${suffix}`,
    `lock_measure_parallel_${index}_${suffix}`
]);
const activeKey = activeOverrideKey('rury');

function createMeasurementApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.post(
        '/measured-offers/:id',
        withRuryPricelistWriteLock(async (req, res) => {
            const stamp = await resolveActiveForStamp('rury');
            if (!stamp.id || stamp.failed) return res.sendStatus(503);
            await prisma.offers_rel.create({
                data: { id: req.params.id, pricelistVersionId: stamp.id }
            });
            return res.sendStatus(201);
        })
    );
    return app;
}

afterAll(async () => {
    await prisma.$disconnect();
});

test('mierzy blokadę przy pojedynczych i równoległych zapisach PostgreSQL', async () => {
    const app = createMeasurementApp();
    const endpoint = 'POST /measured-offers/:id';
    const metric = () => getMetricsSnapshot().endpoints[endpoint];
    const writeOffer = (id: string) => request(app).post(`/measured-offers/${id}`).send({});
    let previousActiveOverride: { value: string | null } | null = null;
    let activeOverrideChanged = false;

    try {
        await prisma.pricelistVersion.create({
            data: {
                id: versionId,
                type: 'rury',
                seq: 900_000_000 + Math.floor(Math.random() * 90_000_000),
                version: `lock_measure_${suffix}`,
                status: 'APPROVED',
                effectiveFrom: new Date(Date.now() - 10_000).toISOString(),
                sha256: 'lock-measure-test'
            }
        });
        previousActiveOverride = await prisma.settings.findUnique({
            where: { key: activeKey },
            select: { value: true }
        });
        await prisma.settings.upsert({
            where: { key: activeKey },
            update: { value: versionId },
            create: { key: activeKey, value: versionId }
        });
        activeOverrideChanged = true;

        resetMetrics();
        const serialResponses = [];
        for (let index = 0; index < 4; index++) {
            serialResponses.push(await writeOffer(`lock_measure_serial_${index}_${suffix}`));
        }
        const serialMetric = metric();

        resetMetrics();
        const parallelResponses = await Promise.all(
            [0, 1, 2, 3].map((index) => writeOffer(`lock_measure_parallel_${index}_${suffix}`))
        );
        const parallelMetric = metric();
        const lockBusyResponses = [...serialResponses, ...parallelResponses].filter(
            (response) => response.status === 503
        ).length;

        console.info(
            '[pricelist-lock-measurement]',
            JSON.stringify({ serial: serialMetric, parallel: parallelMetric, lockBusyResponses })
        );
        expect(serialResponses.every((response) => response.status === 201)).toBe(true);
        expect(parallelResponses.every((response) => response.status === 201)).toBe(true);
        expect(lockBusyResponses).toBe(0);
        expect(serialMetric?.n).toBe(4);
        expect(parallelMetric?.n).toBe(4);
    } finally {
        resetMetrics();
        await prisma.offers_rel.deleteMany({ where: { id: { in: offerIds } } });
        if (activeOverrideChanged && previousActiveOverride) {
            await prisma.settings.update({
                where: { key: activeKey },
                data: { value: previousActiveOverride.value }
            });
        } else if (activeOverrideChanged) {
            await prisma.settings.deleteMany({ where: { key: activeKey } });
        }
        await prisma.pricelistVersion.deleteMany({ where: { id: versionId } });
    }
}, 60_000);
