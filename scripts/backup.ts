import 'dotenv/config';
import type { PrismaClient } from '../generated/prisma-postgres/client';
import prisma from '../src/prismaClient';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createReadStream } from 'fs';
import { once } from 'events';
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

function verifyPrivatePermissions(filePath: string, mask: number): void {
    if (process.platform === 'win32') return;
    const mode = fs.statSync(filePath).mode & 0o777;
    if ((mode & mask) !== 0) {
        throw new Error(`Backup permissions are too broad: ${path.basename(filePath)}`);
    }
}

export function ensurePrivateBackupDirectory(dir: string = backupDir): void {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new Error('Backup directory must be a real directory, not a symbolic link');
    }
    if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
    verifyPrivatePermissions(dir, 0o077);
}

export function createPrivateBackupArchive(filePath: string): void {
    const descriptor = fs.openSync(filePath, 'wx', 0o600);
    fs.closeSync(descriptor);
}

export function verifyPrivateBackupArchive(filePath: string): void {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error('Backup archive is not a regular file');
    }
    if (process.platform !== 'win32') fs.chmodSync(filePath, 0o600);
    verifyPrivatePermissions(filePath, 0o077);
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
 * Selekcja retencji liczy wyłącznie archiwa PostgreSQL `.dump`.
 * (sidecary .sha256 nie są kopiami). Zwraca nazwy do usunięcia
 * (najstarsze), posortowane od najstarszej.
 */
export function selectBackupsForRetention(
    files: Array<{ name: string; mtimeMs: number }>,
    maxBackups: number = MAX_BACKUPS
): string[] {
    const backups = files
        .filter((f) => f.name.startsWith('backup_') && f.name.endsWith('.dump'))
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map((x) => x.name);
    return backups.slice(0, Math.max(0, backups.length - maxBackups));
}

/** Sidecary .sha256 bez pary .dump (sieroty do posprzątania). */
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
 * - `ok`         — `pg_restore --list` poprawnie odczytał custom archive
 * - `corrupt`    — archiwum PostgreSQL nie jest czytelne
 * - `unverified` — nie można wykonać kontroli pg_restore
 */
export type BackupVerification = 'ok' | 'corrupt' | 'unverified';

/** Błąd integralności → plik uszkodzony; pozostałe błędy → brak możliwości weryfikacji. */
export function classifyVerification(message: string): BackupVerification {
    if (/ENOENT|EBUSY|EACCES|permission denied/i.test(message)) return 'unverified';
    return message ? 'corrupt' : 'unverified';
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
 * bez pary `.dump`) są bezużyteczne niezależnie od weryfikacji.
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

interface PostgresConnection {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
    sslMode?: string;
    sslRootCert?: string;
    sslCert?: string;
    sslKey?: string;
}

export function parsePostgresUrl(rawUrl: string): PostgresConnection {
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('DATABASE_URL must use PostgreSQL');
    }
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!url.hostname || !database || !url.username) {
        throw new Error('DATABASE_URL must include host, database and username');
    }
    const sslMode = url.searchParams.get('sslmode') ?? undefined;
    if (sslMode && !['disable', 'verify-full'].includes(sslMode)) {
        throw new Error('DATABASE_URL has an unsupported sslmode');
    }
    const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
    const isLocalHost = ['localhost', '127.0.0.1', '::1', 'postgres'].includes(host.toLowerCase());
    if (!isLocalHost && sslMode !== 'verify-full') {
        throw new Error('Remote PostgreSQL backup connections require sslmode=verify-full');
    }
    return {
        host,
        port: url.port || '5432',
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database,
        sslMode,
        sslRootCert: url.searchParams.get('sslrootcert') ?? undefined,
        sslCert: url.searchParams.get('sslcert') ?? undefined,
        sslKey: url.searchParams.get('sslkey') ?? undefined
    };
}

function postgresCliEnvironment(connection: PostgresConnection): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PGHOST: connection.host,
        PGPORT: connection.port,
        PGUSER: connection.user,
        PGPASSWORD: connection.password,
        PGDATABASE: connection.database
    };
    for (const key of [
        'DATABASE_URL',
        'MIGRATION_DATABASE_URL',
        'BACKUP_DATABASE_URL',
        'RESTORE_DB_URL',
        'POSTGRES_TEST_URL',
        'PLAYWRIGHT_DATABASE_URL'
    ]) {
        delete env[key];
    }
    if (connection.sslMode) env.PGSSLMODE = connection.sslMode;
    if (connection.sslRootCert) env.PGSSLROOTCERT = connection.sslRootCert;
    if (connection.sslCert) env.PGSSLCERT = connection.sslCert;
    if (connection.sslKey) env.PGSSLKEY = connection.sslKey;
    return env;
}

