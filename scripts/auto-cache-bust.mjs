#!/usr/bin/env node
/**
 * auto-cache-bust.mjs — automatyczne ustawienie cache-bustingu w HTML
 *                       i synchronizacja wersji w dokumentacji.
 *
 * Czyta wersję z VERSION i podmienia:
 *   - ?v= w lokalnych assetach (.js/.css) w plikach HTML
 *   - **Wersja:** X.Y.Z w plikach .md
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
    'public/zlecenia.html',
    'public/templates/etykieta.html',
    'public/templates/ofertaStudnie.html',
    'public/templates/zlecenie.html'
];

const MD_FILES = [
    'README.md',
    'docs/API.md',
    'docs/ARCHITECTURE.md',
    'docs/DEPLOYMENT.md',
    'docs/INSTRUKCJA_SERWER.md',
    'docs/README.md',
    'docs/SECURITY.md',
    'docs/plans/instalacja-krok-po-kroku-dla-laika.md',
    'docs/plans/instalacja-przenoszenie-systemu.md'
];

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

function processMdFile(filePath) {
    const absPath = resolve(ROOT, filePath);
    if (!existsSync(absPath)) {
        console.log(`  - ${filePath} (nie istnieje, pomijam)`);
        return false;
    }

    let content = readFileSync(absPath, 'utf-8');
    const original = content;

    content = content.replace(
        /(\*\*Wersja:\*\*)\s*\d+\.\d+\.\d+/g,
        `$1 ${VERSION}`
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

    let mdChanged = 0;
    for (const mdFile of MD_FILES) {
        if (processMdFile(mdFile)) mdChanged++;
    }

    console.log(`  Zmieniono ${mdChanged} z ${MD_FILES.length} plikow MD\n`);
}

main();
