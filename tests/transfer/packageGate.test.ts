/**
 * P7.0/P7.1 — testy bramy archiwum i manifestu (.sokml).
 * Czyste unit testy (bez DB): archiwa budowane w pamięci przez jszip.
 */
import { describe, expect, it } from '@jest/globals';
import JSZip from 'jszip';
import {
    inspectArchive,
    validateEntryName,
    readCentralDirectoryNames
} from '../../src/services/ml/transfer/archiveGate';
import {
    computePackageFingerprint,
    verifyGatedPackage,
    sha256Hex
} from '../../src/services/ml/transfer/manifest';
import {
    isAllowedArtifactPath,
    SOKML_LIMITS
} from '../../src/services/ml/transfer/transferConstants';
import { TransferError } from '../../src/services/ml/transfer/transferErrors';

const MODEL_JSON = JSON.stringify({ version: 'v1', weights: [0.1, -0.2], bias: 0.01 });

function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        format: 'sok-ai-ml',
        formatVersion: 1,
        manifestVersion: 1,
        aiSchemaVersion: '1',
        featureSchemaVersion: 'v7',
        lineageSchemaVersion: '1',
        modelSchemaVersion: '1',
        transferPackageId: 'pkg_test_001',
        packageFingerprint: 'sha256:' + '0'.repeat(64),
        createdAt: new Date().toISOString(),
        sourceSokVersion: '1.34.0',
        sourcePlatform: 'test',
        dataset: {
            fingerprint: null,
            fingerprintAlgorithm: 'SHA-256',
            fingerprintVersion: 1,
            datasetSchemaVersion: '1',
            recordCount: null,
            mode: 'not-included'
        },
        model: {
            version: 'v1',
            state: 'PRODUCTION',
            featureVersion: 'v7',
            modelSchemaVersion: '1'
        },
        lineage: {
            datasetFingerprint: null,
            datasetSchemaVersion: null,
            solverVersion: null,
            rulesVersion: null,
            trainingRunId: null,
            trainingConfigFingerprint: null,
            validationResult: null,
            sourceSokVersion: '1.34.0'
        },
        artifacts: [{ path: 'models/model.json', sha256: sha256Hex(MODEL_JSON) }],
        ...overrides
    };
}

async function buildZip(
    files: Record<string, string>,
    opts: { compression?: 'STORE' | 'DEFLATE' } = {}
): Promise<Buffer> {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) zip.file(path, content);
    return zip.generateAsync({
        type: 'nodebuffer',
        compression: opts.compression ?? 'DEFLATE'
    });
}

async function buildValidPackage(
    manifestOverrides: Record<string, unknown> = {},
    spoofFingerprint?: string
): Promise<Buffer> {
    const manifest = baseManifest(manifestOverrides);
    const artifacts = manifest.artifacts as Array<{ path: string; sha256: string }>;
    manifest.packageFingerprint = spoofFingerprint ?? computePackageFingerprint(artifacts);
    const manifestText = JSON.stringify(manifest);
    const checksums =
        `${sha256Hex(manifestText)}  manifest.json\n` +
        `${sha256Hex(MODEL_JSON)}  models/model.json\n`;
    return buildZip({
        'manifest.json': manifestText,
        'checksums.sha256': checksums,
        'models/model.json': MODEL_JSON
    });
}

describe('validateEntryName', () => {
    it('przepuszcza poprawne ścieżki względne', () => {
        expect(() => validateEntryName('models/model.json')).not.toThrow();
        expect(() => validateEntryName('manifest.json')).not.toThrow();
    });
    it('blokuje ../ (zip-slip)', () => {
        try {
            validateEntryName('../outside.json');
            throw new Error('no-throw');
        } catch (e) {
            expect((e as TransferError).code).toBe('PATH_TRAVERSAL');
        }
    });
    it('blokuje ścieżki absolutne i dyskowe', () => {
        expect.assertions(2);
        for (const p of ['/etc/passwd', 'C:/win.ini']) {
            try {
                validateEntryName(p);
            } catch (e) {
                expect((e as TransferError).code).toBe('ABSOLUTE_PATH');
            }
        }
    });
    it('blokuje pustą ścieżkę', () => {
        try {
            validateEntryName('');
            throw new Error('no-throw');
        } catch (e) {
            expect((e as TransferError).code).toBe('EMPTY_PATH');
        }
    });
});

describe('isAllowedArtifactPath', () => {
    it('allowlista: Core + P7.5 Extended (opt-in), reszta zablokowana', () => {
        expect(isAllowedArtifactPath('models/m.json')).toBe(true);
        expect(isAllowedArtifactPath('manifest.json')).toBe(true);
        expect(isAllowedArtifactPath('models/a/b.json')).toBe(false);
        expect(isAllowedArtifactPath('knowledge/patterns.json')).toBe(true);
        expect(isAllowedArtifactPath('telemetry/selected.json')).toBe(true);
        expect(isAllowedArtifactPath('knowledge/other.json')).toBe(false);
        expect(isAllowedArtifactPath('evil.exe')).toBe(false);
    });
});

