import crypto from 'crypto';
import prisma from '../../../prismaClient';
import { AcceptanceModel } from '../AcceptanceModel';
import { AiModelState } from '../aiModelState';
import { TransferError } from './transferErrors';
import { inspectArchive } from './archiveGate';
import { verifyGatedPackage, sha256Hex, type SokmlManifest } from './manifest';
import { checkCompatibility, type CompatReport, type ModelArtifactShape } from './compatibility';
import { resolveCurrentImportTarget } from './targetResolver';
import { getDryRun } from './dryRunStore';
import {
    parseRecordsNdjson,
    verifyDatasetIntegrity,
    importDatasetRows,
    type DatasetRow
} from './dataset';
import { parsePatternsFile, importPatterns, type KnowledgePattern } from './knowledge';
import { logAudit } from '../../auditService';

/**
 * P7.3 — Import modelu (GO-2: binding z dry-run, idempotencja, zawsze CANDIDATE).
 *
 * Przepływ: dryRunId → brama archiwum → manifest/checksumy → binding dry-run →
 * ALREADY_IMPORTED? → re-compat (TOCTOU) → walidacje IMPORT/LINEAGE/MODEL →
 * zapis CANDIDATE (active=false) → AiTransfer + audit.
 */

export interface ImportResult {
    status: 'IMPORTED' | 'ALREADY_IMPORTED';
    modelId: string;
    version: string;
    transferId: string;
    report: CompatReport;
}

function newTransferId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `trf_${date}_${crypto.randomBytes(3).toString('hex')}`;
}

function parseModelArtifact(
    text: string
): ModelArtifactShape & { metricsJson: string; bias: number } {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new TransferError('MODEL_INVALID', 'Artefakt modelu nie jest JSON');
    }
    const obj = json as Record<string, unknown>;
    const numArray = (v: unknown): number[] | null =>
        Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n))
            ? (v as number[])
            : null;
    const features =
        Array.isArray(obj.features) && obj.features.every((f) => typeof f === 'string')
            ? (obj.features as string[])
            : null;
    const weights = numArray(obj.weights);
    const mins = numArray(obj.featureMins);
    const maxs = numArray(obj.featureMaxs);
    if (
        !features ||
        !weights ||
        !mins ||
        !maxs ||
        typeof obj.bias !== 'number' ||
        !Number.isFinite(obj.bias)
    ) {
        throw new TransferError('MODEL_INVALID', 'Nieprawidłowa struktura artefaktu modelu');
    }
    if (weights.length !== features.length) {
        throw new TransferError('MODEL_INVALID', 'Niespójne wymiary artefaktu modelu');
    }
    return {
        features,
        weights,
        featureMins: mins,
        featureMaxs: maxs,
        metricsJson: JSON.stringify(obj.metrics ?? {}),
        bias: obj.bias
    };
}

/** MODEL VALIDATION: deterministyczny smoke-test predykcji (exact equality). */
function smokeTestModel(shape: ModelArtifactShape & { bias: number }): void {
    const model = new AcceptanceModel(shape.features.length, shape.weights, shape.bias);
    const probe = shape.featureMins.map((min, i) => (min + shape.featureMaxs[i]) / 2);
    const first = model.predict(probe);
    const second = model.predict(probe);
    if (!Number.isFinite(first) || first !== second) {
        throw new TransferError('MODEL_INVALID', 'Smoke-test predykcji nie przeszedł');
    }
}

function resolveModelArtifactPath(manifest: SokmlManifest): string {
    const modelPaths = manifest.artifacts.map((a) => a.path).filter((p) => p.startsWith('models/'));
    if (modelPaths.length === 0) {
        throw new TransferError('MODEL_INVALID', 'Pakiet nie zawiera modelu');
    }
    return modelPaths[0];
}

