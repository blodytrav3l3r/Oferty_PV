#!/usr/bin/env node
/**
 * Archiwizacja dużych wpisów audit_logs (> 64 KB) — eksport, walidacja, usuwanie, przywracanie.
 *
 * Powód: 111 wierszy > 1 MB zajmowało 95% tabeli audit_logs (1,27 GB).
 * Bezpieczeństwo:
 *  - `export` tylko czyta bazę i pisze JSONL.gz + manifest z SHA-256 każdego payloadu,
 *  - `verify` porównuje archiwum z bazą (liczba, id, hash) — nie zmienia danych,
 *  - `delete` i `restore` wymagają jawnego `--confirm`,
 *  - `delete` odmawia pracy, jeśli `verify` nie przejdzie dla tego samego archiwum.
 *
 * Użycie (kolejność):
 *   node scripts/audit-archive.mjs export
 *   node scripts/audit-archive.mjs verify --file data/backups/audit-archive-*.jsonl.gz
 *   node scripts/audit-archive.mjs delete --file ... --confirm
 *   node scripts/audit-archive.mjs restore --file ... --confirm
 *
 * VACUUM nie jest tu wykonywane — osobne okno serwisowe (patrz docs/plans).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const MIN_BYTES = 64 * 1024;
const DB_PATH = process.env.DATABASE_URL?.startsWith('file:')
    ? process.env.DATABASE_URL.slice(5).split('?')[0]
    : path.join('data', 'app_database.sqlite');
const SIZE_EXPR = 'COALESCE(LENGTH(oldData),0) + COALESCE(LENGTH(newData),0)';
const COLUMNS = [
    'id',
    'entityType',
    'entityId',
    'userId',
    'action',
    'oldData',
    'newData',
    'createdAt'
];

function payloadHash(row) {
    return crypto
        .createHash('sha256')
        .update(`${row.oldData ?? ''}\u0000${row.newData ?? ''}`, 'utf8')
        .digest('hex');
}

function openDb(readOnly = false) {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`[BLAD] Brak bazy: ${DB_PATH}`);
        process.exit(1);
    }
    return new DatabaseSync(DB_PATH, { readOnly });
}

function defaultArchivePath() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join('data', 'backups', `audit-archive-${stamp}.jsonl.gz`);
}

async function exportArchive(file, minBytes) {
    const db = openDb(true);
    const rows = db
        .prepare(`SELECT * FROM audit_logs WHERE ${SIZE_EXPR} > ? ORDER BY id`)
        .all(minBytes);
    if (rows.length === 0) {
        console.error('[BLAD] Brak wierszy do archiwizacji.');
        process.exit(1);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const gzip = zlib.createGzip({ level: 9 });
    const out = fs.createWriteStream(file);
    gzip.pipe(out);
    let bytes = 0;
    for (const row of rows) {
        bytes += Buffer.byteLength(row.oldData ?? '') + Buffer.byteLength(row.newData ?? '');
        const line = JSON.stringify({ ...row, _payloadHash: payloadHash(row) }) + '\n';
        if (!gzip.write(line)) await new Promise((r) => gzip.once('drain', r));
    }
    gzip.end();
    await new Promise((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
    });
    const manifest = {
        createdAt: new Date().toISOString(),
        dbPath: DB_PATH,
        minBytes,
        rows: rows.length,
        payloadBytes: bytes,
        archive: path.basename(file),
        archiveBytes: fs.statSync(file).size,
        archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    };
    const manifestPath = `${file}.manifest.json`;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(
        `[OK] Eksport: ${manifest.rows} wierszy, ${(bytes / 1048576).toFixed(1)} MB payloadu`
    );
    console.log(`[OK] Archiwum: ${file} (${(manifest.archiveBytes / 1048576).toFixed(1)} MB)`);
    console.log(`[OK] Manifest: ${manifestPath}`);
    console.log(`[OK] SHA-256 archiwum: ${manifest.archiveSha256}`);
}

/** Strumieniowy odczyt archiwum — 1,25 GB payloadu nie mieści się w jednym stringu. */
async function* readArchive(file) {
    if (!fs.existsSync(file)) {
        console.error(`[BLAD] Brak archiwum: ${file}`);
        process.exit(1);
    }
    const stream = fs.createReadStream(file).pipe(zlib.createGunzip());
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
        if (line) yield JSON.parse(line);
    }
}

