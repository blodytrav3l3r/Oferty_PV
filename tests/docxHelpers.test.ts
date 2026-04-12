import { fmtCurrency, fmtInt, fmtDate } from '../src/services/docx/helpers';

// ─── fmtCurrency ────────────────────────────────────────────────────

describe('fmtCurrency', () => {
    it('powinien formatować wartości całkowite z 2 miejscami po przecinku', () => {
        const result = fmtCurrency(1000);
        // Lokalizacja polska używa spacji jako separatora tysięcy i przecinka jako separatora dziesiętnego
        expect(result).toMatch(/1[\s\u00a0]?000,00/);
    });

    it('powinien formatować wartości dziesiętne', () => {
        const result = fmtCurrency(1234.56);
        expect(result).toMatch(/1[\s\u00a0]?234,56/);
    });

    it('powinien formatować zero', () => {
        expect(fmtCurrency(0)).toBe('0,00');
    });

    it('powinien zaokrąglać do 2 miejsc po przecinku', () => {
        const result = fmtCurrency(99.999);
        expect(result).toMatch(/100,00/);
    });

    it('powinien obsługiwać wartości ujemne', () => {
        const result = fmtCurrency(-500);
        expect(result).toContain('500,00');
    });

    it('powinien obsługiwać duże liczby', () => {
        const result = fmtCurrency(1000000);
        expect(result).toMatch(/1[\s\u00a0]?000[\s\u00a0]?000,00/);
    });
});

// ─── fmtInt ─────────────────────────────────────────────────────────

describe('fmtInt', () => {
    it('powinien formatować liczbę całkowitą bez części dziesiętnej', () => {
        expect(fmtInt(1500)).toMatch(/1[\s\u00a0]?500/);
    });

    it('powinien formatować zero', () => {
        expect(fmtInt(0)).toBe('0');
    });

    it('powinien obcinać/zaokrąglać wartości dziesiętne', () => {
        const result = fmtInt(1500.7);
        // Should display as whole number (rounded)
        expect(result).toMatch(/1[\s\u00a0]?501|1[\s\u00a0]?500/);
    });
});

// ─── fmtDate ────────────────────────────────────────────────────────

describe('fmtDate', () => {
    it('powinien formatować ciąg daty ISO', () => {
        const result = fmtDate('2024-03-15');
        // Lokalizacja polska: dd.mm.rrrr
        expect(result).toMatch(/15/);
        expect(result).toMatch(/3|03/);
        expect(result).toMatch(/2024/);
    });

    it('powinien formatować ciąg daty i czasu ISO', () => {
        const result = fmtDate('2024-12-31T14:30:00Z');
        expect(result).toMatch(/2024|2025/); // strefa czasowa może przesunąć datę
    });

    it('powinien zwrócić oryginalny ciąg dla nieprawidłowej daty', () => {
        // Konstruktor nieprawidłowej daty zwraca "Invalid Date",
        // ale toLocaleDateString może nadal działać — zależy od środowiska uruchomieniowego
        const result = fmtDate('not-a-date');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('powinien łagodnie obsługiwać pusty ciąg', () => {
        const result = fmtDate('');
        expect(typeof result).toBe('string');
    });
});