describe('inspectArchive', () => {
    it('przepuszcza poprawny pakiet', async () => {
        const buf = await buildValidPackage();
        const gated = await inspectArchive(buf);
        expect(gated.has('models/model.json')).toBe(true);
        expect(gated.get('models/model.json')?.sha256).toBe(sha256Hex(MODEL_JSON));
    });
    it('odrzuca pusty bufor i śmieci', async () => {
        await expect(inspectArchive(Buffer.alloc(0))).rejects.toMatchObject({
            code: 'ARCHIVE_EMPTY'
        });
        await expect(inspectArchive(Buffer.from('nie-zip'))).rejects.toMatchObject({
            code: 'ARCHIVE_INVALID'
        });
    });
    it('odrzuca artefakt spoza allowlisty przed odczytem treści', async () => {
        const buf = await buildZip({ 'evil.exe': 'x', 'manifest.json': '{}' });
        await expect(inspectArchive(buf)).rejects.toMatchObject({ code: 'UNKNOWN_ARTIFACT' });
    });
    it('egzekwuje limit liczby plików', async () => {
        const buf = await buildValidPackage();
        await expect(inspectArchive(buf, { ...SOKML_LIMITS, maxFiles: 1 })).rejects.toMatchObject({
            code: 'TOO_MANY_FILES'
        });
    });
    it('central directory czyta wpisy bez ekstrakcji', async () => {
        const buf = await buildValidPackage();
        const names = readCentralDirectoryNames(buf)
            .map((e) => e.name)
            .sort();
        // jszip dopisuje jawny wpis katalogu models/ — brama go toleruje (pomija).
        expect(names).toEqual([
            'checksums.sha256',
            'manifest.json',
            'models/',
            'models/model.json'
        ]);
    });
});

describe('verifyGatedPackage', () => {
    it('weryfikuje poprawny pakiet', async () => {
        const gated = await inspectArchive(await buildValidPackage());
        const { manifest } = verifyGatedPackage(gated);
        expect(manifest.format).toBe('sok-ai-ml');
    });
    it('GO-1: ten sam stan logiczny = ten sam fingerprint niezależnie od ZIP-a', async () => {
        const manifestText = JSON.stringify({
            ...baseManifest(),
            packageFingerprint: computePackageFingerprint([
                { path: 'models/model.json', sha256: sha256Hex(MODEL_JSON) }
            ])
        });
        const checksums =
            `${sha256Hex(manifestText)}  manifest.json\n` +
            `${sha256Hex(MODEL_JSON)}  models/model.json\n`;
        // Różna kolejność wpisów i kompresja → różne bajty ZIP-a.
        const a = await buildZip(
            {
                'models/model.json': MODEL_JSON,
                'manifest.json': manifestText,
                'checksums.sha256': checksums
            },
            { compression: 'STORE' }
        );
        const b = await buildZip(
            {
                'checksums.sha256': checksums,
                'manifest.json': manifestText,
                'models/model.json': MODEL_JSON
            },
            { compression: 'DEFLATE' }
        );
        expect(a.equals(b)).toBe(false);
        const fpA = verifyGatedPackage(await inspectArchive(a)).manifest.packageFingerprint;
        const fpB = verifyGatedPackage(await inspectArchive(b)).manifest.packageFingerprint;
        expect(fpA).toBe(fpB);
    });
    it('naruszony model → CHECKSUM_MISMATCH', async () => {
        const buf = await buildValidPackage();
        const gated = await inspectArchive(buf);
        const entry = gated.get('models/model.json');
        if (!entry) throw new Error('brak wpisu');
        gated.set('models/model.json', {
            ...entry,
            data: Buffer.from('{"tampered":true}'),
            sha256: sha256Hex('{"tampered":true}')
        });
        expect(() => verifyGatedPackage(gated)).toThrow(
            expect.objectContaining({ code: 'CHECKSUM_MISMATCH' })
        );
    });
    it('fałszywy packageFingerprint → PACKAGE_FINGERPRINT_MISMATCH', async () => {
        // Manifest podpisany fałszywym fingerprintem, checksums spójne —
        // test izoluje wyłącznie bramkę kanonicznego fingerprintu.
        const buf = await buildValidPackage({}, 'sha256:' + 'f'.repeat(64));
        const gated = await inspectArchive(buf);
        expect(() => verifyGatedPackage(gated)).toThrow(
            expect.objectContaining({ code: 'PACKAGE_FINGERPRINT_MISMATCH' })
        );
    });
    it('brak manifestu → MANIFEST_MISSING', async () => {
        const buf = await buildZip({ 'models/model.json': MODEL_JSON });
        const gated = await inspectArchive(buf);
        expect(() => verifyGatedPackage(gated)).toThrow(
            expect.objectContaining({ code: 'MANIFEST_MISSING' })
        );
    });
});
