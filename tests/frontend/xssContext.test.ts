import fs from 'fs';
import path from 'path';

// P0.3: klasyfikacja kontekstów escapowania (korekta #2 z review planu).
// - HTML-attr (value/title/data-*/href/aria-*) -> tylko escapeHtmlAttr
// - JS-string w onclick ('...') -> tylko escapeJsStr
// - text-content (">...") -> escapeHtml
function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp, out);
        else if (e.name.endsWith('.js')) out.push(fp);
    }
    return out;
}

describe('P0.3 konteksty escapowania w public/js', () => {
    const files = walk(path.join(process.cwd(), 'public/js'));

    it('brak escapeHtml() w atrybutach HTML', () => {
        const bad: string[] = [];
        const re =
            /(value|title|data-[a-z-]+|href|aria-label|placeholder|alt)=["']\$\{escapeHtml\(/;
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf-8');
            if (re.test(content)) bad.push(path.relative(process.cwd(), f));
        }
        expect(bad).toEqual([]);
    });

    it('brak escapeHtml() w JS-stringach onclick', () => {
        const bad: string[] = [];
        const re = /onclick="[^"]*escapeHtml\(/;
        for (const f of files) {
            const content = fs.readFileSync(f, 'utf-8');
            if (re.test(content)) bad.push(path.relative(process.cwd(), f));
        }
        expect(bad).toEqual([]);
    });

    it('escapeHtmlAttr escapuje cudzysłowy (payload nie wychodzi z atrybutu)', () => {
        const file = path.join(process.cwd(), 'public/js/shared/escapeHtml.js');
        const content = fs.readFileSync(file, 'utf-8');
        // implementacja musi zamieniać " oraz '
        expect(content).toMatch(/&quot;/);
        expect(content).toMatch(/&#39;/);
    });

    it('escapeJsStr escapuje backslash i cudzysłowy', () => {
        const file = path.join(process.cwd(), 'public/js/shared/escapeHtml.js');
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).toMatch(/\\\\/);
        expect(content).toMatch(/\\'/);
    });
});
