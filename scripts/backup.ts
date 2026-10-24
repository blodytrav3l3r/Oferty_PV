import { PrismaClient } from '../generated/prisma';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDataDir } from '../src/utils/paths';

/**
 * Kontrakt ścieżki backupu: zawsze `<root>/data/backups`, niezależnie od tego,
 * czy kod działa z `scripts/` (ts-node), czy z `dist/scripts/` (tsc prod).
 * Poprzednie `path.resolve(__dirname, '../data/backups')` po kompilacji
 * wskazywało `dist/data/backups` (cicha rozbieżność z planRollback/restore).
 */
export function getBackupDir(): string {
    return path.join(resolveDataDir(), 'backups');
}

const backupDir = getBackupDir();

/**
 * Limit kopii w `data/backups`. Kopia ~1.4 GB (baza rośnie), więc 30 kopii
 * zajmowało ~37 GB. 1 kopia = brak historii: odtwarzanie wyłącznie z ostatniego
 * stanu. Świadoma decyzja właściciela (2026-10-24) — baza ma być kopiowana
 * sposobem zewnętrznym, lokalnie trzymamy jedną kopię.
 */
export const MAX_BACKUPS = 1;

/** Marker świeżości ostatniego udanego backupu (nie jest kopią, retencja go nie liczy). */
export const BACKUP_MARKER_FILE = '.last-backup.json';

export interface BackupMarker {
    at: string;
    file: string;
    size: number;
    sha256: string;
    verification: BackupVerification;
}

/**
 * Próg świeżości: doba + 2 h zapasu. Backup w aplikacji startuje od startu
 * procesu, więc dryfuje przy restartach — samo 24 h dawałoby fałszywe alarmy.
 */
export const MAX_BACKUP_AGE_MS = 26 * 60 * 60 * 1000;

/**
 * Czy ostatni backup jest przestarzały? Brak markera, brak daty i data
 * nieparsowalna znaczą to samo: nie wiemy, czy kopia jest aktualna → `true`.
 */
export function isBackupStale(marker: BackupMarker | null, now: number): boolean {
    if (!marker || typeof marker.at !== 'string') return true;
    const at = Date.parse(marker.at);
    if (!Number.isFinite(at)) return true;
    return now - at >= MAX_BACKUP_AGE_MS;
}

export function getBackupMarkerPath(dir: string = backupDir): string {
    return path.join(dir, BACKUP_MARKER_FILE);
}

/** Odczyt markera; uszkodzony/brakujący plik → `null` (nie rzuca). */
export function readBackupMarker(dir: string = backupDir): BackupMarker | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(getBackupMarkerPath(dir), 'utf8'));
        if (!parsed || typeof (parsed as BackupMarker).at !== 'string') return null;
        return parsed as BackupMarker;
    } catch {
        return null;
    }
}

/**
 * P0.6: czysta selekcja retencji — liczy WYŁĄCZNIE pliki .sqlite
 * (sidecary .sha256 nie są kopiami). Zwraca nazwy do usunięcia
 * (najstarsze), posortowane od najstarszej.
 */
export function selectBackupsForRetention(
    files: Array<{ name: string; mtimeMs: number }>,
    maxBackups: number = MAX_BACKUPS
): string[] {
    const backups = files
        .filter((f) => f.name.startsWith('backup_') && f.name.endsWith('.sqlite'))
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map((x) => x.name);
    return backups.slice(0, Math.max(0, backups.length - maxBackups));
}

/** Sidecary .sha256 bez pary .sqlite (sieroty do posprzątania). */
export function findOrphanSidecars(files: string[]): string[] {
    const set = new Set(files);
    return files.filter(
        (f) =>
            f.startsWith('backup_') &&
            f.endsWith('.sha256') &&
            !set.has(f.slice(0, -'.sha256'.length))
    );
}

/**
 * Status weryfikacji świeżego backupu.
 * - `ok`         — integralność potwierdzona (`PRAGMA integrity_check` = ok)
 * - `corrupt`    — baza nie przechodzi integrity_check (plik uszkodzony)
 * - `unverified` — nie dało się sprawdzić (brak node:sqlite, plik zablokowany)
 */
export type BackupVerification = 'ok' | 'corrupt' | 'unverified';

/** Błąd integralności → plik uszkodzony; pozostałe błędy → brak możliwości weryfikacji. */
export function classifyVerification(message: string): BackupVerification {
    return message.includes('integrity_check') ? 'corrupt' : 'unverified';
}

/**
 * Retencja (kasowanie starych kopii) TYLKO dla zweryfikowanego backupu.
 * Bez weryfikacji stare kopie zostają — nigdy nie zamieniamy działającej
 * historii na plik, którego integralności nie da się potwierdzić.
 */
export function canPruneOldBackups(verification: BackupVerification): boolean {
    return verification === 'ok';
}

/**
 * Plan czyszczenia katalogu backupów. `toDelete` jest puste, gdy nowy backup
 * nie przeszedł weryfikacji — stare kopie zostają. Sieroce sidecary (`.sha256`
 * bez pary `.sqlite`) są bezużyteczne niezależnie od weryfikacji.
 */
export function planRetention(
    files: Array<{ name: string; mtimeMs: number }>,
    verification: BackupVerification
): { toDelete: string[]; orphanSidecars: string[] } {
    const orphanSidecars = findOrphanSidecars(files.map((f) => f.name));
    if (!canPruneOldBackups(verification)) {
        return { toDelete: [], orphanSidecars };
    }
    return { toDelete: selectBackupsForRetention(files), orphanSidecars };
}

export interface BackupResult {
    file: string;
    size: number;
    sha256: string;
    verification: BackupVerification;
    keptCount: number;
}

