import crypto from 'crypto';
import { SOKML_LIMITS } from './transferConstants';
import type { CompatReport } from './compatibility';
import type { SokmlManifest } from './manifest';

/**
 * P7.7 — magazyn dry-run (GO-2).
 *
 * dryRunId wiąże packageFingerprint + manifestFingerprint. Import weryfikuje
 * zgodność przed zapisem — dry-run dla zmienionego pakietu nie przejdzie.
 * Monolit jednodprocesowy: mapa w pamięci z TTL (jak predictionCache).
 */
export interface DryRunRecord {
    id: string;
    packageFingerprint: string;
    manifestFingerprint: string;
    manifest: SokmlManifest;
    report: CompatReport;
    // P1-S: binding dry-run ↔ użytkownik. Import sprawdza zgodność userId.
    userId: string;
    createdAt: number;
}

const store = new Map<string, DryRunRecord>();

function fingerprintOfManifest(manifestBytes: Buffer): string {
    return 'sha256:' + crypto.createHash('sha256').update(manifestBytes).digest('hex');
}

function purgeExpired(now: number): void {
    for (const [id, rec] of store) {
        if (now - rec.createdAt > SOKML_LIMITS.dryRunTtlMs) store.delete(id);
    }
}

export function createDryRun(
    packageFingerprint: string,
    manifestBytes: Buffer,
    manifest: SokmlManifest,
    report: CompatReport,
    userId: string
): DryRunRecord {
    purgeExpired(Date.now());
    const rec: DryRunRecord = {
        id: 'dry_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        packageFingerprint,
        manifestFingerprint: fingerprintOfManifest(manifestBytes),
        manifest,
        report,
        userId,
        createdAt: Date.now()
    };
    store.set(rec.id, rec);
    return rec;
}

/** Zwraca rekord albo null (brak / wygasł — wygasłe sprzątane). */
export function getDryRun(id: string): DryRunRecord | null {
    const rec = store.get(id);
    if (!rec) return null;
    if (Date.now() - rec.createdAt > SOKML_LIMITS.dryRunTtlMs) {
        store.delete(id);
        return null;
    }
    return rec;
}

/** Tylko do testów. */
export function clearDryRuns(): void {
    store.clear();
}
