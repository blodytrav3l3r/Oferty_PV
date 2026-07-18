import prisma from '../src/prismaClient';

async function main() {
    console.log('Creating FTS5 table offers_search_fts...');
    await prisma.$executeRawUnsafe(`
        CREATE VIRTUAL TABLE IF NOT EXISTS offers_search_fts USING fts5(
            id UNINDEXED,
            offer_number,
            clientName,
            investName,
            type UNINDEXED,
            tokenize='porter unicode61'
        )
    `);
    console.log('  OK');

    const existing = (await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) AS cnt FROM offers_search_fts'
    )) as any[];
    const count = Number(existing[0]?.cnt || 0);
    if (count > 0) {
        console.log(`FTS5 has ${count} rows, skipping backfill`);
        return;
    }

    console.log('Backfill offers_rel...');
    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, type)
        SELECT id, offer_number, clientName, investName, 'rury'
        FROM offers_rel WHERE id IS NOT NULL
    `);
    console.log('  OK');

    console.log('Backfill offers_studnie_rel...');
    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, type)
        SELECT id, offer_number, clientName, investName, 'studnie'
        FROM offers_studnie_rel WHERE id IS NOT NULL
    `);
    console.log('  OK');

    const total = (await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) AS cnt FROM offers_search_fts'
    )) as any[];
    console.log(`FTS5 ready: ${Number(total[0]?.cnt)} rows`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
