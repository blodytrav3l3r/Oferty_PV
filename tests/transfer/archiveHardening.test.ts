/**
 * P7.0 hardening — regresja audytu zewnętrznego (bez jszip, ręczne ZIP-y):
 * symlink gate, limity pre-dekompresji, exact-set manifest↔ZIP, GO-1 LF.
 */
import { describe, expect, it } from '@jest/globals';
import { inspectArchive } from '../../src/services/ml/transfer/archiveGate';
import { canonicalArtifactList, verifyGatedPackage } from '../../src/services/ml/transfer/manifest';
import { SOKML_LIMITS } from '../../src/services/ml/transfer/transferConstants';
import { TransferError } from '../../src/services/ml/transfer/transferErrors';

interface RawEntry {
    name: string;
    data: Buffer;
    attrs?: number;
    declaredUncomp?: number;
}

/** Minimalny ZIP (stored) z pełną kontrolą pól CD — do testów bramy pre-parse. */
function buildRawZip(entries: RawEntry[]): Buffer {
    const chunks: Buffer[] = [];
    const cd: Buffer[] = [];
    let offset = 0;
    for (const e of entries) {
        const nameBuf = Buffer.from(e.name, 'utf8');
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(e.data.length, 18);
        lh.writeUInt16LE(e.data.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        chunks.push(lh, nameBuf, e.data);
        const cdEntry = Buffer.alloc(46);
        cdEntry.writeUInt32LE(0x02014b50, 0);
        cdEntry.writeUInt32LE(e.data.length, 20);
        cdEntry.writeUInt32LE(e.declaredUncomp ?? e.data.length, 24);
        cdEntry.writeUInt16LE(nameBuf.length, 28);
        cdEntry.writeUInt32LE(e.attrs ?? 0, 38);
        cd.push(cdEntry, nameBuf);
        offset += lh.length + nameBuf.length + e.data.length;
    }
    const cdStart = offset;
    const cdBuf = Buffer.concat(cd);
    chunks.push(cdBuf);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(cdStart, 16);
    chunks.push(eocd);
    return Buffer.concat(chunks);
}

const S_IFLNK_ATTRS = 0xa0000000;

async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
        await p;
    } catch (e) {
        return (e as TransferError).code;
    }
    throw new Error('no-throw');
}

describe('archive hardening (audyt zewnętrzny)', () => {
    it('GO-1: kanonika to linie zakończone LF (łącznie z ostatnią)', () => {
        expect(
            canonicalArtifactList([
                { path: 'b.json', sha256: 'b'.repeat(64) },
                { path: 'a.json', sha256: 'a'.repeat(64) }
            ])
        ).toBe(`a.json:${'a'.repeat(64)}\nb.json:${'b'.repeat(64)}\n`);
    });

    it('symlink w CD → SYMLINK_ENTRY przed parsowaniem treści', async () => {
        const buf = buildRawZip([
            { name: 'models/link.json', data: Buffer.from('target'), attrs: S_IFLNK_ATTRS }
        ]);
        await expect(inspectArchive(buf)).rejects.toMatchObject({ code: 'SYMLINK_ENTRY' });
    });

    it('deklarowany rozmiar > limit artefaktu → ARTIFACT_TOO_LARGE bez dekompresji', async () => {
        const buf = buildRawZip([
            {
                name: 'models/big.json',
                data: Buffer.from('tiny'),
                declaredUncomp: 200 * 1024 * 1024
            }
        ]);
        await expect(inspectArchive(buf)).rejects.toMatchObject({ code: 'ARTIFACT_TOO_LARGE' });
    });

    it('podejrzany stopień kompresji z metadanych → COMPRESSION_RATIO_EXCEEDED', async () => {
        const buf = buildRawZip([
            { name: 'models/a.json', data: Buffer.alloc(100, 7), declaredUncomp: 100000 }
        ]);
        const limits = {
            ...SOKML_LIMITS,
            maxArtifactBytes: 1024 * 1024 * 1024,
            maxUnpackedBytes: 1024 * 1024 * 1024,
            maxCompressionRatio: 10
        };
        await expect(inspectArchive(buf, limits)).rejects.toMatchObject({
            code: 'COMPRESSION_RATIO_EXCEEDED'
        });
        expect(await codeOf(inspectArchive(buf, limits))).toBe('COMPRESSION_RATIO_EXCEEDED');
    });

    async function buildPkg(
        manifest: Record<string, unknown>,
        files: Record<string, string>
    ): Promise<Buffer> {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (const [p, text] of Object.entries(files)) zip.file(p, text);
        zip.file('manifest.json', JSON.stringify(manifest));
        return zip.generateAsync({ type: 'nodebuffer' });
    }

    function baseManifestFields(
        artifacts: Array<{ path: string; sha256: string }>,
        packageFingerprint: string
    ): Record<string, unknown> {
        return {
            format: 'sok-ai-ml',
            formatVersion: 1,
            manifestVersion: 1,
            aiSchemaVersion: '1',
            featureSchemaVersion: 'v7',
            lineageSchemaVersion: '1',
            modelSchemaVersion: '1',
            transferPackageId: 'pkg_dup',
            packageFingerprint,
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
            artifacts
        };
    }

    it('zduplikowane wpisy w manifest.artifacts → CHECKSUM_MISMATCH', async () => {
        const modelText = '{"a":1}';
        const { sha256Hex, computePackageFingerprint } =
            await import('../../src/services/ml/transfer/manifest');
        const modelSha = sha256Hex(modelText);
        const artifacts = [
            { path: 'models/m.json', sha256: modelSha },
            { path: 'models/m.json', sha256: modelSha }
        ];
        const manifest = baseManifestFields(artifacts, computePackageFingerprint(artifacts));
        const manifestText = JSON.stringify(manifest);
        const buf = await buildPkg(manifest, {
            'models/m.json': modelText,
            'checksums.sha256': `${modelSha}  models/m.json\n${sha256Hex(manifestText)}  manifest.json\n`
        });
        const gated = await inspectArchive(buf);
        expect(() => verifyGatedPackage(gated)).toThrow(
            expect.objectContaining({ code: 'CHECKSUM_MISMATCH' })
        );
    });

    it('zduplikowane linie w checksums.sha256 → CHECKSUM_MISMATCH', async () => {
        const modelText = '{"a":1}';
        const { sha256Hex, computePackageFingerprint } =
            await import('../../src/services/ml/transfer/manifest');
        const modelSha = sha256Hex(modelText);
        const artifacts = [{ path: 'models/m.json', sha256: modelSha }];
        const manifest = baseManifestFields(artifacts, computePackageFingerprint(artifacts));
        const manifestText = JSON.stringify(manifest);
        const buf = await buildPkg(manifest, {
            'models/m.json': modelText,
            'checksums.sha256':
                `${modelSha}  models/m.json\n${modelSha}  models/m.json\n` +
                `${sha256Hex(manifestText)}  manifest.json\n`
        });
        const gated = await inspectArchive(buf);
        expect(() => verifyGatedPackage(gated)).toThrow(
            expect.objectContaining({ code: 'CHECKSUM_MISMATCH' })
        );
    });
});
