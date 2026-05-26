import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();
async function clean() {
  await prisma.clients_rel.deleteMany({});
  console.log('Cleared clients_rel table');
}
clean();
