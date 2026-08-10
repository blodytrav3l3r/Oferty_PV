#!/usr/bin/env node
/**
 * check-appname.cjs — strażnik spójnej nazwy aplikacji (S.O.K.).
 *
 * NIE MUTUJE plików. Skanuje surowy tekst plików i zwraca exit code
 * 0 (OK) lub 1 (znaleziono wzorzec nazwy aplikacji WITROS Oferty).
 *
 * Wzorce (case-insensitive) — patrz docs/plans/2026-08-09-spojna-korekta-nazwy-aplikacji.md §5.1:
 *   P1  "WITROS Oferty"            (rdzeń nazwy aplikacji)
 *   P2  "WITROS — Generator Ofert" (bug z orderEditMode.js:92; też "-" ASCII)
 *   P3  "WITROS PRECISION OS"      (stary working title)
 *   P4  "WITROS — <Moduł>"         (nagłówki)
 *
 * Dozwolony jest sam "WITROS" (firma/identyfikatory/dane seed) — żaden taki
 * tekst nie pasuje do P1–P4. Dokumenty historyczne i dane są na whitelist.
 *
 * Użycie:
 *   node scripts/check-appname.cjs                # skan katalogu głównego
 *   node scripts/check-appname.cjs --root <dir>   # skan wskazanego katalogu
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const IGNORE_DIRS = new Set([
    '.git',
    'node_modules',
    'ECC',
    'dist',
    'coverage',
    'generated',
    'venv',
    '.husky/_',
    'plans',
    'adr',
    'archive',
    'graphify-out',
    'data'
]);

// Pliki pomijane po nazwie (basename)
const IGNORE_FILES = new Set([
    'package-lock.json',
    'CHANGELOG.md',
    'LICENSE',
    '.env',
    'server.log',
    'server-err.log',
    'check-appname.cjs',
    'appNameCheck.test.ts',
    'appNameConsistency.cjs'
]);

// Pliki pomijane po ścieżce względnej
const IGNORE_REL = new Set(['docs/AUDIT.md']);

const IGNORE_EXT = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    '.svg',
    '.sqlite',
    '.db',
    '.exe',
    '.dll',
    '.obj',
    '.bin',
    '.dat',
    '.xlsx',
    '.xls',
    '.docx',
    '.pdf',
    '.zip'
]);

const PATTERNS = [
    { id: 'P1', label: 'WITROS Oferty', re: /WITROS[ \t\u00A0]+Oferty/i },
    { id: 'P2', label: 'WITROS — Generator Ofert', re: /WITROS\s*[–—-]\s*Generator\s+Ofert/i },
    { id: 'P3', label: 'WITROS PRECISION OS', re: /WITROS[ \t\u00A0]+PRECISION[ \t\u00A0]+OS/i },
    { id: 'P4', label: 'WITROS —', re: /WITROS[ \t\u00A0]+[–—-]/i }
];

function shouldIgnoreDir(dir) {
    return dir.split(path.sep).some((p) => IGNORE_DIRS.has(p));
}

function shouldIgnoreFile(full) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const base = path.basename(full);
    return IGNORE_FILES.has(base) || IGNORE_REL.has(rel);
}

const readErrors = [];

function walkDir(dir, files = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        readErrors.push(`Nie można odczytać katalogu ${dir}: ${err.message}`);
        return files;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!shouldIgnoreDir(full)) walkDir(full, files);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!IGNORE_EXT.has(ext) && !shouldIgnoreFile(full)) {
                files.push(full);
            }
        }
    }
    return files;
}

function scanFile(file) {
    const buffer = fs.readFileSync(file);
    // Guard NUL-bajt — binaria pomijane nawet z tekstowym rozszerzeniem.
    if (buffer.includes(0)) return [];
    const text = buffer.toString('utf-8');
    const violations = [];
    for (const p of PATTERNS) {
        const re = new RegExp(p.re.source, p.re.flags + 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            const line = text.slice(0, m.index).split(/\r?\n/).length;
            violations.push({ pattern: p.id, label: p.label, line });
            if (violations.length > 20) break;
        }
    }
    return violations;
}

function scanFiles(files) {
    const results = [];
    for (const file of files) {
        const violations = scanFile(file);
        if (violations.length > 0) {
            results.push({ file, violations });
        }
    }
    return results;
}

function validateRepo(root) {
    readErrors.length = 0;
    const files = fs.statSync(root).isDirectory() ? walkDir(root) : [root];
    return scanFiles(files);
}

// ── CLI ──
function main() {
    const args = process.argv.slice(2);
    let root = ROOT;
    const idx = args.indexOf('--root');
    if (idx !== -1 && args[idx + 1]) root = path.resolve(process.cwd(), args[idx + 1]);

    const results = validateRepo(root);

    if (readErrors.length > 0) {
        console.error('\n  ✗ Błędy skanowania (niekompletny skan — pliki mogły zostać pominięte):');
        for (const e of readErrors) {
            console.error(`    - ${e}`);
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(2);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  App Name Guard — spójność nazwy aplikacji (S.O.K.)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.length === 0) {
        console.log('  ✓ Nazwa aplikacji spójna — brak wzorców WITROS Oferty.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(0);
    }

    for (const { file, violations } of results) {
        const rel = path.relative(ROOT, file);
        for (const v of violations) {
            console.log(`  ✗ [${v.pattern}] ${rel}:${v.line} — "${v.label}"`);
        }
    }
    console.log(`\n  Wynik: ${results.length} plik(ów) z nazwą aplikacji WITROS Oferty.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
}

if (require.main === module) {
    main();
}

module.exports = { scanFiles, validateRepo, PATTERNS, scanFile, readErrors };
