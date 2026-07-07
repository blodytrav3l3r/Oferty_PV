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
        const match = html.match(
            /<div class="info-row"[^>]*>[\s\S]{0,300}Przejścia zamówione w:[\s\S]{0,300}<\/div><\/div>/
        );
        expect(match).not.toBeNull();
        expect(match![0]).toMatch(/<div class="info-label">/);
        expect(match![0]).toMatch(/<div class="info-value">/);
        expect(match![0]).not.toMatch(/style="width:/);
        expect(match![0]).not.toMatch(/full-width/);
    });
});
