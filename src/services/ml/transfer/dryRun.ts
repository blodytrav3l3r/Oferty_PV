import { TransferError } from './transferErrors';
import { inspectArchive } from './archiveGate';
import { verifyGatedPackage } from './manifest';
import { checkCompatibility, type CompatReport } from './compatibility';
import { createDryRun, type DryRunRecord } from './dryRunStore';
import { parseModelArtifact } from './importModel';
import { resolveCurrentImportTarget } from './targetResolver';
import { logAudit } from '../../auditService';

/**
 * P7.7 — Dry-run (first-class, bez zapisu do DB).
 *
 * UPLOAD → brama → manifest → compat → dryRunId. Import wymaga świeżego,
 * pozytywnego dry-run dla DOKŁADNIE tego pakietu (GO-2).
 */

export interface DryRunPreview {
    packageFingerprint: string;
    sourceSokVersion: string;
    modelVersion: string;
    modelState: string;
    featureVersion: string;
    datasetMode: string;
    datasetFingerprint: string | null;
    datasetRecords: number | null;
    knowledgePatterns: number | null;
    telemetryGroups: number | null;
    artifacts: number;
}

export interface DryRunResult {
    record: DryRunRecord;
    preview: DryRunPreview;
}

export async function runDryRun(buffer: Buffer, userId: string): Promise<DryRunResult> {
    const gated = await inspectArchive(buffer);
    const { manifest, files } = verifyGatedPackage(gated);

    const modelPath = manifest.artifacts.map((a) => a.path).find((p) => p.startsWith('models/'));
    if (!modelPath) throw new TransferError('MODEL_INVALID', 'Pakiet nie zawiera modelu');
    // P1.2+: SSoT walidacji z importModel (pełna struktura + finite, nie ślepy cast).
    const shape = parseModelArtifact(files.get(modelPath)?.toString('utf8') ?? '');

    const target = await resolveCurrentImportTarget();
    const report: CompatReport = checkCompatibility(manifest, shape, target);
    const manifestBytes = files.get('manifest.json');
    if (!manifestBytes) throw new TransferError('MANIFEST_MISSING', 'Brak manifest.json');
    const record = createDryRun(
        manifest.packageFingerprint,
        manifestBytes,
        manifest,
        report,
        userId
    );

    await logAudit('ai_transfer', record.id, userId, 'TRANSFER_DRY_RUN', {
        packageFingerprint: manifest.packageFingerprint,
        modelVersion: manifest.model.version,
        sourceSokVersion: manifest.sourceSokVersion,
        result: report.status
    });
    return {
        record,
        preview: {
            packageFingerprint: manifest.packageFingerprint,
            sourceSokVersion: manifest.sourceSokVersion,
            modelVersion: manifest.model.version,
            modelState: manifest.model.state,
            featureVersion: manifest.model.featureVersion,
            datasetMode: manifest.dataset.mode,
            datasetFingerprint: manifest.dataset.fingerprint,
            datasetRecords: countExtended(files.get('datasets/records.ndjson'), countLines),
            knowledgePatterns: countExtended(files.get('knowledge/patterns.json'), countArray),
            telemetryGroups: countExtended(files.get('telemetry/selected.json'), countGroups),
            artifacts: manifest.artifacts.length
        }
    };
}

function countExtended(
    bytes: Buffer | undefined,
    counter: (text: string) => number | null
): number | null {
    if (!bytes) return null;
    try {
        return counter(bytes.toString('utf8'));
    } catch {
        return null;
    }
}

function countLines(text: string): number | null {
    const n = text.split('\n').filter((l) => l.trim()).length;
    return n;
}

function countArray(text: string): number | null {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.length : null;
}

function countGroups(text: string): number | null {
    const parsed = JSON.parse(text) as { byDaySource?: unknown };
    return Array.isArray(parsed.byDaySource) ? parsed.byDaySource.length : null;
}
