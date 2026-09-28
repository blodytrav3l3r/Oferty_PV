/*
 * tests/ci/workflowStatus.test.ts
 * P1.1: semantyka statusow load/deploy w workflowach (PASS/FAIL/SKIPPED/BLOCKED).
 * Zakaz maskowania: brak serwera / brak konfiguracji NIE moze konczyc sie
 * cichym SUCCESS udajacym wykonany test lub wdrozenie.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const CI = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const NIGHTLY = fs.readFileSync(
    path.join(ROOT, '.github', 'workflows', 'load-nightly.yml'),
    'utf8'
);

describe('P1.1 load status semantics', () => {
    it('ci.yml: brak maskujacego LOAD_SKIP=true', () => {
        expect(CI).not.toMatch(/LOAD_SKIP=true/);
        expect(CI).not.toMatch(/LOAD_SKIP !=/);
    });

    it('ci.yml: brak serwera to FAIL (exit 1 + BLOCKED), nie SKIP', () => {
        expect(CI).toMatch(/brak serwera = FAIL/);
        expect(CI).toMatch(/LOAD_STATUS=BLOCKED/);
        expect(CI).toMatch(/GITHUB_STEP_SUMMARY/);
        // Sekcja load-quick musi zawierac jawny exit 1 po BLOCKED.
        const idx = CI.indexOf('load-quick');
        const section = CI.slice(idx, idx + 6000);
        expect(section).toMatch(/exit 1/);
        expect(section).not.toMatch(/pomijam load-quick \(nie FAIL\)/);
    });

    it('ci.yml: krok Load quick jest bezwarunkowy (brak if LOAD_SKIP)', () => {
        const idx = CI.indexOf('Load quick (self-cleaning');
        expect(idx).toBeGreaterThan(-1);
        const window = CI.slice(Math.max(0, idx - 200), idx + 200);
        expect(window).not.toMatch(/if:\s*env\.LOAD_SKIP/);
    });

    it('load-nightly.yml: swiadome pominiecie tylko przez jawny input skip', () => {
        expect(NIGHTLY).toMatch(/skip:/);
        expect(NIGHTLY).toMatch(/LOAD_SKIP_CONSCIOUS=true/);
        expect(NIGHTLY).toMatch(/SKIPPED \(swiadome pominiecie/);
        expect(NIGHTLY).not.toMatch(/LOAD_SKIP=true/);
    });

    it('load-nightly.yml: brak serwera to FAIL (exit 1 + BLOCKED)', () => {
        expect(NIGHTLY).toMatch(/brak serwera = FAIL/);
        expect(NIGHTLY).toMatch(/LOAD_STATUS=BLOCKED/);
        const idx = NIGHTLY.indexOf('Czekaj na /health');
        const section = NIGHTLY.slice(idx, idx + 3000);
        expect(section).toMatch(/exit 1/);
    });
});
