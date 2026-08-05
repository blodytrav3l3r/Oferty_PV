#!/usr/bin/env node
/**
 * auto-bat-version.mjs — automatyczna aktualizacja wersji w plikach .bat.
 *
 * Czyta wersję z VERSION i podmienia w plikach .bat:
 *   - set "APP_VERSION=X.Y.Z"  →  set "APP_VERSION=<VERSION>"
 *   - REM  Wersja: X.Y.Z       →  REM  Wersja: <VERSION>
 *
 * Pliki .bat muszą być ASCII-only (AGENTS.md) — wersja jest zawsze ASCII.
 *
 * Uruchamiany automatycznie przez standard-version (postbump).
 * Idempotentny — drugie uruchomienie z tą samą wersją nie zmienia niczego.
 *
 * Użycie:
 *   node scripts/auto-bat-version.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());

const VERSION = (readFileSync(resolve(ROOT, 'VERSION'), 'utf-8') || '').trim();
if (!VERSION) {
    console.error('BLAD: Brak wersji w VERSION');
    process.exit(1);
}

const BAT_FILES = ['start.bat', 'install.bat', 'build.bat', 'scripts/ensure-db.bat'];

function processFile(filePath) {
    const absPath = resolve(ROOT, filePath);
    if (!existsSync(absPath)) {
        console.log(`  - ${filePath} (nie istnieje, pomijam)`);
        return false;
    }

    let content = readFileSync(absPath, 'utf-8');
    const original = content;

    content = content.replace(/(set "APP_VERSION=)\d+\.\d+\.\d+(")/g, `$1${VERSION}$2`);
    content = content.replace(/(^REM  Wersja: )\d+\.\d+\.\d+$/gm, `$1${VERSION}`);

    if (content === original) {
        console.log(`  - ${filePath} (bez zmian)`);
        return false;
    }

    writeFileSync(absPath, content, 'utf-8');
    console.log(`  \u2713 ${filePath}  ->  v${VERSION}`);
    return true;
}

function main() {
    console.log(`\n  auto-bat-version  |  VERSION=${VERSION}\n`);

    let changed = 0;
    for (const file of BAT_FILES) {
        if (processFile(file)) changed++;
    }

    console.log(`\n  Zmieniono ${changed} z ${BAT_FILES.length} plikow BAT\n`);
}

main();
