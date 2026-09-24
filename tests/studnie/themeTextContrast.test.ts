// @ts-nocheck -- skan tekstu CSS/HTML, celowy brak typow dla public/
// ===== THEME TEXT CONTRAST — bialy tekst wymaga ciemnego tla lub latki light =====
// Luka pokryta: themeTokensParity weryfikuje parzystosc tokenow, ale nie kontrast
// per-selektor (dowod: L8/L9/L10 w studnie.css). Ten test wymaga, by kazdy selektor
// z bialym kolorem tekstu mial:
//  - ciemne tlo w tej samej regule (kotwica: slate-950/slate-800/black/accent/…), LUB
//  - jawna latke html[data-theme='light'] dla tego selektora.
// Dodatkowo: klasy z class="" w HTML studni musza istniec w CSS (wykrywa martwe
// klasy) oraz style inline w partialach nie moga uzywac bieli/slate-200/300/400
// jako koloru tekstu (niewidoczne w light).
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const CSS_FILES = [
    'public/css/style.base.css',
    'public/css/style.cards.css',
    'public/css/style.responsive.css',
    'public/css/style.utilities.css',
    'public/css/studnie.css',
    'public/css/studnie/offer.css',
    'public/css/studnie/modal.css',
    'public/css/printModal.css'
];
const HTML_FILES = [
    'public/studnie.html',
    'public/partials/studnie/sidebar.html',
    'public/partials/studnie/step1-client.html',
    'public/partials/studnie/step2-parameters.html',
    'public/partials/studnie/step3-offer.html',
    'public/partials/studnie/step4-build-card.html',
    'public/partials/studnie/offer.html',
    'public/partials/studnie/pricelist.html',
    'public/partials/studnie/modals.html'
];
/* Haczyki JS / w pelni inline-stylowane: klasa bez reguly CSS jest zamierzona. */
const CLASS_HOOKS = new Set(['param-group', 'spinner-loader', 'page-loader-spinner']);
const FOREIGN_PREFIX = /^(fa-|lucide|icon-|cursor-|no-|js-|is-|has-)/;

function readRel(f) {
    return fs.readFileSync(path.join(ROOT, f), 'utf8');
}

/* Prosty parser regul top-level (lapie tez reguly w @media — tez obowiazuja). */
function parseRules(css) {
    const out = [];
    const re = /([^{}@]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        out.push({ selector: m[1].trim().replace(/\s+/g, ' '), decls: m[2] });
    }
    return out;
}

/* Kotwice ciemnego tla — bialy tekst na nich czytelny w obu motywach. */
const DARK_BG = new RegExp(
    [
        'slate-950',
        'slate-800',
        'var\\(--black\\)',
        'var\\(--accent\\)',
        'var\\(--accent-strong\\)',
        'var\\(--success-strong\\)',
        'scrollbar-thumb-hover',
        'brand-navy',
        'linear-gradient',
        'color-mix'
    ].join('|')
);
/* Wlasciwosc color: scisle (bez border-color/outline-color). */
const WHITE_TEXT = /(?:^|[;{])\s*color\s*:\s*(var\(--white\)|rgba\(var\(--white-rgb\))/m;
/* Tekst dziedziczacy ciemne tlo rodzica (regula rodzica ma kotwice). */
const SAFE_PARENT = [/recalc-tile/, /zak-tile/];
/* Kolor ustawiany inline w runtime z audytowanej mapy (gate: test typeBadge). */
const RUNTIME_COLOR = [/cfg-type-badge/];

function classTokens(selector) {
    const toks = [];
    const re = /\.([a-zA-Z][\w-]*)/g;
    let m;
    while ((m = re.exec(selector)) !== null) toks.push(m[1]);
    return toks;
}

/* Vivid baza jako tekst na powierzchniach nie przechodzi AA na dark
   (accent 3.97, accent2 ~3.0, purple 4.48, slate-500 3.73) — dozwolone
   wylacznie warianty -text/-hover (tokeny adaptacyjne w light). */
const VIVID_TEXT = /(?<![-\w])color\s*:\s*var\(--(accent|accent2|purple|slate-500)\)/;
/* Display 8xl black = large text (3.97 >= 3:1 PASS), swiadoma decyzja P3. */
const VIVID_CSS_ALLOW = [/\.index-logo/, /\.summary-card \.label/, /\.print-footer/];
/* Budowniczowie dokumentow drukuja na papierze (slate-500 na bieli 4.76 PASS). */
const VIVID_JS_ALLOW_FILE = [/offerExports/, /printManager/, /Print/, /export/i];
const JS_SCAN_DIRS = [
    'public/js/admin',
    'public/js/rury',
    'public/js/shared',
    'public/js/spa',
    'public/js/studnie',
    'public/js/kartoteka',
    'public/js/import-export'
];

function listJsFiles() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = dir + '/' + e.name;
            if (e.isDirectory()) walk(rel);
            else if (e.name.endsWith('.js')) out.push(rel);
        }
    };
    JS_SCAN_DIRS.forEach((d) => {
        if (fs.existsSync(path.join(ROOT, d))) walk(d);
    });
    return out.filter((f) => !VIVID_JS_ALLOW_FILE.some((re) => re.test(f)));
}

