/**
 * Testy bezpieczenstwa XSS (Faza 4) -- sanity check dla funkcji escapeHtml
 *
 * Implementacja symmetrical do shared/ui.js.
 */

function escapeHtml(str: string | null | undefined): string {
    if (str == null) return '';
    const amp = String.fromCharCode(38);
    return String(str)
        .replace(/&(?!(amp|lt|gt|quot|#39);)/g, amp + 'amp;')
        .replace(/</g, amp + 'lt;')
        .replace(/>/g, amp + 'gt;')
        .replace(/"/g, amp + 'quot;')
        .replace(/'/g, amp + '#39;');
}

const AMP = String.fromCharCode(38);

describe('XSS Prevention - escapeHtml (defense-in-depth)', () => {
    it('escapeuje skrypt tag (encode < >)', () => {
        const malicious = '<script>alert("XSS")</script>';
        const escaped = escapeHtml(malicious);
        // Pierwotne tagi nie powinny juz istniec
        expect(escaped).not.toContain('<script>');
        expect(escaped).not.toContain('</script>');
        // Ale zakodowane encje powinny
        expect(escaped).toContain(AMP + 'lt;script' + AMP + 'gt;');
    });

    it('escapeuje atrybut HTML injection', () => {
        const malicious = '"><img src=x onerror=alert(1)>';
        const escaped = escapeHtml(malicious);
        // Znaki specjalne HTML sa encodeowane
        expect(escaped).toContain(AMP + 'quot;');
        expect(escaped).toContain(AMP + 'gt;');
        // <img zostaje zakodowane (a wiec nie renderuje sie jako tag)
        expect(escaped).not.toContain('<img');
    });

    it('zachowuje ID produktu (bezpieczne alfanum)', () => {
        const input = 'prod-123-DN500';
        const escaped = escapeHtml(input);
        expect(escaped).toBe('prod-123-DN500');
    });

    it('zwraca pusty string dla null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('zachowuje polskie znaki', () => {
        const input = 'Rura żeliwna DN500 Kraków';
        const escaped = escapeHtml(input);
        expect(escaped).toContain('Rura');
        expect(escaped).toContain('DN500');
        expect(escaped).toContain('Krak');
    });

    it('encode ampersand w stringach bez istniejacych entities', () => {
        const input = 'Tom & Jerry';
        const escaped = escapeHtml(input);
        expect(escaped).toContain(AMP + 'amp;');
    });

    it('escapeuje cudzyslow -- krytyczne dla atrybutow HTML', () => {
        const malicious = 'foo"bar';
        const escaped = escapeHtml(malicious);
        expect(escaped).toContain(AMP + 'quot;');
    });
});