export async function importPackage(
    buffer: Buffer,
    dryRunId: string,
    userId: string
): Promise<ImportResult> {
    const dryRun = getDryRun(dryRunId);
    if (!dryRun) {
        throw new TransferError('DRY_RUN_NOT_FOUND', 'Brak ważnego dry-run dla importu');
    }
    // P1-S: binding dry-run ↔ użytkownik. Cudzy dryRunId nie importuje.
    if (dryRun.userId !== userId) {
        throw new TransferError('DRY_RUN_USER_MISMATCH', 'Dry-run należy do innego użytkownika');
    }
    const gated = await inspectArchive(buffer);
    const { manifest, files } = verifyGatedPackage(gated);

    // GO-2: binding dry-run ↔ pakiet.
    if (manifest.packageFingerprint !== dryRun.packageFingerprint) {
        throw new TransferError('DRY_RUN_PACKAGE_MISMATCH', 'Dry-run dotyczy innego pakietu');
    }
    const manifestBytes = files.get('manifest.json');
    if (!manifestBytes || 'sha256:' + sha256Hex(manifestBytes) !== dryRun.manifestFingerprint) {
        throw new TransferError('DRY_RUN_PACKAGE_MISMATCH', 'Manifest zmieniony po dry-run');
    }
    if (dryRun.report.status === 'blocked') {
        throw new TransferError('DRY_RUN_NOT_PASSED', 'Dry-run zablokowany — import niemożliwy');
    }

    // Idempotencja: ten sam pakiet już zaimportowany → ALREADY_IMPORTED.
    const prior = await prisma.aiTransfer.findFirst({
        where: {
            packageFingerprint: manifest.packageFingerprint,
            direction: 'IMPORT',
            status: 'COMPLETED'
        }
    });
    if (prior) {
        return {
            status: 'ALREADY_IMPORTED',
            modelId: prior.modelVersion ?? '',
            version: prior.modelVersion ?? '',
            transferId: prior.transferId,
            report: dryRun.report
        };
    }
    // Wersja istnieje, ale pakiet jest nowy (inny fingerprint): kolizja wersji,
    // nie duplikat transferu. Fałszywe ALREADY_IMPORTED ukrywałoby problem —
    // jawny konflikt 409 z identyfikatorem istniejącego modelu.
    const existingModel = await prisma.aiModel.findFirst({
        where: { version: manifest.model.version }
    });
    if (existingModel) {
        throw new TransferError(
            'MODEL_DUPLICATE',
            `Wersja ${manifest.model.version} już istnieje (model ${existingModel.id})`
        );
    }

    if (manifest.dataset.mode === 'full' && !files.has('datasets/records.ndjson')) {
        throw new TransferError('DATASET_INVALID', 'Tryb full bez records.ndjson');
    }
    const modelPath = resolveModelArtifactPath(manifest);
    const modelText = files.get(modelPath)?.toString('utf8');
    if (!modelText) throw new TransferError('MODEL_INVALID', 'Brak treści artefaktu modelu');
    const shape = parseModelArtifact(modelText);

    // Re-compat (TOCTOU: cel mógł się zmienić między dry-run a importem).
    // Ten sam resolver co dry-run — import widzi AKTUALNY baseline celu.
    const target = await resolveCurrentImportTarget();
    const report = checkCompatibility(manifest, shape, target);
    if (report.status === 'blocked') {
        throw new TransferError('DRY_RUN_NOT_PASSED', 'Kompatybilność zmieniona — powtórz dry-run');
    }
    // LINEAGE + MODEL VALIDATION.
    if (!manifest.lineage.sourceSokVersion || !manifest.model.featureVersion) {
        throw new TransferError('MODEL_INVALID', 'Niekompletne lineage pakietu');
    }
    smokeTestModel(shape);

    // P7.5 Extended: parsowanie + weryfikacja integralności POZA transakcją
    // (czyste funkcje); zapisy do DB w jednej transakcji (atomowość).
    const extendedSummary: Record<string, number> = {};
    let datasetRows: DatasetRow[] | null = null;
    const recordsText = files.get('datasets/records.ndjson')?.toString('utf8');
    if (recordsText !== undefined) {
        datasetRows = parseRecordsNdjson(recordsText);
        verifyDatasetIntegrity(
            datasetRows,
            manifest.dataset.fingerprint ?? '',
            manifest.model.featureVersion
        );
    }
    let kbPatterns: KnowledgePattern[] | null = null;
    const patternsText = files.get('knowledge/patterns.json')?.toString('utf8');
    if (patternsText !== undefined) {
        kbPatterns = parsePatternsFile(patternsText);
    }
    const telemetryText = files.get('telemetry/selected.json')?.toString('utf8');
    if (telemetryText !== undefined) {
        // Informacyjnie: weryfikacja kształtu, zero zapisów do DB.
        let groups = -1;
        try {
            const tel = JSON.parse(telemetryText) as { byDaySource?: unknown };
            groups = Array.isArray(tel.byDaySource) ? tel.byDaySource.length : -1;
        } catch {
            groups = -1;
        }
        if (groups < 0)
            throw new TransferError('DATASET_INVALID', 'Nieprawidłowe telemetry/selected.json');
        extendedSummary.telemetryGroups = groups;
    }

    // Zapis: ZAWSZE CANDIDATE, active=false. PRODUCTION tylko przez APPROVE+PROMOTE.
    // Jedna transakcja: model + dataset + wiedza + rekord transferu + audit —
    // awaria w środku wycofuje wszystko (brak częściowych importów).
    const transferId = newTransferId();
    const now = new Date().toISOString();
    let trainingRows = 0;
    try {
        const metrics = JSON.parse(shape.metricsJson) as { trainSize?: unknown };
        if (typeof metrics.trainSize === 'number' && Number.isInteger(metrics.trainSize)) {
            trainingRows = metrics.trainSize;
        }
    } catch {
        trainingRows = 0;
    }
    const modelFp = manifest.artifacts.find((a) => a.path === modelPath)?.sha256 ?? '';
    const created = await prisma.$transaction(async (tx) => {
        const model = await tx.aiModel.create({
            data: {
                id: crypto.randomUUID(),
                version: manifest.model.version,
                weights: JSON.stringify(shape.weights),
                bias: shape.bias,
                metrics: shape.metricsJson,
                features: JSON.stringify(shape.features),
                featureMins: JSON.stringify(shape.featureMins),
                featureMaxs: JSON.stringify(shape.featureMaxs),
                trainingRows,
                featureVersion: manifest.model.featureVersion,
                state: AiModelState.CANDIDATE,
                seed: null,
                featureDistributions: null,
                active: false,
                notes: `Import transfer ${transferId} (${manifest.transferPackageId})`,
                createdAt: now
            }
        });
        if (datasetRows) {
            const ds = await importDatasetRows(datasetRows, tx);
            extendedSummary.datasetInserted = ds.inserted;
            extendedSummary.datasetSkipped = ds.skipped;
        }
        if (kbPatterns) {
            const kb = await importPatterns(kbPatterns, tx);
            extendedSummary.knowledgeInserted = kb.inserted;
            extendedSummary.knowledgeSkipped = kb.skipped;
        }
        await tx.aiTransfer.create({
            data: {
                id: crypto.randomUUID(),
                transferId,
                direction: 'IMPORT',
                packageFingerprint: manifest.packageFingerprint,
                manifestFingerprint: dryRun.manifestFingerprint,
                modelVersion: model.version,
                modelFingerprint: 'sha256:' + modelFp,
                datasetFingerprint: manifest.lineage.datasetFingerprint,
                sourceSokVersion: manifest.sourceSokVersion,
                targetSokVersion: target.sokVersion,
                status: 'COMPLETED',
                result: 'CANDIDATE',
                userId,
                createdAt: now
            }
        });
        await logAudit(
            'ai_transfer',
            transferId,
            userId,
            'TRANSFER_IMPORT_COMPLETED',
            {
                packageFingerprint: manifest.packageFingerprint,
                modelVersion: model.version,
                sourceSokVersion: manifest.sourceSokVersion,
                targetSokVersion: target.sokVersion,
                result: 'CANDIDATE',
                ...extendedSummary
            },
            null,
            tx
        );
        return model;
    });
    return {
        status: 'IMPORTED',
        modelId: created.id,
        version: created.version,
        transferId,
        report
    };
}
