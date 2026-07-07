import * as fs from 'fs';

describe('Kartoteka Zleceń — responsywność', () => {
    test('768px ukrywa kolumny Element, Wygenerował, Data', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?display\s*:\s*none/);
        expect(mqMatch).not.toBeNull();
    });

    test('600px zmienia zlecenia-stats na 1 kolumnę', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*600px\)[\s\S]*?\.zlecenia-stats[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('768px zmienia zlecenia-header na kolumnę', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zlecenia-header[\s\S]*?flex-direction\s*:\s*column/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('zlecenia.html ma .zlecenia-page', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        expect(html).toContain('class="zlecenia-page"');
    });
});
