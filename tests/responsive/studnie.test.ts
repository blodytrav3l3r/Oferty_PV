import * as fs from 'fs';

describe('Kreator studni — responsywność', () => {
    test('768px ukrywa .wizard-dot-label', () => {
        const css = fs.readFileSync('public/css/studnie.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?\.wizard-dot-label[\s\S]*?display\s*:\s*none/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('600px zwija gridy kreatora do 1fr', () => {
        const css = fs.readFileSync('public/css/studnie.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*600px\)[\s\S]*?\.wizard-form-grid[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('768px zwija .wizard-nav', () => {
        const css = fs.readFileSync('public/css/studnie.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?\.wizard-nav[\s\S]*?flex-direction\s*:\s*column/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('scalenie configurator.css - unikalne reguly przeniesione do studnie.css', () => {
        const css = fs.readFileSync('public/css/studnie.css', 'utf-8');
        expect(css).toContain('[data-partial] {');
        expect(css).toContain('.config-tile:hover');
        expect(css).toContain('cursor: pointer');
    });

    test('configurator.css nie jest juz ladowany w studnie.html', () => {
        const html = fs.readFileSync('public/studnie.html', 'utf-8');
        expect(html).not.toMatch(/configurator\.css/);
    });
});
