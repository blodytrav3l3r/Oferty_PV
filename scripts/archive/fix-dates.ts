import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function main() {
    try {
        const clients = await prisma.$queryRawUnsafe<any[]>("SELECT id, createdAt, updatedAt FROM clients_rel");
        
        let fixedCount = 0;
        for (const c of clients) {
            let needsUpdate = false;
            let newCreatedAt = c.createdAt;
            let newUpdatedAt = c.updatedAt;

            // Fix createdAt
            if (typeof c.createdAt === 'string' && /^\d+$/.test(c.createdAt)) {
                newCreatedAt = new Date(Number(c.createdAt)).toISOString();
                needsUpdate = true;
            }

            // Fix updatedAt
            if (typeof c.updatedAt === 'string' && /^\d+$/.test(c.updatedAt)) {
                newUpdatedAt = new Date(Number(c.updatedAt)).toISOString();
                needsUpdate = true;
            }

            if (needsUpdate) {
                await prisma.$executeRawUnsafe(
                    `UPDATE clients_rel SET createdAt = ?, updatedAt = ? WHERE id = ?`,
                    newCreatedAt,
                    newUpdatedAt,
                    c.id
                );
                fixedCount++;
            }
        }
        console.log(`Fixed ${fixedCount} rows.`);

        // verify
        const check = await prisma.$queryRawUnsafe<any[]>("SELECT id, createdAt FROM clients_rel LIMIT 5");
        console.log("Samples:", check);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
