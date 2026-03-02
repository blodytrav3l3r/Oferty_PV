const XLSX = require('xlsx');
const wb = XLSX.readFile('Impuls_14.00.xlsm');
console.log('Sheet names:', JSON.stringify(wb.SheetNames));

// For each sheet, show the first few rows
wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    console.log('\n=== SHEET: ' + name + ' ===');
    console.log('Range: ' + (ws['!ref'] || 'empty'));

    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const maxRows = Math.min(data.length, 15);
    for (let i = 0; i < maxRows; i++) {
        console.log('Row ' + i + ': ' + JSON.stringify(data[i]));
    }
    console.log('Total rows: ' + data.length);
});
