#!/usr/bin/env node
/**
 * check-version.mjs — walidacja spójności wersji.
 *
 * Sprawdza: VERSION, package.json, package-lock.json, CHANGELOG.md, *.bat
 * oraz markery wersji w README.md i docs/*.md (**Wersja:**, > Wersja:,
 * "version"/"dbVersion" JSON, ?v=). Każde źródło musi mieć DOKŁADNIE wersję z VERSION.
 *
 * NIE MUTUJE plików. Wyświetla raport i zwraca exit code 0 (OK) lub 1 (rozjazd).
 * Uruchamiany w pre-commit/pre-push — rozjazd = blokada. Bez wyjątków.
 *
 * Użycie:
 *   node scripts/check-version.mjs
 *   npm run version:check
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

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
    // Bierzemy pierwszy nagłówek "## [X.Y.Z]" lub "## X.Y.Z".
    const m = [...(cl ?? '').matchAll(/^#{2,3}[ \t]*\[?(\d+\.\d+\.\d+)\]?[^\n\r]*/gm)];
    return m.length > 0 ? m[0][1] : null;
}

// ── Odczyt źródeł ──
const versionFile = (read(resolve(ROOT, 'VERSION')) ?? '').trim();
const pkgJson = read(resolve(ROOT, 'package.json'));
const versionPkg = parseVersionFromPkg(pkgJson);
const lockJson = read(resolve(ROOT, 'package-lock.json'));
const versionLock = parseVersionFromPkg(lockJson);
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
if (!versionLock) {
    errors.push(`package-lock.json — brak lub nieprawidłowa sekcja "version"`);
}
if (!versionChangelog) {
    warnings.push(`CHANGELOG.md — brak wpisu ## [X.Y.Z] (początkowy CHANGELOG OK)`);
}

const allVersions = {
    VERSION: versionFile,
    'package.json': versionPkg,
    'package-lock.json': versionLock,
    CHANGELOG: versionChangelog
};

if (versionFile && versionPkg && versionFile !== versionPkg) {
    errors.push(`VERSION (${versionFile}) ≠ package.json (${versionPkg})`);
}
if (versionFile && versionLock && versionFile !== versionLock) {
    errors.push(`VERSION (${versionFile}) ≠ package-lock.json (${versionLock})`);
}
if (versionChangelog && versionFile && versionChangelog !== versionFile) {
    errors.push(`VERSION (${versionFile}) ≠ CHANGELOG.md [${versionChangelog}]`);
}

// ── Wersja w plikach .bat (ASCII, AGENTS.md — utrzymywana przez auto-bat-version.mjs) ──
const BAT_FILES = [
    'start.bat',
    'install.bat',
    'build.bat',
    'setup-ai.bat',
    'scripts/ensure-db.bat'
];
const BAT_VERSION_RE = /(?:set "APP_VERSION=|REM {2}Wersja: )(\d+\.\d+\.\d+)/g;

for (const file of BAT_FILES) {
    const content = read(resolve(ROOT, file));
    if (content == null) continue;
    const found = [...content.matchAll(BAT_VERSION_RE)].map((m) => m[1]);
    allVersions[file] = found.length > 0 ? found[0] : null;
    if (SEMVER.test(versionFile) && found.length === 0) {
        errors.push(`${file} — brak znacznika wersji (APP_VERSION / REM Wersja)`);
    } else if (found.some((v) => v !== versionFile)) {
        errors.push(`${file} (${found[0]}) ≠ VERSION (${versionFile})`);
    }
}

// ── Wersja w dokumentacji (README.md + docs/*.md) — utrzymywana przez auto-docs-version.mjs ──
// BEZWZGLĘDNIE sprawdzana: rozjazd w markerze = błąd = blokada pre-push. Bez wyjątków.
const DOCS_DIR = resolve(ROOT, 'docs');
const DOC_SKIP_DIRS = new Set([
    'plans',
    'audits',
    'adr',
    'baseline',
    'import-export',
    'examples',
    'node_modules'
]);
// Wzorce muszą być 1:1 z auto-docs-version.mjs (2. grupa = numer wersji).
const DOC_VERSION_RES = [
    /(\*\*Wersja:\*{0,2}\s*)(\d+\.\d+\.\d+)/g,
    /(\*\*Wersja projektu:\*{0,2}\s*)(\d+\.\d+\.\d+)/g,
    /(\*\*Wersja aplikacji:\*{0,2}\s*)(\d+\.\d+\.\d+)/g,
    /(> Wersja:\s*)(\d+\.\d+\.\d+)/g,
    /("version":\s*")(\d+\.\d+\.\d+)(")/g,
    /("dbVersion":\s*")(\d+\.\d+\.\d+)(")/g,
    /(\?v=)(\d+\.\d+\.\d+)/g
];

function collectMdFiles(dir, out) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        try {
            const st = statSync(full);
            if (st.isDirectory()) {
                if (!DOC_SKIP_DIRS.has(entry)) collectMdFiles(full, out);
            } else if (entry.endsWith('.md')) {
                out.push(full);
            }
        } catch {
            // skip
        }
    }
    return out;
}

const docFiles = collectMdFiles(DOCS_DIR, [])
    .filter((f) => !f.endsWith('CHANGELOG.md'))
    .concat(resolve(ROOT, 'README.md'));
const docErrors = [];

for (const file of docFiles) {
    const content = read(file);
    if (content == null) continue;
    const found = new Set();
    for (const re of DOC_VERSION_RES) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content)) !== null) found.add(m[2]);
    }
    const bad = [...found].filter((v) => v !== versionFile);
    if (bad.length > 0) {
        docErrors.push(`${file.replace(ROOT + '\\', '')} → ${bad.join(', ')}`);
    }
}
allVersions['README + docs/*.md'] = docErrors.length === 0 ? versionFile : 'NIEZGODNE';
for (const d of docErrors) {
    errors.push(`Dokumentacja: ${d}  (≠ VERSION ${versionFile})`);
}

// ── Wersja w HTML (cache-bust ?v=) — utrzymywana przez auto-cache-bust.mjs ──
const HTML_DIRS = [resolve(ROOT, 'public'), resolve(ROOT, 'public', 'templates')];
const HTML_VERSION_RE = /(\?v=)(\d+\.\d+\.\d+)/g;
const htmlErrors = [];

for (const dir of HTML_DIRS) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        continue;
    }
    for (const entry of entries) {
        if (!entry.endsWith('.html')) continue;
        const full = join(dir, entry);
        const content = read(full);
        if (content == null) continue;
        HTML_VERSION_RE.lastIndex = 0;
        const found = new Set();
        let m;
        while ((m = HTML_VERSION_RE.exec(content)) !== null) found.add(m[2]);
        const bad = [...found].filter((v) => v !== versionFile);
        if (bad.length > 0) {
            htmlErrors.push(`${full.replace(ROOT + '\\', '')} → ${bad.join(', ')}`);
        }
    }
}
allVersions['HTML ?v= (cache-bust)'] = htmlErrors.length === 0 ? versionFile : 'NIEZGODNE';
for (const h of htmlErrors) {
    errors.push(`HTML: ${h}  (≠ VERSION ${versionFile})`);
}

// ── Raport ──
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Version Guard — sprawdzenie spójności wersji');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const [name, value] of Object.entries(allVersions)) {
    console.log(`  ${pad(name, 26)} → ${value ?? '⚠ BRAK'}`);
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
