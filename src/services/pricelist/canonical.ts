/**
 * Kanoniczny JSON, stabilny SHA-256 i porównanie wierszy po `id`.
 *
 * Wydzielone z dawnego `priceOverrideService` (etap 2): te funkcje są czysto
 * obliczeniowe i nie dotykają żadnej tabeli, więc zostają po usunięciu LIVE.
 */
import { createHash } from 'crypto';

/** Kanoniczny stringify (rekurencyjne sortowanie kluczy) — stabilny SHA dla JSON. */
export function canonicalStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalStringify).join(',') + ']';
    }
    if (value !== null && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        return (
            '{' +
            Object.keys(obj)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]))
                .join(',') +
            '}'
        );
    }
    return JSON.stringify(value);
}

export function sha256Canonical(value: unknown): string {
    return createHash('sha256').update(canonicalStringify(value), 'utf-8').digest('hex');
}

export interface IdDiff {
    added: number;
    removed: number;
    changed: number;
}

export function diffById(
    current: Record<string, unknown>[],
    incoming: Record<string, unknown>[]
): IdDiff {
    const cur = new Map(current.map((r) => [String(r.id), r]));
    const inc = new Map(incoming.map((r) => [String(r.id), r]));
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const [id, row] of inc) {
        if (!cur.has(id)) {
            added++;
        } else if (canonicalStringify(cur.get(id)) !== canonicalStringify(row)) {
            changed++;
        }
    }
    for (const id of cur.keys()) {
        if (!inc.has(id)) removed++;
    }
    return { added, removed, changed };
}
