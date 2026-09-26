/**
 * setupDbIsolation.ts — izolacja SQLite per worker Jesta (setupFiles).
 *
 * Problem: równoległe workery dzieliły jeden plik DB (dev lub test-ci),
 * co dawało SQLITE_BUSY/tx-flaki pod obciążeniem (telemetryRoutes,
 * ruryDuplicateAtomic) i przy okazji brudziło dev-bazę.
 *
 * Rozwiązanie: każdy worker dostaje własny plik
 * tests/tmp/jest-worker-<id>.sqlite (schema przez db push raz na plik).
 * Pliki nietknięte >5 min sprząta tests/setup.ts; katalog gitignored.
 * Kolejność ładowania: setupFiles wykonuje się PRZED importami pliku
 * testowego, więc prismaClient odczyta już podmieniony DATABASE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const workerId = process.env.JEST_WORKER_ID || '1';
const tmpDir = path.resolve(__dirname, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const dbFile = path.join(tmpDir, `jest-worker-${workerId}.sqlite`);
const query = 'connection_limit=1&busy_timeout=30000';
const url = 'file:' + dbFile.replace(/\\/g, '/') + '?' + query;

function pushSchema(): void {
    execFileSync(
        process.execPath,
        [
            path.resolve(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js'),
            'db',
            'push',
            '--skip-generate',
            '--accept-data-loss'
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            env: { ...process.env, DATABASE_URL: url },
            stdio: 'pipe',
            timeout: 120000
        }
    );
}

// Znacznik gotowości zawiera mtime schema.prisma — zmiana schematu
// unieważnia cache (stary plik + flaga sprzątane).
const schemaMtime = (() => {
    try {
        return String(
            fs.statSync(path.resolve(__dirname, '..', 'prisma', 'schema.prisma')).mtimeMs
        );
    } catch {
        return '0';
    }
})();
const readyFlag = `${dbFile}.${schemaMtime}.ready`;
try {
    for (const e of fs.readdirSync(tmpDir)) {
        const prefix = `jest-worker-${workerId}.sqlite.`;
        if (e.startsWith(prefix) && e.endsWith('.ready') && path.join(tmpDir, e) !== readyFlag) {
            fs.rmSync(path.join(tmpDir, e), { force: true });
        }
    }
} catch {
    /* ignore */
}
if (!fs.existsSync(readyFlag)) {
    try {
        fs.rmSync(dbFile, { force: true });
        fs.rmSync(dbFile + '-wal', { force: true });
        fs.rmSync(dbFile + '-shm', { force: true });
        // db push z flagami CLI (spójnie z jobami testowymi CI).
        pushSchema();
        fs.writeFileSync(readyFlag, String(Date.now()));
    } catch {
        // Brak Prisma/poza repo — testy z mockami przejdą, DB polegną jak dotąd.
        try {
            fs.rmSync(readyFlag, { force: true });
        } catch {
            /* ignore */
        }
    }
}

process.env.DATABASE_URL = url;
