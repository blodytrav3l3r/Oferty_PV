import { prisma } from '../src/prismaClient';

async function checkDatabase() {
    console.log('=== SPRAWDZANIE BAZY DANYCH ===\n');

    // Oferty studni
    const studnieOffers = await prisma.$queryRaw`
        SELECT id, offer_number, userId, state, createdAt 
        FROM offers_studnie_rel
    `;
    console.log('OFERTY STUDNI:', (studnieOffers as any[]).length);
    (studnieOffers as any[]).forEach(o => {
        console.log(`  - ${o.id} | nr: ${o.offer_number || 'brak'} | user: ${o.userId} | state: ${o.state}`);
    });

    // Oferty rur
    const ruryOffers = await prisma.$queryRaw`
        SELECT id, offer_number, userId, state, createdAt 
        FROM offers_rel
    `;
    console.log('\nOFERTY RUR:', (ruryOffers as any[]).length);
    (ruryOffers as any[]).forEach(o => {
        console.log(`  - ${o.id} | nr: ${o.offer_number || 'brak'} | user: ${o.userId} | state: ${o.state}`);
    });

    // Zamówienia studni
    const orders = await prisma.$queryRaw`
        SELECT id, offerStudnieId, userId, status, createdAt 
        FROM orders_studnie_rel
    `;
    console.log('\nZAMÓWIENIA STUDNI:', (orders as any[]).length);
    (orders as any[]).forEach(o => {
        console.log(`  - ${o.id} | offerId: ${o.offerStudnieId} | user: ${o.userId} | status: ${o.status}`);
    });

    // Zlecenia produkcyjne
    const production = await prisma.$queryRaw`
        SELECT id, orderId, userId, createdAt 
        FROM production_orders_rel
    `;
    console.log('\nZLECENIA PRODUKCYJNE:', (production as any[]).length);
    (production as any[]).forEach(o => {
        console.log(`  - ${o.id} | orderId: ${o.orderId} | user: ${o.userId}`);
    });

    console.log('\n=== KONIEC ===');
}

checkDatabase().catch(console.error).finally(() => process.exit());
