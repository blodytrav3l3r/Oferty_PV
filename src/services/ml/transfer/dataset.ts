import prisma from '../../../prismaClient';
import type { Prisma } from '../../../../generated/prisma';
import { ML_CONSTANTS } from '../../../config/mlConstants';
import { computeDatasetFingerprint } from '../TrainingPipeline';
import { SOKML_DATASET_SCHEMA_VERSION } from './transferConstants';
import { TransferError } from './transferErrors';

/**
 * P7.4 / P7.5 — Dataset FULL DATA (records.ndjson).
 *
 * Uczciwa semantyka: dokładny zbiór treningowy runu NIE jest odtwarzalny
 * z metadanych (sliding window, filtry, allowlista, resync) — eksport FULL
 * to snapshot AKTUALNIE kwalifikowalnych wierszy AiFeature (te same reguły
 * co pipeline: label != NO_FEEDBACK, okno TRAINING_BATCH_SIZE).
 * Fingerprint liczony TĄ SAMĄ funkcją co TrainingPipeline (reuse, nie kopia).
 */

export interface DatasetRow {
    id: string;
    telemetryId: string | null;
    dn: number;
    heightMm: number;
    warehouse: string;
    wellType: string;
    hasReduction: boolean;
    hasPsiaBuda: boolean;
    hasStyczna: boolean;
    ringCount: number;
    bottomType: string;
    topType: string;
    kinetaType: string | null;
    dennicaHeight: number | null;
    connectionCount: number;
    transitionsAboveDennica: number;
    totalPrice: number;
    totalWeight: number;
    ringVariety: number;
    season: string;
    label: string;
    reward: number;
    decisionMs: number | null;
    createdAt: string;
}

const ROW_FIELDS = [
    'id',
    'telemetryId',
    'dn',
    'heightMm',
    'warehouse',
    'wellType',
    'hasReduction',
    'hasPsiaBuda',
    'hasStyczna',
    'ringCount',
    'bottomType',
    'topType',
    'kinetaType',
    'dennicaHeight',
    'connectionCount',
    'transitionsAboveDennica',
    'totalPrice',
    'totalWeight',
    'ringVariety',
    'season',
    'label',
    'reward',
    'decisionMs',
    'createdAt'
] as const;

/** Snapshot kwalifikowalnych wierszy (jak okno treningowe pipeline). */
export async function fetchEligibleDatasetRows(): Promise<DatasetRow[]> {
    const rows = await prisma.aiFeature.findMany({
        where: { label: { not: 'NO_FEEDBACK' } },
        orderBy: { createdAt: 'desc' },
        take: ML_CONSTANTS.TRAINING_BATCH_SIZE
    });
    return rows as DatasetRow[];
}

export function datasetFingerprintOf(
    rows: Array<{ id: string; createdAt: string; label: string }>,
    featureVersion: string = ML_CONSTANTS.FEATURE_VERSION
): string {
    return computeDatasetFingerprint(
        rows.map((r) => ({ id: r.id, timestamp: r.createdAt, label: r.label })),
        featureVersion
    );
}

export function serializeRecordsNdjson(rows: DatasetRow[]): string {
    return rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
}

function isDatasetRow(v: unknown): v is DatasetRow {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o.id === 'string' &&
        typeof o.label === 'string' &&
        typeof o.createdAt === 'string' &&
        (o.telemetryId === null || typeof o.telemetryId === 'string')
    );
}

export function parseRecordsNdjson(text: string): DatasetRow[] {
    const rows: DatasetRow[] = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            throw new TransferError('DATASET_INVALID', 'Uszkodzona linia records.ndjson');
        }
        if (!isDatasetRow(parsed)) {
            throw new TransferError('DATASET_INVALID', 'Nieprawidłowy rekord datasetu');
        }
        const row = {} as DatasetRow;
        const src = parsed as unknown as Record<string, unknown>;
        for (const f of ROW_FIELDS) (row as unknown as Record<string, unknown>)[f] = src[f];
        rows.push(row);
    }
    return rows;
}

export interface DatasetManifest {
    fingerprint: string;
    fingerprintAlgorithm: 'SHA-256';
    fingerprintVersion: 1;
    datasetSchemaVersion: string;
    recordCount: number;
    mode: 'full';
}

export function buildDatasetManifest(rows: DatasetRow[]): DatasetManifest {
    return {
        fingerprint: datasetFingerprintOf(rows),
        fingerprintAlgorithm: 'SHA-256',
        fingerprintVersion: 1,
        datasetSchemaVersion: SOKML_DATASET_SCHEMA_VERSION,
        recordCount: rows.length,
        mode: 'full'
    };
}

/**
 * Weryfikacja integralności FULL DATA: fingerprint z rekordów vs manifest.
 * Konflikt = BLOCKED (tabela compat: DATASET_FINGERPRINT_CONFLICT).
 */
export function verifyDatasetIntegrity(
    rows: DatasetRow[],
    expectedFingerprint: string,
    featureVersion: string
): void {
    if (datasetFingerprintOf(rows, featureVersion) !== expectedFingerprint) {
        throw new TransferError('DATASET_INVALID', 'Fingerprint rekordów niezgodny z manifestem');
    }
}

export interface DatasetImportResult {
    inserted: number;
    skipped: number;
}

/**
 * Import wierszy: istniejące id pomijane (idempotencja na poziomie rekordu).
 * `db` pozwala wpiąć zapis w transakcję importu (atomowość, brak częściowych danych).
 */
export async function importDatasetRows(
    rows: DatasetRow[],
    db: Prisma.TransactionClient = prisma
): Promise<DatasetImportResult> {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    const existing = await db.aiFeature.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true }
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const fresh = rows.filter((r) => !existingIds.has(r.id));
    if (fresh.length > 0) {
        // Bez skipDuplicates (SQLite): istniejące odfiltrowane wyżej.
        await db.aiFeature.createMany({ data: fresh });
    }
    return { inserted: fresh.length, skipped: rows.length - fresh.length };
}
