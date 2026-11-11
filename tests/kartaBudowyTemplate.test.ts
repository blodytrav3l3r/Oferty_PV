import fs from 'fs';
import path from 'path';

describe('public/templates/kartaBudowy.html — brak naglowka i stopki', () => {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'kartaBudowy.html');
    let html: string;

    beforeAll(() => {
        html = fs.readFileSync(templatePath, 'utf-8');
    });

    it('template istnieje i ma zawartosc', () => {
        expect(html.length).toBeGreaterThan(0);
    });

    it('NIE zawiera <thead class="report-header"> (page header)', () => {
        expect(html).not.toMatch(/<thead[^>]*class=["'][^"']*report-header/i);
    });

    it('NIE zawiera <tfoot class="report-footer"> (page footer)', () => {
        expect(html).not.toMatch(/<tfoot[^>]*class=["'][^"']*report-footer/i);
    });

    it('NIE zawiera referencji do letterhead-header.png', () => {
        expect(html).not.toMatch(/letterhead-header\.png/);
    });

    it('NIE zawiera referencji do letterhead-footer.png', () => {
        expect(html).not.toMatch(/letterhead-footer\.png/);
    });

    it('NIE zawiera klas CSS .letterhead-header, .letterhead-footer, .header-title', () => {
        expect(html).not.toMatch(/\.letterhead-header\b/);
        expect(html).not.toMatch(/\.letterhead-footer\b/);
        expect(html).not.toMatch(/\.header-title\b/);
    });

    it('ZAWIERA blok tytulu KARTA BUDOWY w tresci dokumentu', () => {
        expect(html).toMatch(/<div class="karta-title"/);
        expect(html).toMatch(/KARTA BUDOWY/);
    });

    it('ZAWIERA numer zamowienia {{NR_ZAMOWIENIA}} w bloku tytulu', () => {
        expect(html).toMatch(/Nr zamówienia: \{\{NR_ZAMOWIENIA\}\}/);
    });

    it('NIE zawiera .info-row z klasa full-width (alignment bug fix)', () => {
        expect(html).not.toMatch(/<div class="info-row full-width"/);
    });

    it('NIE zawiera inline width: 22% / 78% w info-label / info-value (alignment bug fix)', () => {
        expect(html).not.toMatch(/<div class="info-label" style="width: 22%;"/);
        expect(html).not.toMatch(/<div class="info-value" style="width: 78%;"/);
    });

    it('wiersz "Przejścia zamówione w" uzywa domyslnego layoutu (info-label + info-value bez inline width)', () => {
        const labelIndex = html.indexOf('Przejścia zamówione w:');
        expect(labelIndex).toBeGreaterThanOrEqual(0);
        const rowStart = html.lastIndexOf('<div class="info-row">', labelIndex);
        const row = html.slice(rowStart, labelIndex + 300);
        expect(row).toMatch(/<div class="info-label">/);
        expect(row).toMatch(/<div class="info-value">/);
        expect(row).not.toMatch(/style="width:/);
        expect(row).not.toMatch(/full-width/);
    });

    describe('pary pol w jednej linii (.info-row--multi)', () => {
        /** Wycina HTML wiersza zawierajacego podany label. */
        const rowWith = (label: string): string => {
            const labelIndex = html.indexOf(`>${label}<`);
            expect(labelIndex).toBeGreaterThanOrEqual(0);
            const rowStart = html.lastIndexOf('<div class="info-row info-row--multi">', labelIndex);
            expect(rowStart).toBeGreaterThanOrEqual(0);
            const rowEnd = html.indexOf('</div>', labelIndex);
            return html.slice(rowStart, rowEnd);
        };

        it('Kod pocztowy + Miejscowość + Ulica i numer w jednym wierszu', () => {
            const row = rowWith('Kod pocztowy:');
            expect(row).toContain('Kod pocztowy:');
            expect(row).toContain('Miejscowość:');
            expect(row).toContain('Ulica i numer:');
            expect(row.match(/class="info-pair"/g)).toHaveLength(3);
        });

        it('Kod kontrahenta obok Firma, a NIP i Adres firmy w kolejnych wierszach', () => {
            const row = rowWith('Kod kontrahenta:');
            expect(row).toContain('Firma:');
            for (const label of ['NIP:', 'Adres firmy:']) {
                const labelIndex = html.indexOf(`>${label}<`);
                expect(labelIndex).toBeGreaterThanOrEqual(0);
                const rowStart = html.lastIndexOf('<div class="info-row', labelIndex);
                expect(html.slice(rowStart, rowStart + 30)).toContain('<div class="info-row">');
            }
        });

        it('Nr powiązanej oferty obok Data zamówienia', () => {
            const row = rowWith('Nr powiązanej oferty:');
            expect(row).toContain('Data zamówienia:');
        });

        it('Warunki płatności obok Ilość dni, a Rodzaj transportu obok Koszt transportu', () => {
            expect(rowWith('Warunki płatności:')).toContain('Ilość dni:');
            expect(rowWith('Rodzaj transportu:')).toContain('Koszt transportu:');
        });

        it('CSS definiuje .info-row--multi i .info-pair', () => {
            expect(html).toMatch(/\.info-row--multi\s*\{/);
            expect(html).toMatch(/\.info-row--multi \.info-pair\s*\{/);
        });
    });
});