/**
 * Pełny cykl backupu: `VACUUM INTO` → sidecar SHA-256 → weryfikacja
 * integralności → retencja → marker świeżości.
 *
 * Rzuca przy porażce: CLI tłumaczy to na `exit 1` (cron widzi porażkę zamiast
 * cichego sukcesu), a CronService łapie i loguje — procesu aplikacji nie wolno
 * zabijać z powodu backupu, dlatego tutaj nie ma `process.exit`.
 */
export async function runBackup(prisma: PrismaClient): Promise<BackupResult> {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timestamp = Date.now();
    const backupName = `backup_${date}_${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, backupName);

    // WAL-safe: SQLite's VACUUM INTO tworzy spójny snapshot niezależnie
    // od aktywnych połączeń i write-ahead log. Bezpieczne nawet gdy
    // aplikacja pisze do bazy w trakcie backupu.
    const targetPath = backupPath.replace(/\\/g, '/');
    await prisma.$executeRawUnsafe(`VACUUM INTO '${targetPath}'`);

    const stats = fs.statSync(backupPath);
    if (stats.size === 0) throw new Error('Backup pusty (0 B) — VACUUM nie utworzył pliku');
    console.log(`[Backup] Utworzono: ${backupPath} (${(stats.size / 1024).toFixed(1)} KB)`);

    // P0-F: SHA-256 backupu — restore weryfikuje przed nadpisaniem bazy.
    const hash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
    fs.writeFileSync(backupPath + '.sha256', `${hash}  ${backupName}\n`, 'utf8');
    console.log(`[Backup] SHA-256: ${hash}`);

    // weryfikacja integralności backupu — bramka przed retencją
    let verification: BackupVerification = 'unverified';
    try {
        const { DatabaseSync } = await import('node:sqlite');
        const db = new DatabaseSync(backupPath, { readOnly: true });
        const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
        db.close();
        if (row.integrity_check !== 'ok')
            throw new Error(`integrity_check: ${row.integrity_check}`);
        verification = 'ok';
        console.log('[Backup] Weryfikacja integralności OK');
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        verification = classifyVerification(msg);
        console.warn('[Backup] Ostrzeżenie weryfikacji:', msg);
    }

    // W katalogu trzymamy WYŁĄCZNIE zweryfikowane kopie: plik, którego
    // integralności nie da się potwierdzić, wypierałby dobrą kopię
    // w retencji, więc go usuwamy. Stare kopie zostają na dysku.
    if (verification !== 'ok') {
        try {
            fs.unlinkSync(backupPath);
            console.log(`[Backup] Usunięto niezweryfikowany backup (${verification})`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[Backup] Nie udało się usunąć niezweryfikowanego backupu: ${msg}`);
        }
        try {
            fs.unlinkSync(backupPath + '.sha256');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[Backup] Nie udało się usunąć sidecara: ${msg}`);
        }
    }

    // P0.6: retencja liczy WYŁĄCZNIE pliki .sqlite (sidecary .sha256
    // nie są kopiami — wcześniej 30 plików ≈ 15 backupów).
    const files = fs.readdirSync(backupDir);
    const withMtime = files.map((f) => ({
        name: f,
        mtimeMs: fs.statSync(path.join(backupDir, f)).mtimeMs
    }));
    const { toDelete: toDeleteList, orphanSidecars } = planRetention(withMtime, verification);

    // P0.6: sprzątanie sierot — sidecar bez pary .sqlite.
    for (const f of orphanSidecars) {
        try {
            fs.unlinkSync(path.join(backupDir, f));
            console.log(`[Backup] Usunięto sierocy sidecar: ${f}`);
        } catch {}
    }

    for (const toDelete of toDeleteList) {
        fs.unlinkSync(path.join(backupDir, toDelete));
        // P0.6: kasowanie pary sqlite+sha256 atomowo (względem retencji).
        try {
            fs.unlinkSync(path.join(backupDir, toDelete + '.sha256'));
        } catch {}
        console.log(`[Backup] Usunięto starą kopię: ${toDelete}`);
    }

    const kept = withMtime.filter(
        (f) => f.name.startsWith('backup_') && f.name.endsWith('.sqlite')
    ).length;

    const keptCount = Math.min(kept, MAX_BACKUPS);

    console.log(`[Backup] Zachowano ${keptCount}/${MAX_BACKUPS} kopii`);

    // Marker świeżości WYŁĄCZNIE po zweryfikowanym backupie. Aktualizacja przy
    // porażce kłamałaby dokładnie wtedy, gdy monitoring jest potrzebny.
    if (verification === 'ok') {
        const marker: BackupMarker = {
            at: new Date().toISOString(),
            file: backupName,
            size: stats.size,
            sha256: hash,
            verification
        };
        try {
            fs.writeFileSync(getBackupMarkerPath(), JSON.stringify(marker, null, 2) + '\n', 'utf8');
            console.log('[Backup] Marker świeżości zapisany');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(`[Backup] Nie udało się zapisać markera: ${msg}`);
        }
    }

    // Bramka: bez zweryfikowanego backupu stare kopie zostają, a skrypt
    // kończy się błędem (cron widzi porażkę zamiast cichego sukcesu).
    if (!canPruneOldBackups(verification)) {
        throw new Error(`Backup ${verification} — retencja wstrzymana, stare kopie zachowane`);
    }

    return { file: backupName, size: stats.size, sha256: hash, verification, keptCount };
}

async function main() {
    const prisma = new PrismaClient();
    try {
        await runBackup(prisma);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Backup] Błąd:', msg);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

// P0.6: guard importu — testy mogą importować selekcję retencji bez startu backupu.
if (require.main === module) {
    main();
}
