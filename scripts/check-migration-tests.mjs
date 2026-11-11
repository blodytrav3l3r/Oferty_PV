#!/usr/bin/env node
/**
 * Pre-commit: migracja SQL bez testu w tym samym commicie = blokada.
 * Sprawdza wyłącznie staged pliki; brak gita (CI, eksport) = no-op, bo tam
 * egzekwuje to `DB migrate deploy verify` i testy migracyjne.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MIGRATION = /^prisma\/migrations-postgresql\/[^/]+\/migration\.sql$/;
const TEST = /^tests\/.*\.(ts|cjs|mjs)$/;

/** @param {string[]} paths @returns {{ok:boolean, migrations:string[]}} */
export function decide(paths) {
    const migrations = (Array.isArray(paths) ? paths : []).filter((p) => MIGRATION.test(p));
    if (migrations.length === 0) return { ok: true, migrations };
    return { ok: paths.some((p) => TEST.test(p)), migrations };
}

function stagedPaths() {
    try {
        const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        return out.split(/\r?\n/).filter(Boolean);
    } catch {
        return null;
    }
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
    const staged = stagedPaths();
    const result = staged ? decide(staged) : { ok: true, migrations: [] };
    if (!result.ok) {
        console.error('BŁĄD — migracja SQL bez testu w tym samym commicie:');
        for (const migration of result.migrations) console.error(`  ✗ ${migration}`);
        console.error('  Dodaj test migracyjny (np. tests/clients/*.test.ts) do tego commita.');
        process.exit(1);
    }
}