async function verifyArchive(file) {
    const db = openDb(true);
    const findLive = db.prepare('SELECT * FROM audit_logs WHERE id = ?');
    let archived = 0;
    let missing = 0;
    let hashMismatch = 0;
    let fieldMismatch = 0;
    const sampleErrors = [];

    for await (const row of readArchive(file)) {
        archived++;
        const live = findLive.get(row.id);
        if (!live) {
            missing++;
            continue;
        }
        if (payloadHash(live) !== row._payloadHash) hashMismatch++;
        for (const col of COLUMNS) {
            if (String(live[col] ?? '') !== String(row[col] ?? '')) {
                fieldMismatch++;
                if (sampleErrors.length < 5)
                    sampleErrors.push(`pole ${col} różni się dla id=${row.id}`);
                break;
            }
        }
    }
    for (const e of sampleErrors) console.error(`[BLAD] ${e}`);
    const ok = archived > 0 && missing === 0 && hashMismatch === 0 && fieldMismatch === 0;
    console.log(
        `[${ok ? 'OK' : 'BLAD'}] Weryfikacja: archiwum=${archived}, brak w bazie=${missing}, ` +
            `zly hash=${hashMismatch}, niezgodne pola=${fieldMismatch}`
    );
    return ok;
}

async function deleteArchived(file) {
    const ok = await verifyArchive(file);
    if (!ok) {
        console.error(
            '[BLAD] Weryfikacja nie przeszła — usuwanie przerwane. Dane w bazie nietknięte.'
        );
        process.exit(1);
    }
    const db = openDb(false);
    const before = fs.statSync(DB_PATH).size;
    const stmt = db.prepare('DELETE FROM audit_logs WHERE id = ?');
    db.exec('BEGIN');
    let deleted = 0;
    try {
        for await (const row of readArchive(file)) {
            deleted += stmt.run(row.id).changes;
        }
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        console.error(`[BLAD] Usuwanie przerwane, rollback: ${e.message}`);
        process.exit(1);
    }
    const after = fs.statSync(DB_PATH).size;
    console.log(
        `[OK] Usunięto ${deleted} wierszy. Plik: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`
    );
    console.log('[INFO] Miejsce odzyska dopiero VACUUM w oknie serwisowym.');
}

async function restoreArchive(file) {
    const db = openDb(false);
    const stmt = db.prepare(
        `INSERT OR REPLACE INTO audit_logs (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`
    );
    db.exec('BEGIN');
    let restored = 0;
    try {
        for await (const row of readArchive(file)) {
            restored += stmt.run(...COLUMNS.map((c) => row[c] ?? null)).changes;
        }
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        console.error(`[BLAD] Przywracanie przerwane, rollback: ${e.message}`);
        process.exit(1);
    }
    console.log(`[OK] Przywrócono ${restored} wierszy z ${file}`);
}

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        file: { type: 'string' },
        'min-bytes': { type: 'string' },
        confirm: { type: 'boolean', default: false }
    }
});

const command = positionals[0];
const needsFile = ['verify', 'delete', 'restore'];

if (!command || !['export', 'verify', 'delete', 'restore'].includes(command)) {
    console.error('Użycie: audit-archive.mjs export|verify|delete|restore [--file F] [--confirm]');
    process.exit(2);
}
if (needsFile.includes(command) && !values.file) {
    console.error(`[BLAD] \`${command}\` wymaga --file <archiwum.jsonl.gz>`);
    process.exit(2);
}
if (['delete', 'restore'].includes(command) && !values.confirm) {
    console.error(`[BLAD] \`${command}\` wymaga --confirm (operacja zmienia bazę).`);
    process.exit(2);
}

if (command === 'export') {
    await exportArchive(
        values.file ?? defaultArchivePath(),
        Number(values['min-bytes'] ?? MIN_BYTES)
    );
} else if (command === 'verify') {
    const ok = await verifyArchive(values.file);
    process.exit(ok ? 0 : 1);
} else if (command === 'delete') {
    await deleteArchived(values.file);
} else {
    await restoreArchive(values.file);
}
