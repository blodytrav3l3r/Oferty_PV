const XLSX = require('xlsx');
const wb = XLSX.readFile('Impuls_14.00.xlsm', { cellFormula: false, sheetStubs: true });

// Get the full Cennik sheet (Index -> Price mapping)
const wsCennik = wb.Sheets['Cennik'];
const cennikData = XLSX.utils.sheet_to_json(wsCennik, { header: 1, defval: '' });
console.log('=== CENNIK - Full dump (first 200 rows) ===');
for (let i = 0; i < Math.min(cennikData.length, 200); i++) {
    const row = cennikData[i];
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
        console.log('Row ' + i + ': ' + JSON.stringify(row.slice(0, 5)));
    }
}

// Get the Tabele pomocnicze INDEKSY sheet fully
console.log('\n\n=== INDEKSY - Full dump ===');
const wsIdx = wb.Sheets['Tabele pomocnicze INDEKSY'];
const idxData = XLSX.utils.sheet_to_json(wsIdx, { header: 1, defval: '' });
for (let i = 0; i < idxData.length; i++) {
    const row = idxData[i];
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
        console.log('Row ' + i + ': ' + JSON.stringify(row));
    }
}
