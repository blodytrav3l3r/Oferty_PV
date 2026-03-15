const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'public', 'js', 'app_studnie.js');
const outDir = path.join(__dirname, 'public', 'js', 'studnie');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const content = fs.readFileSync(srcFile, 'utf8');

const sectionMap = [
    { start: '/* ===== GLOBALS ===== */', end: '/* ===== WIZARD ===== */', file: 'globals.js' },
    { start: '/* ===== WIZARD ===== */', end: '/* ===== WELLS MANAGEMENT ===== */', file: 'uiHelpers.js' },
    { start: '/* ===== WELLS MANAGEMENT ===== */', end: '/* ===== ZAKOŃCZENIE (TOP CLOSURE SELECTION) ===== */', file: 'wellManager.js' },
    { start: '/* ===== ZAKOŃCZENIE (TOP CLOSURE SELECTION) ===== */', end: '/* ===== DISCOUNT PANEL ===== */', file: 'autoSelect.js' },
    { start: '/* ===== DISCOUNT PANEL ===== */', end: '/* ===== DN SELECTOR ===== */', file: 'wellManager.js' }, 
    { start: '/* ===== DN SELECTOR ===== */', end: '/* ===== SVG HIGHLIGHTING ===== */', file: 'autoSelect.js' }, 
    { start: '/* ===== SVG HIGHLIGHTING ===== */', end: '/* ===== OFFER SUMMARY ===== */', file: 'wellDiagram.js' },
    { start: '/* ===== OFFER SUMMARY ===== */', end: '/* ===== CENNIK TABS ===== */', file: 'offerManager.js' },
    { start: '/* ===== CENNIK TABS ===== */', end: '/* ===== OFFERS STUDNIE (SERVER API) ===== */', file: 'pricelistManager.js' },
    { start: '/* ===== OFFERS STUDNIE (SERVER API) ===== */', end: '/* ===== ORDERS STUDNIE (Zamówienia) ===== */', file: 'offerManager.js' },
    { start: '/* ===== ORDERS STUDNIE (Zamówienia) ===== */', end: '/* ===== OFFER SUMMARY (Studnie) ===== */', file: 'orderManager.js' },
    { start: '/* ===== OFFER SUMMARY (Studnie) ===== */', end: '/* ===== CLIENT DATABASE ===== */', file: 'offerManager.js' },
    { start: '/* ===== CLIENT DATABASE ===== */', end: '/* ===== BACKEND STATUS CHECKER ===== */', file: 'offerManager.js' },
    { start: '/* ===== BACKEND STATUS CHECKER ===== */', end: '/* ===== GLOBAL RECALCULATOR ===== */', file: 'uiHelpers.js' },
    { start: '/* ===== GLOBAL RECALCULATOR ===== */', end: '/* ===== ZLECENIA PRODUKCYJNE (Production Orders) ===== */', file: 'autoSelect.js' },
    { start: '/* ===== ZLECENIA PRODUKCYJNE (Production Orders) ===== */', end: null, file: 'orderManager.js' }
];

const fileContents = {};

for (let i = 0; i < sectionMap.length; i++) {
    const rule = sectionMap[i];
    const startIndex = content.indexOf(rule.start);
    let endIndex = rule.end ? content.indexOf(rule.end) : content.length;
    
    if (startIndex === -1) {
        console.warn("Warning: Could not find start marker: " + rule.start);
        continue;
    }
    if (endIndex === -1 && rule.end) {
        console.warn("Warning: Could not find end marker: " + rule.end);
        endIndex = content.length;
    }

    const chunk = content.substring(startIndex, endIndex);
    if (!fileContents[rule.file]) {
        fileContents[rule.file] = [];
    }
    fileContents[rule.file].push(chunk);
}

for (const [filename, chunks] of Object.entries(fileContents)) {
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, chunks.join('\n\n'));
    console.log("Wrote " + filename + " (" + chunks.length + " chunks)");
}

let outLength = 0;
for (const [filename, chunks] of Object.entries(fileContents)) {
    outLength += chunks.join('\n\n').length;
}
console.log("Original body length roughly: " + content.length + ", Split length: " + outLength);
