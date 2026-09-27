// @ts-nocheck -- skan tekstu CSS, celowy brak typow dla public/
// ===== THEME RESZTKA — gate fazy D (P1.2): filter-bar, focus-ring, soft-bg, blur =====
// Zakotwicza poprawki audytu: plaski filter-bar bez gradientu/blura,
// --focus-ring per motyw, ciemne soft-bg w dark (:root) + pastele w light,
// kasacja backdrop-blur w edytowanych selektorach.
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');

function readRel(f) {
    return fs.readFileSync(path.join(ROOT, f), 'utf8');
}

/* Zwraca tresc WSZYSTKICH blokow danego selektora (zlaczone). */
function selectorBlocks(css, selector) {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc + '\\s*\\{([^{}]*)\\}', 'g');
    const out = [];
    let m;
    while ((m = re.exec(css)) !== null) out.push(m[1]);
    return out.join('\n');
}

function rootBlock(css) {
    const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    return m ? m[1] : '';
}

function lightBlocks(css) {
    const out = [];
    const re = /html\[data-theme='light'\][^{]*\{([\s\S]*?)\n\}/g;
    let m;
    while ((m = re.exec(css)) !== null) out.push(m[1]);
    return out.join('\n');
}

function tokenValue(block, name) {
    const m = block.match(
        new RegExp(name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*:\\s*([^;]+);')
    );
    return m ? m[1].trim() : null;
}

describe('themeResztka gate fazy D', () => {
    const BASE = readRel('public/css/style.base.css');
    const RESP = readRel('public/css/style.responsive.css');
    const ZLEC = readRel('public/css/zlecenia.css');
    const STUD = readRel('public/css/studnie.css');
    const UPM = readRel('public/css/printModal.css');

    test('filter-bar plaski: bez blur i gradientu, na tokenach', () => {
        const base = selectorBlocks(RESP, '.kartoteka-filter-bar');
        expect(base).not.toMatch(/backdrop-filter/);
        expect(base).not.toMatch(/linear-gradient/);
        expect(base).toMatch(/background:\s*var\(--bg-secondary\)/);
        expect(base).toMatch(/border:\s*1px solid var\(--border\)/);
    });

    test('filter-bar w light tez plaski (bez gradientu)', () => {
        const light = lightBlocks(RESP);
        expect(light).not.toMatch(/linear-gradient/);
        expect(light).toMatch(/--bg-secondary/);
    });

    test('focus-ring zdefiniowany w dark i light', () => {
        expect(tokenValue(rootBlock(BASE), '--focus-ring')).toBe('var(--accent)');
        expect(tokenValue(lightBlocks(BASE), '--focus-ring')).toBe('var(--accent)');
        expect(BASE).toMatch(/\*:focus-visible\s*\{\s*outline:\s*2px solid var\(--focus-ring\)/);
    });

    test('soft-bg ciemne w dark, pastele w light', () => {
        const root = rootBlock(BASE);
        expect(tokenValue(root, '--success-bg-soft')).toBe('#0d2a20');
        expect(tokenValue(root, '--danger-bg-soft')).toBe('#3a1515');
        expect(tokenValue(root, '--warn-bg-soft')).toBe('#2d1a08');
        const light = lightBlocks(BASE);
        expect(tokenValue(light, '--success-bg-soft')).toBe('#e6f7e6');
        expect(tokenValue(light, '--danger-bg-soft')).toBe('#fce8e8');
        expect(tokenValue(light, '--warn-bg-soft')).toBe('#fff3e0');
    });

    test('print zachowuje jasne pastele soft', () => {
        const print = RESP.slice(RESP.indexOf('@media print'));
        expect(print).toMatch(/--success-bg-soft:\s*#e6f7e6/);
        expect(print).toMatch(/--danger-bg-soft:\s*#fce8e8/);
        expect(print).toMatch(/--warn-bg-soft:\s*#fff3e0/);
    });

    test('brak backdrop-blur w edytowanych selektorach', () => {
        expect(selectorBlocks(ZLEC, '.zlecenia-batch-bar')).not.toMatch(/backdrop-filter/);
        expect(selectorBlocks(STUD, '.main.studnie-view-transitioning::after')).not.toMatch(
            /backdrop-filter/
        );
        expect(selectorBlocks(STUD, '.app-confirm-overlay')).not.toMatch(/backdrop-filter/);
        expect(selectorBlocks(UPM, '.upm-overlay')).not.toMatch(/backdrop-filter/);
    });

    test('edytowane selektory bez golych hexow (tylko var(--*))', () => {
        const blocks = [
            selectorBlocks(RESP, '.kartoteka-filter-bar'),
            selectorBlocks(ZLEC, '.zlecenia-batch-bar'),
            selectorBlocks(STUD, '.app-confirm-overlay'),
            selectorBlocks(UPM, '.upm-overlay')
        ].join('\n');
        expect(blocks).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });

    test('light graniczne bez regresji: warn-strong i text-muted ciemne', () => {
        // Faza1 FAIL th 4,08 / badge-warn 4,43 na #996600 — po fixie #8a5c00/#52616f.
        expect(tokenValue(rootBlock(BASE), '--warn-strong')).toBe('#8a5c00');
        expect(tokenValue(lightBlocks(BASE), '--text-muted')).toBe('#52616f');
        expect(BASE + RESP + ZLEC + STUD + UPM).not.toMatch(/#996600/i);
    });
});
