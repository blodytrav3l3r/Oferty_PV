import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function main() {
    try {
        const check = await prisma.$queryRawUnsafe<any[]>("SELECT id, createdAt, typeof(createdAt) as t FROM clients_rel");
        console.log("Raw DB:", check);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
