import crypto from 'crypto';
import JSZip from 'jszip';
import prisma from '../../../prismaClient';
import { getVersion } from '../../../version';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../../config/mlConstants';
import {
    SOKML_FORMAT,
    SOKML_FORMAT_VERSION,
    SOKML_MANIFEST_VERSION,
    SOKML_AI_SCHEMA_VERSION,
    SOKML_MODEL_SCHEMA_VERSION,
    SOKML_LINEAGE_SCHEMA_VERSION,
    SOKML_FEATURE_SCHEMA_VERSION,
    SOKML_DATASET_SCHEMA_VERSION
} from './transferConstants';
import { TransferError } from './transferErrors';
import {
    computePackageFingerprint,
    buildChecksumsFile,
    sha256Hex,
    type SokmlManifest
} from './manifest';

/**
 * P7.2 — Export model-only (samowystarczalny artefakt).
 *
 * Pakiet niesie wszystko do predykcji po imporcie: wagi, bias, normalizację,
 * nazwy i kolejność cech. Model-only = dataset w trybie fingerprint-only
 * (gdy znany z training run) albo not-included.
 */

export interface ParsedModel {
    weights: number[];
    bias: number;
    features: string[];
    featureMins: number[];
    featureMaxs: number[];
    metricsJson: string;
}

/** Parsuje rekord AiModel do postaci eksportowej (MODEL_INVALID przy korupcji). */
export function parseModelRecord(record: {
    weights: string;
    bias: number;
    features: string;
    featureMins: string;
    featureMaxs: string;
    metrics: string;
}): ParsedModel {
    let weights: unknown;
    let features: unknown;
    let featureMins: unknown;
    let featureMaxs: unknown;
    try {
        weights = JSON.parse(record.weights);
        features = JSON.parse(record.features);
        featureMins = JSON.parse(record.featureMins);
        featureMaxs = JSON.parse(record.featureMaxs);
        JSON.parse(record.metrics);
    } catch {
        throw new TransferError('MODEL_INVALID', 'Uszkodzone dane modelu w bazie');
    }
    const numArray = (v: unknown): number[] | null =>
        Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n))
            ? (v as number[])
            : null;
    const w = numArray(weights);
    const mins = numArray(featureMins);
    const maxs = numArray(featureMaxs);
    const feats =
        Array.isArray(features) && features.every((f) => typeof f === 'string')
            ? (features as string[])
            : null;
    if (!w || !mins || !maxs || !feats || !Number.isFinite(record.bias)) {
        throw new TransferError('MODEL_INVALID', 'Nieprawidłowa struktura modelu');
    }
    if (w.length !== feats.length || mins.length !== feats.length || maxs.length !== feats.length) {
        throw new TransferError('MODEL_INVALID', 'Niespójne wymiary modelu');
    }
    return {
        weights: w,
        bias: record.bias,
        features: feats,
        featureMins: mins,
        featureMaxs: maxs,
        metricsJson: record.metrics
    };
}

function sanitizeVersion(version: string): string {
    return version.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'model';
}

function newTransferId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `trf_${date}_${crypto.randomBytes(3).toString('hex')}`;
}

export interface ExportPreview {
    model: {
        id: string;
        version: string;
        state: string | null;
        featureVersion: string | null;
        featureCount: number;
        trainingRows: number;
    };
    dataset: {
        mode: 'fingerprint-only' | 'not-included';
        fingerprint: string | null;
        recordCount: number | null;
    };
    trainingRuns: number;
    lineageIncluded: boolean;
    estimatedBytes: number;
}

