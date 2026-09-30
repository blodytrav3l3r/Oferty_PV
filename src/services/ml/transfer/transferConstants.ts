import { ML_CONSTANTS } from '../../../config/mlConstants';

/**
 * P7 — stałe kontraktu .sokml (SSoT).
 *
 * Limity konfigurowalne przez ENV (bez magicznych liczb w kodzie).
 * Odczyt przy imporcie modułu — zmiana ENV wymaga restartu procesu.
 */

// Format pakietu
export const SOKML_FORMAT = 'sok-ai-ml';
export const SOKML_FORMAT_VERSION = 1;
export const SOKML_MANIFEST_VERSION = 1;

// Wersje poszczególnych schematów (osobne kontrakty — rozdz. 3 planu P7).
export const SOKML_AI_SCHEMA_VERSION = '1';
export const SOKML_MODEL_SCHEMA_VERSION = '1'; // AcceptanceModel: regresja logistyczna
export const SOKML_LINEAGE_SCHEMA_VERSION = '1'; // koperta lineageSnapshot v1
export const SOKML_FEATURE_SCHEMA_VERSION = ML_CONSTANTS.FEATURE_VERSION;
export const SOKML_DATASET_SCHEMA_VERSION = '1';

function envInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface SokmlLimits {
    maxUploadBytes: number;
    maxUnpackedBytes: number;
    maxFiles: number;
    maxArtifactBytes: number;
    maxCompressionRatio: number;
    dryRunTtlMs: number;
}

export const SOKML_LIMITS: SokmlLimits = {
    maxUploadBytes: envInt('MAX_SOKML_UPLOAD_BYTES', 25 * 1024 * 1024),
    maxUnpackedBytes: envInt('MAX_SOKML_UNPACKED_BYTES', 100 * 1024 * 1024),
    maxFiles: envInt('MAX_SOKML_FILES', 100),
    maxArtifactBytes: envInt('MAX_SOKML_ARTIFACT_BYTES', 50 * 1024 * 1024),
    maxCompressionRatio: envInt('MAX_SOKML_COMPRESSION_RATIO', 100),
    dryRunTtlMs: envInt('SOKML_DRY_RUN_TTL_MS', 15 * 60 * 1000)
};

// P7 Core: tylko artefakty modelu/datasetu/treningu/lineage.
// Knowledge i telemetria = P7.5 Extended (poza allowlistą do czasu decyzji).
const SOKML_ALLOWED_EXACT = new Set([
    'manifest.json',
    'checksums.sha256',
    'datasets/manifest.json',
    'datasets/records.ndjson',
    'training/runs.json',
    'lineage/snapshots.json',
    // P7.5 Extended (opt-in): wiedza i wybrane agregaty telemetryczne.
    'knowledge/patterns.json',
    'telemetry/selected.json'
]);

/** Sprawdza, czy ścieżka artefaktu jest na allowliście P7 Core. */
export function isAllowedArtifactPath(path: string): boolean {
    if (SOKML_ALLOWED_EXACT.has(path)) return true;
    // Modele: models/<nazwa>.json, bez podkatalogów.
    if (!path.startsWith('models/')) return false;
    const rest = path.slice('models/'.length);
    return rest.length > 5 && rest.endsWith('.json') && !rest.includes('/');
}
