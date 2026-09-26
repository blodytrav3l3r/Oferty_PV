/**
 * Contract guard (F3): fail-closed na legacy cenników.
 *
 * Użycie `price_defaults` / `_Default` / `restoreDefaultsFromJson` poza
 * allowlistą = FAIL. Allowlista = Expand-faza (stare LIVE działa do Contract);
 * Contract usunie wpisy i zacieśni guard do zera.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

/** Pliki z legacy dozwolone do Contract (Expand & Contract). */
const ALLOWLIST = new Set(
    [
        // Silnik legacy LIVE + *_Default (działa do Contract).
        'src/services/priceOverrideService.ts',
        'src/validators/priceDefaultsSchemas.ts',
        // Klucz fresh-guarda pricelist_defaults_updated_at (F1/F2, nietknięte).
        'src/services/pricelistVersionService.ts',
        // Startowy restore snapshotu (app.ts:356, usuwany w Contract).
        'src/app.ts',
        // Transfer maszyn starym JSON do końca F3.
        'scripts/prices-export.ts',
        'scripts/prices-import.ts',
        'scripts/prices-verify.ts',
        'scripts/add-transport-products.mjs',
        'scripts/docker-entrypoint.sh',
        // Testy silnika legacy + ten guard (wzorce w literałach).
        'tests/priceOverrideService.test.ts',
        'tests/pricelistLegacyGuard.test.ts'
    ].map((p) => path.normalize(p))
);

const PATTERNS = [/price_defaults/, /_Default/, /restoreDefaultsFromJson/];
const SCAN_DIRS = ['src', 'scripts', 'public/js', 'tests'];
const SCAN_FILES = ['server.ts'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build']);

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name)) continue;
            walk(path.join(dir, e.name), out);
        } else if (/\.(ts|js|mjs|cjs|tsx|jsx)$/.test(e.name)) {
            out.push(path.join(dir, e.name));
        }
    }
}

describe('pricelistLegacyGuard (fail-closed)', () => {
    test('brak legacy poza allowlistą', () => {
        const files: string[] = [];
        for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
        for (const f of SCAN_FILES) {
            const p = path.join(ROOT, f);
            if (fs.existsSync(p)) files.push(p);
        }
        const violations: string[] = [];
        for (const abs of files) {
            const rel = path.normalize(path.relative(ROOT, abs));
            if (ALLOWLIST.has(rel)) continue;
            const content = fs.readFileSync(abs, 'utf8');
            for (const re of PATTERNS) {
                if (re.test(content)) violations.push(`${rel} ~ ${re.source}`);
            }
        }
        expect(violations).toEqual([]);
    });

    test('allowlista istnieje i jest niepusta (Expand; Contract ją wyzeruje)', () => {
        for (const rel of ALLOWLIST) {
            expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
        }
        expect(ALLOWLIST.size).toBeGreaterThan(0);
    });
});
