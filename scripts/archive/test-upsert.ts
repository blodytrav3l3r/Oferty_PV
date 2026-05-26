import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function test() {
  try {
    let authReq = { user: { id: 'usr_admin' } };
    
    // Simulate req.body.data from frontend after Zod stripping
    const arr = [{
        id: Date.now().toString(),
        name: 'Test',
        nip: '123',
        address: 'Warszawa',
        contact: 'Jan'
    }];

    for (const c of arr) {
        let docId = c.id;
        if (!docId) {
            docId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
        }

        let parsedDate = new Date();
        if (c.createdAt) {
            const num = Number(c.createdAt);
            if (!isNaN(num) && num > 1000000000000) {
                parsedDate = new Date(num);
            } else {
                const d = new Date(c.createdAt);
                if (!isNaN(d.getTime())) parsedDate = d;
            }
        }

        await prisma.clients_rel.upsert({
            where: { id: docId },
            create: {
                id: docId,
                userId: authReq.user?.id,
                name: c.name || '',
                nip: c.nip || '',
                address: c.address || '',
                contact: c.contact || '',
                phone: c.phone || '',
                email: c.email || '',
                createdAt: parsedDate,
                updatedAt: new Date()
            },
            update: {
                userId: authReq.user?.id,
                name: c.name || '',
                nip: c.nip || '',
                address: c.address || '',
                contact: c.contact || '',
                phone: c.phone || '',
                email: c.email || '',
                updatedAt: new Date()
            }
        });
    }
    console.log('SUCCESS');
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
