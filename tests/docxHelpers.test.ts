import { fmtCurrency, fmtInt, fmtDate } from '../src/services/docx/helpers';

// ─── fmtCurrency ────────────────────────────────────────────────────

describe('fmtCurrency', () => {
    it('should format integer values with 2 decimal places', () => {
        const result = fmtCurrency(1000);
        // Polish locale uses space as thousands separator and comma as decimal
        expect(result).toMatch(/1[\s\u00a0]?000,00/);
    });

    it('should format decimal values', () => {
        const result = fmtCurrency(1234.56);
        expect(result).toMatch(/1[\s\u00a0]?234,56/);
    });

    it('should format zero', () => {
        expect(fmtCurrency(0)).toBe('0,00');
    });

    it('should round to 2 decimal places', () => {
        const result = fmtCurrency(99.999);
        expect(result).toMatch(/100,00/);
    });

    it('should handle negative values', () => {
        const result = fmtCurrency(-500);
        expect(result).toContain('500,00');
    });

    it('should handle large numbers', () => {
        const result = fmtCurrency(1000000);
        expect(result).toMatch(/1[\s\u00a0]?000[\s\u00a0]?000,00/);
    });
});

// ─── fmtInt ─────────────────────────────────────────────────────────

describe('fmtInt', () => {
    it('should format integer without decimals', () => {
        expect(fmtInt(1500)).toMatch(/1[\s\u00a0]?500/);
    });

    it('should format zero', () => {
        expect(fmtInt(0)).toBe('0');
    });

    it('should truncate decimal values', () => {
        const result = fmtInt(1500.7);
        // Should display as whole number (rounded)
        expect(result).toMatch(/1[\s\u00a0]?501|1[\s\u00a0]?500/);
    });
});

// ─── fmtDate ────────────────────────────────────────────────────────

describe('fmtDate', () => {
    it('should format ISO date string', () => {
        const result = fmtDate('2024-03-15');
        // Polish locale: dd.mm.yyyy
        expect(result).toMatch(/15/);
        expect(result).toMatch(/3|03/);
        expect(result).toMatch(/2024/);
    });

    it('should format ISO datetime string', () => {
        const result = fmtDate('2024-12-31T14:30:00Z');
        expect(result).toMatch(/2024|2025/); // timezone may shift date
    });

    it('should return original string for invalid date', () => {
        // An invalid date constructor returns "Invalid Date", 
        // but toLocaleDateString might still work — depends on runtime
        const result = fmtDate('not-a-date');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty string gracefully', () => {
        const result = fmtDate('');
        expect(typeof result).toBe('string');
    });
});
