
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const offersCount = await prisma.offers_rel.count();
        const studnieCount = await prisma.offers_studnie_rel.count();
        console.log('Offers count:', offersCount);
        console.log('Studnie offers count:', studnieCount);
    } catch (e) {
        console.error('Error querying database:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
