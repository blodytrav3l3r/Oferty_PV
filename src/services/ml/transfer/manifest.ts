import crypto from 'crypto';
import { z } from 'zod';
import { SOKML_FORMAT, SOKML_FORMAT_VERSION, SOKML_MANIFEST_VERSION } from './transferConstants';
import { TransferError } from './transferErrors';
import type { GatedEntry } from './archiveGate';
import { trainingGroupDiagnosticsSchema } from '../trainingGroupDiagnostics';

/**
 * P7.1 — Manifest .sokml + checksumy + kanoniczny packageFingerprint.
 *
 * GO-1: packageFingerprint = SHA-256 posortowanej listy
 * `ścieżka:sha256` artefaktów (bez manifest.json i checksums.sha256).
 * Hash manifestu NIGDY nie jest wejściem fingerprintu (zakaz cyklu).
 */

const SHA256_HEX = /^[0-9a-f]{64}$/;

const artifactSchema = z.object({
    path: z.string().min(1),
    sha256: z.string().regex(SHA256_HEX)
});

const datasetSchema = z.object({
    fingerprint: z.string().min(1).nullable(),
    fingerprintAlgorithm: z.string().min(1),
    fingerprintVersion: z.union([z.literal(1), z.literal(2)]),
    datasetSchemaVersion: z.enum(['1', '2']),
    recordCount: z.number().int().nonnegative().nullable(),
    mode: z.enum(['fingerprint-only', 'full', 'not-included'])
});

const modelSchema = z.object({
    version: z.string().min(1),
    state: z.string().min(1),
    featureVersion: z.string().min(1),
    modelSchemaVersion: z.string().min(1)
});

const partitionFingerprintSchema = z.object({
    count: z.number().int().nonnegative(),
    fingerprint: z.string().min(1)
});

export const trainingSnapshotSchema = z.object({
    lineageSchemaVersion: z.literal(2),
    runId: z.string().min(1),
    modelVersion: z.string().min(1).nullable(),
    appVersion: z.string().min(1),
    appCommitSha: z.string().min(1).nullable(),
    codeFingerprint: z.string().min(1).nullable(),
    featureSchemaVersion: z.string().min(1),
    featureSchemaFingerprint: z.string().min(1),
    datasetFingerprint: z.string().min(1),
    trainingConfigFingerprint: z.string().min(1),
    trainingConfig: z.object({
        algorithm: z.string().min(1),
        learningRate: z.number().finite(),
        epochs: z.number().int().positive(),
        l2Lambda: z.number().finite(),
        forgettingLambda: z.number().finite(),
        splitPolicyVersion: z.string().min(1),
        preprocessingVersion: z.string().min(1),
        seed: z.number().int(),
        seedUsage: z.literal('metadata_only'),
        gateAndDeploymentThresholds: z.record(z.string(), z.number().finite())
    }),
    splitPolicyVersion: z.string().min(1),
    splitFingerprints: z.object({
        train: partitionFingerprintSchema,
        validation: partitionFingerprintSchema,
        test: partitionFingerprintSchema
    }),
    groupOverlapDiagnostics: trainingGroupDiagnosticsSchema.optional(),
    solverVersion: z.string().min(1).nullable(),
    rulesVersion: z.string().min(1).nullable(),
    unavailableFields: z.array(z.string().min(1)),
    environment: z.object({
        nodeVersion: z.string().min(1),
        platform: z.string().min(1),
        arch: z.string().min(1)
    }),
    validationResult: z
        .object({
            status: z.string().min(1),
            reason: z.string().min(1).nullable(),
            metrics: z.record(z.string(), z.number().finite().nullable()).nullable()
        })
        .nullable(),
    decision: z
        .object({
            deployed: z.boolean(),
            reason: z.string().min(1).nullable()
        })
        .nullable(),
    modelFingerprint: z.string().min(1).nullable()
});

const lineageSchema = z.object({
    datasetFingerprint: z.string().min(1).nullable(),
    datasetSchemaVersion: z.string().min(1).nullable(),
    solverVersion: z.string().min(1).nullable(),
    rulesVersion: z.string().min(1).nullable(),
    trainingRunId: z.string().min(1).nullable(),
    trainingConfigFingerprint: z.string().min(1).nullable(),
    validationResult: z.string().min(1).nullable(),
    sourceSokVersion: z.string().min(1),
    snapshot: trainingSnapshotSchema.optional()
});

export const manifestSchema = z
    .object({
        format: z.literal(SOKML_FORMAT),
        formatVersion: z.literal(SOKML_FORMAT_VERSION),
        manifestVersion: z.literal(SOKML_MANIFEST_VERSION),
        aiSchemaVersion: z.string().min(1),
        featureSchemaVersion: z.string().min(1),
        lineageSchemaVersion: z.enum(['1', '2']),
        modelSchemaVersion: z.string().min(1),
        transferPackageId: z.string().min(1),
        packageFingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        createdAt: z.string().min(1),
        sourceSokVersion: z.string().min(1),
        sourcePlatform: z.string().min(1),
        dataset: datasetSchema,
        model: modelSchema,
        lineage: lineageSchema,
        artifacts: z.array(artifactSchema).min(1)
    })
    .superRefine((manifest, context) => {
        if (manifest.lineageSchemaVersion === '2' && !manifest.lineage.snapshot) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['lineage', 'snapshot'],
                message: 'Brak wymaganego snapshotu lineage v2'
            });
        }
        if (
            manifest.dataset.fingerprintVersion === 2 &&
            manifest.dataset.datasetSchemaVersion !== '2'
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['dataset', 'datasetSchemaVersion'],
                message: 'Wersja fingerprintu niezgodna ze schematem datasetu'
            });
        }
    });

