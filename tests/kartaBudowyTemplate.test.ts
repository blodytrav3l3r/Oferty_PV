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
});
