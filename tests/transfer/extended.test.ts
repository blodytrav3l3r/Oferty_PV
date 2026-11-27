/**
 * P7.5 Extended — testy dataset FULL + knowledge + telemetry (prawdziwa DB).
 */
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import JSZip from 'jszip';
import prisma from '../../src/prismaClient';
import { ML_CONSTANTS, FEATURE_NAMES } from '../../src/config/mlConstants';
import { buildExportPreview, buildModelPackage } from '../../src/services/ml/transfer/exportModel';
import { runDryRun } from '../../src/services/ml/transfer/dryRun';
import { importPackage } from '../../src/services/ml/transfer/importModel';
import { parseRecordsNdjson } from '../../src/services/ml/transfer/dataset';
import { buildTelemetryAggregates } from '../../src/services/ml/transfer/telemetryExport';
import { importPatterns } from '../../src/services/ml/transfer/knowledge';
import { clearDryRuns } from '../../src/services/ml/transfer/dryRunStore';
import { inspectArchive } from '../../src/services/ml/transfer/archiveGate';
import {
    verifyGatedPackage,
    computePackageFingerprint,
    buildChecksumsFile,
    sha256Hex
} from '../../src/services/ml/transfer/manifest';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const UID = 'p7ext';
const TAG = `p7ext-${Date.now().toString(36)}`;
const createdModelIds: string[] = [];
const createdTransferIds: string[] = [];
let originalTrainingUsersSetting: { value: string | null } | null = null;
let originalTrainingUsersMigratedSetting: { value: string | null } | null = null;

beforeAll(async () => {
    const [users, migrated] = await Promise.all([
        prisma.settings.findUnique({ where: { key: 'ai_training_user_ids' } }),
        prisma.settings.findUnique({ where: { key: 'ai_training_user_ids_migrated' } })
    ]);
    originalTrainingUsersSetting = users ? { value: users.value } : null;
    originalTrainingUsersMigratedSetting = migrated ? { value: migrated.value } : null;
});

async function restoreSetting(
    key: string,
    original: { value: string | null } | null
): Promise<void> {
    if (original) {
        await prisma.settings.upsert({
            where: { key },
            update: { value: original.value },
            create: { key, value: original.value }
        });
        return;
    }
    await prisma.settings.deleteMany({ where: { key } });
}

function featureRow(
    id: string,
    label: string,
    createdAt: string,
    telemetryId: string | null = null
) {
    return {
        id,
        telemetryId,
        dn: 1000,
        heightMm: 2000,
        warehouse: 'KLB',
        wellType: 'standard',
        hasReduction: false,
        hasPsiaBuda: false,
        hasStyczna: false,
        ringCount: 3,
        bottomType: 'dennica',
        topType: 'wlaz',
        kinetaType: 'standard',
        dennicaHeight: 500,
        connectionCount: 1,
        transitionsAboveDennica: 0,
        totalPrice: 1000,
        totalWeight: 500,
        ringVariety: 0.5,
        season: 'spring',
        label,
        reward: 1,
        decisionMs: null,
        createdAt
    };
}

async function seedFeatures(): Promise<string[]> {
    const ids = [0, 1, 2, 3, 4].map((i) => `${TAG}-f${i}`);
    const labels = ['ACCEPTED', 'REJECTED', 'MODIFIED', 'ACCEPTED', 'NO_FEEDBACK'];
    await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_telemetry_logs.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.settings.upsert({
        where: { key: 'ai_training_user_ids' },
        update: { value: JSON.stringify([UID]) },
        create: { key: 'ai_training_user_ids', value: JSON.stringify([UID]) }
    });
    await prisma.settings.upsert({
        where: { key: 'ai_training_user_ids_migrated' },
        update: { value: '0' },
        create: { key: 'ai_training_user_ids_migrated', value: '0' }
    });
    const telemetryIds = ids.map((id) => `${id}-telemetry`);
    await prisma.ai_telemetry_logs.createMany({
        data: telemetryIds.map((id) => ({ id, userId: UID }))
    });
    await prisma.aiFeature.createMany({
        data: ids.map((id, i) =>
            featureRow(id, labels[i], `2026-09-2${i}T10:00:00.000Z`, telemetryIds[i])
        )
    });
    const foreignTelemetryId = `${TAG}-foreign-telemetry`;
    await prisma.ai_telemetry_logs.create({
        data: { id: foreignTelemetryId, userId: 'other-user' }
    });
    await prisma.aiFeature.createMany({
        data: [
            featureRow(
                `${TAG}-foreign-feature`,
                'ACCEPTED',
                '2026-09-26T10:00:00.000Z',
                foreignTelemetryId
            ),
            featureRow(`${TAG}-orphan-feature`, 'ACCEPTED', '2026-09-27T10:00:00.000Z')
        ]
    });
    const ineligibleTelemetryId = `${TAG}-ineligible-telemetry`;
    await prisma.ai_telemetry_logs.create({
        data: { id: ineligibleTelemetryId, userId: UID, trainingEligible: false }
    });
    await prisma.aiFeature.create({
        data: featureRow(
            `${TAG}-ineligible-feature`,
            'ACCEPTED',
            '2026-09-28T10:00:00.000Z',
            ineligibleTelemetryId
        )
    });
    return ids;
}

