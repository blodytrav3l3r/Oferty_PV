/**
 * PostgreSQL 18 performance fixture for pricelist endpoints.
 * Requires POSTGRES_TEST_URL for a local disposable database ending `_test`.
 * Each run creates a unique schema, deploys the canonical migrations, seeds it,
 * measures the endpoint services, then drops only that schema.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const ROOT = path.resolve(__dirname, '..');
const VERSIONS_RURY = 200;
const VERSIONS_STUDNIE = 200;
const VERSIONS_PRECO = 100;
const ITEMS_PER_VERSION = 5000;
const PRECO_ROWS = 2000;
const OFFERS = 10000;
const WARMUP = 3;
const SAMPLES = 20;
const INDEX_TARGETS = [
    ['offers_rel', 'idx_offers_pricelistversion'],
    ['offers_studnie_rel', 'idx_offersstud_pricelistversion'],
    ['orders_studnie_rel', 'idx_ordstud_pricelistversion'],
    ['orders_rury_rel', 'idx_ordrury_pricelistversion']
] as const;

interface IsolatedSchema {
    schemaName: string;
    databaseUrl: string;
    baseUrl: string;
}

interface MeasureResult {
    value: number;
    verdict: 'PASS' | 'FAIL';
}

function requireTestDatabaseUrl(rawUrl: string | undefined): URL {
    if (!rawUrl) throw new Error('POSTGRES_TEST_URL is required');
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('POSTGRES_TEST_URL must be a valid PostgreSQL URL');
    }
    const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
    const host = url.hostname.toLowerCase();
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('POSTGRES_TEST_URL must use PostgreSQL');
    }
    if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)) {
        throw new Error('Performance fixture requires a local test PostgreSQL host');
    }
    if (!database.endsWith('_test') && !database.endsWith('_test_db')) {
        throw new Error('Performance fixture database name must end with _test or _test_db');
    }
    url.searchParams.delete('schema');
    return url;
}

async function createIsolatedSchema(): Promise<IsolatedSchema> {
    const baseUrl = requireTestDatabaseUrl(process.env.POSTGRES_TEST_URL);
    const schemaName = `sok_perf_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    const admin = new Client({ connectionString: baseUrl.toString() });
    await admin.connect();
    try {
        await admin.query(`CREATE SCHEMA "${schemaName}"`);
    } finally {
        await admin.end();
    }

    const databaseUrl = new URL(baseUrl);
    databaseUrl.searchParams.set('schema', schemaName);
    const isolated = {
        schemaName,
        databaseUrl: databaseUrl.toString(),
        baseUrl: baseUrl.toString()
    };
    try {
        execFileSync(
            process.execPath,
            [path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
            {
                cwd: ROOT,
                env: { ...process.env, DATABASE_URL: isolated.databaseUrl },
                stdio: 'inherit',
                timeout: 120_000
            }
        );
    } catch (error) {
        await dropIsolatedSchema(isolated);
        throw error;
    }
    return isolated;
}

async function dropIsolatedSchema(isolated: IsolatedSchema): Promise<void> {
    const admin = new Client({ connectionString: isolated.baseUrl });
    await admin.connect();
    try {
        await admin.query(`DROP SCHEMA IF EXISTS "${isolated.schemaName}" CASCADE`);
    } finally {
        await admin.end();
    }
}

function p95(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

async function runQuery(query: string, ...parameters: unknown[]): Promise<number> {
    return await getPrisma().$executeRawUnsafe(query, ...parameters);
}

let prismaClient: Awaited<typeof import('../src/prismaClient')>['default'] | null = null;
function getPrisma() {
    if (!prismaClient) throw new Error('Prisma client has not been initialized');
    return prismaClient;
}

async function seed(): Promise<void> {
    const types = [
        ['rury', VERSIONS_RURY],
        ['studnie', VERSIONS_STUDNIE],
        ['preco', VERSIONS_PRECO]
    ] as const;
    for (const [type, total] of types) {
        for (let seq = 1; seq <= total; seq++) {
            const id = `perf_${type}_${seq}`;
            const effectiveFrom = new Date(Date.UTC(2020, 0, 1) + seq * 86_400_000).toISOString();
            await runQuery(
                `INSERT INTO "PricelistVersion"
                 ("id","type","seq","version","status","effectiveFrom","sha256","createdBy","createdAt")
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                id,
                type,
                seq,
                `v${seq}`,
                'APPROVED',
                effectiveFrom,
                `sha_${type}_${seq}`,
                'perf',
                effectiveFrom
            );
            if (type === 'rury') await seedRuryItems(id);
            else if (type === 'studnie') await seedStudnieItems(id);
            else await seedPrecoItems(id);
        }
        process.stdout.write(`[perf] ${type}: ${total} wersji\n`);
    }
    await seedOffers();
}

async function seedRuryItems(versionId: string): Promise<void> {
    await runQuery(
        `INSERT INTO "PricelistItemRury" ("id","versionId","name","category","price")
         SELECT $1 || '_' || item_no, $1, 'Rura ' || item_no,
                'K' || (item_no % 20), 100 + item_no
         FROM generate_series(1, $2::integer) AS generated(item_no)`,
        versionId,
        ITEMS_PER_VERSION
    );
}

async function seedStudnieItems(versionId: string): Promise<void> {
    await runQuery(
        `INSERT INTO "PricelistItemStudnie"
           ("id","versionId","name","category","componentType","price","active")
         SELECT $1 || '_' || item_no, $1, 'Studnia ' || item_no,
                'K' || (item_no % 20), 'dennica', 100 + item_no, true
         FROM generate_series(1, $2::integer) AS generated(item_no)`,
        versionId,
        ITEMS_PER_VERSION
    );
}

async function seedPrecoItems(versionId: string): Promise<void> {
    await runQuery(
        `INSERT INTO "PricelistItemPrecoKinety"
           ("id","versionId","order","dn","wellDn","height","cena")
         SELECT $1 || '_k' || row_no, $1, row_no, 1000, 1000,
                500 + (row_no % 2000), 50 + row_no
         FROM generate_series(1, $2::integer) AS generated(row_no)`,
        versionId,
        PRECO_ROWS
    );
    await runQuery(
        `INSERT INTO "PricelistItemPrecoZakresy"
           ("id","versionId","order","label","min","max","grupy","wellDn")
         SELECT $1 || '_z' || row_no, $1, row_no, 'Z' || row_no,
                row_no, row_no + 10, '[]', 1000
         FROM generate_series(1, $2::integer) AS generated(row_no)`,
        versionId,
        PRECO_ROWS
    );
    await runQuery(
        `INSERT INTO "PricelistItemPrecoKonfig" ("id","versionId","key","value")
         SELECT $1 || '_c' || row_no, $1, 'key_' || row_no, 'val_' || row_no
         FROM generate_series(1, $2::integer) AS generated(row_no)`,
        versionId,
        PRECO_ROWS
    );
}

async function seedOffers(): Promise<void> {
    await runQuery(
        `INSERT INTO "offers_rel" ("id","pricelistVersionId","createdAt")
         SELECT 'perf_o_r_' || row_no,
                'perf_rury_' || (1 + row_no % $1::integer), '2024-01-01T00:00:00.000Z'
         FROM generate_series(1, $2::integer) AS generated(row_no)`,
        VERSIONS_RURY,
        Math.floor(OFFERS / 2)
    );
    await runQuery(
        `INSERT INTO "offers_studnie_rel" ("id","pricelistVersionId","createdAt","totalPrice")
         SELECT 'perf_o_s_' || row_no,
                'perf_studnie_' || (1 + row_no % $1::integer), '2024-01-01T00:00:00.000Z', 0
         FROM generate_series(1, $2::integer) AS generated(row_no)`,
        VERSIONS_STUDNIE,
        Math.floor(OFFERS / 2)
    );
    process.stdout.write(`[perf] oferty: ${OFFERS}\n`);
}

async function explainIndexes(): Promise<boolean> {
    let ok = true;
    for (const [table, index] of INDEX_TARGETS) {
        const rows = await getPrisma().$transaction(async (transaction) => {
            await transaction.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
            return transaction.$queryRawUnsafe<Array<Record<string, unknown>>>(
                `EXPLAIN (FORMAT TEXT) SELECT COUNT(*) FROM "${table}" WHERE "pricelistVersionId" = $1`,
                'perf_rury_1'
            );
        });
        const detail = rows.map((row) => Object.values(row).join(' ')).join(' | ');
        const usesIndex = detail.includes(index);
        ok = ok && usesIndex;
        process.stdout.write(
            `[perf] EXPLAIN ${table}: ${usesIndex ? 'PASS' : 'FAIL'} — ${detail}\n`
        );
    }
    return ok;
}

async function measure(
    label: string,
    budget: number,
    action: () => Promise<unknown>
): Promise<MeasureResult> {
    for (let index = 0; index < WARMUP; index++) await action();
    const times: number[] = [];
    for (let index = 0; index < SAMPLES; index++) {
        const startedAt = performance.now();
        await action();
        times.push(performance.now() - startedAt);
    }
    const value = p95(times);
    const verdict = value <= budget ? 'PASS' : 'FAIL';
    process.stdout.write(
        `[perf] ${label}: p95=${value.toFixed(1)} ms (budżet ${budget}) ${verdict}\n`
    );
    return { value, verdict };
}

async function runMeasurements(): Promise<boolean> {
    const { getVersionsSummary, countVersionUsageBatch } =
        await import('../src/services/pricelistVersionService');
    const { getVersionChecks } = await import('../src/services/pricelist/checks');
    let queryEvents = 0;
    (getPrisma() as unknown as { $on: (event: 'query', callback: () => void) => void }).$on(
        'query',
        () => {
            queryEvents++;
        }
    );

    const indexesOk = await explainIndexes();
    const summary = await measure('GET /summary', 200, () => getVersionsSummary());
    const checks = await measure('GET /:id/checks', 500, () =>
        getVersionChecks('perf_studnie_200')
    );
    let listQueries = 0;
    const list = await measure('GET /pricelist-versions', 300, async () => {
        queryEvents = 0;
        const versions = await getPrisma().pricelistVersion.findMany({
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        await countVersionUsageBatch(
            versions.filter((version) => version.type !== 'preco').map((version) => version.id)
        );
        await new Promise((resolve) => setImmediate(resolve));
        listQueries = queryEvents;
    });
    process.stdout.write(
        `[perf] N+1: batch usage = ${listQueries} zapytań dla ${VERSIONS_RURY + VERSIONS_STUDNIE} wersji (stała liczba)\n`
    );
    return indexesOk && [summary, checks, list].every((result) => result.verdict === 'PASS');
}

async function main(): Promise<void> {
    process.env.NODE_ENV = 'test';
    const isolated = await createIsolatedSchema();
    process.env.DATABASE_URL = isolated.databaseUrl;
    let success = false;
    try {
        const prismaModule = await import('../src/prismaClient');
        prismaClient = prismaModule.default;
        await seed();
        success = await runMeasurements();
    } finally {
        if (prismaClient) await prismaClient.$disconnect();
        await dropIsolatedSchema(isolated);
    }
    if (!success) process.exitCode = 1;
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown performance fixture error';
    process.stderr.write(`[perf] ${message}\n`);
    process.exitCode = 1;
});
