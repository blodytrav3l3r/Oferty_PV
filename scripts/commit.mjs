#!/usr/bin/env node
/**
 * commit.mjs — bezpieczny commit zgodny z commitlint (bez mojibake z konsoli).
 *
 * PowerShell/cmd mangle polskie znaki przy przekazywaniu argumentów do git.exe
 * (kodepage ANSI), dlatego wiadomość jest walidowana i zapisywana do pliku UTF-8,
 * a git czyta ją przez `-F`. Node.exe odbiera argumenty jako UTF-16, więc polskie
 * znaki docierają tu poprawnie.
 *
 * Użycie:
 *   node scripts/commit.mjs "fix(config): naprawa wersji w docs"
 *   node scripts/commit.mjs "feat(studnie): nowa kolumna w excel" "linia body" "kolejna linia"
 *   node scripts/commit.mjs --amend "fix(config): poprawka treści"
 *
 * Walidacja (1:1 z commitlint.config.js):
 *   - typ: feat, fix, refactor, chore, docs, perf, test, style
 *   - scope: dozwolona lista (24), małe litery
 *   - nagłówek <= 72 znaki, subject małymi literami, bez kropki na końcu
 */

import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';

const TYPE_ENUM = ['feat', 'fix', 'refactor', 'chore', 'docs', 'perf', 'test', 'style'];
const SCOPE_ENUM = [
    'rury',
    'studnie',
    'offers',
    'orders',
    'prisma',
    'auth',
    'ui',
    'api',
    'seed',
    'deploy',
    'clients',
    'audit',
    'settings',
    'preco',
    'telemetry',
    'deps',
    'docs',
    'ci',
    'config',
    'test',
    'docker',
    'security',
    'chore',
    'release'
];
const HEADER_MAX = 72;

const argv = process.argv.slice(2);
const amend = argv[0] === '--amend';
if (amend) argv.shift();

const header = argv[0];
if (!header) {
    console.error('BŁĄD: podaj wiadomość, np.');
    console.error('  node scripts/commit.mjs "fix(config): naprawa wersji w docs"');
    process.exit(1);
}

const bodyLines = argv.slice(1);
const m = /^([a-z]+)\(([^)]+)\): (.+)$/.exec(header);
const errors = [];

if (!m) {
    errors.push('nagłówek musi mieć format "typ(scope): temat"');
} else {
    const [, type, scope, subject] = m;
    if (!TYPE_ENUM.includes(type))
        errors.push(`typ "${type}" spoza listy: ${TYPE_ENUM.join(', ')}`);
    if (!SCOPE_ENUM.includes(scope)) {
        errors.push(`scope "${scope}" spoza listy: ${SCOPE_ENUM.join(', ')}`);
    }
    if (header.length > HEADER_MAX) errors.push(`nagłówek ${header.length} > ${HEADER_MAX} znaków`);
    if (subject !== subject.toLowerCase())
        errors.push('temat musi być małymi literami (subject-case: lower-case)');
    if (/[A-Z]/.test(scope)) errors.push('scope musi być małymi literami (scope-case: lower-case)');
    if (subject.endsWith('.')) errors.push('temat nie może kończyć się kropką (subject-full-stop)');
}

if (errors.length > 0) {
    console.error('BŁĄD — wiadomość odrzucona:');
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
}

const message = [header, ...(bodyLines.length > 0 ? ['', ...bodyLines] : []), ''].join('\n');
const tmp = join(tmpdir(), `sok-commit-${process.pid}.txt`);
writeFileSync(tmp, message, 'utf-8');

try {
    execFileSync('git', ['commit', ...(amend ? ['--amend'] : []), '-F', tmp], { stdio: 'inherit' });
} finally {
    try {
        unlinkSync(tmp);
    } catch {
        // plik tymczasowy już usunięty — ignoruj
    }
}
