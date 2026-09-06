#!/usr/bin/env node
// P0-H: `npm run audit:integrity` — determinystyczny, machine-readable gate.
// JSON na stdout + exit 0 (PASS) / 1 (FAIL). Użycie: po restore, przed deploy,
// po migracji, po load-teście, okresowo.
// FAIL (integralność naruszona): duplicates, orphans, recycledCollision,
//   counterRegression, integrity_check.
// WARN (dług legacy, broniony w runtime): nullOwner.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH =
    process.env.AUDIT_DB_PATH ||
    path.resolve(import.meta.dirname, '..', 'data', 'app_database.sqlite');

function parseProdNumber(s) {
    if (typeof s !== 'string') return null;
    const parts = s.split('/');
    if (parts.length < 4) return null;
    const seq = parseInt(parts[2], 10);
    const year = 2000 + parseInt(parts[3], 10);
    if (!Number.isInteger(seq) || seq <= 0 || !Number.isInteger(year)) return null;
    return { seq, year };
}

const checks = {};
const warnings = {};
let failed = false;

function fail(name, count, detail) {
    checks[name] = count;
    if (count > 0) {
        failed = true;
        if (detail) checks[name + 'Detail'] = detail;
    }
}

function warn(name, count) {
    warnings[name] = count;
}

try {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });

    // 0. integralność fizyczna.
    const ic = db.prepare('PRAGMA integrity_check').get();
    fail('integrityCheck', ic.integrity_check === 'ok' ? 0 : 1, ic.integrity_check);

    const has = (t) =>
        db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name=?").get(t)
            .n > 0;

    // 1. Duble finalnych numerów produkcji per user (P0-A invariant).
    if (has('production_orders_rel')) {
        const prodCols = db.prepare('PRAGMA table_info(production_orders_rel)').all();
        if (prodCols.some((c) => c.name === 'productionNumber')) {
            const dups = db
                .prepare(
                    `SELECT "userId", "productionNumber", COUNT(*) AS c
                     FROM production_orders_rel
                     WHERE "productionNumber" IS NOT NULL
                     GROUP BY "userId", "productionNumber" HAVING c > 1 LIMIT 5`
                )
                .all();
            fail(
                'duplicateProductionNumbers',
                dups.reduce((a, r) => a + r.c - 1, 0),
                dups.slice(0, 5)
            );
        } else {
            warnings.productionNumberColumnMissing = 1;
            checks.duplicateProductionNumbers = 0;
        }

        // 2. Osierocone pozycje ofert rur.
        let orphanItems = 0;
        if (has('offer_items_rel') && has('offers_rel')) {
            orphanItems = db
                .prepare(
                    `SELECT COUNT(*) AS n FROM offer_items_rel
                     WHERE "offerId" NOT IN (SELECT id FROM offers_rel)`
                )
                .get().n;
        }
        fail('orphanOfferItems', orphanItems);

        // 3. Zblokowane dane PZ: recycled kolidujący z żywym numerem + licznik cofnięty.
        const prodCols2 = db.prepare('PRAGMA table_info(production_orders_rel)').all();
        const hasProdNum = prodCols2.some((c) => c.name === 'productionNumber');
        const rows = db
            .prepare(
                `SELECT "userId", data${hasProdNum ? ', "productionNumber"' : ''} FROM production_orders_rel WHERE data IS NOT NULL`
            )
            .all();
        const assigned = new Map(); // userId|year|seq -> count
        const maxSeq = new Map(); // userId|year -> max seq
        for (const r of rows) {
            // Kolumna ma pierwszeństwo (P0-A), blob to fallback.
            let num = (hasProdNum && r.productionNumber) || null;
            if (!num) {
                try {
                    num = JSON.parse(r.data || '{}').productionOrderNumber;
                } catch {
                    num = null;
                }
            }
            const parsed = parseProdNumber(num);
            if (!parsed || !r.userId) continue;
            const key = `${r.userId}|${parsed.year}|${parsed.seq}`;
            assigned.set(key, (assigned.get(key) || 0) + 1);
            const mk = `${r.userId}|${parsed.year}`;
            maxSeq.set(mk, Math.max(maxSeq.get(mk) || 0, parsed.seq));
        }
        let recycledCollision = 0;
        const collisionDetail = [];
        if (has('recycled_production_numbers')) {
            const rec = db
                .prepare('SELECT "userId", year, "seqNumber" FROM recycled_production_numbers')
                .all();
            for (const x of rec) {
                if (assigned.has(`${x.userId}|${x.year}|${x.seqNumber}`)) {
                    recycledCollision++;
                    if (collisionDetail.length < 5) collisionDetail.push(x);
                }
            }
        }
        fail('recycledCollision', recycledCollision, collisionDetail);

        let counterRegression = 0;
        const regressionDetail = [];
        if (has('production_order_counters')) {
            const counters = db
                .prepare('SELECT "userId", year, "lastNumber" FROM production_order_counters')
                .all();
            for (const c of counters) {
                const mk = `${c.userId}|${c.year}`;
                const max = maxSeq.get(mk) || 0;
                if ((c.lastNumber || 0) < max) {
                    counterRegression++;
                    if (regressionDetail.length < 5)
                        regressionDetail.push({
                            userId: c.userId,
                            year: c.year,
                            lastNumber: c.lastNumber,
                            maxAssigned: max
                        });
                }
            }
        }
        fail('counterRegression', counterRegression, regressionDetail);

        // 4. Legacy bez właściciela (WARN — runtime odmawia, canWriteDoc deny-NULL).
        for (const t of [
            'production_orders_rel',
            'orders_studnie_rel',
            'orders_rury_rel',
            'offers_rel',
            'offers_studnie_rel'
        ]) {
            if (!has(t)) continue;
            const cols = db.prepare(`PRAGMA table_info(${t})`).all();
            if (!cols.some((c) => c.name === 'userId')) continue;
            warn(
                `nullOwner:${t}`,
                db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE "userId" IS NULL`).get().n
            );
        }

        // 5. Osierocone shares (best-effort — tabela może nie istnieć na legacy).
        try {
            if (has('document_shares')) {
                const orph = db
                    .prepare(
                        `SELECT COUNT(*) AS n FROM document_shares
                         WHERE ("documentType" = 'offer' AND "documentId" NOT IN (SELECT id FROM offers_rel))
                            OR ("documentType" = 'offer_studnie' AND "documentId" NOT IN (SELECT id FROM offers_studnie_rel))`
                    )
                    .get().n;
                fail('orphanShares', orph);
            }
        } catch {
            warnings.sharesSkipped = 1;
        }
    }

    db.close();
} catch (e) {
    console.log(JSON.stringify({ status: 'ERROR', error: e.message, checks: {}, warnings: {} }));
    process.exit(1);
}

console.log(JSON.stringify({ status: failed ? 'FAIL' : 'PASS', checks, warnings }));
process.exit(failed ? 1 : 0);
