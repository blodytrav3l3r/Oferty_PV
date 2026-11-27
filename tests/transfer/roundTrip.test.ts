/**
 * P7.9 — testy round-trip transferu (izolowany schemat PostgreSQL per-worker, bez mocków).
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

// Wstrzyknięcie awarii do importDatasetRows (transakcyjność importu).
// Domyślnie deleguje do prawdziwej implementacji (holder omija hoisting).
const mockDatasetFailure: { fn?: (...args: any[]) => Promise<any> } = {};
jest.mock('../../src/services/ml/transfer/dataset', () => {
    const actual = jest.requireActual('../../src/services/ml/transfer/dataset') as Record<
        string,
        (...args: any[]) => Promise<any>
    >;
    return {
        ...actual,
        importDatasetRows: (...args: any[]) =>
            mockDatasetFailure.fn
                ? mockDatasetFailure.fn(...args)
                : actual.importDatasetRows(...args)
    };
});

const UID = 'p7-test';
const SEED_DATASET_FINGERPRINT = 'sok-ml-dataset-v2:sha256:' + 'a'.repeat(64);
const createdModelIds: string[] = [];
let createdTransferIds: string[] = [];

function uniqVersion(): string {
    return `v9.9.9-p7-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

async function seedModel(version: string): Promise<string> {
    const runId = crypto.randomUUID();
    const lineageSnapshot = {
        lineageSchemaVersion: 2,
        runId,
        modelVersion: version,
        appVersion: '1.64.28',
        appCommitSha: null,
        codeFingerprint: null,
        featureSchemaVersion: ML_CONSTANTS.FEATURE_VERSION,
        featureSchemaFingerprint: 'sok-ml-feature-schema-v1:sha256:' + 'b'.repeat(64),
        datasetFingerprint: SEED_DATASET_FINGERPRINT,
        trainingConfigFingerprint: 'sok-ml-config-v1:sha256:' + 'c'.repeat(64),
        trainingConfig: {
            algorithm: 'logistic-gradient-descent-v1',
            learningRate: 0.01,
            epochs: 5000,
            l2Lambda: 0.01,
            forgettingLambda: 0.01,
            splitPolicyVersion: 'chronological-70-15-15-v1',
            preprocessingVersion: 'train-only-minmax-v1',
            seed: 7,
            seedUsage: 'metadata_only',
            gateAndDeploymentThresholds: { minAuc: 0.55 }
        },
        splitPolicyVersion: 'chronological-70-15-15-v1',
        splitFingerprints: {
            train: { count: 84, fingerprint: 'sha256:' + 'd'.repeat(64) },
            validation: { count: 18, fingerprint: 'sha256:' + 'e'.repeat(64) },
            test: { count: 18, fingerprint: 'sha256:' + 'f'.repeat(64) }
        },
        solverVersion: null,
        rulesVersion: null,
        unavailableFields: ['solverVersion: unavailable', 'rulesVersion: unavailable'],
        environment: { nodeVersion: 'v22.0.0', platform: 'test', arch: 'x64' },
        validationResult: {
            status: 'SUCCESS',
            reason: null,
            metrics: { rocAuc: 0.81, testRocAuc: 0.8 }
        },
        decision: { deployed: true, reason: 'seed P7' },
        modelFingerprint: 'sok-ml-model-v1:sha256:' + '1'.repeat(64)
    };
    const snapshotText = JSON.stringify(lineageSnapshot);
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
            lineageSnapshot: snapshotText,
            notes: 'seed P7',
            createdAt: new Date().toISOString()
        }
    });
    await prisma.aiTrainingRun.create({
        data: {
            id: runId,
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
            datasetFingerprint: SEED_DATASET_FINGERPRINT,
            lineageSnapshot: snapshotText,
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
        expect(preview.dataset.fingerprint).toBe(SEED_DATASET_FINGERPRINT);
        expect(preview.trainingRuns).toBe(1);
        await expect(buildExportPreview('nope')).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    });

    it('export produkuje weryfikowalny .sokml', async () => {
        const pkg = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkg.transferId);
        const { manifest } = verifyGatedPackage(await inspectArchive(pkg.buffer));
        expect(manifest.model.version).toBe(version);
        expect(manifest.packageFingerprint).toBe(pkg.packageFingerprint);
        expect(manifest.lineageSchemaVersion).toBe('2');
        expect(manifest.lineage.snapshot?.datasetFingerprint).toBe(SEED_DATASET_FINGERPRINT);
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
        expect(JSON.parse(imported!.lineageSnapshot!)).toMatchObject({
            modelVersion: freshVersion,
            datasetFingerprint: SEED_DATASET_FINGERPRINT,
            trainingConfigFingerprint: 'sok-ml-config-v1:sha256:' + 'c'.repeat(64)
        });

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

    it('równoległy import tego samego pakietu kończy się jednym IMPORTED i jednym ALREADY_IMPORTED', async () => {
        const freshVersion = uniqVersion();
        const freshId = await seedModel(freshVersion);
        const pkg = await buildModelPackage(freshId, UID);
        createdTransferIds.push(pkg.transferId);
        await prisma.aiModel.delete({ where: { id: freshId } });
        const { record } = await runDryRun(pkg.buffer, UID);

        const results = await Promise.allSettled([
            importPackage(pkg.buffer, record.id, UID),
            importPackage(pkg.buffer, record.id, UID)
        ]);
        const fulfilled = results.flatMap((result) =>
            result.status === 'fulfilled' ? [result.value] : []
        );
        for (const result of fulfilled) {
            if (result.status === 'IMPORTED') createdModelIds.push(result.modelId);
            createdTransferIds.push(result.transferId);
        }
        const statuses = results
            .map((result) => (result.status === 'fulfilled' ? result.value.status : 'REJECTED'))
            .sort();

        expect(statuses).toEqual(['ALREADY_IMPORTED', 'IMPORTED']);
        expect(await prisma.aiModel.count({ where: { version: freshVersion } })).toBe(1);
        expect(
            await prisma.aiTransfer.count({
                where: { packageFingerprint: pkg.packageFingerprint, direction: 'IMPORT' }
            })
        ).toBe(1);
    }, 30000);

    it('po restarcie magazynu dry-run import wymaga ponownej analizy pakietu', async () => {
        const pkg = await buildModelPackage(modelId, UID);
        createdTransferIds.push(pkg.transferId);
        const { record } = await runDryRun(pkg.buffer, UID);

        clearDryRuns(); // odtworzenie procesu: magazyn jest celowo tylko w pamięci

        await expect(importPackage(pkg.buffer, record.id, UID)).rejects.toMatchObject({
            code: 'DRY_RUN_NOT_FOUND'
        });
    });

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

    it('kolizja wersji z obcego pakietu → MODEL_DUPLICATE (nie false ALREADY_IMPORTED)', async () => {
        // Model V istnieje lokalnie; pakiet B (inny fingerprint) deklaruje tę samą wersję.
        const versionB = uniqVersion();
        await seedModel(versionB);
        const idA = await seedModel(uniqVersion());
        const pkgA = await buildModelPackage(idA, UID);
        createdTransferIds.push(pkgA.transferId);
        const evil = await rebuildManifestVersion(pkgA.buffer, versionB);
        const dry = await runDryRun(evil, UID);
        await expect(importPackage(evil, dry.record.id, UID)).rejects.toMatchObject({
            code: 'MODEL_DUPLICATE'
        });
        await prisma.aiModel.delete({ where: { id: idA } });
    }, 30000);

    it('awaria zapisu w transakcji → rollback bez częściowych danych', async () => {
        const freshVersion = uniqVersion();
        const freshId = await seedModel(freshVersion);
        const telemetryId = `${freshVersion}-telemetry`;
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: JSON.stringify([UID]) },
            create: { key: 'ai_training_user_ids', value: JSON.stringify([UID]) }
        });
        await prisma.ai_telemetry_logs.create({ data: { id: telemetryId, userId: UID } });
        await prisma.aiFeature.create({
            data: {
                id: `${freshVersion}-feature`,
                telemetryId,
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'dennica',
                topType: 'wlaz',
                season: 'spring',
                label: 'ACCEPTED',
                createdAt: new Date().toISOString()
            }
        });
        // Pakiet FULL, żeby importDatasetRows było wołane wewnątrz transakcji.
        const pkg = await buildModelPackage(freshId, UID, { dataset: 'full' });
        createdTransferIds.push(pkg.transferId);
        await prisma.aiModel.delete({ where: { id: freshId } });
        const { record } = await runDryRun(pkg.buffer, UID);
        mockDatasetFailure.fn = () => Promise.reject(new Error('boom-tx'));
        try {
            await expect(importPackage(pkg.buffer, record.id, UID)).rejects.toThrow('boom-tx');
        } finally {
            delete mockDatasetFailure.fn;
        }
        // Model CANDIDATE wycofany razem z resztą transakcji.
        expect(await prisma.aiModel.findFirst({ where: { version: freshVersion } })).toBeNull();
        expect(
            await prisma.aiTransfer.findFirst({
                where: { packageFingerprint: pkg.packageFingerprint, direction: 'IMPORT' }
            })
        ).toBeNull();
        await prisma.aiFeature.deleteMany({ where: { id: `${freshVersion}-feature` } });
        await prisma.ai_telemetry_logs.delete({ where: { id: telemetryId } });
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: '[]' },
            create: { key: 'ai_training_user_ids', value: '[]' }
        });
    }, 30000);
});

/** Przepisuje manifest (wersja + packageId) z przeliczeniem hashy — obcy pakiet. */
async function rebuildManifestVersion(buf: Buffer, version: string): Promise<Buffer> {
    const JSZip = (await import('jszip')).default;
    const { buildChecksumsFile, sha256Hex } =
        await import('../../src/services/ml/transfer/manifest');
    const zip = await JSZip.loadAsync(buf);
    const manifest = JSON.parse((await zip.file('manifest.json')!.async('string')) as string);
    manifest.model.version = version;
    manifest.transferPackageId = 'pkg_collision_test';
    const manifestText = JSON.stringify(manifest);
    const hashes = manifest.artifacts as Array<{ path: string; sha256: string }>;
    const checksums = buildChecksumsFile([
        ...hashes,
        { path: 'manifest.json', sha256: sha256Hex(manifestText) }
    ]);
    const out = new JSZip();
    const names = Object.keys(zip.files);
    for (const name of names) {
        const f = zip.file(name);
        if (!f || f.dir) continue;
        if (name === 'manifest.json' || name === 'checksums.sha256') continue;
        out.file(name, await f.async('uint8array'));
    }
    out.file('manifest.json', manifestText);
    out.file('checksums.sha256', checksums);
    return out.generateAsync({ type: 'nodebuffer' });
}
