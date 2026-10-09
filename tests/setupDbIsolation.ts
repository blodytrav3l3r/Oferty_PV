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

function pushSchema(targetUrl: string = url): void {
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
            env: { ...process.env, DATABASE_URL: targetUrl },
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
const DIAG = process.env.SOK_DBISOL_DIAG ? path.resolve(process.env.SOK_DBISOL_DIAG) : null;
function diag(msg: string): void {
    if (!DIAG) return;
    try {
        fs.appendFileSync(DIAG, `${new Date().toISOString()} wid=${workerId} ${msg}\n`);
    } catch {
        /* ignore */
    }
}

// Szablon współdzielony: 15 równoległych `db push` pod pełną suitą na
// zimnym cache przekracza 120 s execFileSync (ETIMEDOUT, flaga nigdy nie
// powstaje, każdy kolejny plik testowy ponawia push — udokumentowane
// logami SOK_DBISOL_DIAG). Jeden worker pushuje szablon, reszta kopiuje
// plik (~2 MB) — bazy per worker nadal osobne, izolacja zachowana.
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const lockDir = path.join(tmpDir, `jest-template.${schemaMtime}.lock`);
const templateDb = path.join(tmpDir, `jest-template.${schemaMtime}.sqlite`);
const templateReady = `${templateDb}.ready`;
const templateUrl = 'file:' + templateDb.replace(/\\/g, '/') + '?' + query;

function rmRetry(p: string): void {
    // EPERM na Windows przy równoległych procesach — retry zamiast 1 strzału.
    fs.rmSync(p, { force: true, maxRetries: 10, retryDelay: 200 });
}

function sleepMs(ms: number): void {
    try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    } catch {
        /* ignore */
    }
}

/** mkdir jest atomowy — wygrywa jeden proces. Osierocony lock (martwy PID lub timeout) przejmujemy. */
function acquireLock(): boolean {
    const ownerFile = path.join(lockDir, 'owner.json');
    const claim = (): void => {
        fs.mkdirSync(lockDir, { recursive: false });
        // Zapis atomowy (tmp + rename) — czytelnik nigdy nie widzi urwanego JSON.
        const tmp = `${ownerFile}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, at: Date.now() }));
        fs.renameSync(tmp, ownerFile);
    };
    try {
        claim();
        return true;
    } catch {
        /* zajęty — sprawdź staleness */
    }
    try {
        const raw = fs.readFileSync(ownerFile, 'utf8');
        const o = JSON.parse(raw) as { pid?: unknown; at?: unknown };
        const age = Date.now() - (typeof o.at === 'number' ? o.at : 0);
        let alive = false;
        if (typeof o.pid === 'number') {
            try {
                process.kill(o.pid, 0);
                alive = true;
            } catch {
                alive = false;
            }
        }
        if (!alive || age > LOCK_TIMEOUT_MS) {
            fs.rmSync(lockDir, { recursive: true, force: true });
            claim();
            return true;
        }
    } catch {
        // Brak owner.json (crash między mkdir a zapisem) = osierocony lock.
        try {
            fs.rmSync(lockDir, { recursive: true, force: true });
            claim();
            return true;
        } catch {
            /* ignore — lock cudzy i świeży */
        }
    }
    return false;
}

function releaseLock(): void {
    try {
        fs.rmSync(lockDir, { recursive: true, force: true });
    } catch {
        /* ignore */
    }
}

function waitForTemplate(): boolean {
    const t0 = Date.now();
    while (!fs.existsSync(templateReady)) {
        if (Date.now() - t0 > LOCK_TIMEOUT_MS) return false;
        sleepMs(250);
    }
    return true;
}

/** Bezpośredni push do własnej bazy — fallback gdy szablon niedostępny (zachowanie sprzed zmiany). */
function directPush(): void {
    try {
        rmRetry(dbFile);
        rmRetry(dbFile + '-wal');
        rmRetry(dbFile + '-shm');
        // db push z flagami CLI (spójnie z jobami testowymi CI).
        pushSchema();
        fs.writeFileSync(readyFlag, String(Date.now()));
        diag('direct push ok');
    } catch (e) {
        diag(
            `direct push THREW: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`
        );
        // Brak Prisma/poza repo — testy z mockami przejdą, DB polegną jak dotąd.
        try {
            fs.rmSync(readyFlag, { force: true });
        } catch {
            /* ignore */
        }
    }
}

diag(`setup start existsFlag=${fs.existsSync(readyFlag)}`);
if (!fs.existsSync(readyFlag)) {
    let ready = false;
    try {
        if (fs.existsSync(templateReady)) {
            diag('template hit');
        } else if (acquireLock()) {
            try {
                // Sprzątnij szablony ze starego schematu (trzymamy lock).
                try {
                    for (const e of fs.readdirSync(tmpDir)) {
                        if (
                            e.startsWith('jest-template.') &&
                            path.join(tmpDir, e) !== templateDb &&
                            path.join(tmpDir, e) !== templateReady &&
                            !e.startsWith(path.basename(lockDir))
                        ) {
                            fs.rmSync(path.join(tmpDir, e), { force: true });
                        }
                    }
                } catch {
                    /* ignore */
                }
                if (!fs.existsSync(templateReady)) {
                    const t0 = Date.now();
                    rmRetry(templateDb);
                    rmRetry(templateDb + '-wal');
                    rmRetry(templateDb + '-shm');
                    pushSchema(templateUrl);
                    diag(`template push ok ${Date.now() - t0}ms`);
                    fs.writeFileSync(templateReady, String(Date.now()));
                }
            } finally {
                releaseLock();
            }
        } else {
            diag('waiting for template owner');
            if (!waitForTemplate()) {
                diag('template wait TIMEOUT');
            }
        }
        if (fs.existsSync(templateReady)) {
            rmRetry(dbFile);
            rmRetry(dbFile + '-wal');
            rmRetry(dbFile + '-shm');
            fs.copyFileSync(templateDb, dbFile);
            fs.writeFileSync(readyFlag, String(Date.now()));
            diag('copied template, flag written');
            ready = true;
        }
    } catch (e) {
        diag(
            `template path THREW: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`
        );
    }
    if (!ready) {
        directPush();
    }
} else {
    diag('flag hit, skip push');
}

process.env.DATABASE_URL = url;
