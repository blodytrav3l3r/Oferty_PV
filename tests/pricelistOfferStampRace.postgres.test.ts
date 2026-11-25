import express from 'express';
import request from 'supertest';
import prisma from '../src/prismaClient';
import { withRuryPricelistWriteLock } from '../src/routes/offers/ruryCrud';
import { deleteVersion, setActiveVersion } from '../src/services/pricelist/lifecycle';
import { activeOverrideKey, resolveActiveForStamp } from '../src/services/pricelist/usage';
import { lockFor, PricelistVersionError } from '../src/services/pricelist/validation';

const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const oldVersionId = `race_old_${suffix}`;
const newVersionId = `race_new_${suffix}`;
const offerId = `race_offer_${suffix}`;
const version = `race_${suffix}`;
const seq = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const activeKey = activeOverrideKey('rury');

function createApp(
    method: 'post' | 'put',
    onRead: (id: string | null) => Promise<void>
): express.Application {
    const app = express();
    app.use(express.json());
    app[method](
        '/offers',
        withRuryPricelistWriteLock(async (_req, res) => {
            const stamp = await resolveActiveForStamp('rury');
            await onRead(stamp.id);
            if (!stamp.id || stamp.failed) return res.sendStatus(503);
            if (method === 'post') {
                await prisma.offers_rel.create({
                    data: { id: offerId, pricelistVersionId: stamp.id }
                });
                return res.sendStatus(201);
            }
            await prisma.offers_rel.update({
                where: { id: offerId },
                data: { pricelistVersionId: stamp.id }
            });
            return res.sendStatus(200);
        })
    );
    return app;
}

afterAll(async () => {
    await prisma.$disconnect();
});

test.each([
    ['POST tworzący ofertę', 'post'],
    ['PUT aktualizujący pieczątkę', 'put']
] as const)(
    '%s jest serializowany z lifecycle cennika',
    async (_label, method) => {
        let releaseWrite!: () => void;
        let reportRead!: (id: string | null) => void;
        const writeGate = new Promise<void>((resolve) => (releaseWrite = resolve));
        const readGate = new Promise<string | null>((resolve) => (reportRead = resolve));
        let didSwitch = false;

        try {
            await prisma.pricelistVersion.createMany({
                data: [oldVersionId, newVersionId].map((id, index) => ({
                    id,
                    type: 'rury',
                    seq: seq + index,
                    version: `${version}_${index}`,
                    status: 'APPROVED',
                    effectiveFrom: new Date(
                        Date.now() - (index === 0 ? 10_000 : 5_000)
                    ).toISOString(),
                    sha256: 'race-test'
                }))
            });
            await prisma.settings.upsert({
                where: { key: activeKey },
                update: { value: oldVersionId },
                create: { key: activeKey, value: oldVersionId }
            });
            if (method === 'put') {
                await prisma.offers_rel.create({ data: { id: offerId, pricelistVersionId: null } });
            }

            const app = createApp(method, async (id) => {
                reportRead(id);
                await writeGate;
            });
            const pendingWrite = request(app)
                [method]('/offers')
                .send({ data: [{ id: offerId }] })
                .then((response) => response);
            await expect(readGate).resolves.toBe(oldVersionId);

            const pricelistLock = lockFor('rury');
            const originalRunWithLock = pricelistLock.runWithLock.bind(pricelistLock);
            let notifyLockRequest!: () => void;
            const lockRequest = new Promise<void>((resolve) => (notifyLockRequest = resolve));
            const runWithLockSpy = jest
                .spyOn(pricelistLock, 'runWithLock')
                .mockImplementation((fn) => {
                    notifyLockRequest();
                    return originalRunWithLock(fn);
                });
            const switchVersion = setActiveVersion(newVersionId).then((value) => {
                didSwitch = true;
                return value;
            });
            try {
                await lockRequest;
                expect(didSwitch).toBe(false);
            } finally {
                runWithLockSpy.mockRestore();
            }

            releaseWrite();
            expect((await pendingWrite).status).toBe(method === 'post' ? 201 : 200);
            await switchVersion;
            await expect(deleteVersion(oldVersionId)).rejects.toMatchObject({
                code: 'USED_BY',
                statusCode: 409
            } satisfies Partial<PricelistVersionError>);

            const offer = await prisma.offers_rel.findUnique({ where: { id: offerId } });
            expect(offer?.pricelistVersionId).toBe(oldVersionId);
            expect(
                await prisma.pricelistVersion.findUnique({ where: { id: oldVersionId } })
            ).not.toBeNull();
        } finally {
            releaseWrite?.();
            await prisma.offers_rel.deleteMany({ where: { id: offerId } });
            await prisma.settings.deleteMany({ where: { key: activeKey } });
            await prisma.pricelistVersion.deleteMany({
                where: { id: { in: [oldVersionId, newVersionId] } }
            });
        }
    },
    60_000
);
