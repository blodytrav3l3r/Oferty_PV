// Skrypt wypełnia pole `doplataPEHD` w data/seed_studnie.json.
// Reguły biznesowe:
//   - elementy 'przejscie', 'kineta' oraz 'konus' NIE dostają dopłaty (konus z wkładką PEHD zabroniony)
//   - produkty bez pola area lub z area <= 0 nie dostają dopłaty
//   - pozostałe: doplataPEHD = Math.round(effectiveArea * PEHD_PRICE_PER_M2)
// Skrypt zachowuje strukturę pliku (tablica lub obiekt z kluczem products),
// format JSON (wcięcia 2 spacje), końcówki linii CRLF oraz UTF-8 bez BOM.

import fs from 'fs';
import path from 'path';

// Domyślna cena wkładki PEHD za m² (zgodnie z public/js/studnie/pricelistManager.js:97)
const PEHD_PRICE_PER_M2 = 270;

// Typy płytowe — liczone ze współczynnikiem odpadu 4/π (jak w actionsWellPainting.js)
const PLATE_COMPONENT_TYPES = new Set([
    'plyta',
    'plyta_din',
    'plyta_najazdowa',
    'plyta_zamykajaca',
    'plyta_redukcyjna',
    'plyta_nastudzienna'
]);

// Typy wykluczone z przeliczania PEHD (konus z wkładką jest zabroniony)
const SKIPPED_COMPONENT_TYPES = new Set(['przejscie', 'kineta', 'konus']);

/**
 * Oblicza powierzchnię efektywną PEHD dla produktu (replikacja getPehdEffectiveArea).
 * @param {object} p
 * @returns {number}
 */
function effArea(p) {
    if (p.area == null || p.area <= 0) return 0;
    if (PLATE_COMPONENT_TYPES.has(p.componentType)) return p.area * (4 / Math.PI);
    if (p.componentType === 'dennica' || p.componentType === 'styczna') {
        const dn = parseInt(p.dn) || 0;
        if (dn > 0) {
            const bottomArea = Math.PI * Math.pow(dn / 2000, 2);
            const wallArea = p.area - bottomArea;
            if (wallArea > 0) return wallArea + bottomArea * (4 / Math.PI);
        }
    }
    return p.area;
}

const filePath = path.join(process.cwd(), 'data', 'seed_studnie.json');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

// Normalizacja struktury: tablica lub obiekt { products: [...] }
const isArray = Array.isArray(data);
const products = isArray ? data : data.products;
if (!Array.isArray(products)) {
    console.error('Nie rozpoznano struktury data/seed_studnie.json (oczekiwano tablicy lub obiektu z kluczem products).');
    process.exit(1);
}

let computed = 0;
let nulled = 0;
const dennicaExamples = [];

for (const p of products) {
    if (SKIPPED_COMPONENT_TYPES.has(p.componentType) || p.area == null || p.area <= 0) {
        p.doplataPEHD = null;
        nulled++;
        continue;
    }
    const eff = effArea(p);
    p.doplataPEHD = Math.round(eff * PEHD_PRICE_PER_M2);
    computed++;
    if (p.componentType === 'dennica' && dennicaExamples.length < 5) {
        dennicaExamples.push({ id: p.id, area: p.area, eff: Math.round(eff * 100) / 100, doplataPEHD: p.doplataPEHD });
    }
}

// Zapis z zachowaniem formatu: JSON.stringify z wcięciem 2 spacji, linie CRLF, bez końcowego newline, UTF-8 bez BOM
const output = JSON.stringify(data, null, 2).replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, output, 'utf8');

console.log(`Zapisano: ${filePath}`);
console.log(`Przeliczono (doplataPEHD = liczba): ${computed}`);
console.log(`Ustawiono null: ${nulled}`);
console.log('Przykłady dennicy (id, area, eff, doplataPEHD):');
for (const ex of dennicaExamples) {
    console.log(`  ${ex.id}: area=${ex.area}, eff=${ex.eff}, doplataPEHD=${ex.doplataPEHD}`);
}