async function seedModel(): Promise<{ id: string; version: string }> {
    const version = `v9.9.9-${TAG}-${crypto.randomBytes(2).toString('hex')}`;
    const weights = FEATURE_NAMES.map((_, i) => (i % 2 === 0 ? 0.05 : -0.03));
    const model = await prisma.aiModel.create({
        data: {
            id: crypto.randomUUID(),
            version,
            weights: JSON.stringify(weights),
            bias: 0.1,
            metrics: JSON.stringify({ rocAuc: 0.8, trainSize: 4, valSize: 1 }),
            features: JSON.stringify(FEATURE_NAMES),
            featureMins: JSON.stringify(new Array(FEATURE_NAMES.length).fill(0)),
            featureMaxs: JSON.stringify(new Array(FEATURE_NAMES.length).fill(1)),
            trainingRows: 4,
            featureVersion: ML_CONSTANTS.FEATURE_VERSION,
            state: 'PRODUCTION',
            active: false,
            notes: 'seed P7ext',
            createdAt: new Date().toISOString()
        }
    });
    createdModelIds.push(model.id);
    return { id: model.id, version };
}

async function seedPattern(key: string) {
    await prisma.ai_knowledge_base.create({
        data: {
            id: crypto.randomUUID(),
            patternType: 'test',
            patternKey: key,
            dn: null,
            context: null,
            description: 'seed',
            recommendation: null,
            hitCount: 1,
            confidence: 0.5,
            successCount: 1,
            rejectionCount: 0,
            firstDetectedAt: null,
            lastHitAt: null,
            lastUpdatedAt: new Date().toISOString(),
            changeHistory: null,
            status: 'active',
            generatedBy: 'p7ext'
        }
    });
}

async function addLegacyKnowledgeArtifact(buffer: Buffer): Promise<Buffer> {
    const { manifest, files } = verifyGatedPackage(await inspectArchive(buffer));
    const artifactText = '[]';
    const artifacts = [
        ...manifest.artifacts,
        { path: 'knowledge/patterns.json', sha256: sha256Hex(artifactText) }
    ];
    const legacyManifest = {
        ...manifest,
        packageFingerprint: computePackageFingerprint(artifacts),
        artifacts
    };
    const manifestText = JSON.stringify(legacyManifest);
    const checksums = buildChecksumsFile([
        ...artifacts,
        { path: 'manifest.json', sha256: sha256Hex(manifestText) }
    ]);
    const zip = new JSZip();
    for (const [path, content] of files) {
        if (path !== 'manifest.json' && path !== 'checksums.sha256') zip.file(path, content);
    }
    zip.file('knowledge/patterns.json', artifactText);
    zip.file('manifest.json', manifestText);
    zip.file('checksums.sha256', checksums);
    return zip.generateAsync({ type: 'nodebuffer' });
}

afterAll(async () => {
    await prisma.aiTransfer.deleteMany({ where: { transferId: { in: createdTransferIds } } });
    await prisma.aiModel.deleteMany({ where: { id: { in: createdModelIds } } });
    await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_telemetry_logs.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_knowledge_base.deleteMany({ where: { patternKey: { startsWith: TAG } } });
    await restoreSetting('ai_training_user_ids', originalTrainingUsersSetting);
    await restoreSetting('ai_training_user_ids_migrated', originalTrainingUsersMigratedSetting);
    await prisma.$disconnect();
});

