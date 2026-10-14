/*
 * tests/security/noHardcodedSecrets.test.ts
 * Brama: sekrety nie w kodzie. Skan src/** + scripts/** pod kątem
 * zahardkodowanego hasła deweloperskiego. Allowlista (D-decision pending):
 * - src/middleware/auth.ts: stała fallbacku (usunięcie wymaga GO — łamie
 *   dev/test; prod i tak rzuca bez hasła). Każdy NOWY trafiony plik = fail.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SECRET = 'anim123456';
// Pliki z jawną decyzją (komentarz z powodem), nie do kopiowania wzorca.
const ALLOW = new Set(['src/middleware/auth.ts']);

function* walk(dir: string): Generator<string> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules') continue;
            yield* walk(full);
        } else if (/\.(ts|js|mjs|cjs|sh|bat|ps1|yml|yaml|json)$/.test(e.name)) {
            yield full;
        }
    }
}

describe('security: brak zahardkodowanych sekretów w src/scripts', () => {
    it('żaden nowy plik poza allowlistą nie niesie sekretu', () => {
        const bad: string[] = [];
        for (const dir of ['src', 'scripts']) {
            for (const file of walk(path.join(ROOT, dir))) {
                const content = fs.readFileSync(file, 'utf8');
                if (!content.includes(SECRET)) continue;
                const rel = path.relative(ROOT, file).replace(/\\/g, '/');
                if (ALLOW.has(rel)) continue;
                bad.push(rel);
            }
        }
        expect(bad).toEqual([]);
    });

    it('allowlista ma dokładnie 1 wpis (fallback auth.ts)', () => {
        expect([...ALLOW]).toEqual(['src/middleware/auth.ts']);
        const content = fs.readFileSync(path.join(ROOT, 'src/middleware/auth.ts'), 'utf8');
        expect(content).toContain(SECRET);
    });
});
