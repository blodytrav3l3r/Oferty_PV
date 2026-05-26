import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function main() {
    try {
        const arr = [
            {
                id: '1772264378479',
                name: 'Budimex S.A.',
                nip: '5261003187',
                address: '01-204 Warszawa, ul. Siedmiogrodzka 9',
                email: '',
                phone: '',
                contact: 'Test Contact',
                createdAt: '2026-03-21T07:41:16.960Z'
            }
        ];

        for (const c of arr) {
            let docId = c.id;
            
            let parsedDate = new Date().toISOString();
            if (c.createdAt) {
                const num = Number(c.createdAt);
                if (!isNaN(num) && num > 1000000000000) {
                    parsedDate = new Date(num).toISOString();
                } else {
                    const d = new Date(c.createdAt);
                    if (!isNaN(d.getTime())) parsedDate = d.toISOString();
                }
            }

            await prisma.clients_rel.upsert({
                where: { id: docId },
                create: {
                    id: docId,
                    userId: 'user_admin',
                    name: c.name || '',
                    nip: c.nip || '',
                    address: c.address || '',
                    contact: c.contact || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    createdAt: parsedDate
                },
                update: {
                    userId: 'user_admin',
                    name: c.name || '',
                    nip: c.nip || '',
                    address: c.address || '',
                    contact: c.contact || '',
                    phone: c.phone || '',
                    email: c.email || '',
                    createdAt: parsedDate
                }
            });
        }
        console.log("Upsert simulated OK");
    } catch (e) {
        console.error("Upsert simulated Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
