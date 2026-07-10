#!/usr/bin/env node
/**
 * auto-cache-bust.mjs — automatyczne ustawienie cache-bustingu w HTML.
 *
 * Czyta wersję z VERSION i podmienia wszystkie ?v= w lokalnych assetach
 * (.js/.css) w wskazanych plikach HTML na ?v=<VERSION>.
 *
 * Użycie:
 *   node scripts/auto-cache-bust.mjs
 *
 * Idempotentne — drugie uruchomienie z tą samą wersją nie generuje zmian.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());

const VERSION = (readFileSync(resolve(ROOT, 'VERSION'), 'utf-8') || '').trim();
if (!VERSION) {
    console.error('BLAD: Brak wersji w VERSION');
    process.exit(1);
}

const HTML_FILES = [
    'public/app.html',
    'public/index.html',
    'public/studnie.html',
    'public/rury.html',
    'public/kartoteka.html',
    'public/zlecenia.html'
];

const VER_PATTERN = /v=\d+\.\d+\.\d+/g;

function isLocalPath(url) {
    if (!url) return false;
    if (url.startsWith('http://') || url.startsWith('https://')) return false;
    if (url.startsWith('//')) return false;
    if (url.startsWith('data:')) return false;
    return true;
}

function processFile(filePath) {
    const absPath = resolve(ROOT, filePath);
    if (!existsSync(absPath)) {
        console.log(`  - ${filePath} (nie istnieje, pomijam)`);
        return false;
    }

    let content = readFileSync(absPath, 'utf-8');
    const original = content;

    content = content.replace(
        /(src|href)\s*=\s*"([^"]*?\.(js|css))(?:\?[^"]*)?"/gi,
        (match, attr, url) => {
            if (!isLocalPath(url)) return match;

            const cleanUrl = url.replace(/\?.*$/, '');
            const hasQuery = match.includes('?');
            const newSuffix = hasQuery
                ? match.replace(/\?[^"]*/, `?v=${VERSION}`)
                : `${attr}="${cleanUrl}?v=${VERSION}"`;

            return newSuffix;
        }
    );

    if (content === original) {
        console.log(`  - ${filePath} (bez zmian)`);
        return false;
    }

    writeFileSync(absPath, content, 'utf-8');
    console.log(`  \u2713 ${filePath}  ->  v${VERSION}`);
    return true;
}

function main() {
    console.log(`\n  auto-cache-bust  |  VERSION=${VERSION}\n`);

    let changed = 0;
    for (const htmlFile of HTML_FILES) {
        if (processFile(htmlFile)) changed++;
    }

    console.log(`\n  Zmieniono ${changed} z ${HTML_FILES.length} plikow HTML\n`);
}

main();
