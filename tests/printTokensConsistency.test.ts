import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/** Wyciąga pary --nazwa: wartość z bloku :root (CSS lub template-string JS/TS). */
function parseTokens(source: string): Record<string, string> {
    const tokens: Record<string, string> = {};
    const pairRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = pairRegex.exec(source)) !== null) {
        tokens[m[1]] = m[2].trim();
    }
    return tokens;
}

function getRootBlock(cssText: string): string {
    const m = cssText.match(/:root\s*\{[\s\S]*?\}/);
    expect(m).not.toBeNull();
    return m![0];
}

function getPrintTokensBlock(source: string): string {
    const m = source.match(/PRINT_TOKENS_CSS\s*=\s*`([^`]+)`/);
    expect(m).not.toBeNull();
    return m![1];
}

/** Wyciąga pary klucz: 'HEX' z obiektu DOCX_COLORS (wartości bez prefiksu #). */
function parseDocxColors(source: string): Record<string, string> {
    const colors: Record<string, string> = {};
    const pairRegex = /([a-zA-Z][\w]*)\s*:\s*'([0-9A-Fa-f]{6})'/g;
    let m: RegExpExecArray | null;
    while ((m = pairRegex.exec(source)) !== null) {
        colors[m[1]] = m[2].toUpperCase();
    }
    return colors;
}

/** Mapowanie kluczy DOCX_COLORS na tokeny :root, które mają wspólną wartość. */
const DOCX_TO_TOKEN: Record<string, string> = {
    success: '--success',
    successHover: '--success-hover',
    danger: '--danger',
    dangerHover: '--danger-hover',
    warn: '--warn',
    warnHover: '--warn-hover',
    accent: '--accent',
    accentHover: '--accent-hover',
    accent2: '--accent2',
    brandRed: '--danger-strong',
    whiteText: '--white',
    titleText: '--black',
    pageBg: '--white'
};

/** Klucze DOCX_COLORS bez odpowiednika w :root — celowo niezależna paleta dokumentów Word.
 *  Wartości legacy (neutralne szarości, kolory strukturalne) nie mają odpowiednika w UI,
 *  dlatego są jawnie wyłączone z synchronizacji z :root. */
const DOCX_LEGACY_ALLOWED: Record<string, string> = {
    bodyText: '1A1A2E',
    labelText: '333333',
    mutedText: '888888',
    linkUnderline: '0000FF',
    headerBg: 'F0F0F0',
    headerText: '999999',
    summaryBg: 'F0F0F0',
    rowAlt: 'FAFAFA',
    infoBg: 'F9F9F9',
    noteBg: 'FFFBE6',
    noteBorder: 'F5A623',
    tableBorder: 'CCCCCC',
    lightBorder: 'DDDDDD',
    innerBorder: 'E0E0E0',
    cardBg: 'F9F9F9',
    tableHeaderBg: 'F0F0F0'
};

describe('Spójność tokenów kolorów (4 SSoT)', () => {
    const cssRoot = parseTokens(getRootBlock(read('public/css/style.base.css')));
    const frontend = parseTokens(getPrintTokensBlock(read('public/js/shared/formatters.js')));
    const backend = parseTokens(getPrintTokensBlock(read('src/services/pdf/printTokens.ts')));
    const docx = parseDocxColors(read('src/services/docx/colors.ts'));

    it('frontend i backend PRINT_TOKENS_CSS identyczne', () => {
        expect(frontend).toEqual(backend);
    });

    it('dokładnie 16 tokenów w PRINT_TOKENS_CSS', () => {
        expect(Object.keys(frontend)).toHaveLength(16);
    });

    it('każdy token z PRINT_TOKENS ma identyczną wartość w style.base.css :root', () => {
        for (const [name, value] of Object.entries(frontend)) {
            expect(cssRoot[name]).toBe(value);
        }
    });

    it('DOCX_COLORS (semantyczne klucze) ma wartości zgodne z :root', () => {
        for (const [docxKey, cssToken] of Object.entries(DOCX_TO_TOKEN)) {
            const docxVal = docx[docxKey];
            const cssVal = cssRoot[cssToken]?.replace('#', '').toUpperCase();
            if (docxVal !== cssVal) {
                throw new Error(
                    `Niespójność DOCX_COLORS.${docxKey} (${docxVal}) vs :root ${cssToken} (${cssVal})`
                );
            }
        }
        expect(true).toBe(true);
    });

    it('każdy klucz DOCX_COLORS jest zmapowany na :root LUB jawnie w allowliście legacy', () => {
        const keys = Object.keys(docx);
        const covered = new Set([
            ...Object.keys(DOCX_TO_TOKEN),
            ...Object.keys(DOCX_LEGACY_ALLOWED)
        ]);
        const missing = keys.filter((k) => !covered.has(k));
        if (missing.length > 0) {
            throw new Error(
                `DOCX_COLORS ma niepokryte klucze: ${missing.join(', ')}. Dodaj do DOCX_TO_TOKEN (jeśli ma odpowiednik w :root) lub DOCX_LEGACY_ALLOWED (jeśli to celowa paleta dokumentu Word).`
            );
        }
        expect(true).toBe(true);
    });
});
