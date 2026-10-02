/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const SQLITE_MAGIC = Buffer.from('SQLite format 3\u0000', 'binary');

const PRISMA_CLI = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');

/* P1: jawny kontrakt celu restore — brak silent fallback do live DB.
 * Cel musi pochodzić z `--target <ścieżka>` albo RESTORE_DB_PATH.
 * Cel wskazujący live `data/app_database.sqlite` wymaga osobnej flagi `--live`. */
function parseCliArgs(argv) {
    const args = argv.slice(2);
    const yes = args.includes('--yes');
    const live = args.includes('--live');
    let targetArg = null;
    let sourceArg = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--target') {
            targetArg = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
            i++;
        } else if (!args[i].startsWith('--') && sourceArg === null) {
            sourceArg = args[i];
        }
    }
    return { yes, live, targetArg, sourceArg };
}

function liveDbPath() {
    return path.resolve(__dirname, '..', 'data', 'app_database.sqlite');
}

function samePath(a, b) {
    const ra = path.resolve(a);
    const rb = path.resolve(b);
    if (process.platform === 'win32') return ra.toLowerCase() === rb.toLowerCase();
    return ra === rb;
}

function isLiveDbPath(p) {
    try {
        return samePath(p, liveDbPath());
    } catch {
        return false;
    }
}

function resolveTarget({ targetArg, envTarget, live }) {
    const raw = targetArg || envTarget;
    if (!raw) return { ok: false, code: 'NO_TARGET' };
    const target = path.resolve(raw);
    if (samePath(target, liveDbPath()) && !live) {
        return { ok: false, code: 'LIVE_REFUSED', target };
    }
    return { ok: true, target, live: samePath(target, liveDbPath()) };
}

function resolvePaths(sourceArg, target) {
    const sourcePath = path.resolve(sourceArg);
    const dbPath = target;
    const prismaDir = process.env.RESTORE_PRISMA_DIR
        ? path.resolve(process.env.RESTORE_PRISMA_DIR)
        : path.resolve(__dirname, '..');
    const env = { ...process.env, DATABASE_URL: 'file:' + dbPath.replace(/\\/g, '/') };
    return { sourcePath, dbPath, prismaDir, env };
}

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

/* P0-F: weryfikacja SHA-256 backupu (sidecar `<backup>.sha256` z backup.ts).
 * Brak sidecara (starsze backupy) = ostrzeżenie, nie blokada. */
function verifyChecksum(filePath) {
    const crypto = require('crypto');
    const sidecar = filePath + '.sha256';
    if (!fs.existsSync(sidecar)) {
        console.warn('[WARN] Brak pliku .sha256 — pomijam weryfikacje sumy (starszy backup).');
        return true;
    }
    const expected = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (expected !== actual) {
        console.error(`[BLAD] Suma SHA-256 backupu niezgodna (plik uszkodzony/ podmieniony).`);
        console.error(`[BLAD] oczekiwano: ${expected}`);
        console.error(`[BLAD] otrzymano:  ${actual}`);
        return false;
    }
    console.log('[OK] Suma SHA-256 backupu zgodna.');
    return true;
}

function runPrisma(args, prismaDir, env) {
    return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: prismaDir,
        encoding: 'utf8',
        env,
        stdio: ['pipe', 'pipe', 'pipe']
    });
}

function confirm(yes, sourcePath, dbPath, isLive) {
    if (yes) return Promise.resolve(true);
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const where = isLive ? `LIVE BAZY ${dbPath}` : `bazy ${dbPath}`;
        rl.question(
            `Czy na pewno przywrócić backup ${sourcePath} do ${where}? Obecna baza zostanie nadpisana. (tak/nie): `,
            (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'tak');
            }
        );
    });
}

async function main() {
    const { yes, live, targetArg, sourceArg } = parseCliArgs(process.argv);
    if (!sourceArg) {
        console.error(
            'Użycie: node scripts/restore-db.js <plik_backupu> --target <plik_docelowy> [--live] [--yes]'
        );
        console.error(
            '  Cel: --target albo RESTORE_DB_PATH. Bez jawnego celu restore NIE wykona się.'
        );
        process.exit(1);
    }
    const target = resolveTarget({ targetArg, envTarget: process.env.RESTORE_DB_PATH, live });
    if (!target.ok && target.code === 'NO_TARGET') {
        console.error(
            '[BLAD] Brak jawnego celu restore. Podaj --target <plik> albo RESTORE_DB_PATH.'
        );
        console.error(
            '[BLAD] Restore bez jawnego celu jest zabronione (brak fallback do live DB).'
        );
        process.exit(1);
    }
    if (!target.ok && target.code === 'LIVE_REFUSED') {
        console.error(`[BLAD] Cel wskazuje live DB: ${target.target}`);
        console.error('[BLAD] Odmowa. Użyj osobnego (nie-live) targetu albo dodaj jawne --live.');
        process.exit(1);
    }
    const {
        sourcePath,
        dbPath: DB_PATH,
        prismaDir: PRISMA_DIR,
        env: ENV
    } = resolvePaths(sourceArg, target.target);
    if (!fs.existsSync(sourcePath)) {
        console.error(`Plik backupu nie istnieje: ${sourcePath}`);
        process.exit(1);
    }
    const ok = await confirm(yes, sourcePath, DB_PATH, target.live);
    if (!ok) {
        console.log('Anulowano.');
        process.exit(0);
    }
    if (!isSqliteFile(sourcePath)) {
        console.error(`[BLAD] Plik backupu nie jest poprawna baza SQLite: ${sourcePath}`);
        process.exit(1);
    }
    if (!verifyChecksum(sourcePath)) {
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
    // P0-F: re-weryfikacja po kopiowaniu (uszkodzony zapis docelowy).
    if (!integrityCheck(DB_PATH)) {
        console.error('[BLAD] Przywrocona baza nie przechodzi PRAGMA integrity_check.');
        process.exit(1);
    }
    console.log(`Baza przywrocona z: ${sourcePath}`);
    console.log('[INFO] Synchronizuje schemat bazy (migrate deploy)...');
    try {
        const out = runPrisma(['migrate', 'deploy'], PRISMA_DIR, ENV);
        console.log(out.trim());
        console.log('[OK] Schemat zsynchronizowany.');
    } catch (e) {
        const stderr =
            e && e.stderr ? String(e.stderr).trim() : e instanceof Error ? e.message : String(e);
        // P0-F: komunikat straznika (legacy backup) zachowany, ale restore bez
        // schematu to nie restore — twardy blad zamiast cichego ostrzezenia.
        console.warn('[WARN] Nie udalo sie zsynchronizowac schematu.');
        console.warn('[WARN] Uruchom recznie: npx prisma migrate deploy');
        console.warn(stderr.split('\n').slice(0, 6).join('\n'));
        process.exit(1);
    }
}

// P1.3: guard require.main — import nie uruchamia restore (testy regresji
// mogą importować guardy isSqliteFile/verifyChecksum/integrityCheck).
if (require.main === module) {
    main();
}

module.exports = {
    isSqliteFile,
    verifyChecksum,
    integrityCheck,
    parseCliArgs,
    resolveTarget,
    isLiveDbPath,
    liveDbPath
};
