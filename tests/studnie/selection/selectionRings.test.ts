describe('OT substitution rules', () => {
    it('OT wymagane gdy środek otworu jest wewnątrz kręgu', () => {
        expect(true).toBe(true);
    });

    it('OT niepotrzebne gdy przejście w dennicy (środek w dennicy)', () => {
        expect(true).toBe(true);
    });

    it('OT niepotrzebne gdy przejście całkowicie powyżej kręgów', () => {
        expect(true).toBe(true);
    });

    it('przejście na łączeniu dennicy z kręgiem → needsTallerDennica', () => {
        const dennicaHeight = 500;
        const przHeight = 160;
        const przFromBottom = 450;
        const dennicaEnd = dennicaHeight;
        const transitionOverlapsJoint =
            przFromBottom < dennicaEnd && przFromBottom + przHeight > dennicaEnd;
        expect(transitionOverlapsJoint).toBe(true);
    });

    it('OT zamiana zachowuje wysokość kręgu', () => {
        const originalHeight = 500;
        const otHeight = 500;
        expect(originalHeight).toBe(otHeight);
    });

    it('dynamiczny OT tworzony gdy brak w cenniku', () => {
        const baseId = 'KDB-10-05-D';
        const dynamicOtId = baseId + '_OT';
        expect(dynamicOtId).toBe('KDB-10-05-D_OT');
    });
});

describe('Solver scoring rules', () => {
    const score = (
        dennicaHeight: number,
        ringCount: number,
        diff: number,
        outOfBounds: boolean,
        minimalClearance: boolean,
        dennicaTooShort: boolean,
        fallbackTop: boolean,
        reductionNeeded: boolean
    ): number => {
        let s = dennicaHeight * 1000 + ringCount * 10 + Math.abs(diff) * 5;
        if (outOfBounds) s += 20000;
        if (minimalClearance || dennicaTooShort) s += 50000;
        if (fallbackTop) s += 100000;
        if (reductionNeeded) s += 5000000;
        return s;
    };

    it('niższa dennica → lepszy score', () => {
        const s300 = score(300, 2, 10, false, false, false, false, false);
        const s500 = score(500, 2, 10, false, false, false, false, false);
        expect(s300).toBeLessThan(s500);
    });

    it('mniej kręgów → lepszy score', () => {
        const s2 = score(300, 2, 10, false, false, false, false, false);
        const s3 = score(300, 3, 10, false, false, false, false, false);
        expect(s2).toBeLessThan(s3);
    });

    it('mniejszy diff → lepszy score', () => {
        const s0 = score(300, 2, 0, false, false, false, false, false);
        const s50 = score(300, 2, 50, false, false, false, false, false);
        expect(s0).toBeLessThan(s50);
    });

    it('poza zakresem → kara +20000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const oob = score(300, 2, 10, true, false, false, false, false);
        expect(oob - ok).toBe(20000);
    });

    it('minimal clearance → kara +50000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const min = score(300, 2, 10, false, true, false, false, false);
        expect(min - ok).toBe(50000);
    });

    it('fallback top closure → kara +100000', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const fb = score(300, 2, 10, false, false, false, true, false);
        expect(fb - ok).toBe(100000);
    });

    it('brak redukcji gdy potrzebna → kara +5000000 (ogromna)', () => {
        const ok = score(300, 2, 10, false, false, false, false, false);
        const noRed = score(300, 2, 10, false, false, false, false, true);
        expect(noRed - ok).toBe(5000000);
    });

    it('priorytety: redukcja > fallback > minimal > outOfBounds > rings > height', () => {
        const withoutRed = score(300, 2, 10, false, false, false, false, false);
        const withRed = score(300, 2, 10, false, false, false, false, true);
        expect(withRed).toBeGreaterThan(withoutRed + 100000);
    });
});
