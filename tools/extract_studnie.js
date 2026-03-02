const XLSX = require('xlsx');
const wb = XLSX.readFile('Impuls_14.00.xlsm', { cellFormula: false, sheetStubs: true });

// Get ALL cennik data - this has index -> price pairs
const wsCennik = wb.Sheets['Cennik'];
const cennikData = XLSX.utils.sheet_to_json(wsCennik, { header: 1, defval: '' });

// Build price lookup from cennik
const priceMap = {};
cennikData.forEach(row => {
    if (row[0] && row[1] && typeof row[0] === 'string' && row[0] !== 'Brak') {
        priceMap[row[0]] = row[1];
    }
});

// Get the indexes sheet
const wsIdx = wb.Sheets['Tabele pomocnicze INDEKSY'];
const idxData = XLSX.utils.sheet_to_json(wsIdx, { header: 1, defval: '' });

// Parse well component data for each DN size
// Structure: For each DN, there are sections:
// - Component header row (with column names like Konus, Kręgi, PZE, etc.)
// - Variant rows (Standard Beton, Nierdzewna, etc.) with index values
// - Weight section with same structure
// Then "Jaki indeks" row has the actual indexes for variant 1

// Let me extract all the structured data
const dns = ['DN800', 'DN1000', 'DN1200', 'DN1500', 'DN2000']; // corrected from data
let currentDN = null;
let currentSection = null;
let componentHeaders = [];
let result = {};

for (let i = 0; i < idxData.length; i++) {
    const row = idxData[i];
    const firstCell = String(row[0] || '').trim();

    // Check if this is a DN header
    if (dns.some(dn => firstCell === dn)) {
        currentDN = firstCell;
        result[currentDN] = { indexes: {}, weights: {}, prices: {}, components: [] };
        currentSection = 'indexes';
        continue;
    }

    // Check for component headers  
    if (row[1] === 'Nr.' && currentDN) {
        componentHeaders = row.slice(2); // Skip first two cols
        result[currentDN].components = componentHeaders.filter(h => h !== '');
        continue;
    }

    // Weight section
    if (firstCell === 'WAGA' && currentDN) {
        currentSection = 'weights';
        continue;
    }

    // "Jaki indeks" row - most important - the actual index codes
    if (firstCell === 'Jaki indeks' && currentDN) {
        const variant = row[1];
        const indexes = row.slice(2);
        result[currentDN].indexes[variant] = {};
        componentHeaders.forEach((comp, idx) => {
            if (comp && indexes[idx] && indexes[idx] !== '' && indexes[idx] !== 'BRAK') {
                result[currentDN].indexes[variant][comp] = indexes[idx];
            }
        });
        continue;
    }

    // "Waga" row 
    if (firstCell === 'Waga' && currentDN) {
        const weights = row.slice(2);
        result[currentDN].weights = {};
        componentHeaders.forEach((comp, idx) => {
            if (comp && weights[idx] && weights[idx] !== '' && weights[idx] !== 1000000) {
                result[currentDN].weights[comp] = weights[idx];
            }
        });
        continue;
    }
}

// Now build the final product list
const products = [];
const seenIds = new Set();

Object.keys(result).forEach(dn => {
    const dnData = result[dn];
    Object.keys(dnData.indexes).forEach(variant => {
        const indexes = dnData.indexes[variant];
        Object.keys(indexes).forEach(componentName => {
            const indexId = indexes[componentName];
            if (seenIds.has(indexId)) return;
            seenIds.add(indexId);

            const price = priceMap[indexId] || 0;
            const weight = dnData.weights[componentName] || null;
            const cleanName = componentName.replace(/\s+/g, ' ').trim();

            products.push({
                id: indexId,
                name: `${cleanName} ${dn}`,
                price: price,
                weight: weight,
                category: `Studnie ${dn}`,
                dn: dn.replace('DN', ''),
                componentType: cleanName
            });
        });
    });
});

console.log('=== EXTRACTED PRODUCTS ===');
console.log('Total unique products:', products.length);
console.log('\nPrice map entries:', Object.keys(priceMap).length);

// Show some relevant cennik entries
console.log('\n=== RELEVANT CENNIK ENTRIES (studnie-related) ===');
const studniePrefix = ['DDD', 'KDB', 'KZB', 'JZW', 'PDD', 'PDR', 'PZE', 'PO-', 'PN-', 'AVR', 'Y-U-S', 'Y-U-G'];
Object.keys(priceMap).forEach(key => {
    if (studniePrefix.some(p => key.startsWith(p))) {
        console.log(`${key} => ${priceMap[key]}`);
    }
});

console.log('\n=== PRODUCTS EXTRACTED ===');
products.forEach(p => {
    console.log(`${p.id} | ${p.name} | ${p.price} PLN | ${p.weight} kg | ${p.category}`);
});

// Also save products to temp JSON
const fs = require('fs');
fs.writeFileSync('temp_studnie_products.json', JSON.stringify(products, null, 2));
console.log('\nSaved to temp_studnie_products.json');
