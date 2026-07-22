#!/usr/bin/env node
/**
 * export-settings-to-seed.mjs
 *
 * Eksportuje dane cennikowe z tabeli `settings` w SQLite do plików seed JSON.
 * Zapisuje w data/seed_rury.json, data/seed_studnie.json, data/seed_preco.json.
 *
 * Uzycie:
 *   node scripts/export-settings-to-seed.mjs
 *   node scripts/export-settings-to-seed.mjs --dry-run
 *   node scripts/export-settings-to-seed.mjs pricelist_rury preco_pricing
 *   node scripts/export-settings-to-seed.mjs --dry-run pricelist_studnie
 */

import { createRequire } from 'module';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const { PrismaClient } = require('../generated/prisma/index.js');

const ALL_KEYS = ['pricelist_rury', 'pricelist_studnie', 'preco_pricing'];

const OUTPUT_MAP = {
  pricelist_rury: resolve(__dirname, '..', 'data', 'seed_rury.json'),
  pricelist_studnie: resolve(__dirname, '..', 'data', 'seed_studnie.json'),
  preco_pricing: resolve(__dirname, '..', 'data', 'seed_preco.json'),
};

const PRICELIST_KEYS = new Set(['pricelist_rury', 'pricelist_studnie']);
const REQUIRED_FIELDS = ['id', 'name', 'category', 'price'];

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const requested = args.filter((a) => !a.startsWith('--'));
  return { dryRun, keys: requested.length ? requested : ALL_KEYS };
}

function checksum(str) {
  return createHash('sha256').update(str, 'utf-8').digest('hex');
}

function missingFields(item) {
  return REQUIRED_FIELDS.filter(
    (f) => item[f] === undefined || item[f] === null || item[f] === ''
  );
}

function detectDuplicates(items) {
  const seen = new Set();
  const dups = new Set();
  for (const item of items) {
    const id = item.id;
    if (id !== undefined && id !== null) {
      if (seen.has(id)) dups.add(id);
      seen.add(id);
    }
  }
  return dups;
}

function processPricelist(key, raw) {
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON' };
  }
  if (!Array.isArray(items)) return { error: 'Expected array' };

  let missCount = 0;
  const missDetails = [];

  for (let i = 0; i < items.length; i++) {
    const m = missingFields(items[i]);
    if (m.length) {
      missCount++;
      missDetails.push({ idx: i, id: items[i].id, fields: m });
    }
  }

  const dups = detectDuplicates(items);

  const json = JSON.stringify(items, null, 2);
  const sha = checksum(json);

  return { total: items.length, missCount, missDetails, dups: [...dups], sha, json };
}

function processPreco(key, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { error: 'Invalid JSON' };
  }

  // preco_pricing is stored as [{ "1000": {...}, ... }] — array wrapping one object
  let obj = data;
  if (Array.isArray(data)) {
    if (data.length === 0) return { error: 'Empty array' };
    obj = data[0];
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { error: 'Expected object' };
  }

  const topKeys = Object.keys(obj);
  let kinetyCount = 0;
  for (const k of topKeys) {
    const entry = obj[k];
    if (entry && Array.isArray(entry.kinety)) {
      kinetyCount += entry.kinety.length;
    }
  }

  const json = JSON.stringify(data, null, 2);
  const sha = checksum(json);

  return { total: topKeys.length, kinetyCount, sha, json };
}

function printReport(results, dryRun) {
  console.log('\n=== SETTINGS EXPORT REPORT ===\n');

  for (const [key, r] of Object.entries(results)) {
    if (r.error) {
      console.log(`  key: ${key}`);
      console.log(`  ERROR: ${r.error}\n`);
      continue;
    }

    const isPricelist = PRICELIST_KEYS.has(key);

    console.log(`  key: ${key}`);

    if (isPricelist) {
      console.log(`    Source records:    ${r.total}`);
      console.log(`    Exported records:  ${r.total}`);
      console.log(`    Duplicates:        ${r.dups.length}${r.dups.length ? ' (' + r.dups.join(', ') + ')' : ''}`);
      console.log(`    Missing fields:    ${r.missCount}`);
      for (const d of r.missDetails) {
        console.log(`      - [#${d.idx}] id=${d.id || 'N/A'}: brakuje ${d.fields.join(', ')}`);
      }
    } else {
      console.log(`    DN groups:         ${r.total}`);
      console.log(`    Kinety entries:    ${r.kinetyCount}`);
    }

    console.log(`    SHA-256:           ${r.sha}`);
    console.log(`    Written to:        ${OUTPUT_MAP[key]}`);
    console.log('');
  }

  console.log(dryRun ? '  [DRY RUN] No files written.\n' : '  Done.\n');
}

async function main() {
  const { dryRun, keys } = parseArgs();

  for (const k of keys) {
    if (!ALL_KEYS.includes(k)) {
      console.error(`Unknown key: ${k}. Valid: ${ALL_KEYS.join(', ')}`);
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  let results;

  try {
    const rows = await prisma.settings.findMany({
      where: { key: { in: keys } },
    });

    const map = {};
    for (const r of rows) map[r.key] = r.value;

    results = {};
    for (const key of keys) {
      const val = map[key];
      if (val === undefined || val === null) {
        results[key] = { error: `Key "${key}" not found in settings table` };
        continue;
      }

      results[key] = PRICELIST_KEYS.has(key)
        ? processPricelist(key, val)
        : processPreco(key, val);
    }
  } finally {
    await prisma.$disconnect();
  }

  printReport(results, dryRun);

  if (!dryRun) {
    for (const [key, r] of Object.entries(results)) {
      if (r.error) continue;
      writeFileSync(OUTPUT_MAP[key], r.json, 'utf-8');
    }
  }

  const hasError = Object.values(results).some((r) => r.error);
  if (hasError) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
