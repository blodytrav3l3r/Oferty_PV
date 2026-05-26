import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function main() {
    try {
        const triggers = await prisma.$queryRawUnsafe<any[]>("SELECT name, sql FROM sqlite_master WHERE type='trigger'");
        console.log("Triggers:", triggers);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
