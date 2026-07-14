import * as fs from 'fs';

describe('Podsumowania — responsywność', () => {
    test('480px zmienia .summary-grid na 1fr', () => {
        const css = fs.readFileSync('public/css/style.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*480px\)[\s\S]*?\.summary-grid[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('.offer-header-grid jest 2 kolumny', () => {
        const css = fs.readFileSync('public/css/style.css', 'utf-8');
        const grid = css.match(/\.offer-header-grid[\s\S]*?grid-template-columns\s*:\s*1fr\s+1fr/);
        expect(grid).not.toBeNull();
    });
});
