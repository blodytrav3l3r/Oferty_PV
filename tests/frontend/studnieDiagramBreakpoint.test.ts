import fs from 'fs';
import path from 'path';

/**
 * Breakpoint ≤1200 px: panel podglądu studni MUSI być ukryty.
 * Regresja z 1.63.1: media query stała wyżej w pliku niż bazowy
 * `.well-diagram-panel { display: flex }`, więc `display: none` było martwe —
 * panel zostawał w siatce 2-kolumnowej, dzielił wysokość z listą studni
 * i przewijał się (schemat `yMax` wpadał pod krawędź panelu).
 */

const ROOT = path.join(__dirname, '..', '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/css/studnie.css'), 'utf-8');

/** Wycina blok `@media (max-width: 1200px) { ... }` po zrównoważonych klamrach. */
function mediaBlock(css: string, header: string): string {
    const start = css.indexOf(header);
    if (start === -1) return '';
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
        if (css[i] === '{') depth++;
        if (css[i] === '}') {
            depth--;
            if (depth === 0) return css.slice(open + 1, i);
        }
    }
    return '';
}

describe('Podgląd studni — breakpoint 1200 px', () => {
    const block = mediaBlock(CSS, '@media (max-width: 1200px)');

    it('blok media istnieje i ustawia 2 kolumny', () => {
        expect(block).not.toBe('');
        expect(block).toContain('grid-template-columns: 1fr clamp(200px, 22vw, 280px);');
    });

    it('ukrywa panel selektorem mocniejszym niż bazowy `.well-diagram-panel`', () => {
        expect(block).toMatch(/\.well-app-layout \.well-diagram-panel\s*\{[^}]*display:\s*none/);
    });

    it('bazowy panel nadal jest flexem (kolejność w pliku nie może tego zmienić)', () => {
        const base = mediaBlock(CSS, '\n.well-diagram-panel {');
        expect(base).toContain('display: flex;');
    });
});
