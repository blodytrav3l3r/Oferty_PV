import crypto from 'crypto';
import JSZip from 'jszip';
import prisma from '../../../prismaClient';
import { Prisma } from '../../../../generated/prisma-postgres/client';
import { getVersion } from '../../../version';
import { FEATURE_NAMES, ML_CONSTANTS } from '../../../config/mlConstants';
import {
    SOKML_FORMAT,
    SOKML_FORMAT_VERSION,
    SOKML_MANIFEST_VERSION,
    SOKML_AI_SCHEMA_VERSION,
    SOKML_MODEL_SCHEMA_VERSION,
    SOKML_LINEAGE_SCHEMA_VERSION,
    SOKML_FEATURE_SCHEMA_VERSION
} from './transferConstants';
import { TransferError } from './transferErrors';
import {
    computePackageFingerprint,
    buildChecksumsFile,
    sha256Hex,
    trainingSnapshotSchema,
    type SokmlManifest
} from './manifest';
import {
    fetchEligibleDatasetRows,
    serializeRecordsNdjson,
    buildDatasetManifest,
    type DatasetRow
} from './dataset';
import { buildTelemetryAggregates } from './telemetryExport';
import { getTrainingUserIds, TRAINING_USERS_KEY } from '../trainingUsers';

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
        mode: 'fingerprint-only' | 'full' | 'not-included';
        fingerprint: string | null;
        recordCount: number | null;
    };
    knowledge: { included: boolean; patterns: number };
    telemetry: { included: boolean; groups: number; records: number; note: string };
    trainingRuns: number;
    lineageIncluded: boolean;
    estimatedBytes: number;
}

export interface ExportOptions {
    dataset?: 'fingerprint-only' | 'full' | 'not-included';
    knowledge?: boolean;
    telemetry?: boolean;
}

function parseTrainingSnapshot(value: string | null): SokmlManifest['lineage']['snapshot'] {
    if (!value) return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new TransferError('MODEL_INVALID', 'Uszkodzony snapshot lineage modelu');
    }
    const result = trainingSnapshotSchema.safeParse(parsed);
    if (!result.success) {
        throw new TransferError('MODEL_INVALID', 'Nieprawidłowy snapshot lineage modelu');
    }
    return result.data;
}

function datasetFingerprintVersion(fingerprint: string | null): 1 | 2 {
    return fingerprint?.startsWith('sok-ml-dataset-v2:') ? 2 : 1;
}

function datasetSchemaVersion(fingerprint: string | null): '1' | '2' {
    return datasetFingerprintVersion(fingerprint) === 2 ? '2' : '1';
}

function assertKnowledgeExportScope(options: ExportOptions): void {
    if (options.knowledge === true) {
        throw new TransferError(
            'DATA_SCOPE_UNAVAILABLE',
            'Eksport knowledge jest niedostępny: wzorce nie mają lineage właściciela i nie można potwierdzić zakresu allowlisty.'
        );
    }
}

function sameUserScope(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((userId, index) => userId === sortedRight[index]);
}

function parseUserScope(value: string | null | undefined): string[] | null {
    if (value === null || value === undefined) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }
    if (!Array.isArray(parsed) || parsed.some((userId) => typeof userId !== 'string')) {
        return null;
    }
    return [...new Set(parsed as string[])];
}

