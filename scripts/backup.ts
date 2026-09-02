import { PrismaClient } from '../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const backupDir = path.resolve(__dirname, '../data/backups');

const MAX_BACKUPS = 30;

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

        const files = fs.readdirSync(backupDir);
        const backups = files
            .filter((f) => f.startsWith('backup_'))
            .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
            .sort((a, b) => a.mtime - b.mtime)
            .map((x) => x.name);

        while (backups.length > MAX_BACKUPS) {
            const toDelete = backups.shift();
            if (toDelete) {
                fs.unlinkSync(path.join(backupDir, toDelete));
                console.log(`[Backup] Usunięto starą kopię: ${toDelete}`);
            }
        }

        console.log(`[Backup] Zachowano ${backups.length}/${MAX_BACKUPS} kopii`);
    } catch (error: any) {
        console.error('[Backup] Błąd:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
