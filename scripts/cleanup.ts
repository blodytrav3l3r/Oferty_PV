import { prisma } from '../src/prismaClient';

async function cleanupDatabase() {
    console.log('=== CZYSZCZENIE BAZY DANYCH ===\n');

    // Usuń zlecenia produkcyjne
    await prisma.$executeRaw`DELETE FROM production_orders_rel`;
    console.log('✓ Usunięto zlecenia produkcyjne');

    // Usuń zamówienia studni
    await prisma.$executeRaw`DELETE FROM orders_studnie_rel`;
    console.log('✓ Usunięto zamówienia studni');

    // Usuń oferty studni (dla pewności)
    await prisma.$executeRaw`DELETE FROM offers_studnie_rel`;
    console.log('✓ Usunięto oferty studni');

    // Usuń oferty rur (dla pewności)
    await prisma.$executeRaw`DELETE FROM offers_rel`;
    console.log('✓ Usunięto oferty rur');

    // Usuń powiązane elementy ofert
    await prisma.$executeRaw`DELETE FROM offer_items_rel`;
    console.log('✓ Usunięto elementy ofert rur');
    await prisma.$executeRaw`DELETE FROM offer_studnie_items_rel`;
    console.log('✓ Usunięto elementy ofert studni');

    // Usuń logi audytu (opcjonalnie)
    await prisma.$executeRaw`DELETE FROM audit_logs`;
    console.log('✓ Usunięto logi audytu');

    console.log('\n=== BAZA WYCZYSZCZONA ===');
    console.log('Baza jest gotowa do wprowadzania nowych rekordów.');
}

cleanupDatabase().catch(err => {
    console.error('Błąd:', err);
    process.exit(1);
}).finally(() => process.exit());