export type SokmlManifest = z.infer<typeof manifestSchema>;

export function sha256Hex(data: Buffer | string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Kanoniczna lista artefaktów (GO-1): linie `path:sha` posortowane
 * deterministycznie, każda zakończona LF (łącznie z ostatnią).
 */
export function canonicalArtifactList(entries: Array<{ path: string; sha256: string }>): string {
    return (
        [...entries]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map((e) => `${e.path}:${e.sha256}`)
            .join('\n') + '\n'
    );
}

/** Kanoniczny fingerprint pakietu (GO-1). Wejście: artefakty BEZ manifestu. */
export function computePackageFingerprint(
    entries: Array<{ path: string; sha256: string }>
): string {
    return 'sha256:' + sha256Hex(canonicalArtifactList(entries));
}

/** Zawartość checksums.sha256 (posortowana, format `sha  path`). */
export function buildChecksumsFile(entries: Array<{ path: string; sha256: string }>): string {
    return (
        [...entries]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map((e) => `${e.sha256}  ${e.path}`)
            .join('\n') + '\n'
    );
}

function parseChecksumsFile(text: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = /^([0-9a-f]{64})\s+(.+)$/.exec(trimmed);
        if (!match) {
            throw new TransferError('CHECKSUM_MISMATCH', 'Nieprawidłowy format checksums.sha256');
        }
        if (map.has(match[2])) {
            throw new TransferError(
                'CHECKSUM_MISMATCH',
                `Zduplikowany wpis w checksums.sha256: ${match[2]}`
            );
        }
        map.set(match[2], match[1]);
    }
    return map;
}

export interface VerifiedPackage {
    manifest: SokmlManifest;
    files: Map<string, Buffer>;
}

/**
 * Weryfikacja pakietu po bramie archiwum: manifest → schemat → checksums →
 * zgodność manifest.artifacts z zawartością → kanoniczny fingerprint.
 */
export function verifyGatedPackage(gated: Map<string, GatedEntry>): VerifiedPackage {
    const manifestEntry = gated.get('manifest.json');
    if (!manifestEntry) {
        throw new TransferError('MANIFEST_MISSING', 'Brak manifest.json w pakiecie');
    }
    let manifestJson: unknown;
    try {
        manifestJson = JSON.parse(manifestEntry.data.toString('utf8'));
    } catch {
        throw new TransferError('MANIFEST_INVALID', 'manifest.json nie jest JSON');
    }
    const parsed = manifestSchema.safeParse(manifestJson);
    if (!parsed.success) {
        throw new TransferError('MANIFEST_INVALID', 'manifest.json niezgodny ze schematem v1');
    }
    const manifest = parsed.data;

    const checksumsEntry = gated.get('checksums.sha256');
    if (!checksumsEntry) {
        throw new TransferError('CHECKSUMS_MISSING', 'Brak checksums.sha256 w pakiecie');
    }
    const checksums = parseChecksumsFile(checksumsEntry.data.toString('utf8'));

    // Exact-set: zbiory muszą być równe (duplikat w manifeście + brakujący
    // plik przy równej liczebności przechodził poprzednie sprawdzenie).
    const contentPaths = [...gated.keys()].filter(
        (p) => p !== 'manifest.json' && p !== 'checksums.sha256'
    );
    const manifestPaths = manifest.artifacts.map((a) => a.path);
    if (new Set(manifestPaths).size !== manifestPaths.length) {
        throw new TransferError('CHECKSUM_MISMATCH', 'Zduplikowane wpisy w manifest.artifacts');
    }
    const contentSet = new Set(contentPaths);
    if (
        manifestPaths.length !== contentPaths.length ||
        !manifestPaths.every((p) => contentSet.has(p))
    ) {
        throw new TransferError('CHECKSUM_MISMATCH', 'Zawartość ZIP niezgodna z manifestem');
    }
    for (const artifact of manifest.artifacts) {
        const entry = gated.get(artifact.path);
        if (!entry || entry.sha256 !== artifact.sha256) {
            throw new TransferError('CHECKSUM_MISMATCH', `Niezgodny artefakt: ${artifact.path}`);
        }
        if (checksums.get(artifact.path) !== artifact.sha256) {
            throw new TransferError(
                'CHECKSUM_MISMATCH',
                `Brak hashy w checksums: ${artifact.path}`
            );
        }
    }
    // Hash manifestu w checksums musi odpowiadać faktycznemu manifestowi.
    if (checksums.get('manifest.json') !== manifestEntry.sha256) {
        throw new TransferError('CHECKSUM_MISMATCH', 'Niezgodny hash manifest.json');
    }

    // GO-1: odtworzenie fingerprintu z artefaktów (bez manifestu).
    const recomputed = computePackageFingerprint(manifest.artifacts);
    if (recomputed !== manifest.packageFingerprint) {
        throw new TransferError(
            'PACKAGE_FINGERPRINT_MISMATCH',
            'packageFingerprint niezgodny z zawartością'
        );
    }

    const files = new Map<string, Buffer>();
    for (const [path, entry] of gated) files.set(path, entry.data);
    return { manifest, files };
}
