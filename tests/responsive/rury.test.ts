import * as fs from 'fs';

describe('Oferty rur — responsywność', () => {
    test('768px ukrywa kolumny Ilość, Dopłata, Wersja handlowa', () => {
        const css = fs.readFileSync('public/css/style.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?#offer-items-body[\s\S]*?display\s*:\s*none/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('600px ukrywa kolumny Metry, Transport/szt, Brutto', () => {
        const css = fs.readFileSync('public/css/style.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*600px\)[\s\S]*?#offer-items-body[\s\S]*?display\s*:\s*none/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('rury.html ma tabelę z dynamic colgroup (buildRuryColgroup)', () => {
        // Główne body tabel są w partialach po podziale rury.html
        const partialDir = 'public/partials/rury';
        const files = fs.readdirSync(partialDir).filter((f) => f.endsWith('.html'));
        let allHtml = '';
        for (const f of files) {
            allHtml += fs.readFileSync(`${partialDir}/${f}`, 'utf-8') + '\n';
        }
        const hasOfferItemsBody = allHtml.includes('id="offer-items-body"');
        const hasOrderItemsBody = allHtml.includes('id="order-items-body"');
        const hasColgroup = allHtml.includes('id="rury-colgroup"') || /<colgroup/.test(allHtml);
        expect(hasOfferItemsBody).toBe(true);
        expect(hasOrderItemsBody).toBe(true);
        expect(hasColgroup).toBe(true);
    });
});
