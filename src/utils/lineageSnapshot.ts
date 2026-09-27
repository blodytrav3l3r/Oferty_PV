import { serializeSnapshot, deserializeSnapshot, UnknownSnapshotVersionError } from './snapshots';
import { fingerprintDataset } from './datasetFingerprint';

/**
 * P5.2: snapshot lineage w kopercie v1 (src/utils/snapshots.ts).
 * Minimalny wielokrotny writer BEZ własnego storage — konsument decyduje
 * o zapisie (np. AiTrainingRun.datasetFingerprint, ml-status, telemetria).
 * Pola obowiązkowe: source, createdAt. Wersje modelu/samplera — gdzie
 * dotyczą (where applicable). Błędy nigdy ciche (throw, nie null).
 */

export interface LineageInput {
    /** Źródło snapshotu, np. 'training-run', 'ml-rank', 'telemetry'. */
    source: string;
    /** Dowolny payload domenowy (kopiowany przez JSON — brak mutacji źródła). */
    payload: unknown;
    /** SHA-256 datasetu (fingerprintDataset) — jeśli dotyczy. */
    datasetFingerprint?: string;
    /** Wersja modelu — jeśli dotyczy. */
    modelVersion?: string;
    /** Wersja solvera — jeśli dotyczy. */
    solverVersion?: string;
    /** Wersja reguł — jeśli dotyczy. */
    rulesVersion?: string;
    /** Wersja cech — jeśli dotyczy. */
    featureVersion?: string;
}

export interface LineageSnapshot {
    source: string;
    createdAt: string;
    datasetFingerprint: string | null;
    modelVersion: string | null;
    solverVersion: string | null;
    rulesVersion: string | null;
    featureVersion: string | null;
    payload: unknown;
}

/** Buduje kopertę v1 z lineage. Rzuca na brak source/payload. */
export function buildLineageSnapshot(input: LineageInput): string {
    if (!input || typeof input.source !== 'string' || input.source.length === 0) {
        throw new Error('Lineage wymaga niepustego source');
    }
    if (input.payload === undefined) {
        throw new Error('Lineage wymaga payload (null dozwolony, undefined nie)');
    }
    const snapshot: LineageSnapshot = {
        source: input.source,
        createdAt: new Date().toISOString(),
        datasetFingerprint: input.datasetFingerprint ?? null,
        modelVersion: input.modelVersion ?? null,
        solverVersion: input.solverVersion ?? null,
        rulesVersion: input.rulesVersion ?? null,
        featureVersion: input.featureVersion ?? null,
        payload: input.payload
    };
    return serializeSnapshot(snapshot);
}

/** Odczyt + walidacja obowiązkowych pól. Nieznana wersja/brak pól → throw. */
export function parseLineageSnapshot(raw: string): LineageSnapshot {
    let data: unknown;
    try {
        data = deserializeSnapshot<LineageSnapshot>(raw);
    } catch (e) {
        if (e instanceof UnknownSnapshotVersionError) throw e;
        throw new SyntaxError('Snapshot lineage nie jest poprawnym JSON');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Snapshot lineage ma nieprawidłowy kształt');
    }
    const s = data as Record<string, unknown>;
    if (typeof s.source !== 'string' || s.source.length === 0) {
        throw new Error('Snapshot lineage bez obowiązkowego source');
    }
    if (typeof s.createdAt !== 'string' || s.createdAt.length === 0) {
        throw new Error('Snapshot lineage bez obowiązkowego createdAt');
    }
    if (!('payload' in s)) {
        throw new Error('Snapshot lineage bez obowiązkowego payload');
    }
    return data as LineageSnapshot;
}

export { fingerprintDataset };
