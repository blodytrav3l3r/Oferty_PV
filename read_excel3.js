const XLSX = require('xlsx');

// Try reading with different options to capture calculated values
const wb = XLSX.readFile('Impuls_14.00.xlsm', { cellFormula: false, cellNF: false, sheetStubs: true });

console.log('All sheet names:');
wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'] || 'EMPTY';
    console.log(`  ${i}: "${name}" - range: ${ref}`);
});

// Now look at "Tabele pomocnicze INDEKSY" sheet in detail - this has the well component indexes
console.log('\n\n=== Tabele pomocnicze INDEKSY - FULL DATA ===');
const wsIdx = wb.Sheets['Tabele pomocnicze INDEKSY'];
if (wsIdx) {
    const data = XLSX.utils.sheet_to_json(wsIdx, { header: 1, defval: '' });
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const nonEmpty = row.filter(c => c !== '');
        if (nonEmpty.length > 0) {
            console.log('Row ' + i + ': ' + JSON.stringify(row));
        }
    }
}

// Now look at all other sheets that might have studnie/well/cennik data
console.log('\n\n=== Looking for pricing-related data ===');
wb.SheetNames.forEach(name => {
    if (['Tabele pomocnicze INDEKSY', 'Wagi przejść + ilość stopni', 'Formy',
        'Zestawienie form KLB', 'Zestawienie form WL'].includes(name)) return;

    const ws = wb.Sheets[name];
    if (!ws['!ref']) return;

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log(`\n--- ${name} (${data.length} rows) ---`);

    // Show first 30 non-empty rows
    let shown = 0;
    for (let i = 0; i < data.length && shown < 30; i++) {
        const row = data[i];
        const nonEmpty = row.filter(c => c !== '');
        if (nonEmpty.length > 0) {
            console.log('Row ' + i + ': ' + JSON.stringify(row));
            shown++;
        }
    }
});
