#!/usr/bin/env node
/** Archive large audit rows from PostgreSQL with verification before mutation. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { once } from 'node:events';
import { Client } from 'pg';

const MIN_BYTES = 64 * 1024;
const BATCH_SIZE = 250;
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
const SELECT_COLUMNS = COLUMNS.map((column) => `"${column}"`).join(', ');
const SIZE_EXPR = 'COALESCE(OCTET_LENGTH("oldData"),0) + COALESCE(OCTET_LENGTH("newData"),0)';
const COLUMN_LIST = COLUMNS.map((column) => `"${column}"`).join(', ');

function getDatabaseConfig(rawUrl) {
    if (!rawUrl) throw new Error('DATABASE_URL is required');
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }
    if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2
    ) {
        throw new Error('DATABASE_URL must specify a PostgreSQL host and database');
    }
    const host = url.hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
    const isLocal = ['localhost', '127.0.0.1', '::1', 'postgres'].includes(host);
    if (!isLocal && url.searchParams.get('sslmode') !== 'verify-full') {
        throw new Error('Remote PostgreSQL connections require sslmode=verify-full');
    }
    if (
        url.searchParams.has('sslmode') &&
        !['disable', 'verify-full'].includes(url.searchParams.get('sslmode'))
    ) {
        throw new Error('DATABASE_URL has an unsupported sslmode');
    }
    return { connectionString: rawUrl, database: decodeURIComponent(url.pathname.slice(1)) };
}

async function withClient(action) {
    const config = getDatabaseConfig(process.env.DATABASE_URL);
    const client = new Client({ connectionString: config.connectionString });
    await client.connect();
    try {
        return await action(client, config);
    } finally {
        await client.end();
    }
}

function payloadHash(row) {
    return crypto
        .createHash('sha256')
        .update(`${row.oldData ?? ''}\u0000${row.newData ?? ''}`, 'utf8')
        .digest('hex');
}

function defaultArchivePath() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join('data', 'backups', `audit-archive-${stamp}.jsonl.gz`);
}

async function hashFile(file) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    await once(stream, 'end');
    return hash.digest('hex');
}

async function* readArchive(file) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        throw new Error('Audit archive file is missing');
    }
    const source = fs.createReadStream(file).pipe(zlib.createGunzip());
    const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
    for await (const line of lines) {
        if (!line) continue;
        let row;
        try {
            row = JSON.parse(line);
        } catch {
            throw new Error('Audit archive contains invalid JSON');
        }
        if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
            throw new Error('Audit archive contains an invalid row');
        }
        const expectedHash = row._payloadHash;
        if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
            throw new Error(`Audit archive row ${row.id} has an invalid payload hash`);
        }
        if (payloadHash(row) !== expectedHash.toLowerCase()) {
            throw new Error(`Audit archive row ${row.id} failed payload verification`);
        }
        yield row;
    }
}

async function* readBatches(rows, batchSize = BATCH_SIZE) {
    let batch = [];
    for await (const row of rows) {
        batch.push(row);
        if (batch.length < batchSize) continue;
        yield batch;
        batch = [];
    }
    if (batch.length) yield batch;
}

async function exportArchive(file, minBytes) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await withClient(async (client, config) => {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const gzip = zlib.createGzip({ level: 9 });
        const output = fs.createWriteStream(file, { flags: 'wx' });
        const outputFinished = new Promise((resolve, reject) => {
            output.once('finish', resolve);
            output.once('error', reject);
            gzip.once('error', reject);
        });
        gzip.pipe(output);
        let count = 0;
        let payloadBytes = 0;
        let lastId = null;
        try {
            for (;;) {
                const result = await client.query(
                    `SELECT ${SELECT_COLUMNS} FROM "audit_logs"
                     WHERE ${SIZE_EXPR} > $1 AND ($2::text IS NULL OR "id" > $2)
                     ORDER BY "id" LIMIT $3`,
                    [minBytes, lastId, BATCH_SIZE]
                );
                if (result.rows.length === 0) break;
                for (const row of result.rows) {
                    lastId = row.id;
                    count++;
                    payloadBytes +=
                        Buffer.byteLength(row.oldData ?? '') + Buffer.byteLength(row.newData ?? '');
                    const line = `${JSON.stringify({ ...row, _payloadHash: payloadHash(row) })}\n`;
                    if (!gzip.write(line))
                        await new Promise((resolve) => gzip.once('drain', resolve));
                }
            }
            gzip.end();
            await outputFinished;
            if (count === 0) throw new Error('No audit rows exceed the archive threshold');
            await client.query('COMMIT');
        } catch (error) {
            gzip.destroy();
            output.destroy();
            await client.query('ROLLBACK');
            fs.rmSync(file, { force: true });
            throw error;
        }
        const archiveBytes = fs.statSync(file).size;
        const manifest = {
            createdAt: new Date().toISOString(),
            database: config.database,
            minBytes,
            rows: count,
            payloadBytes,
            archive: path.basename(file),
            archiveBytes,
            archiveSha256: await hashFile(file)
        };
        const manifestPath = `${file}.manifest.json`;
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
        process.stdout.write(
            `[OK] Export: ${count} rows, ${(payloadBytes / 1048576).toFixed(1)} MB payload\n`
        );
        process.stdout.write(`[OK] Archive: ${file} (${(archiveBytes / 1048576).toFixed(1)} MB)\n`);
        process.stdout.write(`[OK] SHA-256: ${manifest.archiveSha256}\n`);
    });
}

function recordsById(rows) {
    return new Map(rows.map((row) => [row.id, row]));
}

function compareRows(live, archived) {
    if (!live) return false;
    for (const column of COLUMNS) {
        if (String(live[column] ?? '') !== String(archived[column] ?? '')) return false;
    }
    return payloadHash(live) === archived._payloadHash.toLowerCase();
}

async function selectLiveRows(client, ids, lock = false) {
    const lockClause = lock ? ' FOR UPDATE' : '';
    const result = await client.query(
        `SELECT ${SELECT_COLUMNS} FROM "audit_logs" WHERE "id" = ANY($1::text[])${lockClause}`,
        [ids]
    );
    return recordsById(result.rows);
}

async function verifyArchive(file, client = null) {
    const verify = async (db) => {
        let archivedCount = 0;
        let missing = 0;
        let mismatched = 0;
        const seen = new Set();
        for await (const batch of readBatches(readArchive(file))) {
            archivedCount += batch.length;
            const uniqueRows = batch.filter((row) => {
                if (seen.has(row.id)) {
                    mismatched++;
                    return false;
                }
                seen.add(row.id);
                return true;
            });
            const liveRows = await selectLiveRows(
                db,
                uniqueRows.map((row) => row.id)
            );
            for (const archived of uniqueRows) {
                const live = liveRows.get(archived.id);
                if (!live) missing++;
                else if (!compareRows(live, archived)) mismatched++;
            }
        }
        return { archivedCount, missing, mismatched };
    };
    const result = client ? await verify(client) : await withClient(verify);
    const ok = result.archivedCount > 0 && result.missing === 0 && result.mismatched === 0;
    process.stdout.write(
        `[${ok ? 'OK' : 'FAIL'}] Verification: archive=${result.archivedCount}, missing=${result.missing}, mismatched=${result.mismatched}\n`
    );
    return ok;
}

async function deleteArchived(file) {
    await withClient(async (client) => {
        await client.query('BEGIN');
        try {
            const result = await verifyArchive(file, client);
            if (!result) throw new Error('Archive verification failed; delete stopped');
            let deleted = 0;
            for await (const batch of readBatches(readArchive(file))) {
                const lockedRows = await selectLiveRows(
                    client,
                    batch.map((row) => row.id),
                    true
                );
                if (batch.some((row) => !compareRows(lockedRows.get(row.id), row))) {
                    throw new Error(
                        'Audit rows changed during archive deletion; transaction stopped'
                    );
                }
                const deletion = await client.query(
                    'DELETE FROM "audit_logs" WHERE "id" = ANY($1::text[])',
                    [batch.map((row) => row.id)]
                );
                deleted += deletion.rowCount ?? 0;
            }
            await client.query('COMMIT');
            process.stdout.write(`[OK] Deleted ${deleted} audit rows transactionally\n`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    });
}

async function restoreArchive(file) {
    const updateColumns = COLUMNS.slice(1)
        .map((column) => `"${column}" = EXCLUDED."${column}"`)
        .join(', ');
    const valueRows = COLUMNS.map((_, columnIndex) => `$${columnIndex + 1}`).join(', ');
    const query = `INSERT INTO "audit_logs" (${COLUMN_LIST}) VALUES (${valueRows})
                   ON CONFLICT ("id") DO UPDATE SET ${updateColumns}`;
    await withClient(async (client) => {
        await client.query('BEGIN');
        try {
            let restored = 0;
            for await (const batch of readBatches(readArchive(file))) {
                for (const row of batch) {
                    const values = COLUMNS.map((column) => row[column] ?? null);
                    await client.query(query, values);
                    restored++;
                }
            }
            if (restored === 0) throw new Error('Audit archive is empty');
            await client.query('COMMIT');
            process.stdout.write(`[OK] Restored ${restored} audit rows from archive\n`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    });
}

function getOptions() {
    return parseArgs({
        allowPositionals: true,
        options: {
            file: { type: 'string' },
            'min-bytes': { type: 'string' },
            confirm: { type: 'boolean', default: false }
        }
    });
}

async function confirmMutation(command, confirmed) {
    if (confirmed) return true;
    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return await new Promise((resolve) => {
        readlineInterface.question(
            `Run audit archive ${command} against PostgreSQL? (yes/no): `,
            (answer) => {
                readlineInterface.close();
                resolve(answer.toLowerCase() === 'yes');
            }
        );
    });
}

async function main() {
    const { positionals, values } = getOptions();
    const [command] = positionals;
    const needsFile = ['verify', 'delete', 'restore'].includes(command);
    if (!['export', 'verify', 'delete', 'restore'].includes(command)) {
        process.stderr.write(
            'Usage: audit-archive.mjs export|verify|delete|restore [--file F] [--confirm]\n'
        );
        process.exitCode = 2;
        return;
    }
    if (needsFile && !values.file) throw new Error(`${command} requires --file <archive.jsonl.gz>`);
    if (command === 'export') {
        const minBytes = Number(values['min-bytes'] ?? MIN_BYTES);
        if (!Number.isSafeInteger(minBytes) || minBytes < 0)
            throw new Error('--min-bytes must be a non-negative integer');
        await exportArchive(values.file ?? defaultArchivePath(), minBytes);
        return;
    }
    if (command === 'verify') {
        const verified = await verifyArchive(values.file);
        if (!verified) process.exitCode = 1;
        return;
    }
    if (!(await confirmMutation(command, values.confirm))) {
        process.stdout.write('Cancelled.\n');
        return;
    }
    if (command === 'delete') await deleteArchived(values.file);
    else await restoreArchive(values.file);
}

main().catch((error) => {
    const message =
        error instanceof Error ? error.message : 'PostgreSQL audit archive operation failed';
    process.stderr.write(`[ERROR] ${message}\n`);
    process.exitCode = 1;
});