async function sha256File(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const input = createReadStream(filePath);
    input.on('data', (chunk: Buffer) => hash.update(chunk));
    await once(input, 'end');
    return hash.digest('hex');
}

function removeBackupFile(filePath: string): void {
    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw new Error(`Unable to remove backup artifact: ${path.basename(filePath)}`);
        }
    }
}

/**
 * Pełny cykl backupu: `pg_dump` custom archive → SHA-256 → format-check
 * przez `pg_restore --list` → retencja → marker świeżości.
 *
 * Rzuca przy porażce: CLI tłumaczy to na `exit 1` (cron widzi porażkę zamiast
 * cichego sukcesu), a CronService łapie i loguje — procesu aplikacji nie wolno
 * zabijać z powodu backupu, dlatego tutaj nie ma `process.exit`.
 */
export async function runBackup(_prisma: PrismaClient): Promise<BackupResult> {
    ensurePrivateBackupDirectory();

    const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timestamp = Date.now();
    const backupName = `backup_${date}_${timestamp}.dump`;
    const backupPath = path.join(backupDir, backupName);
    const rawUrl = process.env.BACKUP_DATABASE_URL;
    if (!rawUrl) throw new Error('BACKUP_DATABASE_URL is required for PostgreSQL backup');
    const cliEnv = postgresCliEnvironment(parsePostgresUrl(rawUrl));
    try {
        createPrivateBackupArchive(backupPath);
        execFileSync(
            process.env.PG_DUMP_BIN || 'pg_dump',
            ['--format=custom', '--no-owner', '--no-acl', '--file', backupPath],
            { env: cliEnv, stdio: 'pipe' }
        );
    } catch {
        removeBackupFile(backupPath);
        throw new Error('pg_dump failed; verify PostgreSQL connectivity and the backup role');
    }

    try {
        verifyPrivateBackupArchive(backupPath);
    } catch (error) {
        removeBackupFile(backupPath);
        throw error;
    }

    const stats = fs.statSync(backupPath);
    if (!stats.isFile() || stats.size === 0) throw new Error('PostgreSQL backup archive is empty');
    console.log(`[Backup] Utworzono: ${backupName} (${(stats.size / 1024).toFixed(1)} KB)`);

    const hash = await sha256File(backupPath);
    fs.writeFileSync(backupPath + '.sha256', `${hash}  ${backupName}\n`, 'utf8');
    console.log(`[Backup] SHA-256: ${hash}`);

    // Archive TOC parsing is a file-format check, not a full restore drill.
    let verification: BackupVerification = 'unverified';
    try {
        execFileSync(process.env.PG_RESTORE_BIN || 'pg_restore', ['--list', backupPath], {
            env: cliEnv,
            stdio: 'pipe'
        });
        verification = 'ok';
        console.log('[Backup] PostgreSQL archive format verified');
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        verification = msg.includes('ENOENT') ? 'unverified' : 'corrupt';
        console.warn('[Backup] PostgreSQL archive verification failed');
    }

    // W katalogu trzymamy WYŁĄCZNIE zweryfikowane kopie: plik, którego
    // integralności nie da się potwierdzić, wypierałby dobrą kopię
    // w retencji, więc go usuwamy. Stare kopie zostają na dysku.
    if (verification !== 'ok') {
        removeBackupFile(backupPath);
        removeBackupFile(`${backupPath}.sha256`);
        console.log(`[Backup] Usunięto niezweryfikowany backup (${verification})`);
    }

    // Retention counts only PostgreSQL archives, not checksum sidecars.
    const files = fs.readdirSync(backupDir);
    const withMtime = files.map((f) => ({
        name: f,
        mtimeMs: fs.statSync(path.join(backupDir, f)).mtimeMs
    }));
    const { toDelete: toDeleteList, orphanSidecars } = planRetention(withMtime, verification);

    // Remove orphan checksum sidecars.
    for (const f of orphanSidecars) {
        removeBackupFile(path.join(backupDir, f));
        console.log(`[Backup] Usunięto sierocy sidecar: ${f}`);
    }

    for (const toDelete of toDeleteList) {
        fs.unlinkSync(path.join(backupDir, toDelete));
        // Remove the archive checksum sidecar with the retained archive.
        removeBackupFile(path.join(backupDir, toDelete + '.sha256'));
        console.log(`[Backup] Usunięto starą kopię: ${toDelete}`);
    }

    const kept = withMtime.filter(
        (f) => f.name.startsWith('backup_') && f.name.endsWith('.dump')
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
