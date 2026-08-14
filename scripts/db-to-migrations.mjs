#!/usr/bin/env node
/*
 * db-to-migrations.mjs
 * Konwersja legacy bazy (prisma db push, bez _prisma_migrations) na model
 * migration-managed przez `migrate resolve --applied`.
 *
 * Uzycie:
 *   node scripts/db-to-migrations.mjs [sciezka_bazy] [nazwa_migracji] [katalog_projektu]
 *
 * Domyślnie:
 *   baza: data/app_database.sqlite
 *   migracja: 20260815000000_baseline
 *   katalog projektu: <root> (repo)
 *
 * Opcjonalny katalog projektu pozwala testow (A4/A4.5) uruchamiac skrypt
 * w izolowanym projekcie Prisma (wlasny schema + migracje), bez ruszania
 * prisma/migrations w repo.
 *
 * Hard guards — skrypt ODMOWIĄ działania przy:
 *   1. baza nie istnieje            -> ERROR: database does not exist
 *   2. baseline nie istnieje        -> ERROR: migration does not exist
 *   3. diff != puste (poza FTS5)    -> ERROR: database schema differs from Prisma schema
 *   4. _prisma_migrations istnieje  -> STOP (baza częściowo migration-managed)
 *
 * Kroki (atomowy proces operacyjny):
 *   backup (VACUUM INTO, backup_pre_baseline_<ts>.sqlite)
 *   -> diff sanity (pusty, hard guard)
 *   -> migrate resolve --applied <migracja>
 *   -> migrate status raport
 *
 * Migrate CLI czyta bazę z env (DATABASE_URL), nie z argumentu — skrypt
 * spawnuje CLI z env: { ...process.env, DATABASE_URL: 'file:' + resolved }
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nonFts5Changes } from './prisma-diff-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const DEFAULT_MIGRATION = '20260815000000_baseline';

const dbArg = process.argv[2];
const migrationName = process.argv[3] || DEFAULT_MIGRATION;
const projectDir = path.resolve(process.argv[4] || ROOT);
const dbPath = dbArg ? path.resolve(dbArg) : path.join(projectDir, 'data', 'app_database.sqlite');
const migrationDir = path.join(projectDir, 'prisma', 'migrations', migrationName);
const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
const shadowPath = path.join(projectDir, 'data', 'tmp_shadow.sqlite');

const ENV = { ...process.env, DATABASE_URL: 'file:' + dbPath.replace(/\\/g, '/') };

function cleanupShadow() {
    for (const suffix of ['', '-shm', '-wal']) {
        const p = shadowPath + suffix;
        try {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
            /* ignoruj */
        }
    }
}

function runCli(args) {
    return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
        cwd: projectDir,
        encoding: 'utf8',
        env: ENV,
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function fail(msg) {
    cleanupShadow();
    console.error(`ERROR: ${msg}`);
    process.exit(1);
}

// 1. Hard guard: baza istnieje
if (!fs.existsSync(dbPath)) {
    fail(`database does not exist: ${dbPath}`);
}

// 2. Hard guard: migracja baseline istnieje
if (!fs.existsSync(path.join(migrationDir, 'migration.sql'))) {
    fail(`migration does not exist: ${migrationName} (${migrationDir})`);
}

// 3. Hard guard: _prisma_migrations juz istnieje
try {
    const { DatabaseSync } = await import('node:sqlite');
    const probe = new DatabaseSync(dbPath, { readOnly: true });
    const row = probe
        .prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'"
        )
        .get();
    probe.close();
    if (row.n > 0) {
        fail(
            `_prisma_migrations juz istnieje w bazie — baza jest (czesciowo) migration-managed. ` +
                `Nie wykonuje slepego resolve --applied.`
        );
    }
} catch {
    fail(`nie mozna odczytac bazy: ${dbPath}`);
}

// 4. Wlasny backup pre-baseline (VACUUM INTO)
const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const backupDir = path.join(projectDir, 'data', 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `backup_pre_baseline_${ts}.sqlite`);
try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);
    db.close();
    const stats = fs.statSync(backupPath);
    console.log(
        `[db-to-migrations] Backup pre-baseline: ${backupPath} (${(stats.size / 1024).toFixed(1)} KB)`
    );
} catch (e) {
    fail(`backup VACUUM INTO nie powiodl sie: ${e instanceof Error ? e.message : String(e)}`);
}

// 5. Diff sanity — pusty poza FTS5 (hard guard #3)
try {
    const out = runCli([
        'migrate',
        'diff',
        '--from-schema-datasource',
        schemaPath,
        '--to-schema-datamodel',
        schemaPath
    ]);
    const rest = nonFts5Changes(out);
    if (rest.length > 0) {
        console.error('[db-to-migrations] DIFF niepusty (poza FTS5):');
        console.error(rest.join('\n'));
        fail(`database schema differs from Prisma schema — REFUSING TO RESOLVE`);
    }
    console.log('[db-to-migrations] Diff sanity OK (pusto poza FTS5).');
} catch (e) {
    fail(`diff sanity nie powiodl sie: ${e instanceof Error ? e.message : String(e)}`);
}

// 6. migrate resolve --applied
try {
    const out = runCli(['migrate', 'resolve', '--applied', migrationName]);
    console.log(`[db-to-migrations] resolve --applied ${migrationName} OK.`);
    console.log(out.trim());
} catch (e) {
    fail(
        `migrate resolve --applied nie powiodl sie: ${
            e instanceof Error && e.stderr
                ? String(e.stderr).trim()
                : e instanceof Error
                  ? e.message
                  : String(e)
        }`
    );
}

// 7. migrate status raport
try {
    const out = runCli(['migrate', 'status']);
    console.log('[db-to-migrations] migrate status:');
    console.log(out.trim());
} catch {
    /* status jest informacyjny — brak wychwycenia blokuje? nie, tylko raport */
}

cleanupShadow();
console.log('[db-to-migrations] Konwersja zakonczona pomyslnie.');
