/**
 * P1-S — wektory sanityzacji nazwy pliku .sokml (czysta funkcja, bez DB).
 * Wyjście nigdy nie zawiera: " ; / \ CR LF znaków kontrolnych.
 */
import { describe, expect, it } from '@jest/globals';
import { sokmlFilename } from '../../src/services/ml/transfer/transferFilename';

function hasForbiddenChars(s: string): boolean {
    // Bez regexa (no-control-regex): cudzysłów/średnik/separatory + C0/C1 i DEL.
    if (s.includes('"') || s.includes(';') || s.includes('/') || s.includes('\\')) return true;
    for (const ch of s) {
        const c = ch.charCodeAt(0);
        if (c < 32 || c === 127) return true;
    }
    return false;
}

describe('P1-S sokmlFilename', () => {
    it('zwykła wersja bez zmian kształtu', () => {
        expect(sokmlFilename('v1.0-starter')).toBe('sok-ai-ml-v1.0-starter.sokml');
    });

    it.each(['a"; evil="1', 'a;b', 'a/b\\c', 'x\r\ny', 'v\x001', '..\\..\\evil', 'ąęłżźćń', ''])(
        'wektor %j → bezpieczna nazwa',
        (v) => {
            const out = sokmlFilename(v);
            expect(hasForbiddenChars(out)).toBe(false);
            expect(out.startsWith('sok-ai-ml-')).toBe(true);
            expect(out.endsWith('.sokml')).toBe(true);
        }
    );

    it('pusta wersja → fallback model', () => {
        expect(sokmlFilename('')).toBe('sok-ai-ml-model.sokml');
    });

    it('długa wersja przycięta (cap 64)', () => {
        const out = sokmlFilename('v' + 'a'.repeat(200));
        expect(out.length).toBeLessThanOrEqual('sok-ai-ml-'.length + 64 + '.sokml'.length);
        expect(hasForbiddenChars(out)).toBe(false);
    });
});
