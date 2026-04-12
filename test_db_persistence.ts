import prisma from './src/prismaClient';

async function testPersistence() {
    console.log('[TEST] Odświeżenie danych bazy (Odczytywanie aktualnego cennika)...');
    const row = await prisma.settings.findUnique({ where: { key: 'pricelist_studnie' } });
    
    if (!row || !row.value) {
        console.log('[TEST] Błąd: Brak cennika w bazie danych!');
        return;
    }
    
    let arr = JSON.parse(row.value);
    console.log(`[TEST] Znaleziona tablica z: ${arr.length} elementami.`);
    
    if (arr.length > 0) {
        const oldName = arr[0].name;
        const testName = 'TESTOWY_ELEMENT_DO_USUNIECIA_' + Date.now();
        
        console.log(`[TEST] Zmieniam element [indeks: 0, id: ${arr[0].id}] z "${oldName}" na "${testName}"...`);
        arr[0].name = testName;
        
        console.log('[TEST] Wykonuję zapis (komenda UPDATE do SQLite)...');
        await prisma.settings.update({
            where: { key: 'pricelist_studnie' },
            data: { value: JSON.stringify(arr) }
        });
        
        console.log('[TEST] Symulacja restartu aplikacji: Odpytuję bazę całkowicie na nowo...');
        const newRow = await prisma.settings.findUnique({ where: { key: 'pricelist_studnie' } });
        const newArr = JSON.parse(newRow!.value!);
        
        if (newArr[0].name === testName) {
            console.log(`[TEST] 🟢 SUKCES! Zmieniona nazwa przetrwała pozycję "na twardo" na dysku: "${newArr[0].name}". Cennik zapisał się bezbłędnie przy użyciu bazy app_database.sqlite!`);
            
            console.log('[TEST] Cofam zmianę do oryginalnego stanu...');
            newArr[0].name = oldName;
            await prisma.settings.update({
                where: { key: 'pricelist_studnie' },
                data: { value: JSON.stringify(newArr) }
            });
            console.log('[TEST] 🟢 Przywrócono oryginalny cennik.');
        } else {
            console.log(`[TEST] 🔴 BŁĄD! Oczekiwano: "${testName}", otrzymano z bazy: "${newArr[0].name}". Coś wymazało dane.`);
        }
    }
}

testPersistence().catch(console.error).finally(() => prisma.$disconnect());
