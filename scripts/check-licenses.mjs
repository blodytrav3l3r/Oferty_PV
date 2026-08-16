#!/usr/bin/env node
/**
 * check-licenses.mjs — walidacja aktualności THIRD-PARTY-NOTICES.md.
 *
 * Regeneruje treść pliku w pamięci (generate-licenses.mjs) i porównuje z plikiem
 * na dysku. Rozjazd (np. po dodaniu/aktualizacji pakietu) → exit code 1.
 *
 * Użycie:
 *   node scripts/check-licenses.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNotices } from './generate-licenses.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE = path.join(ROOT, 'package-lock.json');
const OUT_FILE = path.join(ROOT, 'THIRD-PARTY-NOTICES.md');

function main() {
    if (!fs.existsSync(OUT_FILE)) {
        console.error('✗ Brak THIRD-PARTY-NOTICES.md — uruchom `npm run licenses:generate`.');
        process.exit(1);
    }
    let lock;
    try {
        lock = JSON.parse(fs.readFileSync(LOCKFILE, 'utf-8'));
    } catch (err) {
        console.error(`Nie można odczytać ${LOCKFILE}: ${err.message}`);
        process.exit(1);
    }
    buildNotices(lock)
        .then((expected) => {
            const actual = fs.readFileSync(OUT_FILE, 'utf-8');
            if (expected === actual) {
                console.log('✓ THIRD-PARTY-NOTICES.md jest aktualny.');
                process.exit(0);
            }
            console.error(
                '✗ THIRD-PARTY-NOTICES.md nieaktualny — uruchom `npm run licenses:generate` i zobowiąż zmiany.'
            );
            process.exit(1);
        })
        .catch((err) => {
            console.error(`Błąd generowania: ${err.message}`);
            process.exit(1);
        });
}

main();
