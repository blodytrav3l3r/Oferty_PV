/**
 * Współdzielone funkcje do odczytu/zapisu seed studni z/do katalogu.
 * Używane przez skrypty naprawcze (fix-studnie-seed-area.mjs, normalize-seed-studnie.mjs itp.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed', 'studnie');

// Kolejność plików jest ważna — determinuje kolejność produktów w DB
export const FILE_MAP = {
    '01-konstrukcja.json': ['dennica', 'krag', 'krag_ot', 'styczna'],
    '02-skladowe.json': ['konus', 'plyta_din', 'plyta_redukcyjna', 'plyta_zamykajaca', 'pierscien_odciazajacy'],
    '03-przejscia.json': ['przejscie'],
    '04-akcesoria.json': ['uszczelka', 'kineta', 'avr', 'wlaz'],
};

/** Odczytuje wszystkie produkty seed studni z katalogu (merge 4 plików) */
export function readSeedProducts() {
    const all = [];
    for (const fileName of Object.keys(FILE_MAP)) {
        const filePath = path.join(SEED_DIR, fileName);
        if (!fs.existsSync(filePath)) continue;
        const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(items)) all.push(...items);
    }
    return all;
}

/** Zapisuje produkty seed studni z powrotem do 4 plików (grupuje po componentType) */
export function writeSeedProducts(products) {
    fs.mkdirSync(SEED_DIR, { recursive: true });

    const compToFile = {};
    for (const [fileName, types] of Object.entries(FILE_MAP)) {
        for (const t of types) compToFile[t] = fileName;
    }

    const grouped = {};
    for (const p of products) {
        const ct = String(p.componentType ?? '');
        const fn = compToFile[ct] || Object.keys(FILE_MAP)[0];
        if (!grouped[fn]) grouped[fn] = [];
        grouped[fn].push(p);
    }

    for (const [fileName, items] of Object.entries(grouped)) {
        const filePath = path.join(SEED_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
    }
}
