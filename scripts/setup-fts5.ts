import prisma from '../src/prismaClient';

const FTS_COLUMNS = ['id', 'offer_number', 'clientName', 'investName', 'clientNumber', 'type'];

async function tableExists(): Promise<boolean> {
    const r = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='offers_search_fts'"
    );
    return r.length > 0;
}

async function getColumns(): Promise<string[]> {
    const r = await prisma.$queryRawUnsafe<{ name: string }[]>(
        'PRAGMA table_info(offers_search_fts)'
    );
    return r.map((c) => c.name);
}

function createFtsTable(): string {
    return `
        CREATE VIRTUAL TABLE IF NOT EXISTS offers_search_fts USING fts5(
            id UNINDEXED,
            offer_number,
            clientName,
            investName,
            clientNumber,
            type UNINDEXED,
            tokenize='porter unicode61'
        )
    `;
}

async function backfill(): Promise<void> {
    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type)
        SELECT id, offer_number, clientName, investName,
               COALESCE(NULLIF(clientNumber, ''), json_extract(data, '$.clientNumber'), ''),
               'rury'
        FROM offers_rel WHERE id IS NOT NULL
    `);

    await prisma.$executeRawUnsafe(`
        INSERT INTO offers_search_fts(id, offer_number, clientName, investName, clientNumber, type)
        SELECT id, offer_number, clientName, investName,
               COALESCE(NULLIF(clientNumber, ''), json_extract(data, '$.clientNumber'), ''),
               'studnie'
        FROM offers_studnie_rel WHERE id IS NOT NULL
    `);
}

async function main() {
    console.log('Sprawdzanie tabeli FTS5 offers_search_fts...');

    if (await tableExists()) {
        const columns = await getColumns();
        const missing = FTS_COLUMNS.filter((c) => !columns.includes(c));
        if (missing.length === 0) {
            const existing = (await prisma.$queryRawUnsafe(
                'SELECT COUNT(*) AS cnt FROM offers_search_fts'
            )) as any[];
            const count = Number(existing[0]?.cnt || 0);
            if (count > 0) {
                console.log(`FTS5 gotowa (${count} wierszy), kolumny OK — bez zmian`);
                return;
            }
            console.log('FTS5 tabela pusta — backfill...');
            await backfill();
            console.log('  OK');
            return;
        }

        console.log(`FTS5 istnieje, ale brak kolumn: ${missing.join(', ')} — przebudowa...`);
        await prisma.$executeRawUnsafe('DROP TABLE offers_search_fts');
        await prisma.$executeRawUnsafe(createFtsTable());
        console.log('  OK');
        await backfill();
        console.log('  OK');
    } else {
        console.log('Tworzenie tabeli FTS5 offers_search_fts...');
        await prisma.$executeRawUnsafe(createFtsTable());
        console.log('  OK');

        const existing = (await prisma.$queryRawUnsafe(
            'SELECT COUNT(*) AS cnt FROM offers_search_fts'
        )) as any[];
        const count = Number(existing[0]?.cnt || 0);
        if (count > 0) {
            console.log(`FTS5 ma ${count} wierszy, pomijam backfill`);
            return;
        }

        console.log('Backfill offers_rel...');
        await backfill();
        console.log('  OK');
    }

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
