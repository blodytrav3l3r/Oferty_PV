/**
 * P7.5 Extended — testy dataset FULL + knowledge + telemetry (prawdziwa DB).
 */
import { describe, expect, it, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import JSZip from 'jszip';
import prisma from '../../src/prismaClient';
import { ML_CONSTANTS, FEATURE_NAMES } from '../../src/config/mlConstants';
import { buildExportPreview, buildModelPackage } from '../../src/services/ml/transfer/exportModel';
import { runDryRun } from '../../src/services/ml/transfer/dryRun';
import { importPackage } from '../../src/services/ml/transfer/importModel';
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

function featureRow(id: string, label: string, createdAt: string) {
    return {
        id,
        telemetryId: null,
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
    await prisma.aiFeature.createMany({
        data: ids.map((id, i) => featureRow(id, labels[i], `2026-09-2${i}T10:00:00.000Z`))
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

afterAll(async () => {
    await prisma.aiTransfer.deleteMany({ where: { transferId: { in: createdTransferIds } } });
    await prisma.aiModel.deleteMany({ where: { id: { in: createdModelIds } } });
    await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_knowledge_base.deleteMany({ where: { patternKey: { startsWith: TAG } } });
    await prisma.$disconnect();
});

describe('P7.5 Extended', () => {
    it('preview full pokazuje rekordy i patterns', async () => {
        await seedFeatures();
        await seedPattern(`${TAG}-kb1`);
        const { id } = await seedModel();
        const preview = await buildExportPreview(id, {
            dataset: 'full',
            knowledge: true,
            telemetry: true
        });
        expect(preview.dataset.mode).toBe('full');
        expect(preview.dataset.recordCount).toBe(4); // bez NO_FEEDBACK
        expect(preview.knowledge.patterns).toBeGreaterThanOrEqual(1);
        expect(preview.telemetry.included).toBe(true);
    }, 30000);

    it('export full → import odtwarza wiersze i fingerprint', async () => {
        clearDryRuns();
        const { id } = await seedModel();
        const pkg = await buildModelPackage(id, UID, {
            dataset: 'full',
            knowledge: true,
            telemetry: true
        });
        createdTransferIds.push(pkg.transferId);
        expect(pkg.manifest.dataset.mode).toBe('full');
        expect(pkg.manifest.dataset.recordCount).toBe(4);

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
        expect(again.preview.knowledgePatterns).toBeGreaterThanOrEqual(1);
        expect(again.preview.telemetryGroups).not.toBeNull();
    }, 30000);

    it('naruszone rekordy przy spójnych checksumach → DATASET_INVALID', async () => {
        clearDryRuns();
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

    it('knowledge: istniejący patternKey pomijany, nowy wstawiany', async () => {
        clearDryRuns();
        await seedPattern(`${TAG}-kbdup`);
        const { id } = await seedModel();
        const pkg = await buildModelPackage(id, UID, { knowledge: true });
        createdTransferIds.push(pkg.transferId);
        await prisma.aiModel.delete({ where: { id } });
        const { record } = await runDryRun(pkg.buffer, UID);
        const result = await importPackage(pkg.buffer, record.id, UID);
        expect(result.status).toBe('IMPORTED');
        createdTransferIds.push(result.transferId);
        createdModelIds.push(result.modelId);
        // Ten sam pakiet drugi raz: model istnieje → ALREADY_IMPORTED, zero duplikatów KB.
        const kbBefore = await prisma.ai_knowledge_base.count({
            where: { patternKey: { startsWith: TAG } }
        });
        const again = await runDryRun(pkg.buffer, UID);
        const r2 = await importPackage(pkg.buffer, again.record.id, UID);
        expect(r2.status).toBe('ALREADY_IMPORTED');
        const kbAfter = await prisma.ai_knowledge_base.count({
            where: { patternKey: { startsWith: TAG } }
        });
        expect(kbAfter).toBe(kbBefore);
    }, 30000);
});
