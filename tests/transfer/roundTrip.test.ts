/**
 * P7.9 — testy round-trip transferu (prawdziwa per-worker SQLite, bez mocków).
 *
 * Scenariusz PC-A → PC-B na jednej instancji:
 * export → dry-run (zero zapisów domenowych) → import → CANDIDATE →
 * prediction before == prediction after (exact) → re-import ALREADY_IMPORTED.
 */
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import prisma from '../../src/prismaClient';
import { AcceptanceModel } from '../../src/services/ml/AcceptanceModel';
import { ML_CONSTANTS, FEATURE_NAMES } from '../../src/config/mlConstants';
import { buildExportPreview, buildModelPackage } from '../../src/services/ml/transfer/exportModel';
import { runDryRun } from '../../src/services/ml/transfer/dryRun';
import { importPackage } from '../../src/services/ml/transfer/importModel';
import { clearDryRuns } from '../../src/services/ml/transfer/dryRunStore';
import { inspectArchive } from '../../src/services/ml/transfer/archiveGate';
import { verifyGatedPackage } from '../../src/services/ml/transfer/manifest';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const UID = 'p7-test';
const createdModelIds: string[] = [];
let createdTransferIds: string[] = [];

function uniqVersion(): string {
    return `v9.9.9-p7-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

async function seedModel(version: string): Promise<string> {
    const weights = FEATURE_NAMES.map((_, i) => (i % 2 === 0 ? 0.05 : -0.03));
    const model = await prisma.aiModel.create({
        data: {
            id: crypto.randomUUID(),
            version,
            weights: JSON.stringify(weights),
            bias: 0.12,
            metrics: JSON.stringify({ rocAuc: 0.81, trainSize: 120, valSize: 30 }),
            features: JSON.stringify(FEATURE_NAMES),
            featureMins: JSON.stringify(new Array(FEATURE_NAMES.length).fill(0)),
            featureMaxs: JSON.stringify(new Array(FEATURE_NAMES.length).fill(1)),
            trainingRows: 120,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            state: 'PRODUCTION',
            active: false,
            notes: 'seed P7',
            createdAt: new Date().toISOString()
        }
    });
    await prisma.aiTrainingRun.create({
        data: {
            id: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            status: 'SUCCESS',
            datasetSize: 120,
            trainSize: 84,
            validationSize: 18,
            testSize: 18,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            seed: 7,
            candidateModelVersion: version,
            datasetFingerprint: 'sok-dataset-v1:p7seed',
            deployed: true,
            deploymentReason: 'seed P7'
        }
    });
    createdModelIds.push(model.id);
    return model.id;
}

afterAll(async () => {
    await prisma.aiTransfer.deleteMany({ where: { transferId: { in: createdTransferIds } } });
    await prisma.aiTrainingRun.deleteMany({
        where: { candidateModelVersion: { startsWith: 'v9.9.9-p7-' } }
    });
    await prisma.aiModel.deleteMany({ where: { id: { in: createdModelIds } } });
    await prisma.$disconnect();
});

describe('P7 round-trip', () => {
    let modelId = '';
    let version = '';

    beforeAll(async () => {
        clearDryRuns();
        version = uniqVersion();
        modelId = await seedModel(version);
    }, 30000);

    it('preview pokazuje co opuszcza komputer', async () => {
        const preview = await buildExportPreview(modelId);
        expect(preview.model.version).toBe(version);
        expect(preview.dataset.mode).toBe('fingerprint-only');
        expect(preview.dataset.fingerprint).toBe('sok-dataset-v1:p7seed');
        expect(preview.trainingRuns).toBe(1);
        await expect(buildExportPreview('nope')).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    });

    it('export produkuje weryfikowalny .sokml', async () => {
        const pkg = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkg.transferId);
        const { manifest } = verifyGatedPackage(await inspectArchive(pkg.buffer));
        expect(manifest.model.version).toBe(version);
        expect(manifest.packageFingerprint).toBe(pkg.packageFingerprint);
    });

    it('dry-run nie tworzy modeli ani transferów', async () => {
        const pkg = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkg.transferId);
        const modelsBefore = await prisma.aiModel.count();
        const transfersBefore = await prisma.aiTransfer.count();
        const { record, preview } = await runDryRun(pkg.buffer, UID);
        expect(record.report.status).not.toBe('blocked');
        expect(preview.modelVersion).toBe(version);
        expect(await prisma.aiModel.count()).toBe(modelsBefore);
        expect(await prisma.aiTransfer.count()).toBe(transfersBefore);
    });

    it('import → CANDIDATE + prediction exact equality', async () => {
        // Świeży model na test + symulacja PC-B: po eksporcie źródło znika
        // z bazy docelowej (ten sam version w tej samej DB dałby ALREADY_IMPORTED).
        const freshVersion = uniqVersion();
        const freshId = await seedModel(freshVersion);
        const pkg = await buildModelPackage(freshId, UID);
        createdTransferIds.push(pkg.transferId);
        const source = await prisma.aiModel.findUnique({ where: { id: freshId } });
        const sourceWeights = JSON.parse(source!.weights) as number[];
        const sourceBias = source!.bias;
        await prisma.aiModel.delete({ where: { id: freshId } });
        const { record } = await runDryRun(pkg.buffer, UID);
        const result = await importPackage(pkg.buffer, record.id, UID);
        expect(result.status).toBe('IMPORTED');
        createdTransferIds.push(result.transferId);
        createdModelIds.push(result.modelId);

        const imported = await prisma.aiModel.findUnique({ where: { id: result.modelId } });
        expect(imported?.state).toBe('CANDIDATE');
        expect(imported?.active).toBe(false);

        const probe = FEATURE_NAMES.map((_, i) => (i * 0.37) % 1);
        const before = new AcceptanceModel(FEATURE_NAMES.length, sourceWeights, sourceBias).predict(
            probe
        );
        const after = new AcceptanceModel(
            FEATURE_NAMES.length,
            JSON.parse(imported!.weights),
            imported!.bias
        ).predict(probe);
        expect(after).toBe(before);
    }, 30000);

    it('re-import → ALREADY_IMPORTED, zero nowych modeli', async () => {
        const freshVersion = uniqVersion();
        const freshId = await seedModel(freshVersion);
        const pkg = await buildModelPackage(freshId, UID);
        createdTransferIds.push(pkg.transferId);
        await prisma.aiModel.delete({ where: { id: freshId } }); // symulacja PC-B
        const countBefore = await prisma.aiModel.count();
        const first = await runDryRun(pkg.buffer, UID);
        const r1 = await importPackage(pkg.buffer, first.record.id, UID);
        expect(r1.status).toBe('IMPORTED');
        createdTransferIds.push(r1.transferId);
        createdModelIds.push(r1.modelId);
        const second = await runDryRun(pkg.buffer, UID);
        const r2 = await importPackage(pkg.buffer, second.record.id, UID);
        expect(r2.status).toBe('ALREADY_IMPORTED');
        expect(await prisma.aiModel.count()).toBe(countBefore + 1);
    }, 30000);

    it('import cudzego pakietu na starym dryRunId → DRY_RUN_PACKAGE_MISMATCH', async () => {
        const pkgA = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkgA.transferId);
        const dryA = await runDryRun(pkgA.buffer, UID);
        const versionB = uniqVersion();
        const modelB = await seedModel(versionB);
        const pkgB = await buildModelPackage(modelB, UID);
        createdTransferIds.push(pkgB.transferId);
        await expect(importPackage(pkgB.buffer, dryA.record.id, UID)).rejects.toMatchObject({
            code: 'DRY_RUN_PACKAGE_MISMATCH'
        });
    });

    it('import bez dryRunId → DRY_RUN_NOT_FOUND', async () => {
        const pkg = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkg.transferId);
        await expect(importPackage(pkg.buffer, 'dry_nonexistent', UID)).rejects.toMatchObject({
            code: 'DRY_RUN_NOT_FOUND'
        });
    });
});
