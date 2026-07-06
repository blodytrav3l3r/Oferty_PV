#!/usr/bin/env node
/**
 * bump-version.mjs — atomiczny bump wersji (VERSION + package.json).
 *
 * NIE MUTUJE CHANGELOG.md — to praca dla AI/human agenta (wymaga kontekstu zmian).
 *
 * Użycie:
 *   node scripts/bump-version.mjs                       # pokaż aktualną
 *   node scripts/bump-version.mjs patch                 # PATCH bump (2.0.0 → 2.0.1)
 *   node scripts/bump-version.mjs minor                 # MINOR bump (2.0.0 → 2.1.0)
 *   node scripts/bump-version.mjs major                 # MAJOR bump (2.0.0 → 3.0.0)
 *   node scripts/bump-version.mjs 2.1.5                 # konkretna wersja
 *
 * Po bump uruchom: npm run version:check (zweryfikuj spójność)
 * Następnie zaktualizuj CHANGELOG.md ręcznie lub przez agenta version-guardian.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(process.cwd());
const VERSION_FILE = resolve(ROOT, 'VERSION');
const PKG_FILE = resolve(ROOT, 'package.json');
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const arg = process.argv[2];

function fail(msg, code = 1) {
    console.error(`\n  ✗ ${msg}\n`);
    process.exit(code);
}

function readCurrent() {
    if (!existsSync(VERSION_FILE)) fail('Brak pliku VERSION w root projektu.');
    return readFileSync(VERSION_FILE, 'utf-8').trim();
}

function readPkgVersion() {
    if (!existsSync(PKG_FILE)) fail('Brak package.json.');
    const data = JSON.parse(readFileSync(PKG_FILE, 'utf-8'));
    return data.version;
}

function bump(current, kind) {
    const m = SEMVER.exec(current);
    if (!m) fail(`Nieprawidłowy format wersji w VERSION: "${current}"`);
    const [, maj, min, pat] = m.map(Number);
    if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
    if (kind === 'minor') return `${maj}.${min + 1}.0`;
    if (kind === 'major') return `${maj + 1}.0.0`;
    if (SEMVER.test(kind)) return kind;
    fail(`Nieznany argument: "${kind}". Użyj: patch | minor | major | X.Y.Z`);
}

function writeFiles(newVer) {
    // VERSION (SSoT)
    writeFileSync(VERSION_FILE, newVer + '\n', 'utf-8');
    // package.json (preserve other fields, tylko 'version')
    const raw = readFileSync(PKG_FILE, 'utf-8');
    const data = JSON.parse(raw);
    data.version = newVer;
    writeFileSync(PKG_FILE, JSON.stringify(data, null, 4) + '\n', 'utf-8');
}

function gitDiff() {
    try {
        return execSync('git diff --stat', { encoding: 'utf-8', cwd: ROOT });
    } catch {
        return '(git niedostępny)';
    }
}

const current = readCurrent();
const pkgCur = readPkgVersion();

if (current !== pkgCur) {
    fail(
        `VERSION (${current}) ≠ package.json (${pkgCur}). Napraw ręcznie przed bump.`
    );
}

if (!arg) {
    console.log(`\n  Wersja: ${current} (VERSION === package.json)`);
    console.log(`  Użycie: bump <patch|minor|major|X.Y.Z>\n`);
    process.exit(0);
}

const next = bump(current, arg);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Bump: ${current} → ${next}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

writeFiles(next);

console.log('  ✓ VERSION zaktualizowany');
console.log('  ✓ package.json version zaktualizowany');
console.log('\n  Aktualne zmiany (git diff --stat):\n');
const diff = gitDiff();
diff.split('\n').forEach((l) => {
    if (l) console.log(`    ${l}`);
});
console.log(
    '\n  Następnie: zaktualizuj CHANGELOG.md ręcznie lub przez agenta version-guardian.'
);
console.log(
    '  Commit:   git add VERSION package.json CHANGELOG.md && git commit -m "chore(release): ' +
        next +
        '"\n'
);
