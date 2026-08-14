/*
 * tests/scripts/coverageCheck.test.ts
 * Faza 1.4: Test skryptu scripts/coverage-check.mjs (progi coverage, mode report/fail).
 *
 * Skrypt czyta coverage/coverage-summary.json z cwd — fixture w katalogu tymczasowym.
 * - domyslnie (report): exit 0 zawsze, wyswietla % z progiem
 * - --fail: exit 1 gdy procent < prog
 * - brak raportu: exit 1 z komunikatem
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'coverage-check.mjs');

function makeSummary(pct: { lines: number; branches: number; functions: number }): object {
    return {
        total: {
            lines: {
                total: 100,
                covered: Math.round((pct.lines / 100) * 100),
                skipped: 0,
                pct: pct.lines
            },
            branches: {
                total: 50,
                covered: Math.round((pct.branches / 100) * 50),
                skipped: 0,
                pct: pct.branches
            },
            functions: {
                total: 20,
                covered: Math.round((pct.functions / 100) * 20),
                skipped: 0,
                pct: pct.functions
            },
            statements: { total: 100, covered: 90, skipped: 0, pct: 90 }
        }
    };
}

function writeFixtureDir(tag: string, summary: object | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `coverage-check-${tag}-`));
    if (summary) {
        fs.mkdirSync(path.join(dir, 'coverage'));
        fs.writeFileSync(
            path.join(dir, 'coverage', 'coverage-summary.json'),
            JSON.stringify(summary),
            'utf8'
        );
    }
    return dir;
}

function runCheck(dir: string, extraArgs: string[] = []): { stdout: string; exit: number } {
    try {
        const stdout = execFileSync(process.execPath, [SCRIPT, ...extraArgs], {
            cwd: dir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return { stdout, exit: 0 };
    } catch (e: any) {
        return { stdout: String(e.stdout || '') + String(e.stderr || ''), exit: e.status || 1 };
    }
}

describe('coverage-check (Faza 1.4)', () => {
    it('report mode: wyswietla % i prog, exit 0 przy coverage powyzej progu', () => {
        const dir = writeFixtureDir(
            'above',
            makeSummary({ lines: 70, branches: 68, functions: 65 })
        );
        const { stdout, exit } = runCheck(dir);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/lines\s+70\.0%/);
        expect(stdout).toContain('prog 65%');
        expect(stdout).toMatch(/branches\s+68\.0%/);
        expect(stdout).toMatch(/functions\s+65\.0%/);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('report mode: exit 0 nawet gdy coverage ponizej progu (nie blokuje, K4)', () => {
        const dir = writeFixtureDir(
            'below-report',
            makeSummary({ lines: 40, branches: 30, functions: 20 })
        );
        const { stdout, exit } = runCheck(dir);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/lines\s+40\.0%/);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('--fail: exit 1 gdy coverage ponizej progu', () => {
        const dir = writeFixtureDir(
            'below-fail',
            makeSummary({ lines: 40, branches: 30, functions: 20 })
        );
        const { stdout, exit } = runCheck(dir, ['--fail']);
        expect(exit).toBe(1);
        expect(stdout).toContain('coverage ponizej progu');
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('--fail: exit 0 gdy coverage powyzej progu', () => {
        const dir = writeFixtureDir(
            'above-fail',
            makeSummary({ lines: 80, branches: 75, functions: 70 })
        );
        const { stdout, exit } = runCheck(dir, ['--fail']);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/lines\s+80\.0%/);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('brak raportu -> exit 1 z komunikatem o uruchomieniu coverage', () => {
        const dir = writeFixtureDir('missing', null);
        const { stdout, exit } = runCheck(dir);
        expect(exit).toBe(1);
        expect(stdout).toContain('nie znaleziono raportu');
        expect(stdout).toContain('npm test -- --coverage');
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