/** Podgląd eksportu (bez generowania pliku) — użytkownik widzi, co opuszcza komputer. */
export async function buildExportPreview(
    modelId: string,
    options: ExportOptions = {}
): Promise<ExportPreview> {
    assertKnowledgeExportScope(options);
    const allowlist = await getTrainingUserIds();
    const record = await prisma.aiModel.findUnique({ where: { id: modelId } });
    if (!record) throw new TransferError('MODEL_NOT_FOUND', 'Model nie istnieje');
    const parsed = parseModelRecord(record);
    const runs = await prisma.aiTrainingRun.findMany({
        where: { candidateModelVersion: record.version },
        orderBy: { startedAt: 'desc' },
        take: 100
    });
    const withFingerprint = runs.find((r) => r.datasetFingerprint);
    const datasetMode = options.dataset ?? (withFingerprint ? 'fingerprint-only' : 'not-included');
    const datasetBlock =
        datasetMode === 'full'
            ? {
                  mode: datasetMode,
                  fingerprint: null as string | null,
                  recordCount: (await fetchEligibleDatasetRows(allowlist)).length
              }
            : {
                  mode: datasetMode,
                  fingerprint: withFingerprint?.datasetFingerprint ?? null,
                  recordCount: withFingerprint?.datasetSize ?? null
              };
    const telemetry =
        options.telemetry === true ? await buildTelemetryAggregates(30, allowlist) : null;
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
        dataset: datasetBlock,
        knowledge: { included: false, patterns: 0 },
        telemetry: {
            included: options.telemetry === true,
            groups: telemetry?.byDaySource.length ?? 0,
            records: telemetry?.rowsIncluded ?? 0,
            note:
                options.telemetry === true
                    ? `Allowlista, agregaty ≥5 właścicieli, do 20 rekordów na właściciela/grupę. Podgląd informacyjny; pakiet użyje zakresu aktualnego przy generowaniu. ${telemetry?.byDaySource.length ?? 0} grup, ${telemetry?.rowsIncluded ?? 0} rekordów.`
                    : 'Wyłączona'
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
export async function buildModelPackage(
    modelId: string,
    userId: string,
    options: ExportOptions = {}
): Promise<BuiltPackage> {
    assertKnowledgeExportScope(options);
    const allowlist = await getTrainingUserIds();
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
    const lineageSnapshot =
        parseTrainingSnapshot(record.lineageSnapshot) ??
        parseTrainingSnapshot(withFingerprint?.lineageSnapshot ?? null);
    const runDatasetFingerprint =
        withFingerprint?.datasetFingerprint ?? lineageSnapshot?.datasetFingerprint ?? null;
    const trainingRecordCount =
        withFingerprint?.datasetSize ??
        (lineageSnapshot
            ? Object.values(lineageSnapshot.splitFingerprints).reduce(
                  (total, split) => total + split.count,
                  0
              )
            : null);

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
    const datasetMode =
        options.dataset ?? (runDatasetFingerprint ? 'fingerprint-only' : 'not-included');
    let datasetRows: DatasetRow[] | null = null;
    let resolvedFingerprint: string | null = null;
    let resolvedRecordCount: number | null = null;
    if (datasetMode === 'full') {
        // P7.5 Extended: snapshot kwalifikowalnych wierszy (semantyka w dataset.ts).
        datasetRows = await fetchEligibleDatasetRows(allowlist);
        const fullManifest = buildDatasetManifest(datasetRows);
        resolvedFingerprint = fullManifest.fingerprint;
        resolvedRecordCount = fullManifest.recordCount;
        contentArtifacts.push({
            path: 'datasets/manifest.json',
            text: JSON.stringify(fullManifest)
        });
        contentArtifacts.push({
            path: 'datasets/records.ndjson',
            text: serializeRecordsNdjson(datasetRows)
        });
    } else if (runDatasetFingerprint && datasetMode === 'fingerprint-only') {
        const runFingerprintVersion = datasetFingerprintVersion(runDatasetFingerprint);
        contentArtifacts.push({
            path: 'datasets/manifest.json',
            text: JSON.stringify({
                fingerprint: runDatasetFingerprint,
                fingerprintAlgorithm: 'SHA-256',
                fingerprintVersion: runFingerprintVersion,
                datasetSchemaVersion: runFingerprintVersion === 2 ? '2' : '1',
                recordCount: trainingRecordCount,
                mode: 'fingerprint-only'
            })
        });
    }
    if (options.telemetry === true) {
        contentArtifacts.push({
            path: 'telemetry/selected.json',
            text: JSON.stringify(await buildTelemetryAggregates(30, allowlist))
        });
    }
    // Model zachowuje fingerprint runu; FULL dataset ma własny fingerprint w datasets/manifest.json.
    modelArtifact.datasetFingerprint = runDatasetFingerprint;
    contentArtifacts[0] = { path: modelPath, text: JSON.stringify(modelArtifact) };
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
                lineageSnapshot: parseTrainingSnapshot(r.lineageSnapshot),
                deployed: r.deployed,
                deploymentReason: r.deploymentReason
            }))
        )
    });
    contentArtifacts.push({
        path: 'lineage/snapshots.json',
        text: JSON.stringify([
            lineageSnapshot ?? {
                modelVersion: record.version,
                featureVersion: record.featureVersion ?? ML_CONSTANTS.FEATURE_VERSION,
                datasetFingerprint: runDatasetFingerprint,
                datasetSchemaVersion: datasetSchemaVersion(runDatasetFingerprint),
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
        lineageSchemaVersion: lineageSnapshot ? SOKML_LINEAGE_SCHEMA_VERSION : '1',
        modelSchemaVersion: SOKML_MODEL_SCHEMA_VERSION,
        transferPackageId: 'pkg_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12),
        packageFingerprint,
        createdAt: new Date().toISOString(),
        sourceSokVersion: sokVersion,
        sourcePlatform: `${process.platform}-${process.arch}`,
        dataset: {
            fingerprint: resolvedFingerprint ?? runDatasetFingerprint,
            fingerprintAlgorithm: 'SHA-256',
            fingerprintVersion:
                datasetMode === 'full'
                    ? 2
                    : datasetFingerprintVersion(resolvedFingerprint ?? runDatasetFingerprint),
            datasetSchemaVersion:
                datasetMode === 'full'
                    ? '2'
                    : datasetSchemaVersion(resolvedFingerprint ?? runDatasetFingerprint),
            recordCount: resolvedRecordCount ?? trainingRecordCount,
            mode: datasetMode
        },
        model: {
            version: record.version,
            state: record.state ?? 'UNKNOWN',
            featureVersion: record.featureVersion ?? ML_CONSTANTS.FEATURE_VERSION,
            modelSchemaVersion: SOKML_MODEL_SCHEMA_VERSION
        },
        lineage: {
            datasetFingerprint: runDatasetFingerprint,
            datasetSchemaVersion: datasetSchemaVersion(runDatasetFingerprint),
            solverVersion: lineageSnapshot?.solverVersion ?? null,
            rulesVersion: lineageSnapshot?.rulesVersion ?? null,
            trainingRunId: lineageSnapshot?.runId ?? withFingerprint?.id ?? null,
            trainingConfigFingerprint: lineageSnapshot?.trainingConfigFingerprint ?? null,
            validationResult: lineageSnapshot?.validationResult
                ? JSON.stringify(lineageSnapshot.validationResult)
                : null,
            sourceSokVersion: sokVersion,
            ...(lineageSnapshot ? { snapshot: lineageSnapshot } : {})
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
    const extended = datasetMode === 'full' || options.telemetry === true;
    const transferRecord = {
        id: crypto.randomUUID(),
        transferId,
        direction: 'EXPORT' as const,
        packageFingerprint,
        manifestFingerprint: 'sha256:' + sha256Hex(manifestText),
        modelVersion: record.version,
        modelFingerprint: 'sha256:' + hashes.find((h) => h.path === modelPath)?.sha256,
        datasetFingerprint: resolvedFingerprint ?? withFingerprint?.datasetFingerprint ?? null,
        sourceSokVersion: sokVersion,
        targetSokVersion: sokVersion,
        status: 'COMPLETED' as const,
        result: extended ? 'FULL' : 'MODEL_ONLY',
        userId,
        createdAt: new Date().toISOString()
    };
    if (datasetMode === 'full' || options.telemetry === true) {
        await prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<Array<{ value: string | null }>>(
                Prisma.sql`SELECT "value" FROM "settings" WHERE "key" = ${TRAINING_USERS_KEY} FOR SHARE`
            );
            const currentUsers = parseUserScope(rows[0]?.value);
            if (currentUsers === null || !sameUserScope(allowlist, currentUsers)) {
                throw new TransferError(
                    'DATA_SCOPE_UNAVAILABLE',
                    'Allowlista zmieniła się podczas eksportu. Wykonaj podgląd i eksport ponownie.'
                );
            }
            await tx.aiTransfer.create({ data: transferRecord });
        });
    } else {
        await prisma.aiTransfer.create({ data: transferRecord });
    }
    return { buffer, transferId, packageFingerprint, manifest };
}
