/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const sourceArg = args.find((a) => !a.startsWith('--'));
if (!sourceArg) {
    console.error('Użycie: node scripts/restore-db.js <plik_backupu> [--yes]');
    process.exit(1);
}
const sourcePath = path.resolve(sourceArg);
const DB_PATH = process.env.RESTORE_DB_PATH
    ? path.resolve(process.env.RESTORE_DB_PATH)
    : path.resolve(__dirname, '..', 'data', 'app_database.sqlite');
const PRISMA_DIR = process.env.RESTORE_PRISMA_DIR
    ? path.resolve(process.env.RESTORE_PRISMA_DIR)
    : path.resolve(__dirname, '..');

if (!fs.existsSync(sourcePath)) {
    console.error(`Plik backupu nie istnieje: ${sourcePath}`);
    process.exit(1);
}

const PRISMA_CLI = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
const ENV = { ...process.env, DATABASE_URL: 'file:' + DB_PATH.replace(/\\/g, '/') };

const SQLITE_MAGIC = Buffer.from('SQLite format 3\u0000', 'binary');

function isSqliteFile(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        try {
            const buf = Buffer.alloc(16);
            const bytes = fs.readSync(fd, buf, 0, 16, 0);
            return bytes === 16 && buf.equals(SQLITE_MAGIC);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return false;
    }
}

function integrityCheck(filePath) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(filePath, { readOnly: true });
    try {
        const rows = db.prepare('PRAGMA integrity_check;').all();
        return rows.length === 1 && rows[0].integrity_check === 'ok';
    } finally {
        db.close();
    }
}

function runPrisma(args) {
    return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: PRISMA_DIR,
        encoding: 'utf8',
        env: ENV,
        stdio: ['pipe', 'pipe', 'pipe']
    });
}

function confirm() {
    if (yes) return Promise.resolve(true);
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(
            `Czy na pewno przywrócić backup ${sourcePath}? Obecna baza zostanie nadpisana. (tak/nie): `,
            (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'tak');
            }
        );
    });
}

(async () => {
    const ok = await confirm();
    if (!ok) {
        console.log('Anulowano.');
        process.exit(0);
    }
    if (!isSqliteFile(sourcePath)) {
        console.error(`[BLAD] Plik backupu nie jest poprawna baza SQLite: ${sourcePath}`);
        process.exit(1);
    }
    if (!integrityCheck(sourcePath)) {
        console.error(`[BLAD] Backup nie przeszedl PRAGMA integrity_check: ${sourcePath}`);
        process.exit(1);
    }
    fs.copyFileSync(sourcePath, DB_PATH);
    for (const suffix of ['-wal', '-shm']) {
        const sidecar = DB_PATH + suffix;
        if (fs.existsSync(sidecar)) {
            fs.unlinkSync(sidecar);
        }
    }
    console.log(`Baza przywrocona z: ${sourcePath}`);
    console.log('[INFO] Synchronizuje schemat bazy (migrate deploy)...');
    try {
        const out = runPrisma(['migrate', 'deploy']);
        console.log(out.trim());
        console.log('[OK] Schemat zsynchronizowany.');
    } catch (e) {
        const stderr =
            e && e.stderr ? String(e.stderr).trim() : e instanceof Error ? e.message : String(e);
        console.warn('[WARN] Nie udalo sie zsynchronizowac schematu.');
        console.warn('[WARN] Uruchom recznie: npx prisma migrate deploy');
        console.warn(stderr.split('\n').slice(0, 6).join('\n'));
    }
})();
