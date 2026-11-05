import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'audit-integrity.mjs');

describe('PostgreSQL audit:integrity CLI contract', () => {
    test('requires PostgreSQL configuration and fails closed without touching a database', () => {
        const result = spawnSync(process.execPath, [SCRIPT], {
            encoding: 'utf8',
            env: { ...process.env, DATABASE_URL: '' }
        });
        expect(result.status).toBe(1);
        expect(JSON.parse(String(result.stdout))).toEqual({
            status: 'ERROR',
            error: 'PostgreSQL integrity audit failed',
            checks: {},
            warnings: {}
        });
    });

    test('does not contain SQLite-specific runtime APIs or default DB paths', () => {
        const source = fs.readFileSync(SCRIPT, 'utf8');
        expect(source).not.toMatch(/node:sqlite|sqlite_master|PRAGMA|\.sqlite/);
        expect(source).toMatch(/information_schema\.tables/);
        expect(source).toMatch(/DATABASE_URL/);
    });
});
