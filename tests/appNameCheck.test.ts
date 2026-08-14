const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateRepo, readErrors } = require('../scripts/check-appname.cjs');

const SCRIPT = path.resolve(__dirname, '../scripts/check-appname.cjs');
const REPO_ROOT = path.resolve(__dirname, '..');

function makeFixture(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appname-'));
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
    }
    return dir;
}

function runCli(root: string): string {
    return execFileSync(process.execPath, [SCRIPT, '--root', root], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function expectCliFail(root: string): string {
    let out = '';
    try {
        out = runCli(root);
    } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        return (e.stdout ?? '') + (e.stderr ?? '');
    }
    throw new Error(`CLI should have failed but exited 0:\n${out}`);
}

describe('check-appname — strażnik nazwy aplikacji (S.O.K.)', () => {
    it('akceptuje dozwolony "WITROS" (firma/dane)', () => {
        const dir = makeFixture({
            'firma.js': "// © WITROS Sp. z o.o., Autor: WITROS\nconst id = 'WITROS-1000';"
        });
        const out = runCli(dir);
        expect(out).toContain('✓');
    });

    it('pomija whitelistowane ścieżki (plans/archive, CHANGELOG, data/seed, LICENSE, junit, tmp)', () => {
        const dir = makeFixture({
            'docs/plans/active.md': 'plan WITROS Oferty PV (roboczy)',
            'docs/plans/archive/stary.md': 'stary plan WITROS Oferty PV',
            'docs/adr/ADR-001.md': 'ADR WITROS Oferty PV',
            'CHANGELOG.md': '## [1.0.0] WITROS Oferty PV',
            'data/seed.json': '{"name": "WITROS Oferty PV seed"}',
            LICENSE: 'WITROS Oferty PV — licence',
            'junit/run1.json': '{"fullName": "test WITROS Oferty PV"}'
        });
        const out = runCli(dir);
        expect(out).toContain('✓');
    });

    it('pomija binaria (NUL + .svg)', () => {
        const dir = makeFixture({});
        fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'public', 'img.svg'), 'WITROS Oferty PV', 'utf-8');
        fs.writeFileSync(
            path.join(dir, 'public', 'bin.dat'),
            'WITROS Oferty PV\u0000\x00\x00',
            'utf-8'
        );
        const out = runCli(dir);
        expect(out).toContain('✓');
    });

    it('odrzuca "WITROS Oferty PV" (P1)', () => {
        const dir = makeFixture({ 'a.js': 'const app = "WITROS Oferty PV";' });
        const out = expectCliFail(dir);
        expect(out).toContain('P1');
    });

    it('odrzuca "WITROS Oferty" bez PV (P1)', () => {
        const dir = makeFixture({ 'a.js': '// WITROS Oferty — moduł' });
        const out = expectCliFail(dir);
        expect(out).toContain('P1');
    });

    it('odrzuca "WITROS — Generator Ofert" (em dash, P2)', () => {
        const dir = makeFixture({ 'a.js': "document.title = 'WITROS — Generator Ofert';" });
        const out = expectCliFail(dir);
        expect(out).toContain('P2');
    });

    it('odrzuca "WITROS - Generator Ofert" (ASCII dash, P2)', () => {
        const dir = makeFixture({ 'a.js': "document.title = 'WITROS - Generator Ofert';" });
        const out = expectCliFail(dir);
        expect(out).toContain('P2');
    });

    it('odrzuca "WITROS — Kalkulator Studni" (P4)', () => {
        const dir = makeFixture({ 'a.js': '// WITROS — Kalkulator Studni' });
        const out = expectCliFail(dir);
        expect(out).toContain('P4');
    });

    it('odrzuca "WITROS PRECISION OS" (P3)', () => {
        const dir = makeFixture({ 'a.js': '/* WITROS PRECISION OS — APP.JS */' });
        const out = expectCliFail(dir);
        expect(out).toContain('P3');
    });

    it('raportuje wiele naruszeń (2 pliki w stdout)', () => {
        const dir = makeFixture({
            'a.js': 'WITROS Oferty PV',
            'b.js': 'WITROS — Generator Ofert'
        });
        const out = expectCliFail(dir);
        expect(out).toMatch(/a\.js/);
        expect(out).toMatch(/b\.js/);
        expect(out).toMatch(/2 plik/);
    });

    it('orderEditMode.js — tytuł naprawiony na S.O.K. (regresja #92)', () => {
        const src = fs.readFileSync(
            path.join(REPO_ROOT, 'public/js/rury/orderEditMode.js'),
            'utf-8'
        );
        expect(src).not.toMatch(/WITROS\s*[—-]\s*Generator\s+Ofert/i);
        expect(src).toMatch(/window\.APP_NAME\s*\|\|\s*'S\.O\.K\.'/);
        expect(src).toMatch(/\$\{window\.APP_NAME \|\| 'S\.O\.K\.'\}\s*[—-]\s*Generator\s+Ofert/);
    });

    it('integracja: validateRepo(repo) → 0 naruszeń', () => {
        const results = validateRepo(REPO_ROOT);
        expect(results).toHaveLength(0);
    });

    it('błąd odczytu katalogu nie jest maskowany — trafia do readErrors', () => {
        const dir = makeFixture({ 'ok.js': '// czysty plik' });
        const real = fs.readdirSync;
        const spy = jest.spyOn(fs, 'readdirSync').mockImplementation((...args: any[]) => {
            const target = String(args[0]).replace(/\\/g, '/');
            if (target.endsWith('/sub')) {
                const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
                err.code = 'EACCES';
                throw err;
            }
            return real(...(args as [string]));
        });
        try {
            fs.mkdirSync(path.join(dir, 'sub'));
            const results = validateRepo(dir);
            expect(results).toHaveLength(0);
            expect(readErrors.some((e: string) => e.replace(/\\/g, '/').includes('/sub'))).toBe(
                true
            );
        } finally {
            spy.mockRestore();
        }
    });

    it('readErrors jest czyszczone między wywołaniami validateRepo', () => {
        const dir = makeFixture({ 'sub/ok.js': '// czysty plik' });
        const real = fs.readdirSync;
        const spy = jest.spyOn(fs, 'readdirSync').mockImplementation((...args: any[]) => {
            const target = String(args[0]).replace(/\\/g, '/');
            if (target.endsWith('/sub')) {
                const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
                err.code = 'EACCES';
                throw err;
            }
            return real(...(args as [string]));
        });
        try {
            validateRepo(dir);
            expect(readErrors.length).toBeGreaterThan(0);
            const clean = validateRepo(makeFixture({ 'a.js': '// x' }));
            expect(clean).toHaveLength(0);
            expect(readErrors).toHaveLength(0);
        } finally {
            spy.mockRestore();
        }
    });
});
