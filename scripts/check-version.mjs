#!/usr/bin/env node
/**
 * check-version.mjs — walidacja spójności wersji między VERSION, package.json, CHANGELOG.md.
 *
 * NIE MUTUJE plików. Wyświetla raport i zwraca exit code 0 (OK) lub 1 (rozjazd).
 *
 * Użycie:
 *   node scripts/check-version.mjs
 *   npm run version:check
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());
const SEMVER = /^\d+\.\d+\.\d+$/;

function read(p) {
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf-8');
}

function parseVersionFromPkg(pkgJson) {
    try {
        const data = JSON.parse(pkgJson);
        const v = data?.version;
        return SEMVER.test(v ?? '') ? v : null;
    } catch {
        return null;
    }
}

function parseLastVersionFromChangelog(cl) {
    // Najnowsza wersja jest na GÓRZE pliku (Keep a Changelog).
    // Bierzemy pierwszy nagłówek "## [X.Y.Z]".
    const m = [...(cl ?? '').matchAll(/^##[ \t]*\[(\d+\.\d+\.\d+)\][^\n\r]*/gm)];
    return m.length > 0 ? m[0][1] : null;
}

// ── Odczyt źródeł ──
const versionFile = (read(resolve(ROOT, 'VERSION')) ?? '').trim();
const pkgJson = read(resolve(ROOT, 'package.json'));
const versionPkg = parseVersionFromPkg(pkgJson);
const changelog = read(resolve(ROOT, 'CHANGELOG.md'));
const versionChangelog = parseLastVersionFromChangelog(changelog);

// ── Walidacja ──
const errors = [];
const warnings = [];

if (!SEMVER.test(versionFile)) {
    errors.push(`VERSION (root) — brak lub nieprawidłowy format: "${versionFile}"`);
}
if (!versionPkg) {
    errors.push(`package.json — brak lub nieprawidłowa sekcja "version"`);
}
if (!versionChangelog) {
    warnings.push(`CHANGELOG.md — brak wpisu ## [X.Y.Z] (początkowy CHANGELOG OK)`);
}

const allVersions = { VERSION: versionFile, 'package.json': versionPkg, CHANGELOG: versionChangelog };

if (versionFile && versionPkg && versionFile !== versionPkg) {
    errors.push(`VERSION (${versionFile}) ≠ package.json (${versionPkg})`);
}
if (versionChangelog && versionFile && versionChangelog !== versionFile) {
    errors.push(`VERSION (${versionFile}) ≠ CHANGELOG.md [${versionChangelog}]`);
}

// ── Raport ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Version Guard — sprawdzenie spójności wersji');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const [name, value] of Object.entries(allVersions)) {
    console.log(`  ${pad(name, 16)} → ${value ?? '⚠ BRAK'}`);
}
console.log('');

if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ Spójne — wersja zgodna we wszystkich źródłach.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
}

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);

console.log(
    `\n  Wynik: ${errors.length === 0 ? 'OK (z ostrzeżeniami)' : 'BŁĄD — wymagana naprawa'}`
);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(errors.length === 0 ? 0 : 1);