/** Podgląd eksportu (bez generowania pliku) — użytkownik widzi, co opuszcza komputer. */
export async function buildExportPreview(modelId: string): Promise<ExportPreview> {
    const record = await prisma.aiModel.findUnique({ where: { id: modelId } });
    if (!record) throw new TransferError('MODEL_NOT_FOUND', 'Model nie istnieje');
    const parsed = parseModelRecord(record);
    const runs = await prisma.aiTrainingRun.findMany({
        where: { candidateModelVersion: record.version },
        orderBy: { startedAt: 'desc' },
        take: 100
    });
    const withFingerprint = runs.find((r) => r.datasetFingerprint);
    const estimatedBytes =
        record.weights.length + record.features.length + record.metrics.length + 4096;
    return {
        model: {
            id: record.id,
            version: record.version,
            state: record.state,
            featureVersion: record.featureVersion,
            featureCount: parsed.features.length,
            trainingRows: record.trainingRows
        },
        dataset: {
            mode: withFingerprint ? 'fingerprint-only' : 'not-included',
            fingerprint: withFingerprint?.datasetFingerprint ?? null,
            recordCount: withFingerprint?.datasetSize ?? null
        },
        trainingRuns: runs.length,
        lineageIncluded: true,
        estimatedBytes
    };
}

export interface BuiltPackage {
    buffer: Buffer;
    transferId: string;
    packageFingerprint: string;
    manifest: SokmlManifest;
}

