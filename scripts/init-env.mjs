#!/usr/bin/env node
/**
 * init-env.mjs — inicjalizacja pliku .env.
 *
 * Zasady:
 * - jesli .env nie istnieje -> kopiuje .env.example do .env;
 * - jesli DEFAULT_ADMIN_PASSWORD w .env jest puste LUB rowne domyslnej
 *   wartosci (anim123456) -> generuje losowe haslo
 *   (crypto.randomBytes(12).toString('base64url')) i nadpisuje zmienna w .env;
 * - w pozostalych przypadkach .env NIE jest nadpisywany.
 *
 * Komunikaty konsoli po angielsku (ASCII) — Windows console moze nie
 * wyswietlic polskich znakow poprawnie.
 *
 * Uzycie:
 *   node scripts/init-env.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env');
const ENV_EXAMPLE = resolve(ROOT, '.env.example');

const DEFAULT_PASSWORD = 'anim123456';

function main() {
    if (!existsSync(ENV_EXAMPLE)) {
        console.error('[init-env] Missing .env.example. Copy it manually to .env.');
        process.exit(1);
    }

    let content;
    if (!existsSync(ENV_FILE)) {
        content = readFileSync(ENV_EXAMPLE, 'utf8');
        writeFileSync(ENV_FILE, content, 'utf8');
        console.log('[init-env] Created .env from .env.example');
    } else {
        content = readFileSync(ENV_FILE, 'utf8');
    }

    const match = content.match(/^DEFAULT_ADMIN_PASSWORD=(.*)$/m);
    const current = match ? match[1].trim() : '';
    if (current && current !== DEFAULT_PASSWORD) {
        console.log('[init-env] DEFAULT_ADMIN_PASSWORD already set - leaving as is');
        return;
    }

    const password = randomBytes(12).toString('base64url');
    const line = 'DEFAULT_ADMIN_PASSWORD=' + password;

    if (match) {
        content = content.replace(/^DEFAULT_ADMIN_PASSWORD=.*$/m, line);
    } else {
        content = content.replace(/\s*$/, '\n') + line + '\n';
    }

    writeFileSync(ENV_FILE, content, 'utf8');
    console.log('[init-env] Generated admin password: ' + password + ' (saved in .env)');
}

main();
