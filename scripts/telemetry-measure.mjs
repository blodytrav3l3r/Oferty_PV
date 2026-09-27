/**
 * P1.6: pomiar wzrostu tabel (telemetria + audyt) — measure przed retention.
 * Użycie: node scripts/telemetry-measure.mjs [ścieżka-do-sqlite]
 * Progi (WARN, nie blokada):
 * - ai_telemetry_logs > 500k wierszy lub wzrost > 50 MB/dzień -> zaprojektuj retencję
 * - audit_logs > 5 GB -> przegląd polityki 180 dni / rozmiaru snapshotów
 * Wyjście: JSON + exit 0 (zawsze informacyjnie, nigdy gate).
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const dbPath = process.argv[2] || 'data/app_database.sqlite';
if (!fs.existsSync(dbPath)) {
    console.error(`[measure] brak bazy: ${dbPath}`);
    process.exit(2);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

function tableStat(name) {
    try {
        const size = db
            .prepare('SELECT COALESCE(SUM(pgsize),0) AS s FROM dbstat WHERE name=?')
            .get(name);
        const rows = db
            .prepare(
                `SELECT COUNT(*) AS c, MIN(createdAt) AS mn, MAX(createdAt) AS mx FROM "${name}"`
            )
            .get();
        const out = { rows: rows.c, bytes: size.s, min: rows.mn, max: rows.mx };
        if (rows.mn && rows.mx) {
            const days = Math.max(1, (new Date(rows.mx) - new Date(rows.mn)) / 86400000);
            out.rowsPerDay = Math.round(rows.c / days);
            out.bytesPerDay = Math.round(size.s / days);
        }
        return out;
    } catch (e) {
        return { error: String(e.message || e).slice(0, 120) };
    }
}

const pageCount = db.prepare('PRAGMA page_count').get().page_count;
const pageSize = db.prepare('PRAGMA page_size').get().page_size;

const report = {
    dbPath,
    dbBytes: pageCount * pageSize,
    tables: {
        ai_telemetry_logs: tableStat('ai_telemetry_logs'),
        ai_telemetry_events: tableStat('ai_telemetry_events'),
        audit_logs: tableStat('audit_logs')
    },
    thresholds: {
        telemetryRowsWarn: 500000,
        telemetryGrowthWarnBytesDay: 50 * 1024 * 1024,
        auditBytesWarn: 5 * 1024 * 1024 * 1024
    },
    warnings: []
};

const t = report.tables.ai_telemetry_logs;
if (t.rows > report.thresholds.telemetryRowsWarn)
    report.warnings.push('telemetry rows powyżej progu');
if (t.bytesPerDay > report.thresholds.telemetryGrowthWarnBytesDay)
    report.warnings.push('telemetry wzrost powyżej progu');
if ((report.tables.audit_logs.bytes || 0) > report.thresholds.auditBytesWarn)
    report.warnings.push('audit powyżej 5 GB');

db.close();

console.log(JSON.stringify(report, null, 2));
