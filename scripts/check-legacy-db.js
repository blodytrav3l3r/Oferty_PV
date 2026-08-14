'use strict';

const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'app_database.sqlite');

// Legacy = baza utworzona przez `prisma db push` (brak tabeli _prisma_migrations).
// Migration-managed = baza z historią migracji Prisma (tabela _prisma_migrations).
const MIGRATIONS_TABLE = '_prisma_migrations';

if (!fs.existsSync(DB_PATH)) {
    console.error('[check-legacy-db] Brak pliku bazy: ' + DB_PATH);
    process.exit(1);
}

function hasMigrationsTableWithNodeSqlite() {
    const sqlite = require('node:sqlite');
    const db = new sqlite.DatabaseSync(DB_PATH, { readOnly: true });
    try {
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
            .get(MIGRATIONS_TABLE);
        return !!row;
    } finally {
        db.close();
    }
}

function hasMigrationsTableWithCli() {
    const { execSync } = require('child_process');
    try {
        const out = execSync(
            `sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='${MIGRATIONS_TABLE}' LIMIT 1"`,
            { stdio: 'pipe' }
        );
        return !!out.toString().trim();
    } catch (e) {
        return false;
    }
}

function hasMigrationsTable() {
    try {
        return hasMigrationsTableWithNodeSqlite();
    } catch (e) {
        if (
            e.code === 'ERR_BROWSER_NOT_SUPPORTED' ||
            e.code === 'MODULE_NOT_FOUND' ||
            e.code === 'ERR_UNKNOWN_BUILTIN_MODULE'
        ) {
            return hasMigrationsTableWithCli();
        }
        throw e;
    }
}

if (hasMigrationsTable()) {
    // Migration-managed
    console.log('[check-legacy-db] OK - baza jest zarzadzana przez migracje Prisma.');
    process.exit(0);
}

// Legacy db-push
console.log(
    '[check-legacy-db] LEGACY - baza utworzona przez prisma db push (brak _prisma_migrations).'
);
process.exit(1);
