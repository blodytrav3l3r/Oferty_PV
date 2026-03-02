const XLSX = require('xlsx');
const wb = XLSX.readFile('Impuls_14.00.xlsm');

// Look at the "cennik" sheet more closely - all rows
const ws = wb.Sheets['cennik'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log('=== CENNIK SHEET - ALL ROWS ===');
console.log('Total rows:', data.length);
for (let i = 0; i < Math.min(data.length, 100); i++) {
    const row = data[i];
    // Only show non-empty rows
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
        console.log('Row ' + i + ': ' + JSON.stringify(row));
    }
}

// Look at "cennik standardowy" more closely
console.log('\n\n=== CENNIK STANDARDOWY - ALL ROWS ===');
const ws2 = wb.Sheets['cennik standardowy'];
const data2 = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
console.log('Total rows:', data2.length);
for (let i = 0; i < Math.min(data2.length, 100); i++) {
    const row = data2[i];
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
        console.log('Row ' + i + ': ' + JSON.stringify(row));
    }
}
