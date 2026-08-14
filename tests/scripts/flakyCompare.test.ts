/*
 * tests/scripts/flakyCompare.test.ts
 * B2: Test skryptu scripts/flaky-compare.mjs (F1 integralnosc != success).
 *
 * Kategorie:
 *  - FLAKY — test w 3 runach, statusy rozne (fail w podzbiorze)
 *  - STABLE FAIL — fail x3 (to NIE flaky)
 *  - STABLE PASS — pass x3
 *  - MISSING / INCONSISTENT — obecnosc w 1-2 z 3 runow
 *  - INFRA FAIL — brak pliku / nieparsowalny JSON / numTotalTests == 0
 *
 * Integralnosc raportu NIE zalezy od results.success — run z flaky faiłem
 * ma success:false i to NORMALNE (nie INFRA FAIL).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'flaky-compare.mjs');

interface AssertionInput {
    fullName: string;
    status: string;
    line: number;
    file?: string;
}

function makeReport(assertions: AssertionInput[], opts?: { numTotalTests?: number }): object {
    const testResultsMap = new Map<string, AssertionInput[]>();
    for (const a of assertions) {
        const file = a.file || 'tests/example.test.ts';
        if (!testResultsMap.has(file)) testResultsMap.set(file, []);
        testResultsMap.get(file)!.push(a);
    }
    const testResults = Array.from(testResultsMap.entries()).map(([file, list]) => ({
        assertionResults: list.map((a) => ({
            fullName: a.fullName,
            status: a.status,
            location: { line: a.line }
        })),
        name: file,
        status: list.some((a) => a.status === 'failed') ? 'failed' : 'passed'
    }));
    const numTotalTests =
        opts?.numTotalTests !== undefined ? opts.numTotalTests : testResults.length;
    const anyFailed = testResults.some((r) => r.status === 'failed');
    return {
        numTotalTests,
        success: !anyFailed,
        testResults
    };
}

function writeFixtures(dir: string, reports: object[]): string[] {
    fs.mkdirSync(dir, { recursive: true });
    return reports.map((r, i) => {
        const p = path.join(dir, `run${i + 1}.json`);
        fs.writeFileSync(p, JSON.stringify(r), 'utf8');
        return p;
    });
}

function runCompare(paths: string[]): { stdout: string; exit: number } {
    try {
        const stdout = execFileSync(process.execPath, [SCRIPT, ...paths], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return { stdout, exit: 0 };
    } catch (e: any) {
        return { stdout: String(e.stdout || '') + String(e.stderr || ''), exit: e.status || 1 };
    }
}

describe('flaky-compare (B2)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flaky-compare-'));

    afterAll(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('2x pass + 1x fail -> FLAKY', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky1'), [
            makeReport([{ fullName: 'test A', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test A', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test A', status: 'failed', line: 1 }])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toContain('FLAKY');
        expect(stdout).toContain('test A');
        expect(stdout).toMatch(/FLAKY \(fail w podzbiorze runow\): 1/);
    });

    it('3x pass -> brak flaky', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky2'), [
            makeReport([{ fullName: 'test B', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test B', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test B', status: 'passed', line: 1 }])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/FLAKY \(fail w podzbiorze runow\): 0/);
        expect(stdout).toContain('Stable PASS: 1');
    });

    it('3x fail -> STABLE FAIL (nie flaky)', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky3'), [
            makeReport([{ fullName: 'test C', status: 'failed', line: 1 }]),
            makeReport([{ fullName: 'test C', status: 'failed', line: 1 }]),
            makeReport([{ fullName: 'test C', status: 'failed', line: 1 }])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/FLAKY \(fail w podzbiorze runow\): 0/);
        expect(stdout).toContain('STABLE FAIL');
        expect(stdout).toContain('test C');
    });

    it('MISSING / INCONSISTENT: test tylko w 1-2 runach (nie flaky)', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky4'), [
            makeReport([{ fullName: 'test D', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test D2', status: 'passed', line: 9 }]),
            makeReport([{ fullName: 'test D', status: 'passed', line: 1 }])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toContain('MISSING / INCONSISTENT');
        expect(stdout).toContain('test D');
    });

    it('skipped/pending traktowane jak brak faila (nie flaky, nie stable fail)', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky5'), [
            makeReport([
                { fullName: 'test E', status: 'passed', line: 1 },
                { fullName: 'test F', status: 'pending', line: 2 }
            ]),
            makeReport([
                { fullName: 'test E', status: 'passed', line: 1 },
                { fullName: 'test F', status: 'skipped', line: 2 }
            ]),
            makeReport([
                { fullName: 'test E', status: 'passed', line: 1 },
                { fullName: 'test F', status: 'passed', line: 2 }
            ])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toMatch(/FLAKY \(fail w podzbiorze runow\): 0/);
        expect(stdout).toContain('Stable PASS');
    });

    it('numTotalTests == 0 -> INFRA FAIL', () => {
        const paths = writeFixtures(path.join(tmp, 'flaky6'), [
            makeReport([], { numTotalTests: 0 }),
            makeReport([], { numTotalTests: 0 }),
            makeReport([], { numTotalTests: 0 })
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(1);
        expect(stdout).toContain('INFRA FAIL');
    });

    it('run z success:false (flaky fail) -> FLAKY, NIE INFRA FAIL', () => {
        // success:false to NORMALNE przy failu - integralnosc raportu zalezy od struktury, nie success
        const paths = writeFixtures(path.join(tmp, 'flaky7'), [
            makeReport([{ fullName: 'test G', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test G', status: 'passed', line: 1 }]),
            makeReport([{ fullName: 'test G', status: 'failed', line: 1 }])
        ]);
        const { stdout, exit } = runCompare(paths);
        expect(exit).toBe(0);
        expect(stdout).toContain('FLAKY');
        expect(stdout).not.toContain('INFRA FAIL');
    });
});
