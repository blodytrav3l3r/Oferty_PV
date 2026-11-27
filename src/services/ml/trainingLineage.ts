import crypto from 'crypto';

export type TrainingSplit = 'train' | 'validation' | 'test';

export interface FingerprintTrainingRow {
    split: TrainingSplit;
    features: number[];
    label: number;
    weight: number;
}

export interface TrainingPartitionFingerprint {
    count: number;
    fingerprint: string;
}

export interface TrainingFingerprints {
    datasetFingerprint: string;
    splitFingerprints: Record<TrainingSplit, TrainingPartitionFingerprint>;
}

export interface TrainingLineageSnapshot {
    lineageSchemaVersion: 2;
    runId: string;
    modelVersion: string | null;
    appVersion: string;
    appCommitSha: string | null;
    codeFingerprint: string | null;
    featureSchemaVersion: string;
    featureSchemaFingerprint: string;
    datasetFingerprint: string;
    trainingConfigFingerprint: string;
    trainingUserScopeFingerprint?: string;
    trainingConfig: {
        algorithm: string;
        learningRate: number;
        epochs: number;
        l2Lambda: number;
        forgettingLambda: number;
        splitPolicyVersion: string;
        preprocessingVersion: string;
        maxTrainingDurationMs: number;
        divergenceThreshold: number;
        divergenceEpochs: number;
        seed: number;
        seedUsage: 'metadata_only';
        gateAndDeploymentThresholds: Record<string, number>;
    };
    splitPolicyVersion: string;
    splitFingerprints: Record<TrainingSplit, TrainingPartitionFingerprint>;
    solverVersion: null;
    rulesVersion: null;
    unavailableFields: string[];
    environment: { nodeVersion: string; platform: string; arch: string };
    validationResult: {
        status: string;
        reason: string | null;
        metrics: Record<string, number | null> | null;
    } | null;
    decision: { deployed: boolean; reason: string | null } | null;
    modelFingerprint: string | null;
}

function canonicalJson(value: unknown): string {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return JSON.stringify(value);
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('fingerprint_non_finite_number');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (typeof value !== 'object') throw new Error('fingerprint_unsupported_value');
    const entries = Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
}

function sha256(value: unknown): string {
    return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/**
 * Privacy-minimal identity of a training allowlist. Raw user IDs stay in memory
 * and are never copied into the persisted training lineage snapshot.
 */
export function computeTrainingUserScopeFingerprint(userIds: readonly string[]): string {
    const canonicalUserIds = [...new Set(userIds)].sort();
    return `sok-ml-user-scope-v1:sha256:${sha256({
        algorithm: 'sok-ml-user-scope',
        version: 1,
        userIds: canonicalUserIds
    })}`;
}

function fingerprintPartition(
    rows: FingerprintTrainingRow[],
    featureSchemaVersion: string,
    splitPolicyVersion: string,
    split: TrainingSplit
): TrainingPartitionFingerprint {
    const records = rows.filter((row) => row.split === split);
    const fingerprint = sha256({
        algorithm: 'sok-ml-partition',
        version: 2,
        featureSchemaVersion,
        splitPolicyVersion,
        split,
        records
    });
    return { count: records.length, fingerprint: `sha256:${fingerprint}` };
}

export function computeTrainingFingerprints(
    rows: FingerprintTrainingRow[],
    featureSchemaVersion: string,
    splitPolicyVersion: string
): TrainingFingerprints {
    const splitFingerprints: Record<TrainingSplit, TrainingPartitionFingerprint> = {
        train: fingerprintPartition(rows, featureSchemaVersion, splitPolicyVersion, 'train'),
        validation: fingerprintPartition(
            rows,
            featureSchemaVersion,
            splitPolicyVersion,
            'validation'
        ),
        test: fingerprintPartition(rows, featureSchemaVersion, splitPolicyVersion, 'test')
    };
    return {
        datasetFingerprint: `sok-ml-dataset-v2:sha256:${sha256({
            algorithm: 'sok-ml-training-dataset',
            version: 2,
            featureSchemaVersion,
            splitPolicyVersion,
            splitFingerprints
        })}`,
        splitFingerprints
    };
}

export function computeTrainingConfigFingerprint(config: unknown): string {
    return `sok-ml-config-v1:sha256:${sha256(config)}`;
}

export function computeFeatureSchemaFingerprint(
    featureSchemaVersion: string,
    featureNames: string[]
): string {
    return `sok-ml-feature-schema-v1:sha256:${sha256({ featureSchemaVersion, featureNames })}`;
}

export function computeModelFingerprint(model: {
    features: string[];
    weights: number[];
    bias: number;
    featureMins: number[];
    featureMaxs: number[];
}): string {
    return `sok-ml-model-v1:sha256:${sha256(model)}`;
}

export function computeDatasetSnapshotFingerprint(
    rows: Array<Record<string, unknown>>,
    featureSchemaVersion: string
): string {
    const contentRows = rows
        .map(({ id: _id, telemetryId: _telemetryId, ...content }) => content)
        .sort((left, right) => {
            const leftValue = canonicalJson(left);
            const rightValue = canonicalJson(right);
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
        });
    return `sok-dataset-v2:sha256:${sha256({
        algorithm: 'sok-eligible-dataset-snapshot',
        version: 2,
        featureSchemaVersion,
        records: contentRows
    })}`;
}
