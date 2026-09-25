// @ts-nocheck -- skan tekstu CSS, celowy brak typow dla public/
// ===== THEME TOKENS PARITY — kontrakt Dark/Light (domkniecie systemu) =====
// :root = dark (SSoT). Kazdy token uzywany w UI musi byc:
//  - zdefiniowany w :root, oraz
//  - nadpisany w html[data-theme='light'] LUB na liscie SHARED (wspoldzielony
//    miedzy motywami: skale, palety ID, geometria, print).
// Wzorzec: tests/studnie/excelThemeTokens.test.ts.
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const BASE_CSS = fs.readFileSync(path.join(ROOT, 'public/css/style.base.css'), 'utf8');
const STUDNIE_CSS = fs.readFileSync(path.join(ROOT, 'public/css/studnie.css'), 'utf8');

/* Tokeny celowo wspoldzielone (identyczna wartosc w obu motywach). */
const SHARED = new Set([
    // skale i geometria
    ...[
        'fs-3xs',
        'fs-2xs',
        'fs-xs',
        'fs-sm',
        'fs-base',
        'fs-md',
        'fs-lg',
        'fs-xl',
        'fs-2xl',
        'fs-3xl',
        'fs-4xl',
        'fs-5xl',
        'fs-6xl',
        'fs-7xl',
        'fs-8xl',
        'fw-medium',
        'fw-normal',
        'fw-semibold',
        'fw-bold',
        'fw-extrabold',
        'fw-black',
        'fw-light',
        'font-sans',
        'font-mono',
        'radius-2xs',
        'radius-sm',
        'radius',
        'radius-md',
        'radius-lg',
        'radius-pill',
        'z-header',
        'z-sticky-th',
        'z-sticky-dropdown',
        'z-dropdown',
        'z-overlay',
        'z-toast',
        'header-h',
        'header-h-mobile',
        'bottom-bar-h',
        'bottom-bar-h-mobile',
        'section-max-width',
        'section-pad-x',
        'section-gap',
        'section-gap-lg',
        'tile-gap-micro',
        'tile-gap-2xs',
        'tile-gap-xs',
        'tile-gap-xs-plus',
        'tile-gap-sm',
        'tile-gap-sm-plus',
        'tile-gap-md',
        'tile-gap-lg',
        'tile-gap-xl',
        'transition',
        'blur-glass'
    ].map((n) => `--${n}`),
    // paleta neutralna i identyfikacyjna (stale identyfikatory wizualne)
    ...[
        'black',
        'black-rgb',
        'white',
        'white-rgb',
        'slate-950',
        'slate-950-rgb',
        'slate-900',
        'slate-800',
        'slate-800-rgb',
        'slate-700',
        'slate-700-rgb',
        'slate-600',
        'slate-600-rgb',
        'slate-500',
        'slate-500-rgb',
        'slate-400-rgb',
        'slate-200',
        'slate-100',
        'slate-50',
        'slate-400',
        'slate-300',
        'cmp-plyta-din',
        'cmp-plyta-najazdowa',
        'cmp-plyta-zamykajaca',
        'cmp-pierscien',
        'cmp-konus',
        'cmp-avr',
        'cmp-plyta-redukcyjna',
        'cmp-krag',
        'cmp-dennica',
        'cmp-kineta',
        'cmp-styczna',
        'cmp-osadnik',
        'cmp-uszczelka',
        'sky-500',
        'brand-navy',
        'accent-glow-soft',
        'scrollbar-thumb',
        'scrollbar-thumb-hover',
        'shadow-navy'
    ].map((n) => `--${n}`),
    // washe rgba (te same hue, para wash + tekst z motywu)
    ...[
        'accent-rgb',
        'accent2-rgb',
        'accent2-hover-rgb',
        'accent-hover-rgb',
        'success-rgb',
        'success-hover-rgb',
        'danger-rgb',
        'warn-rgb',
        'warn-row-rgb',
        'warn-hover-rgb',
        'blue-rgb',
        'blue-hover-rgb',
        'blue-alt-rgb',
        'purple-rgb',
        'pink-rgb',
        'accent-text-rgb',
        'warn-bg-soft',
        'warn-bg-light',
        'text-danger',
        'purple-alt',
        'shadow',
        'success-bg-soft',
        'danger-bg-soft',
        'success-strong',
        'danger-strong',
        'warn-strong',
        'accent2-bg-soft',
        'blue-bg-soft',
        'focus-ring'
    ].map((n) => `--${n}`)
]);

function getRootBlock(css) {
    const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    return m ? m[1] : '';
}

function getThemeBlocks(css) {
    const out = {};
    const re = /html\[data-theme='([^']+)'\]\s*\{([\s\S]*?)\n\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        out[m[1]] = (out[m[1]] || '') + '\n' + m[2];
    }
    return out;
}

function parseTokenNames(block) {
    const names = new Set();
    const re = /(--[\w-]+)\s*:/g;
    let m;
    while ((m = re.exec(block)) !== null) names.add(m[1]);
    return names;
}

describe('themeTokens kontrakt Dark/Light', () => {
    test('kazdy token :root ma odpowiednik light albo jest SHARED', () => {
        const rootNames = parseTokenNames(getRootBlock(BASE_CSS));
        const lightNames = parseTokenNames(getThemeBlocks(BASE_CSS).light || '');
        const missing = [...rootNames].filter((t) => !lightNames.has(t) && !SHARED.has(t));
        expect(missing).toEqual([]);
    });

    test('brak martwych tokenow light-only (definiowane, nieuzywane nigdzie)', () => {
        const lightNames = parseTokenNames(getThemeBlocks(BASE_CSS).light || '');
        const rootNames = parseTokenNames(getRootBlock(BASE_CSS));
        const onlyLight = [...lightNames].filter((t) => !rootNames.has(t));
        const usedSomewhere = (tok) => BASE_CSS.split(tok).length > 2 || STUDNIE_CSS.includes(tok);
        const dead = onlyLight.filter((t) => !usedSomewhere(t));
        expect(dead).toEqual([]);
    });

    test('zakazane widma: radius-xs, niezdefiniowane rgb, fallback z-dropdown', () => {
        expect(STUDNIE_CSS.includes('var(--radius-xs)')).toBe(false);
        expect(BASE_CSS.includes('--danger-text')).toBe(false);
        expect(STUDNIE_CSS.includes('var(--z-dropdown,')).toBe(false);
    });
});
