import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();
async function test() {
  try {
    const clients = await prisma.clients_rel.findMany();
    console.log('Success, found', clients.length, 'clients');
  } catch (e) {
    console.error('Prisma Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
