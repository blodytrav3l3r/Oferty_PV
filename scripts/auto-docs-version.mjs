#!/usr/bin/env node
/**
 * auto-docs-version.mjs — automatyczna aktualizacja wersji w dokumentacji.
 *
 * Czyta wersję z VERSION i podmienia w plikach docs/*.md:
 *   - **Wersja:** X.Y.Z  →  **Wersja:** <VERSION>
 *   - **Wersja projektu:** X.Y.Z  →  **Wersja projektu:** <VERSION>
 *   - > Wersja: X.Y.Z  →  > Wersja: <VERSION>
 *
 * Uruchamiany automatycznie przez standard-version (postbump).
 * Idempotentny — drugie uruchomienie z tą samą wersją nie zmienia niczego.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, extname, join } from 'path';

const ROOT = resolve(process.cwd());

const VERSION = (readFileSync(resolve(ROOT, 'VERSION'), 'utf-8') || '').trim();
if (!VERSION) {
    console.error('BLAD: Brak wersji w VERSION');
    process.exit(1);
}

const DOCS_DIR = resolve(ROOT, 'docs');

const SKIP_DIRS = new Set(['plans', 'audits', 'adr', 'baseline', 'import-export', 'examples', 'node_modules']);

function collectMdFiles(dir) {
    const files = [];
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return files;
    }
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                if (!SKIP_DIRS.has(entry)) {
                    files.push(...collectMdFiles(fullPath));
                }
            } else if (extname(entry) === '.md') {
                files.push(fullPath);
            }
        } catch {
            // skip
        }
    }
    return files;
}

function processFile(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    const original = content;

    const patterns = [
        /(\*\*Wersja:\*{0,2}\s*)\d+\.\d+\.\d+/g,
        /(\*\*Wersja projektu:\*{0,2}\s*)\d+\.\d+\.\d+/g,
        /(> Wersja:\s*)\d+\.\d+\.\d+/g
    ];

    for (const re of patterns) {
        content = content.replace(re, (match, prefix) => `${prefix}${VERSION}`);
    }

    // aktualizacja ?v= w docs (np w przykładowych HTML)
    content = content.replace(
        /(\?v=)\d+\.\d+\.\d+/g,
        (match, prefix) => `${prefix}${VERSION}`
    );

    if (content === original) {
        console.log(`  - ${filePath.replace(ROOT + '\\', '')} (bez zmian)`);
        return false;
    }

    writeFileSync(filePath, content, 'utf-8');
    console.log(`  \u2713 ${filePath.replace(ROOT + '\\', '')}  ->  v${VERSION}`);
    return true;
}

function main() {
    console.log(`\n  auto-docs-version  |  VERSION=${VERSION}\n`);

    const files = collectMdFiles(DOCS_DIR).filter(f => !f.endsWith('CHANGELOG.md'));
    if (files.length === 0) {
        console.log('  Brak plikow .md do przetworzenia\n');
        return;
    }

    let changed = 0;
    for (const file of files) {
        if (processFile(file)) changed++;
    }

    console.log(`\n  Zmieniono ${changed} z ${files.length} plikow dokumentacji\n`);
}

main();
