/**
 * P1-S — binding dry-run ↔ użytkownik (prawdziwa per-worker SQLite).
 * Dry-run użytkownika A nie importuje użytkownik B (403 DRY_RUN_USER_MISMATCH).
 */
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import prisma from '../../src/prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../src/config/mlConstants';
import { buildModelPackage } from '../../src/services/ml/transfer/exportModel';
import { runDryRun } from '../../src/services/ml/transfer/dryRun';
import { importPackage } from '../../src/services/ml/transfer/importModel';
import { clearDryRuns } from '../../src/services/ml/transfer/dryRunStore';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const RUN_PREFIX = 'v9.9.9-p7-binding-';
const createdModelIds: string[] = [];
const createdTransferIds: string[] = [];

function uniqVersion(): string {
    return `${RUN_PREFIX}${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

describe('P1-S dry-run user binding', () => {
    beforeAll(() => {
        clearDryRuns();
    });

    afterAll(async () => {
        await prisma.aiTransfer.deleteMany({ where: { transferId: { in: createdTransferIds } } });
        await prisma.aiTrainingRun.deleteMany({
            where: { candidateModelVersion: { startsWith: RUN_PREFIX } }
        });
        await prisma.aiModel.deleteMany({ where: { id: { in: createdModelIds } } });
        await prisma.$disconnect();
    });

    it('import cudzym dryRunId → DRY_RUN_USER_MISMATCH; własnym → IMPORTED', async () => {
        const version = uniqVersion();
        const weights = FEATURE_NAMES.map((_, i) => (i % 2 === 0 ? 0.05 : -0.03));
        const model = await prisma.aiModel.create({
            data: {
                id: crypto.randomUUID(),
                version,
                weights: JSON.stringify(weights),
                bias: 0.12,
                metrics: JSON.stringify({ rocAuc: 0.81 }),
                features: JSON.stringify(FEATURE_NAMES),
                featureMins: JSON.stringify(new Array(FEATURE_NAMES.length).fill(0)),
                featureMaxs: JSON.stringify(new Array(FEATURE_NAMES.length).fill(1)),
                trainingRows: 120,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                state: 'PRODUCTION',
                active: false,
                notes: 'seed P1-S',
                createdAt: new Date().toISOString()
            }
        });
        await prisma.aiTrainingRun.create({
            data: {
                id: crypto.randomUUID(),
                startedAt: '2098-06-01T00:00:00.000Z',
                finishedAt: '2098-06-01T00:00:00.000Z',
                status: 'SUCCESS',
                datasetSize: 120,
                trainSize: 84,
                validationSize: 18,
                testSize: 18,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                seed: 7,
                candidateModelVersion: version,
                datasetFingerprint: 'fp-binding-A',
                deployed: true,
                deploymentReason: 'seed P1-S'
            }
        });
        const pkg = await buildModelPackage(model.id, 'user-A');
        createdTransferIds.push(pkg.transferId);
        await prisma.aiModel.delete({ where: { id: model.id } }); // symulacja PC-B

        const dry = await runDryRun(pkg.buffer, 'user-A');
        await expect(importPackage(pkg.buffer, dry.record.id, 'user-B')).rejects.toMatchObject({
            code: 'DRY_RUN_USER_MISMATCH'
        });

        const ok = await importPackage(pkg.buffer, dry.record.id, 'user-A');
        expect(ok.status).toBe('IMPORTED');
        createdTransferIds.push(ok.transferId);
        createdModelIds.push(ok.modelId);
    }, 30000);
});
