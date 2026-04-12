import prisma from './src/prismaClient';

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.users.findMany();
    console.log(users);

    console.log('--- OFFERS (RURY) ---');
    const offersRury = await prisma.offers_rel.findMany();
    console.log(offersRury);

    console.log('--- OFFERS (STUDNIE) ---');
    const offersStudnie = await prisma.offers_studnie_rel.findMany();
    console.log(offersStudnie);
}

main().finally(() => {
    prisma.$disconnect();
});
