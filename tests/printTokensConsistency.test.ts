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

describe('Spójność tokenów kolorów (3 SSoT)', () => {
    const cssRoot = parseTokens(getRootBlock(read('public/css/style.base.css')));
    const frontend = parseTokens(getPrintTokensBlock(read('public/js/shared/formatters.js')));
    const backend = parseTokens(getPrintTokensBlock(read('src/services/pdf/printTokens.ts')));

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
});
