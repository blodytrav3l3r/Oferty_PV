#!/usr/bin/env node
/**
 * normalize-seed-studnie.mjs
 *
 * Jednorazowy skrypt do konwersji starych polskich nazw pól na angielskie
 * w pliku data/seed_studnie.json.
 *
 * Użycie:
 *   node scripts/normalize-seed-studnie.mjs --check   # audyt bez zmian
 *   node scripts/normalize-seed-studnie.mjs --apply   # konwersja + backup
 *   node scripts/normalize-seed-studnie.mjs --help    # ta pomoc
 *
 * W trybie --apply:
 *   1. Tworzy kopię: data/seed_studnie.json.bak
 *   2. Zapisuje znormalizowany plik
 *   3. Weryfikuje że zapisany plik jest identyczny z oczekiwanym
 *
 * Skrypt jest idempotentny: drugie uruchomienie --apply nie zmienia niczego.
 * Stare klucze są usuwane z produktu, niezależnie od tego czy nowe istniały.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SEED_PATH = path.resolve(__dirname, '..', 'data', 'seed_studnie.json');
const BACKUP_PATH = SEED_PATH + '.bak';

/** Mapa: polski (stary) klucz → angielski (nowy) klucz */
const FIELD_MAP = {
  'Pow. wewn. m²': 'area',
  'Pow. zewn. m²': 'areaExt',
  'Dopłata Żelbet': 'doplataZelbet',
  'Wys. spocznika': 'spocznikH',
  'Hmin 1 mm': 'hMin1',
  'Hmax 1 mm': 'hMax1',
  'Cena 1 PLN': 'cena1',
  'Hmin 2 mm': 'hMin2',
  'Hmax 2 mm': 'hMax2',
  'Cena 2 PLN': 'cena2',
  'Hmin 3 mm': 'hMin3',
  'Hmax 3 mm': 'hMax3',
  'Cena 3 PLN': 'cena3',
};

const OLD_KEYS = Object.keys(FIELD_MAP);
const NEW_KEYS = Object.values(FIELD_MAP);

function usage() {
  console.log(`
Usage: node scripts/normalize-seed-studnie.mjs <mode>

Modes:
  --check   Audyt: wypisuje statystyki starych kluczy, nic nie zmienia
  --apply   Konwersja: tworzy backup .bak i zapisuje znormalizowany plik
  --help    Ta pomoc
`);
  process.exit(0);
}

function readSeed() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error('Błąd: nie znaleziono', SEED_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

function writeSeed(data) {
  fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function analyze(products) {
  const stats = {};
  for (const oldKey of OLD_KEYS) {
    const matching = products.filter((p) => p[oldKey] !== undefined && p[oldKey] !== null);
    if (matching.length > 0) {
      stats[oldKey] = {
        count: matching.length,
        samples: matching.slice(0, 3).map((p) => p.id + ': ' + JSON.stringify(p[oldKey])),
      };
    }
  }
  return stats;
}

function normalizeProduct(p) {
  const out = {};
  for (const key of Object.keys(p)) {
    if (OLD_KEYS.includes(key)) {
      // Stary klucz — zapisz pod nową nazwą jeśli nowa nie istnieje lub null
      const newKey = FIELD_MAP[key];
      if (p[newKey] === undefined || p[newKey] === null) {
        out[newKey] = p[key];
      }
      // Nie kopiujemy starego klucza do outputu
    } else {
      out[key] = p[key];
    }
  }
  return out;
}

function runCheck() {
  const products = readSeed();
  const stats = analyze(products);

  console.log('\n=== AUDYT: seed_studnie.json ===');
  console.log(`Łączna liczba produktów: ${products.length}`);
  console.log('');

  if (Object.keys(stats).length === 0) {
    console.log('✅ Brak starych polskich kluczy — plik już znormalizowany.\n');
    return true;
  }

  let totalAffected = 0;
  let totalKeys = 0;
  for (const [oldKey, info] of Object.entries(stats)) {
    const newKey = FIELD_MAP[oldKey];
    console.log(`  ${oldKey} → ${newKey}: ${info.count} produktów`);
    for (const s of info.samples) {
      console.log(`    np. ${s}`);
    }
    totalAffected += info.count;
    totalKeys += info.count;
  }

  console.log(`\nProdukty wymagające normalizacji: ${new Set(products.filter((p) => OLD_KEYS.some((k) => p[k] !== undefined && p[k] !== null)).map((p) => p.id)).size}/${products.length}`);
  console.log(`Starych kluczy do usunięcia: ${totalKeys}`);
  console.log('\n❌ Plik wymaga normalizacji. Uruchom: node scripts/normalize-seed-studnie.mjs --apply\n');
  return false;
}

function runApply() {
  const products = readSeed();
  const stats = analyze(products);

  if (Object.keys(stats).length === 0) {
    console.log('\n✅ Plik już znormalizowany — nic do zrobienia.\n');
    return;
  }

  // Backup
  fs.copyFileSync(SEED_PATH, BACKUP_PATH);
  console.log(`\n📦 Backup: ${BACKUP_PATH}`);

  // Normalizacja
  const normalized = products.map(normalizeProduct);
  const changedCount = products.length - normalized.length; // should be 0
  const oldKeyCount = Object.values(stats).reduce((sum, s) => sum + s.count, 0);

  // Zapisz
  writeSeed(normalized);
  console.log(`💾 Zapisano: ${SEED_PATH}`);

  // Weryfikacja: odczytaj ponownie i sprawdź czy identyczny z oczekiwanym
  const verified = readSeed();
  const remainingOld = OLD_KEYS.filter((k) => verified.some((p) => p[k] !== undefined && p[k] !== null));
  if (remainingOld.length > 0) {
    console.error(`\n❌ Błąd weryfikacji: stare klucze nadal istnieją: ${remainingOld.join(', ')}`);
    console.error('   Backup dostępny pod:', BACKUP_PATH);
    process.exit(1);
  }

  // Sprawdź czy JSON jest identyczny (porównaj stringify)
  const expectedStr = JSON.stringify(normalized, null, 2);
  const actualStr = JSON.stringify(verified, null, 2);
  if (expectedStr !== actualStr) {
    console.error('\n❌ Błąd weryfikacji: zapisany plik różni się od oczekiwanego');
    console.error('   Backup dostępny pod:', BACKUP_PATH);
    process.exit(1);
  }

  console.log(`✅ Znormalizowano ${oldKeyCount} starych kluczy w ${products.length} produktach`);
  console.log('   Plik jest spójny i nie zawiera już polskich nazw pól.\n');
}

function main() {
  const mode = process.argv[2] || '--help';

  switch (mode) {
    case '--check':
      runCheck();
      break;
    case '--apply':
      runApply();
      break;
    case '--help':
    default:
      usage();
  }
}

main();
