import fs from 'node:fs';
import path from 'node:path';
import { injectAppNameScript } from '../../src/utils/brandHtml';

/**
 * CSP-E: sufit enforce — zero inline handlerów i javascript:-URLi w kodzie
 * first-party (partials + szablony JS + strony). Dopuszczalne: .onclick =
 * (własność DOM, nie atrybut — CSP jej nie blokuje) oraz vendor/.
 */
const PUB = path.resolve(__dirname, '..', '..', 'public');

function walk(dir: string, ext: string[], out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'vendor' || e.name === 'dist') continue;
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp, ext, out);
        else if (ext.some((x) => e.name.endsWith(x))) out.push(fp);
    }
    return out;
}

describe('CSP-E sufit enforce', () => {
    it('partials: zero atrybutów on* (click/change/mouse/...)', () => {
        const bad: string[] = [];
        for (const f of walk(path.join(PUB, 'partials'), ['.html'])) {
            const s = fs.readFileSync(f, 'utf8');
            const m = s.match(/\son[a-z]+\s*=/g);
            if (m) bad.push(`${path.relative(PUB, f)}: ${m.join(',')}`);
        }
        expect(bad).toEqual([]);
    });

    it('szablony JS: zero atrybutów on* (własność .onclick = dozwolona)', () => {
        const bad: string[] = [];
        for (const f of walk(path.join(PUB, 'js'), ['.js'])) {
            const s = fs.readFileSync(f, 'utf8');
            const m = s.match(/\son[a-z]+\s*=\s*["']/g);
            if (m) bad.push(`${path.relative(PUB, f)}: ${m.join(',')}`);
        }
        expect(bad).toEqual([]);
    });

    it('brak javascript:-URLi we własnym kodzie', () => {
        const bad: string[] = [];
        // Celujemy w użycie (href=/przypisanie/wywolanie), nie w guardy typu
        // startsWith('javascript:') które takie URL-e odrzucają.
        for (const f of [
            ...walk(PUB, ['.html']),
            ...walk(path.join(PUB, 'js'), ['.js']),
            ...walk(path.join(PUB, 'partials'), ['.html'])
        ]) {
            const lines = fs.readFileSync(f, 'utf-8').split('\n');
            const hit = lines.some(
                (ln) =>
                    /["']javascript:/.test(ln) &&
                    !/(startsWith|endsWith|includes|indexOf|match|test)\s*\(?\s*["']javascript:/.test(
                        ln
                    )
            );
            if (hit) bad.push(path.relative(PUB, f));
        }
        expect(bad).toEqual([]);
    });

    it('injectAppNameScript: nonce na kazdym inline script bez src', () => {
        const html =
            '<html><head></head><body>' +
            '<script>var a = 1;</script>' +
            '<script src="x.js"></script>' +
            '<script nonce="keep">var b = 2;</script>' +
            '</body></html>';
        const out = injectAppNameScript(html, 'NONCE123');
        expect(out).toContain('<script nonce="NONCE123">var a = 1;</script>');
        expect(out).toContain('<script src="x.js"></script>');
        expect(out).toContain('<script nonce="keep">var b = 2;</script>');
        expect(out).toContain('nonce="NONCE123">window.APP_NAME=');
    });
});
