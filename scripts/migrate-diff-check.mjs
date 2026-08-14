#!/usr/bin/env node
/*
 * migrate-diff-check.mjs
 * Wrap CLI prisma migrate diff: porownuje baze danych z schema.prisma.
 * Uzycie: node scripts/migrate-diff-check.mjs [--from-empty]
 * Wyjscie:
 *   exit 0 = diff pusty (po wykluczeniu tabel FTS5)
 *   exit 2 = diff niepusty (realny dryf poza FTS5)
 *   exit 1 = blad
 * Cleanup shadow DB (data/tmp_shadow.sqlite) w obu przypadkach.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nonFts5Changes } from './prisma-diff-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHADOW = path.join(ROOT, 'data', 'tmp_shadow.sqlite');

const mode = process.argv.includes('--from-empty') ? 'empty' : 'database';

function cleanupShadow() {
    for (const suffix of ['', '-shm', '-wal']) {
        const p = SHADOW + suffix;
        try {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
            /* ignoruj */
        }
    }
}

const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');

let cliArgs;
if (mode === 'empty') {
    cliArgs = [
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--script'
    ];
} else {
    cliArgs = [
        'migrate',
        'diff',
        '--from-schema-datasource',
        'prisma/schema.prisma',
        '--to-schema-datamodel',
        'prisma/schema.prisma'
    ];
}

try {
    const out = execFileSync(process.execPath, [PRISMA_CLI, ...cliArgs], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    cleanupShadow();
    if (mode === 'empty') {
        console.log('[migrate-diff-check] SQL wygenerowany (%d znakow).', out.length);
        process.exit(0);
    }
    const rest = nonFts5Changes(out);
    if (rest.length === 0) {
        console.log('[migrate-diff-check] DIFF PUSTY (poza FTS5) — baza zgodna ze schema.');
        process.exit(0);
    }
    console.error('[migrate-diff-check] DIFF NIEPUSTY — baza NIE zgadza sie ze schema.');
    console.error(rest.join('\n'));
    process.exit(2);
} catch (err) {
    cleanupShadow();
    const stderr = err.stderr ? String(err.stderr) : '';
    const stdout = err.stdout ? String(err.stdout) : '';
    if (mode === 'empty') {
        console.error('[migrate-diff-check] BLAD generowania SQL:', stderr.trim() || stdout.trim());
        process.exit(1);
    }
    const rest = nonFts5Changes(stdout);
    if (rest.length === 0) {
        console.log('[migrate-diff-check] DIFF PUSTY (poza FTS5) — baza zgodna ze schema.');
        process.exit(0);
    }
    console.error('[migrate-diff-check] DIFF NIEPUSTY — baza NIE zgadza sie ze schema.');
    console.error(rest.join('\n'));
    process.exit(2);
}
