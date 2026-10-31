/**
 * Contract guard (etap 2): fail-closed na legacy cenników.
 *
 * Każda referencja do starego snapshotu JSON, tabel domyślnych albo restore
 * z pliku = FAIL. Allowlista jest pusta — tabele LIVE i snapshot nie istnieją,
 * więc każda referencja to regresja. Wzorce składamy z fragmentów, żeby ten
 * plik nie łapał sam siebie.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');

/** Pusta po etapie 2 — wyjątków nie ma. */
const ALLOWLIST = new Set<string>();

const PATTERNS = [
    new RegExp('price' + '_defaults'),
    new RegExp('_' + 'Default'),
    new RegExp('restoreDefaults' + 'FromJson')
];
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

    test('allowlista jest pusta (etap 2: zero wyjątków)', () => {
        expect(ALLOWLIST.size).toBe(0);
    });
});
