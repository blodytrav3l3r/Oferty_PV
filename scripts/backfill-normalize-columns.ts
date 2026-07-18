import prisma from '../src/prismaClient';

async function main() {
    console.log('Backfilling clientName, investName, clientNip for offers_rel...');
    const r = await prisma.$executeRawUnsafe(`
        UPDATE offers_rel SET
            "clientName" = json_extract("data", '$.clientName'),
            "investName" = json_extract("data", '$.investName'),
            "clientNip" = json_extract("data", '$.clientNip')
        WHERE "clientName" IS NULL
    `);
    console.log(`  offers_rel: ${r} rows updated`);

    console.log('Backfilling for offers_studnie_rel...');
    const s = await prisma.$executeRawUnsafe(`
        UPDATE offers_studnie_rel SET
            "clientName" = json_extract("data", '$.clientName'),
            "investName" = json_extract("data", '$.investName'),
            "clientNip" = json_extract("data", '$.clientNip')
        WHERE "clientName" IS NULL
    `);
    console.log(`  offers_studnie_rel: ${s} rows updated`);
}

main()
    .then(() => {
        console.log('Done');
        process.exit(0);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
