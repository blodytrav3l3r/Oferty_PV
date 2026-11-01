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

    test('768px rozciąga zakładki statusu (pasek filtrów zawija)', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zlecenia-filter-tab[\s\S]*?flex\s*:\s*1 1 auto/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('pasek filtrów zleceń używa układu kartoteki', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        expect(html).toContain('class="kartoteka-filter-bar zlecenia-filter-bar"');
        expect(html).toContain('class="ka-search-row"');
        expect(html).toContain('ka-filter-row ka-filter-row--secondary');
        expect(html).not.toContain('zlecenia-virtual-toolbar');
    });

    test('zlecenia.html ma .zlecenia-page', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        expect(html).toContain('class="zlecenia-page"');
    });
});
