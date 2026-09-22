import { PrismaClient } from '../generated/prisma';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDataDir } from '../src/utils/paths';

const prisma = new PrismaClient();

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

const MAX_BACKUPS = 30;

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

async function main() {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const date = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timestamp = Date.now();
    const backupName = `backup_${date}_${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, backupName);

    try {
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

        // weryfikacja integralności backupu
        try {
            const { DatabaseSync } = await import('node:sqlite');
            const db = new DatabaseSync(backupPath, { readOnly: true });
            const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
            db.close();
            if (row.integrity_check !== 'ok')
                throw new Error(`integrity_check: ${row.integrity_check}`);
            console.log('[Backup] Weryfikacja integralności OK');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn('[Backup] Ostrzeżenie weryfikacji:', msg);
            // nie usuwaj starej kopii jeśli nowa jest uszkodzona
            if (msg.includes('integrity_check')) {
                try {
                    fs.unlinkSync(backupPath);
                    console.log('[Backup] Usunięto uszkodzony backup');
                } catch {}
                throw e;
            }
        }

        // P0.6: retencja liczy WYŁĄCZNIE pliki .sqlite (sidecary .sha256
        // nie są kopiami — wcześniej 30 plików ≈ 15 backupów).
        const files = fs.readdirSync(backupDir);
        const withMtime = files.map((f) => ({
            name: f,
            mtimeMs: fs.statSync(path.join(backupDir, f)).mtimeMs
        }));
        const toDeleteList = selectBackupsForRetention(withMtime);

        // P0.6: sprzątanie sierot — sidecar bez pary .sqlite.
        for (const f of findOrphanSidecars(files)) {
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
    } catch (error: any) {
        console.error('[Backup] Błąd:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// P0.6: guard importu — testy mogą importować selekcję retencji bez startu backupu.
if (require.main === module) {
    main();
}