function listHtmlFiles() {
    const out = [];
    const walk = (dir) => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = dir + '/' + e.name;
            if (e.isDirectory()) {
                if (e.name === 'templates') continue;
                walk(rel);
            } else if (e.name.endsWith('.html')) out.push(rel);
        }
    };
    walk('public');
    return out.filter((f) => !f.includes('/templates/'));
}

describe('themeTextContrast: bialy tekst w Studniach', () => {
    test('kazdy selektor z bialym tekstem ma ciemne tlo albo latke light', () => {
        const cssByFile = CSS_FILES.map((f) => ({ file: f, css: readRel(f) }));
        const lightCss = cssByFile.map((e) => e.css).join('\n');
        const violations = [];
        for (const { file, css } of cssByFile) {
            for (const rule of parseRules(css)) {
                if (!WHITE_TEXT.test(rule.decls)) continue;
                if (DARK_BG.test(rule.decls)) continue; // kotwica w tej samej regule
                if (SAFE_PARENT.some((re) => re.test(rule.selector))) continue; // ciemny rodzic
                if (RUNTIME_COLOR.some((re) => re.test(rule.selector))) continue; // kolor z JS
                const toks = classTokens(rule.selector);
                const patched = toks.some((t) =>
                    lightCss.includes(`html[data-theme='light']`)
                        ? new RegExp(`html\\[data-theme='light'\\][^{]*\\.${t}\\b`).test(lightCss)
                        : false
                );
                if (!patched) violations.push(`${file} :: ${rule.selector}`);
            }
        }
        expect(violations).toEqual([]);
    });

    test('style inline w partialach bez bieli/slate-200/300/400 jako tekstu', () => {
        const bad = /color\s*:\s*var\(--(white|slate-200|slate-300|slate-400)\)/;
        const violations = [];
        for (const f of HTML_FILES) {
            const src = readRel(f);
            src.split('\n').forEach((line, i) => {
                if (bad.test(line)) violations.push(`${f}:${i + 1} :: ${line.trim()}`);
            });
        }
        expect(violations).toEqual([]);
    });

    test('klasy z class="" w HTML studni istnieja w CSS', () => {
        let css = CSS_FILES.map(readRel).join('\n');
        HTML_FILES.forEach((f) => {
            const src = readRel(f);
            const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
            let s;
            while ((s = styleRe.exec(src)) !== null) css += '\n' + s[1];
        });
        const defined = new Set();
        const re = /\.([a-zA-Z][\w-]*)/g;
        let m;
        while ((m = re.exec(css)) !== null) defined.add(m[1]);
        const violations = [];
        for (const f of HTML_FILES) {
            const src = readRel(f);
            const r = /class="([^"]+)"/g;
            let x;
            while ((x = r.exec(src)) !== null) {
                x[1]
                    .split(/\s+/)
                    .filter(Boolean)
                    .forEach((c) => {
                        if (c === 'active') return;
                        if (CLASS_HOOKS.has(c) || FOREIGN_PREFIX.test(c)) return;
                        if (!defined.has(c)) violations.push(`${f} :: .${c}`);
                    });
            }
        }
        expect(violations).toEqual([]);
    });

    test('zakaz vivid-tekstu: accent/accent2/purple/slate-500 jako color', () => {
        const violations = [];
        const declRe = /(?<![-\w])color\s*:\s*var\(--(accent|accent2|purple|slate-500)\)/;
        for (const f of CSS_FILES) {
            for (const rule of parseRules(readRel(f))) {
                // Selektor z nazwa tokenu (np. .text-accent) nie jest naruszeniem,
                // tylko deklaracja wlasciwosci color:.
                const declMatch = rule.decls.match(declRe);
                if (!declMatch) continue;
                if (VIVID_CSS_ALLOW.some((re) => re.test(rule.selector))) continue;
                violations.push(`${f} :: ${rule.selector} -> ${declMatch[1]}`);
            }
        }
        for (const f of [...listHtmlFiles(), ...listJsFiles()]) {
            const src = readRel(f);
            src.split('\n').forEach((line, i) => {
                const dm = line.match(declRe);
                if (dm) violations.push(`${f}:${i + 1} -> ${dm[1]}`);
            });
        }
        expect(violations).toEqual([]);
    });

    test('ciemne option maja odpowiednik light (natywne listy rozwijane)', () => {
        // Kotwice ciemnego tla w regulach `option` (popup selecta je dziedziczy).
        const darkBg =
            /background(-color)?\s*:\s*[^;]*(slate-800|slate-700|var\(--black\)|#0f172a|#1e293b|#334155)/;
        const lightCss = CSS_FILES.map(readRel).join('\n');
        const violations = [];
        for (const f of CSS_FILES) {
            for (const rule of parseRules(readRel(f))) {
                if (!/\boption\b/.test(rule.selector)) continue;
                if (/html\[data-theme='light'\]/.test(rule.selector)) continue;
                if (!darkBg.test(rule.decls)) continue;
                // odpowiednik: latka light z `option` i ta sama klasa/id
                const toks = classTokens(rule.selector);
                const idMatch = rule.selector.match(/#([\w-]+)/);
                const key = idMatch
                    ? `#${idMatch[1]}`
                    : toks.length > 0
                      ? `.${toks[toks.length - 1]}`
                      : 'option';
                const patched = new RegExp(
                    `html\\[data-theme='light'\\][^{]*${key.replace(/[#.]/g, '\\$&')}[^{]*option`
                ).test(lightCss);
                if (!patched) violations.push(`${f} :: ${rule.selector}`);
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('themeTextContrast: badze typu konfiguracji (S10)', () => {
    /* Mapa typeBadge w actionsConfigRender.js ustawia bg inline z JS, wiec CSS
       nie moze zagwarantowac kontrastu — kazdy wpis musi miec sparowany fg
       z kontrastem AA >= 4.5 w obu motywach (tla cmp i slate sa SHARED). */
    function luminance(hex) {
        const c = hex
            .replace('#', '')
            .match(/../g)
            .map((h) => {
                const v = parseInt(h, 16) / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function ratio(a, b) {
        const x = luminance(a);
        const y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    test('kazdy wpis typeBadge ma fg z kontrastem >= 4.5', () => {
        const base = readRel('public/css/style.base.css');
        const tokens = {};
        const tre = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g;
        let tm;
        while ((tm = tre.exec(base)) !== null) tokens[tm[1]] = tm[2];
        const src = readRel('public/js/studnie/actionsConfigRender.js');
        const mapM = src.match(/const typeBadge\s*=\s*\{([\s\S]*?)\n {4}\};/);
        expect(mapM).not.toBeNull();
        const entries = {};
        const ere = /(\w+)\s*:\s*\{\s*bg\s*:\s*'([^']+)'(?:\s*,\s*fg\s*:\s*'([^']+)')?/g;
        let em;
        while ((em = ere.exec(mapM[1])) !== null) entries[em[1]] = { bg: em[2], fg: em[3] };
        expect(Object.keys(entries).length).toBeGreaterThan(10);
        const violations = [];
        for (const [key, e] of Object.entries(entries)) {
            if (!e.fg) {
                violations.push(`${key}: brak fg`);
                continue;
            }
            const bgTok = e.bg.match(/var\((--[\w-]+)\)/);
            const fgTok = e.fg.match(/var\((--[\w-]+)\)/);
            if (!bgTok || !tokens[bgTok[1]] || !fgTok || !tokens[fgTok[1]]) {
                violations.push(`${key}: nierozwiazany token ${e.bg} / ${e.fg}`);
                continue;
            }
            const r = ratio(tokens[bgTok[1]], tokens[fgTok[1]]);
            if (r < 4.5) violations.push(`${key}: kontrast ${r.toFixed(2)} < 4.5`);
        }
        expect(violations).toEqual([]);
    });
});

describe('themeTextContrast: blokada palety (mierzone pary AA)', () => {
    /* Pary tekst/tlo zmierzone w audycie palety 2026-09-24. Kazda zmiana
       tokenu lamiacego prog wywali ten test ZANIM uzytkownik zobaczy blad. */
    function block(css, theme) {
        if (theme === 'dark') {
            const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
            return m ? m[1] : '';
        }
        const re = /html\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/g;
        let out = '';
        let m;
        while ((m = re.exec(css)) !== null) out += '\n' + m[1];
        return out;
    }
    function tokensOf(blockSrc) {
        const t = {};
        const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
        let m;
        while ((m = re.exec(blockSrc)) !== null) t[m[1]] = m[2].trim();
        return t;
    }
    function lum(hex) {
        const c = hex
            .replace('#', '')
            .match(/../g)
            .map((h) => {
                const v = parseInt(h, 16) / 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    // [fg-token, bg-token, motyw, min-ratio]
    const PAIRS = [
        ['--white', '--accent', 'dark', 4.5],
        ['--white', '--accent', 'light', 4.5],
        ['--white', '--accent-strong', 'dark', 4.5],
        ['--white', '--scrollbar-thumb-hover', 'dark', 4.5],
        ['--accent-text', '--bg-secondary', 'dark', 4.5],
        ['--accent-text', '--bg-secondary', 'light', 4.5],
        ['--accent2-hover', '--bg-secondary', 'dark', 4.5],
        ['--accent2-hover', '--bg-secondary', 'light', 4.5],
        ['--text-primary', '--bg-primary', 'dark', 4.5],
        ['--text-primary', '--bg-secondary', 'dark', 4.5],
        ['--text-primary', '--bg-tile', 'dark', 4.5],
        ['--text-primary', '--bg-secondary', 'light', 4.5],
        ['--text-secondary', '--bg-secondary', 'dark', 4.5],
        ['--text-secondary', '--bg-secondary', 'light', 4.5],
        ['--text-muted', '--bg-input', 'dark', 4.5],
        ['--text-muted', '--bg-secondary', 'light', 4.5],
        ['--white', '--success', 'light', 4.5],
        ['--white', '--danger', 'light', 4.5],
        ['--white', '--warn', 'light', 4.5]
    ];
    test('wszystkie pary palety spelniaja prog', () => {
        const css = readRel('public/css/style.base.css');
        const dark = tokensOf(block(css, 'dark'));
        const light = tokensOf(block(css, 'light'));
        const resolve = (tok, theme, depth) => {
            if (depth > 5) throw new Error('cykl tokenow: ' + tok);
            // SHARED: brak nadpisania w light = wartosc z dark.
            const val = (theme === 'dark' ? dark : light)[tok] ?? dark[tok];
            if (!val) throw new Error(`brak tokenu ${tok} (${theme})`);
            const inner = val.match(/^var\((--[\w-]+)\)$/);
            return inner ? resolve(inner[1], theme, depth + 1) : val;
        };
        const violations = [];
        for (const [fg, bg, theme, min] of PAIRS) {
            const a = resolve(fg, theme, 0);
            const b = resolve(bg, theme, 0);
            if (!/^#[0-9a-fA-F]{6}$/.test(a) || !/^#[0-9a-fA-F]{6}$/.test(b)) {
                violations.push(`${fg}/${bg} ${theme}: nierozwiazane ${a} / ${b}`);
                continue;
            }
            const x = lum(a);
            const y = lum(b);
            const r = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
            if (r < min) violations.push(`${fg}/${bg} ${theme}: ${r.toFixed(2)} < ${min}`);
        }
        expect(violations).toEqual([]);
    });
});
