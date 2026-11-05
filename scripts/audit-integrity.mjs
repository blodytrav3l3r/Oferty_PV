#!/usr/bin/env node
// PostgreSQL-only domain integrity gate. JSON stdout; exit 0 PASS / 1 FAIL.
import { Client } from 'pg';

function parseProdNumber(value) {
    if (typeof value !== 'string') return null;
    const parts = value.split('/');
    if (parts.length < 4) return null;
    const seq = Number.parseInt(parts[2], 10);
    const year = 2000 + Number.parseInt(parts[3], 10);
    if (!Number.isInteger(seq) || seq <= 0 || !Number.isInteger(year)) return null;
    return { seq, year };
}

function parseDatabaseConfig(rawUrl) {
    if (!rawUrl) throw new Error('DATABASE_URL is required');
    const url = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('DATABASE_URL must use PostgreSQL');
    }
    const schema = url.searchParams.get('schema') || 'public';
    if (!url.hostname || url.pathname.length < 2 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
        throw new Error('DATABASE_URL must include a valid PostgreSQL host, database and schema');
    }
    url.searchParams.delete('schema');
    return { connectionString: url.toString(), schema };
}

async function main() {
    const config = parseDatabaseConfig(process.env.DATABASE_URL);
    const client = new Client({ connectionString: config.connectionString });
    let connected = false;
    const checks = {};
    const warnings = {};
    let failed = false;
    const fail = (name, count, detail) => {
        checks[name] = Number(count);
        if (Number(count) > 0) {
            failed = true;
            if (detail?.length) checks[`${name}Detail`] = detail;
        }
    };
    const warn = (name, count) => {
        warnings[name] = Number(count);
    };
    const tableExists = async (table) => {
        const result = await client.query(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE') AS present",
            [config.schema, table]
        );
        return result.rows[0]?.present === true;
    };
    const columnsFor = async (table) => {
        const result = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
            [config.schema, table]
        );
        return new Set(result.rows.map((row) => row.column_name));
    };
    const count = async (sql, values = []) => {
        const result = await client.query(sql, values);
        return Number(result.rows[0]?.count ?? 0);
    };
    const table = (name) => `"${config.schema}"."${name}"`;

    try {
        await client.connect();
        connected = true;
        await client.query('SELECT 1');
        checks.databaseReachable = 1;

        if (!(await tableExists('production_orders_rel'))) {
            fail('noRecognizedTables', 1, ['production_orders_rel missing']);
        } else {
            const productionColumns = await columnsFor('production_orders_rel');
            const hasProductionNumber = productionColumns.has('productionNumber');
            if (hasProductionNumber) {
                const duplicateRows = await client.query(
                    `SELECT "userId", "productionNumber", COUNT(*)::bigint AS count
                     FROM ${table('production_orders_rel')}
                     WHERE "productionNumber" IS NOT NULL
                     GROUP BY "userId", "productionNumber" HAVING COUNT(*) > 1
                     LIMIT 5`
                );
                fail(
                    'duplicateProductionNumbers',
                    duplicateRows.rows.reduce((sum, row) => sum + Number(row.count) - 1, 0),
                    duplicateRows.rows
                );
            } else {
                warnings.productionNumberColumnMissing = 1;
                checks.duplicateProductionNumbers = 0;
            }

            let orphanOfferItems = 0;
            if ((await tableExists('offer_items_rel')) && (await tableExists('offers_rel'))) {
                orphanOfferItems = await count(
                    `SELECT COUNT(*)::bigint AS count FROM ${table('offer_items_rel')} i
                     WHERE NOT EXISTS (SELECT 1 FROM ${table('offers_rel')} o WHERE o.id = i."offerId")`
                );
            }
            fail('orphanOfferItems', orphanOfferItems);

            let studnieItemsRows = 0;
            let studnieItemsOrphans = 0;
            if (await tableExists('offer_studnie_items_rel')) {
                studnieItemsRows = await count(
                    `SELECT COUNT(*)::bigint AS count FROM ${table('offer_studnie_items_rel')}`
                );
                if (await tableExists('offers_studnie_rel')) {
                    studnieItemsOrphans = await count(
                        `SELECT COUNT(*)::bigint AS count FROM ${table('offer_studnie_items_rel')} i
                         WHERE i."offerId" IS NOT NULL AND NOT EXISTS
                         (SELECT 1 FROM ${table('offers_studnie_rel')} o WHERE o.id = i."offerId")`
                    );
                }
            }
            checks.studnieItemsRows = studnieItemsRows;
            fail('studnieItemsOrphans', studnieItemsOrphans);

            const dataColumn = productionColumns.has('data') ? ', data' : '';
            const numberColumn = hasProductionNumber ? ', "productionNumber"' : '';
            const productionRows = await client.query(
                `SELECT "userId"${dataColumn}${numberColumn} FROM ${table('production_orders_rel')} WHERE data IS NOT NULL`
            );
            const assigned = new Map();
            const maxSequence = new Map();
            for (const row of productionRows.rows) {
                let number = (hasProductionNumber && row.productionNumber) || null;
                if (!number) {
                    try {
                        number = JSON.parse(row.data || '{}').productionOrderNumber;
                    } catch {
                        number = null;
                    }
                }
                const parsed = parseProdNumber(number);
                if (!parsed || !row.userId) continue;
                const key = `${row.userId}|${parsed.year}|${parsed.seq}`;
                assigned.set(key, (assigned.get(key) || 0) + 1);
                const yearKey = `${row.userId}|${parsed.year}`;
                maxSequence.set(yearKey, Math.max(maxSequence.get(yearKey) || 0, parsed.seq));
            }

            let recycledCollision = 0;
            const collisionDetail = [];
            if (await tableExists('recycled_production_numbers')) {
                const recycledRows = await client.query(
                    `SELECT "userId", year, "seqNumber" FROM ${table('recycled_production_numbers')}`
                );
                for (const row of recycledRows.rows) {
                    if (!assigned.has(`${row.userId}|${row.year}|${row.seqNumber}`)) continue;
                    recycledCollision++;
                    if (collisionDetail.length < 5) collisionDetail.push(row);
                }
            }
            fail('recycledCollision', recycledCollision, collisionDetail);

            let counterRegression = 0;
            const regressionDetail = [];
            if (await tableExists('production_order_counters')) {
                const counters = await client.query(
                    `SELECT "userId", year, "lastNumber" FROM ${table('production_order_counters')}`
                );
                for (const row of counters.rows) {
                    const max = maxSequence.get(`${row.userId}|${row.year}`) || 0;
                    if (Number(row.lastNumber || 0) >= max) continue;
                    counterRegression++;
                    if (regressionDetail.length < 5)
                        regressionDetail.push({ ...row, maxAssigned: max });
                }
            }
            fail('counterRegression', counterRegression, regressionDetail);

            for (const name of [
                'production_orders_rel',
                'orders_studnie_rel',
                'orders_rury_rel',
                'offers_rel',
                'offers_studnie_rel'
            ]) {
                if (!(await tableExists(name))) continue;
                if (!(await columnsFor(name)).has('userId')) continue;
                warn(
                    `nullOwner:${name}`,
                    await count(
                        `SELECT COUNT(*)::bigint AS count FROM ${table(name)} WHERE "userId" IS NULL`
                    )
                );
            }

            if (
                (await tableExists('document_shares')) &&
                (await tableExists('offers_rel')) &&
                (await tableExists('offers_studnie_rel'))
            ) {
                const orphanShares = await count(
                    `SELECT COUNT(*)::bigint AS count FROM ${table('document_shares')} s
                     WHERE (s."documentType" = 'offer' AND NOT EXISTS (SELECT 1 FROM ${table('offers_rel')} o WHERE o.id = s."documentId"))
                        OR (s."documentType" = 'offer_studnie' AND NOT EXISTS (SELECT 1 FROM ${table('offers_studnie_rel')} o WHERE o.id = s."documentId"))`
                );
                fail('orphanShares', orphanShares);
            } else {
                warnings.sharesSkipped = 1;
            }
        }
        const domainChecks = Object.keys(checks).filter((key) => key !== 'databaseReachable');
        if (domainChecks.length === 0) fail('noRecognizedTables', 1);
        console.log(JSON.stringify({ status: failed ? 'FAIL' : 'PASS', checks, warnings }));
        process.exitCode = failed ? 1 : 0;
    } catch (error) {
        console.log(
            JSON.stringify({
                status: 'ERROR',
                error: 'PostgreSQL integrity audit failed',
                checks,
                warnings
            })
        );
        process.exitCode = 1;
    } finally {
        if (connected) await client.end();
    }
}

main().catch(() => {
    console.log(
        JSON.stringify({
            status: 'ERROR',
            error: 'PostgreSQL integrity audit failed',
            checks: {},
            warnings: {}
        })
    );
    process.exitCode = 1;
});
