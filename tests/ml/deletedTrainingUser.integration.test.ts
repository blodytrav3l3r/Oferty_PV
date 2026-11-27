import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import prisma, { createPrismaClient } from '../../src/prismaClient';
import { fetchEligibleDatasetRows } from '../../src/services/ml/transfer/dataset';
import { buildTelemetryAggregates } from '../../src/services/ml/transfer/telemetryExport';
import { getTrainingUserIds, lockTrainingUserScope } from '../../src/services/ml/trainingUsers';

const TAG = `d006-${crypto.randomUUID()}`;
const USER_IDS = Array.from({ length: 5 }, (_, index) => `${TAG}-user-${index}`);
const TELEMETRY_IDS = USER_IDS.map((_, index) => `${TAG}-telemetry-${index}`);
const FEATURE_IDS = USER_IDS.map((_, index) => `${TAG}-feature-${index}`);
let previousTrainingUsers: string | null = null;
let hadTrainingUsers = false;

beforeAll(async () => {
    const setting = await prisma.settings.findUnique({ where: { key: 'ai_training_user_ids' } });
    hadTrainingUsers = setting !== null;
    previousTrainingUsers = setting?.value ?? null;
});

afterAll(async () => {
    await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_telemetry_logs.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.users.deleteMany({ where: { id: { startsWith: TAG } } });
    if (hadTrainingUsers && previousTrainingUsers !== null) {
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: previousTrainingUsers },
            create: { key: 'ai_training_user_ids', value: previousTrainingUsers }
        });
    } else {
        await prisma.settings.deleteMany({ where: { key: 'ai_training_user_ids' } });
    }
    await prisma.$disconnect();
});

describe('D-006 deleted user scope on PostgreSQL', () => {
    it('retains history but excludes deleted owners from training and FULL telemetry exports', async () => {
        await prisma.users.createMany({
            data: USER_IDS.map((id, index) => ({
                id,
                username: `${TAG}-${index}`,
                password: 'test-only-password',
                role: 'user'
            }))
        });
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: JSON.stringify(USER_IDS) },
            create: { key: 'ai_training_user_ids', value: JSON.stringify(USER_IDS) }
        });
        const createdAt = new Date().toISOString();
        await prisma.ai_telemetry_logs.createMany({
            data: TELEMETRY_IDS.map((id, index) => ({
                id,
                userId: USER_IDS[index],
                createdAt,
                solverSource: 'MANUAL',
                wasAccepted: true,
                trainingEligible: true
            }))
        });
        await prisma.aiFeature.createMany({
            data: FEATURE_IDS.map((id, index) => ({
                id,
                telemetryId: TELEMETRY_IDS[index],
                dn: 1000,
                heightMm: 3000,
                warehouse: 'KLB',
                wellType: 'standard',
                ringCount: 3,
                bottomType: 'dennica',
                topType: 'wlaz',
                season: 'winter',
                label: 'ACCEPTED',
                createdAt
            }))
        });

        expect(await getTrainingUserIds()).toEqual(USER_IDS);
        expect(await fetchEligibleDatasetRows()).toHaveLength(USER_IDS.length);
        expect((await buildTelemetryAggregates()).rowsIncluded).toBe(USER_IDS.length);

        await prisma.users.delete({ where: { id: USER_IDS[0] } });

        expect(await getTrainingUserIds()).toEqual(USER_IDS.slice(1));
        const exportedRows = await fetchEligibleDatasetRows();
        expect(exportedRows).toHaveLength(USER_IDS.length - 1);
        expect(exportedRows.map(({ telemetryId }) => telemetryId)).not.toContain(TELEMETRY_IDS[0]);
        expect((await buildTelemetryAggregates()).rowsIncluded).toBe(0);
        await expect(
            prisma.ai_telemetry_logs.count({ where: { id: TELEMETRY_IDS[0] } })
        ).resolves.toBe(1);
        await expect(prisma.aiFeature.count({ where: { id: FEATURE_IDS[0] } })).resolves.toBe(1);
    }, 30000);

    it('utrzymuje blokadę konta do końca transakcji, aby DELETE nie wyprzedził rewalidacji', async () => {
        const userId = `${TAG}-race`;
        const deletionClient = createPrismaClient();
        await prisma.users.create({
            data: {
                id: userId,
                username: userId,
                password: 'test-only-password',
                role: 'user'
            }
        });
        let signalLockAcquired!: () => void;
        let releaseLock!: () => void;
        const lockAcquired = new Promise<void>((resolve) => {
            signalLockAcquired = resolve;
        });
        const holdTransaction = new Promise<void>((resolve) => {
            releaseLock = resolve;
        });
        const protectedWrite = prisma.$transaction(async (tx) => {
            await expect(lockTrainingUserScope(JSON.stringify([userId]), tx)).resolves.toEqual([
                userId
            ]);
            signalLockAcquired();
            await holdTransaction;
        });

        await lockAcquired;
        try {
            await expect(
                deletionClient.$transaction(async (tx) => {
                    await tx.$executeRaw`SET LOCAL lock_timeout = '100ms'`;
                    return tx.users.delete({ where: { id: userId } });
                })
            ).rejects.toThrow(/lock timeout|lock not available/i);
        } finally {
            releaseLock();
        }

        await protectedWrite;
        await deletionClient.users.delete({ where: { id: userId } });
        await deletionClient.$disconnect();
    }, 30000);
});
