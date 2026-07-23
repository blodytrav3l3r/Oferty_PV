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

const PRODUCT_TABLES = [
    'ProductsRury',
    'ProductsStudnie',
    'PrecoKonfig',
    'PrecoKinety',
    'PrecoZakresy'
];

// Tabele ktore musza zawierac dane po udanym seedzie
const PRODUCT_DATA_CHECKS = [
    { table: 'ProductsRury', minRows: 1 },
    { table: 'ProductsStudnie', minRows: 1 },
    { table: 'PrecoKonfig', minRows: 1 }
];

if (!fs.existsSync(DB_PATH)) {
    console.error('[check-db] Brak pliku bazy: ' + DB_PATH);
    process.exit(1);
}

function checkWithNodeSqlite() {
    const sqlite = require('node:sqlite');
    const db = new sqlite.DatabaseSync(DB_PATH, { readOnly: true });
    try {
        const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
        const missingAI = [];
        for (const tbl of REQUIRED_TABLES) {
            const row = stmt.get(tbl);
            if (!row) missingAI.push(tbl);
        }

        const missingProduct = [];
        const existingProduct = [];
        for (const tbl of PRODUCT_TABLES) {
            const row = stmt.get(tbl);
            if (!row) missingProduct.push(tbl);
            else existingProduct.push(tbl);
        }

        const emptyProduct = [];
        for (const check of PRODUCT_DATA_CHECKS) {
            if (!existingProduct.includes(check.table)) continue;
            const row = db.prepare('SELECT COUNT(*) as cnt FROM "' + check.table + '"').get();
            if (!row || row.cnt < check.minRows) emptyProduct.push(check.table);
        }

        return { missingAI, missingProduct, emptyProduct };
    } finally {
        db.close();
    }
}

function checkWithCli() {
    const { execSync } = require('child_process');
    const missing = [];

    const allTables = [...REQUIRED_TABLES, ...PRODUCT_TABLES];
    for (const tbl of allTables) {
        try {
            execSync(
                `sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='${tbl}' LIMIT 1"`,
                { stdio: 'pipe' }
            );
        } catch (e) {
            missing.push(tbl);
        }
    }
    return {
        missingAI: missing.filter((t) => REQUIRED_TABLES.includes(t)),
        missingProduct: missing.filter((t) => PRODUCT_TABLES.includes(t)),
        emptyProduct: []
    };
}

function check() {
    try {
        return checkWithNodeSqlite();
    } catch (e) {
        if (e.code === 'ERR_BROWSER_NOT_SUPPORTED' || e.code === 'MODULE_NOT_FOUND') {
            try {
                return checkWithCli();
            } catch (cliErr) {
                console.error('[check-db] Brak node:sqlite i sqlite3 CLI.');
                process.exit(4);
            }
        }
        throw e;
    }
}

const result = check();

if (result.missingAI.length > 0 || result.missingProduct.length > 0) {
    const allMissing = [...result.missingAI, ...result.missingProduct];
    console.error('[check-db] BRAK TABEL: ' + allMissing.join(', '));
    process.exit(1);
}

if (result.emptyProduct.length > 0) {
    console.error('[check-db] PUSTE TABELE PRODUKTOW: ' + result.emptyProduct.join(', '));
    console.error('[check-db] Wymagany seed — uruchom npx ts-node prisma/seed.ts');
    process.exit(2);
}

console.log('[check-db] OK — wszystkie tabele i dane produktow obecne.');
process.exit(0);
