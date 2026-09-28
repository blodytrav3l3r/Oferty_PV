/*
 * tests/security/cspInventory.test.ts
 * CSP-A: sufit legacy surface (NEW inline handlers = 0).
 * Test pada gdy ktos doda nowy inline <script>, onclick albo style=
 * w public/*.html — hardening idzie w dol (CSP-B), nie w gore.
 * Liczniki z docs/plans/csp-hardening.md (inventory 2026-09-28).
 */
import fs from 'node:fs';
import path from 'node:path';

const PUB = path.resolve(__dirname, '..', '..', 'public');

const CEIL = {
    inlineScript: 17,
    onclick: 40,
    styleAttr: 25
};

function count(re: RegExp, s: string): number {
    return (s.match(re) || []).length;
}

describe('CSP-A inventory ceiling', () => {
    const files = fs.readdirSync(PUB).filter((f) => f.endsWith('.html'));

    it('7 wejsc HTML (kontrakt powierzchni)', () => {
        expect(files.sort()).toEqual(
            [
                'app.html',
                'benchmark-tm.html',
                'index.html',
                'kartoteka.html',
                'rury.html',
                'studnie.html',
                'zlecenia.html'
            ].sort()
        );
    });

    it('inline <script> nie rosnie', () => {
        let total = 0;
        for (const f of files) {
            const s = fs.readFileSync(path.join(PUB, f), 'utf8');
            total += count(/<script(?![^>]*src=)[^>]*>/gi, s);
        }
        expect(total).toBeLessThanOrEqual(CEIL.inlineScript);
    });

    it('onclick nie rosnie', () => {
        let total = 0;
        for (const f of files) {
            const s = fs.readFileSync(path.join(PUB, f), 'utf8');
            total += count(/\sonclick\s*=/gi, s);
        }
        expect(total).toBeLessThanOrEqual(CEIL.onclick);
    });

    it('style= nie rosnie', () => {
        let total = 0;
        for (const f of files) {
            const s = fs.readFileSync(path.join(PUB, f), 'utf8');
            total += count(/\sstyle\s*=/gi, s);
        }
        expect(total).toBeLessThanOrEqual(CEIL.styleAttr);
    });

    it('enforce CSP nie zawiera obcych zrodel skryptow', () => {
        const app = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'app.ts'), 'utf8');
        expect(app).toMatch(/scriptSrc/);
        expect(app).not.toMatch(/https:\/\//);
    });
});
