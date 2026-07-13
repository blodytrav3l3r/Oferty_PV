#!/usr/bin/env node
/**
 * Dzieli seed_studnie.json na 4 pliki wg componentType.
 *
 * Uruchomienie: node scripts/split-seed-studnie.mjs
 *
 * Struktura docelowa:
 *   data/seed/studnie/
 *     01-konstrukcja.json   — dennica, krag, krag_ot, styczna
 *     02-skladowe.json      — konus, plyta_din, plyta_redukcyjna, plyta_zamykajaca, pierscien_odciazajacy
 *     03-przejscia.json     — przejscie
 *     04-akcesoria.json     — uszczelka, kineta, avr, wlaz
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '..', 'data', 'seed_studnie.json');
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'seed', 'studnie');

const FILE_MAP = {
    '01-konstrukcja.json': ['dennica', 'krag', 'krag_ot', 'styczna'],
    '02-skladowe.json': ['konus', 'plyta_din', 'plyta_redukcyjna', 'plyta_zamykajaca', 'pierscien_odciazajacy'],
    '03-przejscia.json': ['przejscie'],
    '04-akcesoria.json': ['uszczelka', 'kineta', 'avr', 'wlaz'],
};

const allTypes = new Set(Object.values(FILE_MAP).flat());

if (!fs.existsSync(SEED_PATH)) {
    console.error('Błąd: nie znaleziono', SEED_PATH);
    process.exit(1);
}

const seedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

if (!Array.isArray(seedData)) {
    console.error('Błąd: seed_studnie.json nie zawiera tablicy');
    process.exit(1);
}

// Sprawdź czy wszystkie componentType są pokryte
const foundTypes = new Set(seedData.map(p => p.componentType));
const missing = [...foundTypes].filter(t => !allTypes.has(t));
if (missing.length > 0) {
    console.error('Błąd: nieobsłużone componentType:', missing.join(', '));
    process.exit(1);
}

// Backup
const backupPath = SEED_PATH + '.bak';
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(SEED_PATH, backupPath);
    console.log(`Backup: ${backupPath}`);
}

// Utwórz katalog wyjściowy
fs.mkdirSync(OUT_DIR, { recursive: true });

// Podziel i zapisz
let total = 0;
for (const [fileName, types] of Object.entries(FILE_MAP)) {
    const filtered = seedData.filter(p => types.includes(p.componentType));
    const filePath = path.join(OUT_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
    console.log(`${fileName}: ${filtered.length} produktów`);
    total += filtered.length;
}

console.log(`\nRazem: ${total}/${seedData.length} produktów`);
console.log(`Katalog: ${OUT_DIR}`);
console.log('Gotowe.');
