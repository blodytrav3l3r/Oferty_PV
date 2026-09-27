/**
 * P1.5: wersjonowane snapshoty JSON przechowywane w kolumnach String.
 * Format: { "schemaVersion": 1, "data": {...} }.
 * - serializeSnapshot: zapis koperty v1 (adopcja writerów — P2, per plik).
 * - deserializeSnapshot: odczyt z kompatybilnością wsteczną — legacy JSON
 *   bez koperty przechodzi bez zmian; nieznana wersja to kontrolowany wyjątek.
 * Zasada: nigdy nie zgaduj kształtu po obecności pól (if property exists...).
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface VersionedSnapshot<T = unknown> {
    schemaVersion: number;
    data: T;
}

export function isVersionedSnapshot(value: unknown): value is VersionedSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const v = (value as Record<string, unknown>).schemaVersion;
    return typeof v === 'number' && 'data' in (value as Record<string, unknown>);
}

/** Zapis koperty v1. */
export function serializeSnapshot<T>(data: T): string {
    const envelope: VersionedSnapshot<T> = { schemaVersion: SNAPSHOT_SCHEMA_VERSION, data };
    return JSON.stringify(envelope);
}

export class UnknownSnapshotVersionError extends Error {
    constructor(readonly version: unknown) {
        super(`Nieznana wersja snapshotu: ${String(version)}`);
        this.name = 'UnknownSnapshotVersionError';
    }
}

/**
 * Odczyt: koperta v1 -> data; legacy JSON -> bez zmian; null/'' -> null.
 * Nie-JSON lub nieznana wersja -> wyjątek (kontrolowany, nie silent).
 */
export function deserializeSnapshot<T = unknown>(raw: string | null | undefined): T | null {
    if (raw === null || raw === undefined || raw === '') return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new SyntaxError('Snapshot nie jest poprawnym JSON');
    }
    if (isVersionedSnapshot(parsed)) {
        if (parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
            throw new UnknownSnapshotVersionError(parsed.schemaVersion);
        }
        return parsed.data as T;
    }
    return parsed as T;
}
