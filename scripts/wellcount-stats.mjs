#!/usr/bin/env node
// F0: rozkład liczby studni na ofertę z realnej bazy (read-only, node:sqlite).
// Narzędzie produkcyjne — do uruchomienia na snapshocie prod (Q6).
// Użycie:
//   node scripts/wellcount-stats.mjs [dbPath] [--json]
//   WELLCOUNT_DB_PATH=/sciezka node scripts/wellcount-stats.mjs
// Domyślnie: data/app_database.sqlite (dev). Exit 2 = błąd odczytu.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dbArg = args.find((a) => !a.startsWith('--'));
const DB_PATH =
    dbArg ||
    process.env.WELLCOUNT_DB_PATH ||
    path.resolve(import.meta.dirname, '..', 'data', 'app_database.sqlite');

const BUCKETS = [
    [0, 0],
    [1, 10],
    [11, 50],
    [51, 68],
    [69, 200],
    [201, 500],
    [501, 1000],
    [1001, 3000],
    [3001, Infinity]
];

function pct(sorted, p) {
    if (!sorted.length) return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[i];
}

function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('Brak pliku bazy: ' + DB_PATH);
        process.exit(2);
    }
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    try {
        const rows = db
            .prepare('SELECT wellCount, length(data) AS dataLen FROM offers_studnie_rel')
            .all();
        const counts = rows.map((r) => Number(r.wellCount) || 0).sort((a, b) => a - b);
        const n = counts.length;
        const sum = counts.reduce((a, b) => a + b, 0);
        const zeros = counts.filter((c) => c === 0).length;
        const dataLens = rows.map((r) => Number(r.dataLen) || 0).sort((a, b) => a - b);
        const distribution = BUCKETS.map(([lo, hi]) => ({
            range: lo + '-' + (hi === Infinity ? 'inf' : hi),
            offers: counts.filter((c) => c >= lo && c <= hi).length
        }));

        const sample = db
            .prepare(
                'SELECT wellCount, data FROM offers_studnie_rel ORDER BY wellCount DESC LIMIT 8'
            )
            .all();
        const sanity = sample.map((s) => {
            let real = -1;
            try {
                const j = JSON.parse(s.data || '{}');
                real = Array.isArray(j.wells) ? j.wells.length : -1;
            } catch {
                real = -1;
            }
            return { wellCount: s.wellCount, jsonWells: real, match: real === s.wellCount };
        });

        const report = {
            dbPath: DB_PATH,
            offersTotal: n,
            offersEmpty: zeros,
            offersNonEmpty: n - zeros,
            wellsSum: sum,
            wellsMean: n ? Number((sum / n).toFixed(2)) : 0,
            min: counts[0] ?? 0,
            max: counts[n - 1] ?? 0,
            p50: pct(counts, 50),
            p75: pct(counts, 75),
            p90: pct(counts, 90),
            p95: pct(counts, 95),
            p99: pct(counts, 99),
            distribution,
            dataJsonBytes: {
                p50: pct(dataLens, 50),
                p90: pct(dataLens, 90),
                p99: pct(dataLens, 99),
                max: dataLens[dataLens.length - 1] ?? 0
            },
            sanity
        };

        if (asJson) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log('=== offers_studnie_rel wellCount | ' + DB_PATH + ' ===');
            console.log(
                'ofert:',
                n,
                '| puste:',
                zeros,
                '| niepuste:',
                n - zeros,
                '| studnie:',
                sum,
                '| mean:',
                report.wellsMean
            );
            console.log(
                'min:',
                report.min,
                'max:',
                report.max,
                '| p50:',
                report.p50,
                'p75:',
                report.p75,
                'p90:',
                report.p90,
                'p95:',
                report.p95,
                'p99:',
                report.p99
            );
            console.log('rozkład (ofert/oferta):');
            for (const d of distribution) console.log('  ' + d.range.padEnd(10), d.offers);
            console.log(
                'data JSON B | p50:',
                report.dataJsonBytes.p50,
                'p90:',
                report.dataJsonBytes.p90,
                'p99:',
                report.dataJsonBytes.p99,
                'max:',
                report.dataJsonBytes.max
            );
            console.log('sanity (wellCount vs JSON wells.length):');
            for (const s of sanity)
                console.log(
                    '  wellCount=' + s.wellCount,
                    '| JSON=' + s.jsonWells,
                    s.match ? 'OK' : 'MISMATCH'
                );
        }
    } finally {
        db.close();
    }
}

main();
