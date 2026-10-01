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
    onclick: 0,
    styleAttr: 25,
    // CSP-B3: zero atrybutow on* (dowolne zdarzenie) poza .x= (wlasnosc DOM).
    otherOnAttr: 0
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

    it('inne on* (change/input/mouse/...) nie rosna — top-level HTML', () => {
        let total = 0;
        for (const f of files) {
            const s = fs.readFileSync(path.join(PUB, f), 'utf8');
            const m = s.match(/\son(?!click)[a-z]+\s*=/gi) || [];
            total += m.length;
        }
        expect(total).toBeLessThanOrEqual(CEIL.otherOnAttr);
    });

    it('partials: zero atrybutow on*', () => {
        const dir = path.join(PUB, 'partials');
        const walk = (d: string): string[] =>
            fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
                const fp = path.join(d, e.name);
                return e.isDirectory() ? walk(fp) : fp.endsWith('.html') ? [fp] : [];
            });
        const bad: string[] = [];
        for (const f of walk(dir)) {
            const s = fs.readFileSync(f, 'utf8');
            if (/\son[a-z]+\s*=/i.test(s)) bad.push(path.relative(PUB, f));
        }
        expect(bad).toEqual([]);
    });

    it('szablony JS: zero atrybutow on* (wlasnosc .x= dozwolona)', () => {
        const dir = path.join(PUB, 'js');
        const walk = (d: string): string[] =>
            fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
                const fp = path.join(d, e.name);
                return e.isDirectory() ? walk(fp) : fp.endsWith('.js') ? [fp] : [];
            });
        const bad: string[] = [];
        for (const f of walk(dir)) {
            const s = fs.readFileSync(f, 'utf8');
            // Bramka lapie tez on* na poczatku template-chunka (po backticku),
            // nie tylko po spacji — inaczej inline handlery w szablonach JS
            // przechodza niezauwazone (przypadek diagramComponents.js, CSP-E).
            const m = s.match(/[\s`]on[a-z]+\s*=\s*["']/g);
            if (m) bad.push(`${path.relative(PUB, f)}: ${m.join(',')}`);
        }
        expect(bad).toEqual([]);
    });

    it('enforce CSP nie zawiera obcych zrodel skryptow', () => {
        const app = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'app.ts'), 'utf8');
        expect(app).toMatch(/scriptSrc/);
        expect(app).not.toMatch(/https:\/\//);
    });
});
