#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const fromEmpty = process.argv.includes('--from-empty');
const args = fromEmpty
    ? ['migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script']
    : [
          'migrate',
          'diff',
          '--from-config-datasource',
          '--to-schema',
          'prisma/schema.prisma',
          '--exit-code'
      ];

const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
});

if (result.error) {
    console.error(`[migrate-diff-check] Prisma CLI failed: ${result.error.message}`);
    process.exit(1);
}

const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
if (fromEmpty) {
    if (
        result.status !== 0 ||
        !/CREATE TABLE/i.test(result.stdout || '') ||
        /sqlite/i.test(result.stdout || '')
    ) {
        console.error('[migrate-diff-check] PostgreSQL DDL generation failed.');
        if (output) console.error(output);
        process.exit(1);
    }
    console.log(`[migrate-diff-check] PostgreSQL DDL generated (${result.stdout.length} chars).`);
    process.exit(0);
}

if (result.status === 0) {
    console.log('[migrate-diff-check] PostgreSQL schema matches Prisma schema.');
    process.exit(0);
}

if (result.status === 2) {
    console.error('[migrate-diff-check] PostgreSQL schema differs from Prisma schema.');
    if (output) console.error(output);
    process.exit(2);
}

console.error('[migrate-diff-check] Could not compare PostgreSQL schema.');
if (output) console.error(output);
process.exit(1);
