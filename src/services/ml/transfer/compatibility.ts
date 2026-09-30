import type { SokmlManifest } from './manifest';

/**
 * P7.6 — Compatibility Engine (tabela reguł z rozdz. 7 planu P7).
 *
 * Zwraca STRUKTURALNY raport {status, checks[]} — UI renderuje checklistę.
 * Agregacja: jakikolwiek BLOCKED → blocked; inaczej WARNING → warning.
 *
 * Znany sufit: S.O.K. nie wersjonuje (jeszcze) solvera ani reguł jako stałych,
 * więc SOLVER/RULES dają co najwyżej WARNING (UNVERIFIED). Gdy powstaną
 * SOLVER_VERSION/RULES_VERSION, dopiąć tu twardy BLOCK na mismatch.
 */

export type CompatCheckStatus = 'PASS' | 'WARNING' | 'BLOCKED';
export type CompatOverall = 'compatible' | 'warning' | 'blocked';

export interface CompatCheck {
    code: string;
    status: CompatCheckStatus;
    detail?: string;
}

export interface CompatReport {
    status: CompatOverall;
    checks: CompatCheck[];
}

export interface ModelArtifactShape {
    features: string[];
    weights: number[];
    featureMins: number[];
    featureMaxs: number[];
}

export interface CompatTarget {
    sokVersion: string;
    aiSchemaVersion: string;
    featureVersion: string;
    featureCount: number;
    featureNames: string[];
    solverVersion: string | null;
    rulesVersion: string | null;
    datasetFingerprint: string | null;
}

function majorOf(version: string): number | null {
    const match = /^(\d+)\./.exec(version.trim());
    return match ? Number(match[1]) : null;
}

function aggregate(checks: CompatCheck[]): CompatOverall {
    if (checks.some((c) => c.status === 'BLOCKED')) return 'blocked';
    if (checks.some((c) => c.status === 'WARNING')) return 'warning';
    return 'compatible';
}

function sokCheck(manifest: SokmlManifest, target: CompatTarget): CompatCheck {
    if (manifest.sourceSokVersion === target.sokVersion) {
        return { code: 'SOK_VERSION_MATCH', status: 'PASS' };
    }
    const srcMajor = majorOf(manifest.sourceSokVersion);
    const tgtMajor = majorOf(target.sokVersion);
    if (srcMajor !== null && srcMajor === tgtMajor) {
        return {
            code: 'SOK_VERSION_DIFFERS',
            status: 'WARNING',
            detail: `${manifest.sourceSokVersion} → ${target.sokVersion}`
        };
    }
    return {
        code: 'SOK_VERSION_MISMATCH',
        status: 'BLOCKED',
        detail: `${manifest.sourceSokVersion} → ${target.sokVersion}`
    };
}

function datasetCheck(manifest: SokmlManifest, target: CompatTarget): CompatCheck {
    const ds = manifest.dataset;
    if (ds.mode === 'not-included') {
        return { code: 'DATASET_NOT_INCLUDED', status: 'WARNING' };
    }
    if (ds.mode === 'full') {
        // Integralność FULL DATA weryfikuje importer (rekordy → fingerprint).
        return { code: 'DATASET_FULL_INCLUDED', status: 'PASS' };
    }
    if (!ds.fingerprint || !target.datasetFingerprint) {
        return { code: 'DATASET_FINGERPRINT_UNVERIFIED', status: 'WARNING' };
    }
    if (ds.fingerprint === target.datasetFingerprint) {
        return { code: 'DATASET_FINGERPRINT_IDENTICAL', status: 'PASS' };
    }
    return {
        code: 'DATASET_FINGERPRINT_DIFFERS',
        status: 'WARNING',
        detail: 'Cel ma inny dataset — model importowany z własnym lineage'
    };
}

function versionedCheck(
    passCode: string,
    unverifiedCode: string,
    mismatchCode: string,
    manifestValue: string | null,
    targetValue: string | null
): CompatCheck {
    if (manifestValue === null && targetValue === null) {
        return { code: passCode, status: 'PASS' };
    }
    if (manifestValue !== null && manifestValue === targetValue) {
        return { code: passCode, status: 'PASS' };
    }
    if (targetValue === null) {
        return { code: unverifiedCode, status: 'WARNING' };
    }
    return { code: mismatchCode, status: 'BLOCKED', detail: `${manifestValue} → ${targetValue}` };
}

export function checkCompatibility(
    manifest: SokmlManifest,
    model: ModelArtifactShape,
    target: CompatTarget
): CompatReport {
    const checks: CompatCheck[] = [sokCheck(manifest, target)];

    checks.push(
        manifest.aiSchemaVersion === target.aiSchemaVersion
            ? { code: 'AI_SCHEMA_MATCH', status: 'PASS' }
            : {
                  code: 'AI_SCHEMA_MISMATCH',
                  status: 'BLOCKED',
                  detail: `${manifest.aiSchemaVersion} → ${target.aiSchemaVersion}`
              }
    );

    checks.push(
        manifest.model.featureVersion === target.featureVersion
            ? { code: 'FEATURE_VERSION_MATCH', status: 'PASS' }
            : {
                  code: 'FEATURE_VERSION_MISMATCH',
                  status: 'BLOCKED',
                  detail: `${manifest.model.featureVersion} → ${target.featureVersion}`
              }
    );

    checks.push(
        model.features.length === target.featureCount
            ? { code: 'FEATURE_COUNT_MATCH', status: 'PASS' }
            : {
                  code: 'FEATURE_COUNT_MISMATCH',
                  status: 'BLOCKED',
                  detail: `${model.features.length} → ${target.featureCount}`
              }
    );

    const namesMatch =
        model.features.length === target.featureNames.length &&
        model.features.every((f, i) => f === target.featureNames[i]);
    checks.push(
        namesMatch
            ? { code: 'FEATURE_NAMES_MATCH', status: 'PASS' }
            : { code: 'FEATURE_NAMES_MISMATCH', status: 'BLOCKED' }
    );

    const normOk =
        model.featureMins.length === model.features.length &&
        model.featureMaxs.length === model.features.length &&
        [...model.featureMins, ...model.featureMaxs].every((v) => Number.isFinite(v));
    checks.push(
        normOk
            ? { code: 'NORMALIZATION_MATCH', status: 'PASS' }
            : { code: 'NORMALIZATION_MISMATCH', status: 'BLOCKED' }
    );

    checks.push(
        model.weights.length === model.features.length
            ? { code: 'MODEL_DIMENSION_MATCH', status: 'PASS' }
            : {
                  code: 'MODEL_DIMENSION_MISMATCH',
                  status: 'BLOCKED',
                  detail: `weights=${model.weights.length} features=${model.features.length}`
              }
    );

    checks.push(
        versionedCheck(
            'SOLVER_VERSION_MATCH',
            'SOLVER_VERSION_UNVERIFIED',
            'SOLVER_VERSION_MISMATCH',
            manifest.lineage.solverVersion,
            target.solverVersion
        )
    );
    checks.push(
        versionedCheck(
            'RULES_VERSION_MATCH',
            'RULES_VERSION_UNVERIFIED',
            'RULES_VERSION_MISMATCH',
            manifest.lineage.rulesVersion,
            target.rulesVersion
        )
    );

    checks.push(datasetCheck(manifest, target));

    return { status: aggregate(checks), checks };
}
