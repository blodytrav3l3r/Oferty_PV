/**
 * P2 — dry-run i import dzielą SSoT walidacji artefaktu (parseModelArtifact).
 * Skorumpowany artefakt → MODEL_INVALID (fail fast), nie BLOCKED z castu.
 * Prawdziwa per-worker SQLite, bez mocków DB.
 */
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import prisma from '../../src/prismaClient';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../src/config/mlConstants';
import { buildModelPackage } from '../../src/services/ml/transfer/exportModel';
import { runDryRun } from '../../src/services/ml/transfer/dryRun';
import { clearDryRuns } from '../../src/services/ml/transfer/dryRunStore';

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const UID = 'p7-modelval';
const RUN_PREFIX = 'v9.9.9-p7-modelval-';
const createdTransferIds: string[] = [];
const createdModelIds: string[] = [];

function uniqVersion(): string {
    return `${RUN_PREFIX}${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
}

/** Podmienia treść artefaktu modelu z przeliczeniem checksums (wzorzec roundTrip). */
async function rebuildModelArtifact(buf: Buffer, text: string): Promise<Buffer> {
    const JSZip = (await import('jszip')).default;
    const { buildChecksumsFile, sha256Hex } =
        await import('../../src/services/ml/transfer/manifest');
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    const modelName = names.find((n) => n.startsWith('models/') && !zip.files[n].dir);
    if (!modelName) throw new Error('brak artefaktu modelu w pakiecie');
    const manifest = JSON.parse((await zip.file('manifest.json')!.async('string')) as string);
    const { computePackageFingerprint } = await import('../../src/services/ml/transfer/manifest');
    manifest.transferPackageId = 'pkg_modelval_test';
    for (const a of manifest.artifacts as Array<{ path: string; sha256: string }>) {
        if (a.path === modelName) a.sha256 = sha256Hex(text);
    }
    manifest.packageFingerprint = computePackageFingerprint(
        (manifest.artifacts as Array<{ path: string; sha256: string }>).filter(
            (a) => a.path !== 'manifest.json'
        )
    );
    const manifestText = JSON.stringify(manifest);
    const hashes = (manifest.artifacts as Array<{ path: string; sha256: string }>).map((a) => ({
        path: a.path,
        sha256: a.sha256
    }));
    const checksums = buildChecksumsFile([
        ...hashes,
        { path: 'manifest.json', sha256: sha256Hex(manifestText) }
    ]);
    const out = new JSZip();
    for (const name of names) {
        const f = zip.file(name);
        if (!f || f.dir) continue;
        if (name === 'manifest.json' || name === 'checksums.sha256') continue;
        out.file(name, name === modelName ? text : await f.async('uint8array'));
    }
    out.file('manifest.json', manifestText);
    out.file('checksums.sha256', checksums);
    return out.generateAsync({ type: 'nodebuffer' });
}

describe('P2 model validation SSoT', () => {
    let pkg: Awaited<ReturnType<typeof buildModelPackage>>;

    beforeAll(async () => {
        clearDryRuns();
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
                notes: 'seed P2',
                createdAt: new Date().toISOString()
            }
        });
        createdModelIds.push(model.id);
        pkg = await buildModelPackage(model.id, UID);
        createdTransferIds.push(pkg.transferId);
    }, 30000);

    afterAll(async () => {
        await prisma.aiTransfer.deleteMany({ where: { transferId: { in: createdTransferIds } } });
        await prisma.aiTrainingRun.deleteMany({
            where: { candidateModelVersion: { startsWith: RUN_PREFIX } }
        });
        await prisma.aiModel.deleteMany({ where: { id: { in: createdModelIds } } });
        await prisma.$disconnect();
    });

    it('dry-run skorumpowanego artefaktu → MODEL_INVALID (nie BLOCKED)', async () => {
        const evil = await rebuildModelArtifact(
            pkg.buffer,
            JSON.stringify({ features: 'nope', weights: [0.1] })
        );
        await expect(runDryRun(evil, UID)).rejects.toMatchObject({ code: 'MODEL_INVALID' });
    });

    it('dry-run artefaktu spoza JSON → MODEL_INVALID', async () => {
        const evil = await rebuildModelArtifact(pkg.buffer, 'to nie json {{{');
        await expect(runDryRun(evil, UID)).rejects.toMatchObject({ code: 'MODEL_INVALID' });
    });

    it('wspólny parser: poprawny przechodzi, zły rzuca MODEL_INVALID', async () => {
        const { parseModelArtifact } = await import('../../src/services/ml/transfer/importModel');
        const good = JSON.stringify({
            features: ['a', 'b'],
            weights: [0.1, 0.2],
            featureMins: [0, 0],
            featureMaxs: [1, 1],
            metrics: {},
            bias: 0
        });
        expect(() => parseModelArtifact(good)).not.toThrow();
        expect(() => parseModelArtifact('{"features":"nope"}')).toThrow(
            expect.objectContaining({ code: 'MODEL_INVALID' })
        );
        expect(() => parseModelArtifact('{{{')).toThrow(
            expect.objectContaining({ code: 'MODEL_INVALID' })
        );
    });
});
