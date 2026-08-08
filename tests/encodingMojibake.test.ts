const {
    detectMojibake,
    fixMojibake,
    classifyMojibake,
    isPolishConventionFile
} = require('../scripts/encoding-integrity.js');

describe('encoding-integrity mojibake detection', () => {
    it('wykrywa podwojnie zakodowane polskie znaki (mojibake)', () => {
        const text =
            'Email e-faktura (TU DOPISYWA\u00c4\u2020) oraz \u00c4\u2122 \u00c4\u2026 \u0102\u0142 \u0139\u201a \u00e2\u20ac\u201d';
        const matches: Array<{ fixed: string }> = detectMojibake(text);
        expect(matches.length).toBe(6);
        expect(matches.map((m) => m.fixed)).toEqual(['Ć', 'ę', 'ą', 'ó', 'ł', '—']);
    });

    it('nie wykrywa poprawnych polskich znakow ani obcych liter', () => {
        expect(detectMojibake('Zażółć gęślą jaźń — test ą Ć')).toHaveLength(0);
        expect(detectMojibake('Änderung (niemiecki umlaut) — nie jest mojibake')).toHaveLength(0);
    });

    it('naprawia mojibake deterministycznie', () => {
        const fixed = fixMojibake('(TU DOPISYWA\u00c4\u2020)');
        expect(fixed).toBe('(TU DOPISYWAĆ)');
        expect(fixMojibake('b\u0139\u201a\u00c4\u2122dy w pliku \u00e2\u20ac\u201d test')).toBe(
            'błędy w pliku — test'
        );
    });

    it('klasyfikuje mojibake w pliku konwencji jako ERROR', () => {
        const rel = 'public/partials/studnie/step4-build-card.html';
        expect(classifyMojibake(1, false, isPolishConventionFile(rel))).toBe('ERROR');
        expect(classifyMojibake(1, false, false)).toBe('WARN');
        expect(classifyMojibake(2, false, false)).toBe('ERROR');
        expect(classifyMojibake(0, false, false)).toBe('OK');
    });
});
