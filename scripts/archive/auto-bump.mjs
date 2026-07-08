#!/usr/bin/env node
/**
 * auto-bump.mjs — automatyczny bump wersji z Conventional Commita.
 *
 * Wywoływany z .husky/commit-msg po przejściu commitlint.
 * Parsuje typ commita i wykonuje bump:
 *   fix        → patch  (1.0.0 → 1.0.1)
 *   feat       → minor  (1.0.0 → 1.1.0)
 *   BREAKING   → major  (1.0.0 → 2.0.0)
 *
 * Użycie: node scripts/auto-bump.mjs <ścieżka-do-pliku-z-msg>
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(process.cwd());
const msgFile = process.argv[2];

if (!msgFile || !existsSync(msgFile)) {
    process.exit(0); // cicho exit jeśli brak pliku (nie blokuj commita)
}

const msg = readFileSync(msgFile, 'utf-8').trim();
const firstLine = msg.split('\n')[0].trim();

// Ignoruj merge commity, revert, chore(release)
if (
    /^Merge/i.test(firstLine) ||
    /^Revert/i.test(firstLine) ||
    /^chore\(release\)/i.test(firstLine)
) {
    process.exit(0);
}

// BREAKING CHANGE: ! po type/scope LUB w body/stopce
const hasBreaking =
    /!:/.test(firstLine) ||
    /BREAKING\s*CHANGE/i.test(msg);

// Wyciągnij type
const typeMatch = /^(\w+)/.exec(firstLine);
const type = typeMatch ? typeMatch[1].toLowerCase() : null;

let bumpKind = null;

if (hasBreaking) {
    bumpKind = 'major';
} else if (type === 'feat') {
    bumpKind = 'minor';
} else if (type === 'fix') {
    bumpKind = 'patch';
}

if (!bumpKind) {
    process.exit(0); // brak bumpu (chore, docs, refactor, test, style, perf)
}

try {
    execSync(
        `node scripts/bump-version.mjs ${bumpKind}`,
        { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8' }
    );
    // Staguj zmienione pliki — wejdą do tego samego commita
    execSync(
        'git add VERSION package.json',
        { cwd: ROOT, stdio: 'pipe' }
    );
} catch {
    // Nie blokuj commita jeśli bump się wysypie
    process.exit(0);
}
