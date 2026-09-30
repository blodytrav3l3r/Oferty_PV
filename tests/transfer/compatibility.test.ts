/**
 * P7.6/P7.7 — testy Compatibility Engine i dry-run store (bez DB).
 */
import { describe, expect, it } from '@jest/globals';
import {
    checkCompatibility,
    type CompatTarget,
    type ModelArtifactShape
} from '../../src/services/ml/transfer/compatibility';
import type { SokmlManifest } from '../../src/services/ml/transfer/manifest';
import { createDryRun, getDryRun, clearDryRuns } from '../../src/services/ml/transfer/dryRunStore';

const NAMES = ['dn', 'heightMm', 'ringCount'];

function manifest(overrides: Record<string, unknown> = {}): SokmlManifest {
    return {
        format: 'sok-ai-ml',
        formatVersion: 1,
        manifestVersion: 1,
        aiSchemaVersion: '1',
        featureSchemaVersion: 'v7',
        lineageSchemaVersion: '1',
        modelSchemaVersion: '1',
        transferPackageId: 'pkg_1',
        packageFingerprint: 'sha256:' + 'a'.repeat(64),
        createdAt: '2026-09-30T00:00:00.000Z',
        sourceSokVersion: '1.34.0',
        sourcePlatform: 'test',
        dataset: {
            fingerprint: 'sok-dataset-v1:abc',
            fingerprintAlgorithm: 'SHA-256',
            fingerprintVersion: 1,
            datasetSchemaVersion: '1',
            recordCount: 100,
            mode: 'fingerprint-only'
        },
        model: {
            version: 'v1',
            state: 'PRODUCTION',
            featureVersion: 'v7',
            modelSchemaVersion: '1'
        },
        lineage: {
            datasetFingerprint: 'sok-dataset-v1:abc',
            datasetSchemaVersion: '1',
            solverVersion: null,
            rulesVersion: null,
            trainingRunId: null,
            trainingConfigFingerprint: null,
            validationResult: null,
            sourceSokVersion: '1.34.0'
        },
        artifacts: [{ path: 'models/model.json', sha256: 'b'.repeat(64) }],
        ...overrides
    } as SokmlManifest;
}

function target(overrides: Partial<CompatTarget> = {}): CompatTarget {
    return {
        sokVersion: '1.34.0',
        aiSchemaVersion: '1',
        featureVersion: 'v7',
        featureCount: 3,
        featureNames: [...NAMES],
        solverVersion: null,
        rulesVersion: null,
        datasetFingerprint: 'sok-dataset-v1:abc',
        ...overrides
    };
}

function model(overrides: Partial<ModelArtifactShape> = {}): ModelArtifactShape {
    return {
        features: [...NAMES],
        weights: [0.1, 0.2, 0.3],
        featureMins: [0, 0, 0],
        featureMaxs: [1, 1, 1],
        ...overrides
    };
}

function codesOf(status: ReturnType<typeof checkCompatibility>): string[] {
    return status.checks.map((c) => c.code);
}

describe('checkCompatibility', () => {
    it('identyczne środowiska → compatible, same PASS', () => {
        const report = checkCompatibility(manifest(), model(), target());
        expect(report.status).toBe('compatible');
        expect(report.checks.every((c) => c.status === 'PASS')).toBe(true);
    });
    it('FEATURE_VERSION_MISMATCH → blocked', () => {
        const m = manifest({
            model: {
                version: 'v1',
                state: 'PRODUCTION',
                featureVersion: 'v5',
                modelSchemaVersion: '1'
            }
        });
        const report = checkCompatibility(m, model(), target());
        expect(report.status).toBe('blocked');
        expect(codesOf(report)).toContain('FEATURE_VERSION_MISMATCH');
    });
    it('kolejność cech i wymiar wag mają znaczenie → blocked', () => {
        const names = checkCompatibility(
            manifest(),
            model({ features: [...NAMES].reverse() }),
            target()
        );
        expect(names.status).toBe('blocked');
        expect(codesOf(names)).toContain('FEATURE_NAMES_MISMATCH');
        const dims = checkCompatibility(manifest(), model({ weights: [0.1] }), target());
        expect(dims.status).toBe('blocked');
        expect(codesOf(dims)).toContain('MODEL_DIMENSION_MISMATCH');
    });
    it('brak normalizacji → blocked', () => {
        const report = checkCompatibility(manifest(), model({ featureMins: [] }), target());
        expect(report.status).toBe('blocked');
        expect(codesOf(report)).toContain('NORMALIZATION_MISMATCH');
    });
    it('S.O.K. ten sam major → warning; inny major → blocked', () => {
        const warn = checkCompatibility(
            manifest({ sourceSokVersion: '1.33.0' }),
            model(),
            target()
        );
        expect(warn.status).toBe('warning');
        expect(codesOf(warn)).toContain('SOK_VERSION_DIFFERS');
        const blocked = checkCompatibility(
            manifest({ sourceSokVersion: '2.0.0' }),
            model(),
            target()
        );
        expect(blocked.status).toBe('blocked');
        expect(codesOf(blocked)).toContain('SOK_VERSION_MISMATCH');
    });
    it('AI schema mismatch → blocked; solver bez baseline → warning', () => {
        const report = checkCompatibility(manifest({ aiSchemaVersion: '2' }), model(), target());
        expect(report.status).toBe('blocked');
        expect(codesOf(report)).toContain('AI_SCHEMA_MISMATCH');
        const m2 = manifest({
            lineage: {
                datasetFingerprint: null,
                datasetSchemaVersion: null,
                solverVersion: '3.1',
                rulesVersion: '9',
                trainingRunId: null,
                trainingConfigFingerprint: null,
                validationResult: null,
                sourceSokVersion: '1.34.0'
            }
        });
        const unverified = checkCompatibility(m2, model(), target());
        expect(codesOf(unverified)).toContain('SOLVER_VERSION_UNVERIFIED');
        expect(codesOf(unverified)).toContain('RULES_VERSION_UNVERIFIED');
    });
    it('dataset: IDENTICAL → pass; inny → warning; brak → warning', () => {
        const identical = checkCompatibility(manifest(), model(), target());
        expect(codesOf(identical)).toContain('DATASET_FINGERPRINT_IDENTICAL');
        const differs = checkCompatibility(
            manifest(),
            model(),
            target({ datasetFingerprint: 'other' })
        );
        expect(differs.status).toBe('warning');
        expect(codesOf(differs)).toContain('DATASET_FINGERPRINT_DIFFERS');
    });
});

describe('dryRunStore', () => {
    it('create → get wiąże fingerprinty; clear czyści', () => {
        clearDryRuns();
        const m = manifest();
        const rec = createDryRun(m.packageFingerprint, Buffer.from('manifest-bytes'), m, {
            status: 'compatible',
            checks: []
        });
        expect(rec.id.startsWith('dry_')).toBe(true);
        expect(rec.manifestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(getDryRun(rec.id)?.packageFingerprint).toBe(m.packageFingerprint);
        expect(getDryRun('dry_nonexistent')).toBeNull();
        clearDryRuns();
        expect(getDryRun(rec.id)).toBeNull();
    });
});