/** Buduje kompletny .sokml dla modelu + zapisuje rekord AiTransfer (EXPORT). */
export async function buildModelPackage(modelId: string, userId: string): Promise<BuiltPackage> {
    const record = await prisma.aiModel.findUnique({ where: { id: modelId } });
    if (!record) throw new TransferError('MODEL_NOT_FOUND', 'Model nie istnieje');
    const parsed = parseModelRecord(record);
    const runs = await prisma.aiTrainingRun.findMany({
        where: { candidateModelVersion: record.version },
        orderBy: { startedAt: 'desc' },
        take: 100
    });
    const withFingerprint = runs.find((r) => r.datasetFingerprint);
    const sokVersion = getVersion().version;

    const modelArtifact = {
        modelSchemaVersion: SOKML_MODEL_SCHEMA_VERSION,
        version: record.version,
        state: record.state,
        featureVersion: record.featureVersion ?? ML_CONSTANTS.FEATURE_VERSION,
        features: parsed.features,
        weights: parsed.weights,
        bias: parsed.bias,
        featureMins: parsed.featureMins,
        featureMaxs: parsed.featureMaxs,
        metrics: JSON.parse(parsed.metricsJson),
        trainingRows: record.trainingRows,
        datasetFingerprint: withFingerprint?.datasetFingerprint ?? null,
        exportedFrom: { sokVersion, featureNames: FEATURE_NAMES }
    };
    const modelPath = `models/model-${sanitizeVersion(record.version)}.json`;
    const modelText = JSON.stringify(modelArtifact);

    const contentArtifacts: Array<{ path: string; text: string }> = [
        { path: modelPath, text: modelText }
    ];
    if (withFingerprint?.datasetFingerprint) {
        contentArtifacts.push({
            path: 'datasets/manifest.json',
            text: JSON.stringify({
                fingerprint: withFingerprint.datasetFingerprint,
                fingerprintAlgorithm: 'SHA-256',
                fingerprintVersion: 1,
                datasetSchemaVersion: SOKML_DATASET_SCHEMA_VERSION,
                recordCount: withFingerprint.datasetSize,
                mode: 'fingerprint-only'
            })
        });
    }
    contentArtifacts.push({
        path: 'training/runs.json',
        text: JSON.stringify(
            runs.map((r) => ({
                id: r.id,
                startedAt: r.startedAt,
                finishedAt: r.finishedAt,
                status: r.status,
                datasetSize: r.datasetSize,
                featureVersion: r.featureVersion,
                seed: r.seed,
                candidateModelVersion: r.candidateModelVersion,
                datasetFingerprint: r.datasetFingerprint,
                deployed: r.deployed,
                deploymentReason: r.deploymentReason
            }))
        )
    });
    contentArtifacts.push({
        path: 'lineage/snapshots.json',
        text: JSON.stringify([
            {
                modelVersion: record.version,
                featureVersion: record.featureVersion ?? ML_CONSTANTS.FEATURE_VERSION,
                datasetFingerprint: withFingerprint?.datasetFingerprint ?? null,
                datasetSchemaVersion: SOKML_DATASET_SCHEMA_VERSION,
                solverVersion: null,
                rulesVersion: null,
                trainingRunId: withFingerprint?.id ?? null,
                trainingConfigFingerprint: null,
                validationResult: null,
                sourceSokVersion: sokVersion
            }
        ])
    });

    // GO-1: fingerprint z artefaktów (bez manifestu), potem manifest, potem zip.
    const hashes = contentArtifacts.map((a) => ({ path: a.path, sha256: sha256Hex(a.text) }));
    const packageFingerprint = computePackageFingerprint(hashes);
    const transferId = newTransferId();
    const manifest: SokmlManifest = {
        format: SOKML_FORMAT,
        formatVersion: SOKML_FORMAT_VERSION,
        manifestVersion: SOKML_MANIFEST_VERSION,
        aiSchemaVersion: SOKML_AI_SCHEMA_VERSION,
        featureSchemaVersion: SOKML_FEATURE_SCHEMA_VERSION,
        lineageSchemaVersion: SOKML_LINEAGE_SCHEMA_VERSION,
        modelSchemaVersion: SOKML_MODEL_SCHEMA_VERSION,
        transferPackageId: 'pkg_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        packageFingerprint,
        createdAt: new Date().toISOString(),
        sourceSokVersion: sokVersion,
        sourcePlatform: `${process.platform}-${process.arch}`,
        dataset: {
            fingerprint: withFingerprint?.datasetFingerprint ?? null,
            fingerprintAlgorithm: 'SHA-256',
            fingerprintVersion: 1,
            datasetSchemaVersion: SOKML_DATASET_SCHEMA_VERSION,
            recordCount: withFingerprint?.datasetSize ?? null,
            mode: withFingerprint ? 'fingerprint-only' : 'not-included'
        },
        model: {
            version: record.version,
            state: record.state ?? 'UNKNOWN',
            featureVersion: record.featureVersion ?? ML_CONSTANTS.FEATURE_VERSION,
            modelSchemaVersion: SOKML_MODEL_SCHEMA_VERSION
        },
        lineage: {
            datasetFingerprint: withFingerprint?.datasetFingerprint ?? null,
            datasetSchemaVersion: SOKML_DATASET_SCHEMA_VERSION,
            solverVersion: null,
            rulesVersion: null,
            trainingRunId: withFingerprint?.id ?? null,
            trainingConfigFingerprint: null,
            validationResult: null,
            sourceSokVersion: sokVersion
        },
        artifacts: hashes
    };
    const manifestText = JSON.stringify(manifest);
    const checksums = buildChecksumsFile([
        ...hashes,
        { path: 'manifest.json', sha256: sha256Hex(manifestText) }
    ]);

    const zip = new JSZip();
    for (const a of contentArtifacts) zip.file(a.path, a.text);
    zip.file('manifest.json', manifestText);
    zip.file('checksums.sha256', checksums);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await prisma.aiTransfer.create({
        data: {
            id: crypto.randomUUID(),
            transferId,
            direction: 'EXPORT',
            packageFingerprint,
            manifestFingerprint: 'sha256:' + sha256Hex(manifestText),
            modelVersion: record.version,
            modelFingerprint: 'sha256:' + hashes.find((h) => h.path === modelPath)?.sha256,
            datasetFingerprint: withFingerprint?.datasetFingerprint ?? null,
            sourceSokVersion: sokVersion,
            targetSokVersion: sokVersion,
            status: 'COMPLETED',
            result: 'MODEL_ONLY',
            userId,
            createdAt: new Date().toISOString()
        }
    });
    return { buffer, transferId, packageFingerprint, manifest };
}
