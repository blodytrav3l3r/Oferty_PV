/*
 * tests/scripts/checkDbPath.test.ts
 * WAL-B: check-db.js honoruje DATABASE_URL jak backend
 * (src/prismaClient.ts normalizeDatabaseUrl), nie twardą ścieżkę ./data.
 * Brak pliku = exit 1 + komunikat z ROZWIĄZANĄ ścieżką (dowód resolvera).
 */
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
const SCRIPT = path.resolve(__dirname, '../../scripts/check-db.js');

function run(env: Record<string, string | undefined>): { stdout: string; code: number } {
    try {
        const out = execFileSync(process.execPath, [SCRIPT], {
            encoding: 'utf8',
            env: { ...process.env, ...env }
        });
        return { stdout: String(out), code: 0 };
    } catch (e: unknown) {
        const err = e as { stdout?: unknown; stderr?: unknown; status?: number };
        return {
            stdout: String(err.stdout ?? '') + String(err.stderr ?? ''),
            code: err.status ?? 2
        };
    }
}

describe('check-db DATABASE_URL resolver', () => {
    it('względny file:../data/x jak Prisma (wobec prisma/)', () => {
        const r = run({ DATABASE_URL: 'file:../data/no-such-check-db.sqlite' });
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('Brak pliku bazy');
        expect(r.stdout).toContain(path.join('data', 'no-such-check-db.sqlite'));
    });

    it('absolutny file: wprost + ucina query', () => {
        const abs =
            'file:' +
            path.resolve(os.tmpdir(), 'no-such-check-db.sqlite').replace(/\\/g, '/') +
            '?connection_limit=3';
        const r = run({ DATABASE_URL: abs });
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('no-such-check-db.sqlite');
        expect(r.stdout).not.toContain('connection_limit');
    });

    it('nie-file URL nie wysadza (fallback do ./data)', () => {
        const r = run({ DATABASE_URL: 'postgresql://x/y' });
        expect(r.stdout).toContain('check-db');
    });
});
