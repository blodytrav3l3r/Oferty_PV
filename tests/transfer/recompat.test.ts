/**
 * P1.2 — re-compat importu widzi AKTUALNY baseline celu (TOCTOU).
 *
 * dry-run przy targecie A → cel zmienia się na B → import musi wykryć
 * DATASET_FINGERPRINT_DIFFERS w świeżym raporcie. Stary kod robił re-compat
 * z target null (UNVERIFIED) i zmiany datasetu nie widział.
 * Prawdziwa per-worker SQLite, bez mocków (wzorzec roundTrip.test.ts).
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

const UID = 'p7-recompat';
const RUN_PREFIX = 'v9.9.9-p7-recompat-';
const createdModelIds: string[] = [];
const createdTransferIds: string[] = [];

function uniqVersion(): string {
    return `${RUN_PREFIX}${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

function codes(checks: Array<{ code: string }>): string[] {
    return checks.map((c) => c.code);
}

describe('P1.2 re-compat TOCTOU', () => {
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

    it('import wykrywa zmianę datasetu celu po dry-run (DIFFERS, nie UNVERIFIED)', async () => {
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
                notes: 'seed P1.2',
                createdAt: new Date().toISOString()
            }
        });
        // Cel A: najnowszy run w momencie dry-run.
        await prisma.aiTrainingRun.create({
            data: {
                id: crypto.randomUUID(),
                startedAt: '2098-01-01T00:00:00.000Z',
                finishedAt: '2098-01-01T00:00:00.000Z',
                status: 'SUCCESS',
                datasetSize: 120,
                trainSize: 84,
                validationSize: 18,
                testSize: 18,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                seed: 7,
                candidateModelVersion: version,
                datasetFingerprint: 'fp-cel-A',
                deployed: true,
                deploymentReason: 'seed P1.2'
            }
        });
        const pkg = await buildModelPackage(model.id, UID);
        createdTransferIds.push(pkg.transferId);

        const dry = await runDryRun(pkg.buffer, UID);
        expect(codes(dry.record.report.checks)).toContain('DATASET_FINGERPRINT_IDENTICAL');

        // Symulacja PC-B + zmiana celu A → B po dry-run.
        await prisma.aiModel.delete({ where: { id: model.id } });
        await prisma.aiTrainingRun.create({
            data: {
                id: crypto.randomUUID(),
                startedAt: '2099-01-01T00:00:00.000Z',
                finishedAt: '2099-01-01T00:00:00.000Z',
                status: 'SUCCESS',
                datasetSize: 200,
                trainSize: 140,
                validationSize: 30,
                testSize: 30,
                featureVersion: ML_CONSTANTS.FEATURE_VERSION,
                seed: 8,
                candidateModelVersion: version,
                datasetFingerprint: 'fp-cel-B',
                deployed: true,
                deploymentReason: 'seed P1.2 retrain'
            }
        });

        const result = await importPackage(pkg.buffer, dry.record.id, UID);
        expect(result.status).toBe('IMPORTED');
        createdTransferIds.push(result.transferId);
        createdModelIds.push(result.modelId);
        // Re-compat z AKTUALNYM targetem: DIFFERS. Stary kod (target null) dawał UNVERIFIED.
        expect(codes(result.report.checks)).toContain('DATASET_FINGERPRINT_DIFFERS');
        expect(codes(result.report.checks)).not.toContain('DATASET_FINGERPRINT_UNVERIFIED');
    }, 30000);
});