describe('P7.5 Extended', () => {
    it('nie eksportuje knowledge bez lineage właściciela', async () => {
        const { id } = await seedModel();
        await expect(buildExportPreview(id, { knowledge: true })).rejects.toMatchObject({
            code: 'DATA_SCOPE_UNAVAILABLE',
            message: expect.stringContaining('lineage')
        });
        await expect(buildModelPackage(id, UID, { knowledge: true })).rejects.toMatchObject({
            code: 'DATA_SCOPE_UNAVAILABLE'
        });
    }, 30000);

    it('blokuje import starszego pakietu z knowledge bez lineage', async () => {
        clearDryRuns();
        const { id } = await seedModel();
        const pkg = await buildModelPackage(id, UID);
        createdTransferIds.push(pkg.transferId);
        const legacyPackage = await addLegacyKnowledgeArtifact(pkg.buffer);
        await prisma.aiModel.delete({ where: { id } });
        await expect(runDryRun(legacyPackage, UID)).rejects.toMatchObject({
            code: 'DATA_SCOPE_UNAVAILABLE'
        });
    }, 30000);

    it('import starszego datasetu usuwa telemetryId', () => {
        const row = featureRow(
            `${TAG}-legacy`,
            'ACCEPTED',
            '2026-09-20T10:00:00.000Z',
            'foreign-id'
        );
        const parsed = parseRecordsNdjson(JSON.stringify(row));

        expect(parsed[0].telemetryId).toBeNull();
    });

    it('eksport modelu działa bez allowlisty na świeżej instalacji', async () => {
        const original = await prisma.settings.findUnique({
            where: { key: 'ai_training_user_ids' }
        });
        try {
            await prisma.settings.deleteMany({ where: { key: 'ai_training_user_ids' } });
            const { id } = await seedModel();
            const pkg = await buildModelPackage(id, UID);
            createdTransferIds.push(pkg.transferId);
            expect(pkg.manifest.dataset.mode).toBe('not-included');
        } finally {
            await restoreSetting('ai_training_user_ids', original);
        }
    }, 30000);

    it('telemetria eksportuje wyłącznie agregaty allowlisty z co najmniej 5 właścicielami', async () => {
        const allowedUsers = Array.from({ length: 6 }, (_, i) => `${TAG}-user-${i}`);
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: JSON.stringify(allowedUsers) },
            create: { key: 'ai_training_user_ids', value: JSON.stringify(allowedUsers) }
        });
        const createdAt = new Date().toISOString();
        await prisma.ai_telemetry_logs.createMany({
            data: [
                ...Array.from({ length: 30 }, (_, index) => ({
                    id: `${TAG}-aggregate-heavy-${index}`,
                    userId: allowedUsers[0],
                    createdAt,
                    solverSource: 'AUTO_JS',
                    wasAccepted: true
                })),
                ...allowedUsers.slice(1, 5).map((userId, index) => ({
                    id: `${TAG}-aggregate-${index}`,
                    userId,
                    createdAt,
                    solverSource: 'AUTO_JS',
                    wasAccepted: true
                })),
                {
                    id: `${TAG}-ineligible-aggregate`,
                    userId: allowedUsers[5],
                    createdAt,
                    solverSource: 'AUTO_JS',
                    wasRejected: true,
                    trainingEligible: false
                },
                ...Array.from({ length: 3 }, (_, index) => ({
                    id: `${TAG}-foreign-${index}`,
                    userId: `foreign-${index}`,
                    createdAt,
                    solverSource: 'AUTO_JS',
                    wasRejected: true
                }))
            ]
        });

        const result = await buildTelemetryAggregates();

        expect(result.rowsIncluded).toBe(24);
        expect(result.byDaySource).toEqual([
            expect.objectContaining({ count: 24, accepted: 24, rejected: 0 })
        ]);
        expect(JSON.stringify(result)).not.toContain('userId');

        const { id } = await seedModel();
        const preview = await buildExportPreview(id, { telemetry: true });
        const pkg = await buildModelPackage(id, UID, { telemetry: true });
        createdTransferIds.push(pkg.transferId);
        const zip = await JSZip.loadAsync(pkg.buffer);
        const artifact = JSON.parse(await zip.file('telemetry/selected.json')!.async('string'));
        expect(preview.telemetry.groups).toBe(artifact.byDaySource.length);
        expect(preview.telemetry.records).toBe(artifact.rowsIncluded);
    }, 30000);

    it('preview full pokazuje rekordy i patterns', async () => {
        await seedFeatures();
        await seedPattern(`${TAG}-kb1`);
        const { id } = await seedModel();
        const preview = await buildExportPreview(id, {
            dataset: 'full',
            telemetry: true
        });
        expect(preview.dataset.mode).toBe('full');
        expect(preview.dataset.recordCount).toBe(4); // bez NO_FEEDBACK
        expect(preview.knowledge).toEqual({ included: false, patterns: 0 });
        expect(preview.telemetry.included).toBe(true);
    }, 30000);

    it('preview full zwraca pusty zbiór przy pustej allowliście', async () => {
        await seedFeatures();
        const { id } = await seedModel();
        await prisma.settings.upsert({
            where: { key: 'ai_training_user_ids' },
            update: { value: '[]' },
            create: { key: 'ai_training_user_ids', value: '[]' }
        });

        const preview = await buildExportPreview(id, { dataset: 'full' });

        expect(preview.dataset.recordCount).toBe(0);
    }, 30000);

    it('export full → import odtwarza wiersze i fingerprint', async () => {
        clearDryRuns();
        await seedFeatures();
        const { id } = await seedModel();
        const pkg = await buildModelPackage(id, UID, {
            dataset: 'full',
            telemetry: true
        });
        createdTransferIds.push(pkg.transferId);
        expect(pkg.manifest.dataset.mode).toBe('full');
        expect(pkg.manifest.dataset.recordCount).toBe(4);
        const zip = await JSZip.loadAsync(pkg.buffer);
        const datasetManifest = JSON.parse(
            await zip.file('datasets/manifest.json')!.async('string')
        );
        expect(datasetManifest).toMatchObject({
            fingerprintVersion: 2,
            datasetSchemaVersion: pkg.manifest.dataset.datasetSchemaVersion
        });
        const rows = (await zip.file('datasets/records.ndjson')!.async('string'))
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        expect(rows).toHaveLength(4);
        expect(rows.every((row) => row.telemetryId === null)).toBe(true);
        expect(rows.some((row) => row.id.includes('foreign') || row.id.includes('orphan'))).toBe(
            false
        );

        // Symulacja PC-B: czyścimy cel.
        await prisma.aiModel.delete({ where: { id } });
        await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });

        const { record } = await runDryRun(pkg.buffer, UID);
        expect(record.report.status).not.toBe('blocked');
        const result = await importPackage(pkg.buffer, record.id, UID);
        expect(result.status).toBe('IMPORTED');
        createdTransferIds.push(result.transferId);
        createdModelIds.push(result.modelId);

        expect(await prisma.aiFeature.count({ where: { id: { startsWith: TAG } } })).toBe(4);
        const again = await runDryRun(pkg.buffer, UID);
        expect(again.preview.datasetRecords).toBe(4);
        expect(again.preview.knowledgePatterns).toBeNull();
        expect(again.preview.telemetryGroups).not.toBeNull();
    }, 30000);

    it('naruszone rekordy przy spójnych checksumach → DATASET_INVALID', async () => {
        clearDryRuns();
        await seedFeatures();
        const { id } = await seedModel();
        const pkg = await buildModelPackage(id, UID, { dataset: 'full' });
        createdTransferIds.push(pkg.transferId);

        // Przepisujemy pakiet: podmienione rekordy + przeliczone hashe
        // (brama archiwum i manifest przechodzą — łapie dopiero integralność).
        const gated = await inspectArchive(pkg.buffer);
        const { manifest, files } = verifyGatedPackage(gated);
        const tampered = files
            .get('datasets/records.ndjson')!
            .toString('utf8')
            .replace('ACCEPTED', 'REJECTED');
        const newHashes = manifest.artifacts.map((a) =>
            a.path === 'datasets/records.ndjson'
                ? { path: a.path, sha256: sha256Hex(tampered) }
                : { path: a.path, sha256: a.sha256 }
        );
        const evilManifest = {
            ...manifest,
            packageFingerprint: computePackageFingerprint(newHashes),
            artifacts: newHashes
        };
        const manifestText = JSON.stringify(evilManifest);
        const checksums = buildChecksumsFile([
            ...newHashes,
            { path: 'manifest.json', sha256: sha256Hex(manifestText) }
        ]);
        const zip = new JSZip();
        for (const [p, data] of files) {
            if (p === 'manifest.json' || p === 'checksums.sha256') continue;
            zip.file(p, p === 'datasets/records.ndjson' ? tampered : data);
        }
        zip.file('manifest.json', manifestText);
        zip.file('checksums.sha256', checksums);
        const evil = await zip.generateAsync({ type: 'nodebuffer' });

        const { record } = await runDryRun(evil, UID);
        await prisma.aiModel.deleteMany({ where: { version: manifest.model.version } });
        await expect(importPackage(evil, record.id, UID)).rejects.toMatchObject({
            code: 'DATASET_INVALID'
        });
    }, 30000);

    it('knowledge import pomija istniejący patternKey i wstawia nowy', async () => {
        await seedPattern(`${TAG}-kbdup`);
        const pattern = {
            patternType: 'test',
            patternKey: `${TAG}-kbdup`,
            dn: null,
            context: null,
            description: null,
            recommendation: null,
            hitCount: 1,
            confidence: 0.5,
            successCount: 1,
            rejectionCount: 0,
            firstDetectedAt: null,
            lastHitAt: null,
            lastUpdatedAt: null,
            changeHistory: null,
            status: 'active',
            generatedBy: 'legacy-package'
        };
        const result = await importPatterns([pattern, { ...pattern, patternKey: `${TAG}-kbnew` }]);
        expect(result).toEqual({ inserted: 1, skipped: 1 });
        const imported = await prisma.ai_knowledge_base.count({
            where: { patternKey: { in: [`${TAG}-kbdup`, `${TAG}-kbnew`] } }
        });
        expect(imported).toBe(2);
    }, 30000);
});
