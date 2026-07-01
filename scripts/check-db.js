/**
 * Skrypt weryfikacyjny bazy danych po migracjach (Chromium-free).
 *
 * Sprawdza czy wszystkie oczekiwane tabele AI + telemetry istnieją w SQLite.
 * Działa bez Prisma Client (node:test runner nie wymusza generowania).
 *
 * Używa wbudowanego node:sqlite (Node 22+) lub `sqlite3` CLI.
 *
 * @example
 *   node scripts/check-db.js && echo "OK" || echo "Wymaga migracji"
 */

'use strict';

const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'app_database.sqlite');

const REQUIRED_TABLES = [
    'ai_telemetry_logs',
    'ai_telemetry_events',
    'ai_config_history',
    'ai_telemetry_versions',
    'ai_transition_snapshots',
    'ai_knowledge_base',
    'ai_recommendations'
];

if (!fs.existsSync(DB_PATH)) {
    console.error('[check-db] Brak pliku bazy: ' + DB_PATH);
    process.exit(1);
}

function checkWithNodeSqlite() {
    const sqlite = require('node:sqlite');
    const db = new sqlite.DatabaseSync(DB_PATH, { readOnly: true });
    try {
        const stmt = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        );
        const missing = [];
        for (const tbl of REQUIRED_TABLES) {
            const row = stmt.get(tbl);
            if (!row) missing.push(tbl);
        }
        return missing;
    } finally {
        db.close();
    }
}

function checkWithCli() {
    // Fallback — jeśli node:sqlite nie dostępne
    const { execSync } = require('child_process');
    const missing = [];
    for (const tbl of REQUIRED_TABLES) {
        try {
            execSync(`sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='${tbl}' LIMIT 1"`, {
                stdio: 'pipe'
            });
        } catch (e) {
            missing.push(tbl);
        }
    }
    return missing;
}

function check() {
    try {
        return checkWithNodeSqlite();
    } catch (e) {
        if (e.code === 'ERR_BROWSER_NOT_SUPPORTED' || e.code === 'MODULE_NOT_FOUND') {
            try {
                return checkWithCli();
            } catch (cliErr) {
                console.error('[check-db] Brak node:sqlite i sqlite3 CLI. Nie moge zweryfikowac bazy.');
                process.exit(2);
            }
        }
        throw e;
    }
}

const missing = check();

if (missing.length === 0) {
    console.log('[check-db] OK - wszystkie ' + REQUIRED_TABLES.length + ' tabel telemetry/AI istnieja.');
    process.exit(0);
}

console.warn('[check-db] BRAK tabel: ' + missing.join(', '));
console.warn('[check-db] Uruchom: npx prisma migrate deploy (lub db push dla dev)');
process.exit(1);
