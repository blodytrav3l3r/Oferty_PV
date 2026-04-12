
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function main() {
  console.log('--- USERS ---');
  const users = await prisma.users.findMany();
  console.log(JSON.stringify(users, null, 2));

  console.log('--- OFFERS (RURY) ---');
  const offersRury = await prisma.offers_rel.findMany();
  console.log(JSON.stringify(offersRury, null, 2));

  console.log('--- OFFERS (STUDNIE) ---');
  const offersStudnie = await prisma.offers_studnie_rel.findMany();
  console.log(JSON.stringify(offersStudnie, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
