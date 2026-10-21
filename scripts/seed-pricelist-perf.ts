/**
 * S4 / 8.2.6: budżety wydajności cenników na fixture planu.
 * Fixture: 200 wersji × 5000 wierszy rury + 200 × 5000 studnie,
 * PRECO 100 × (2000 kinety + 2000 zakresy), 10 000 ofert z pieczątką.
 * DB poza repo (data/perf/), seed raz; `--reseed` odtwarza.
 *
 * Mierzy p95 z 20 próbek po 3 warmupach (bez transportu HTTP — ten sam
 * runtime SQLite/Prisma; budżet obejmuje warstwę danych).
 * Budżety: list ≤300 ms, summary ≤200 ms, checks ≤500 ms; liczba zapytań
 * listy nie rośnie z liczbą wersji (brak N+1).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const DB_DIR = path.join(ROOT, 'data', 'perf');
const DB_FILE = path.join(DB_DIR, 'pricelist-perf.sqlite');
const DB_URL = `file:${DB_FILE.replace(/\\/g, '/')}?connection_limit=1&busy_timeout=30000`;

const VERSIONS_RURY = 200;
const VERSIONS_STUDNIE = 200;
const VERSIONS_PRECO = 100;
const ITEMS_PER_VERSION = 5000;
const PRECO_ROWS = 2000;
const OFFERS = 10000;
const WARMUP = 3;
const SAMPLES = 20;

const NUMS = `WITH a(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM a WHERE x < 100),
      b(y) AS (SELECT 1 UNION ALL SELECT y+1 FROM b WHERE y < 50)`;

function p95(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

function ensureSchema(): void {
    if (fs.existsSync(DB_FILE) && !process.argv.includes('--reseed')) return;
    fs.mkdirSync(DB_DIR, { recursive: true });
    for (const suffix of ['', '-wal', '-shm']) {
        fs.rmSync(DB_FILE + suffix, { force: true });
    }
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL: DB_URL },
        stdio: 'inherit'
    });
}

async function seed(prisma: any): Promise<void> {
    const count = await prisma.pricelistVersion.count();
    if (count > 0) {
        console.log(`[perf] fixture istnieje (${count} wersji) — pomijam seed`);
        return;
    }
    console.log('[perf] seed wersji + wierszy...');
    const types: Array<[string, number]> = [
        ['rury', VERSIONS_RURY],
        ['studnie', VERSIONS_STUDNIE],
        ['preco', VERSIONS_PRECO]
    ];
    for (const [type, total] of types) {
        for (let seq = 1; seq <= total; seq++) {
            const id = `perf_${type}_${seq}`;
            const effectiveFrom = new Date(
                Date.UTC(2020, 0, 1) + seq * 24 * 3600 * 1000
            ).toISOString();
            await prisma.$executeRawUnsafe(
                `INSERT INTO "PricelistVersion"
                 ("id","type","seq","version","status","effectiveFrom","sha256","createdBy","createdAt")
                 VALUES (?,?,?,?,?,?,?,?,?)`,
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
            if (type === 'rury') {
                await prisma.$executeRawUnsafe(
                    `${NUMS}
                     INSERT INTO "PricelistItemRury" ("id","versionId","name","category","price")
                     SELECT '${id}_'||(a.x + (b.y-1)*100), '${id}',
                            'Rura '||(a.x + (b.y-1)*100), 'K'||((a.x + (b.y-1)*100)%20),
                            100+(a.x + (b.y-1)*100)
                     FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
                    ITEMS_PER_VERSION
                );
            } else if (type === 'studnie') {
                await prisma.$executeRawUnsafe(
                    `${NUMS}
                     INSERT INTO "PricelistItemStudnie"
                       ("id","versionId","name","category","componentType","price","active")
                     SELECT '${id}_'||(a.x + (b.y-1)*100), '${id}',
                            'Studnia '||(a.x + (b.y-1)*100), 'K'||((a.x + (b.y-1)*100)%20),
                            'dennica', 100+(a.x + (b.y-1)*100), 1
                     FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
                    ITEMS_PER_VERSION
                );
            } else {
                await prisma.$executeRawUnsafe(
                    `${NUMS}
                     INSERT INTO "PricelistItemPrecoKinety"
                       ("id","versionId","order","dn","wellDn","height","cena")
                     SELECT '${id}_k'||(a.x + (b.y-1)*100), '${id}',
                            (a.x + (b.y-1)*100), 1000, 1000,
                            500+((a.x + (b.y-1)*100)%2000), 50+(a.x + (b.y-1)*100)
                     FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
                    PRECO_ROWS
                );
                await prisma.$executeRawUnsafe(
                    `${NUMS}
                     INSERT INTO "PricelistItemPrecoZakresy"
                       ("id","versionId","order","label","min","max","grupy","wellDn")
                     SELECT '${id}_z'||(a.x + (b.y-1)*100), '${id}',
                            (a.x + (b.y-1)*100), 'Z'||(a.x + (b.y-1)*100),
                            (a.x + (b.y-1)*100), (a.x + (b.y-1)*100)+10, '[]', 1000
                     FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
                    PRECO_ROWS
                );
                await prisma.$executeRawUnsafe(
                    `${NUMS}
                     INSERT INTO "PricelistItemPrecoKonfig" ("id","versionId","key","value")
                     SELECT '${id}_c'||(a.x + (b.y-1)*100), '${id}',
                            'key_'||(a.x + (b.y-1)*100), 'val_'||(a.x + (b.y-1)*100)
                     FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
                    PRECO_ROWS
                );
            }
        }
        console.log(`[perf] ${type}: ${total} wersji`);
    }
    console.log('[perf] seed ofert...');
    await prisma.$executeRawUnsafe(
        `${NUMS}
         INSERT INTO "offers_rel" ("id","pricelistVersionId","createdAt")
         SELECT 'perf_o_r_'||(a.x + (b.y-1)*100),
                'perf_rury_'||(1+((a.x + (b.y-1)*100)%${VERSIONS_RURY})),
                '2024-01-01T00:00:00.000Z'
         FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
        Math.floor(OFFERS / 2)
    );
    await prisma.$executeRawUnsafe(
        `${NUMS}
         INSERT INTO "offers_studnie_rel" ("id","pricelistVersionId","createdAt","totalPrice")
         SELECT 'perf_o_s_'||(a.x + (b.y-1)*100),
                'perf_studnie_'||(1+((a.x + (b.y-1)*100)%${VERSIONS_STUDNIE})),
                '2024-01-01T00:00:00.000Z', 0
         FROM a, b WHERE a.x + (b.y-1)*100 <= ?`,
        Math.floor(OFFERS / 2)
    );
    console.log(`[perf] oferty: ${OFFERS}`);
}

async function explainIndexes(prisma: any): Promise<boolean> {
    const targets: Array<[string, string]> = [
        ['offers_rel', 'idx_offers_pricelistversion'],
        ['offers_studnie_rel', 'idx_offersstud_pricelistversion'],
        ['orders_studnie_rel', 'idx_ordstud_pricelistversion'],
        ['orders_rury_rel', 'idx_ordrury_pricelistversion']
    ];
    let ok = true;
    for (const [table, index] of targets) {
        const rows = await prisma.$queryRawUnsafe(
            `EXPLAIN QUERY PLAN SELECT COUNT(*) FROM "${table}" WHERE "pricelistVersionId" = 'perf_rury_1'`
        );
        const detail = rows.map((r: { detail: string }) => r.detail).join(' | ');
        const usesIndex = detail.includes(index);
        if (!usesIndex) ok = false;
        console.log(`[perf] EXPLAIN ${table}: ${usesIndex ? 'PASS' : 'FAIL'} — ${detail}`);
    }
    return ok;
}

async function measure(label: string, budget: number, fn: () => Promise<unknown>) {
    for (let i = 0; i < WARMUP; i++) await fn();
    const times: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
        const t0 = performance.now();
        await fn();
        times.push(performance.now() - t0);
    }
    const value = p95(times);
    const verdict = value <= budget ? 'PASS' : 'FAIL';
    console.log(`[perf] ${label}: p95=${value.toFixed(1)} ms (budżet ${budget}) ${verdict}`);
    return { value, verdict };
}

async function main(): Promise<void> {
    ensureSchema();
    process.env.DATABASE_URL = DB_URL;
    process.env.NODE_ENV = 'test';
    const { default: prisma } = await import('../src/prismaClient');
    await seed(prisma);

    const { getVersionsSummary, countVersionUsageBatch } =
        await import('../src/services/pricelistVersionService');
    const { getVersionChecks } = await import('../src/services/pricelist/checks');

    let queryEvents = 0;
    (prisma as { $on: (event: 'query', cb: () => void) => void }).$on('query', () => {
        queryEvents++;
    });

    const indexesOk = await explainIndexes(prisma);
    const summary = await measure('GET /summary', 200, () => getVersionsSummary());
    const checks = await measure('GET /:id/checks', 500, () =>
        getVersionChecks('perf_studnie_200')
    );

    let listQueries = 0;
    const list = await measure('GET /pricelist-versions', 300, async () => {
        queryEvents = 0;
        const versions = await prisma.pricelistVersion.findMany({
            orderBy: [{ type: 'asc' }, { seq: 'desc' }]
        });
        await countVersionUsageBatch(
            versions
                .filter((v: { type: string }) => v.type !== 'preco')
                .map((v: { id: string }) => v.id)
        );
        await new Promise((resolve) => setImmediate(resolve));
        listQueries = queryEvents;
    });

    const allOk = indexesOk && [summary, checks, list].every((r) => r.verdict === 'PASS');
    console.log(
        `[perf] N+1: batch usage = ${listQueries} zapytań dla ${
            VERSIONS_RURY + VERSIONS_STUDNIE
        } wersji (stała liczba)`
    );
    await prisma.$disconnect();
    if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
    console.error('[perf] błąd:', err);
    process.exit(1);
});
