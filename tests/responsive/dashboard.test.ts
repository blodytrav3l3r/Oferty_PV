import * as fs from 'fs';

describe('Dashboard — responsywność', () => {
    test('640px zmienia .launch-grid na 1fr', () => {
        const css = fs.readFileSync('public/css/index.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*640px\)[\s\S]*?\.launch-grid[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('640px zmienia .user-hero na column', () => {
        const css = fs.readFileSync('public/css/index.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-hero[\s\S]*?flex-direction\s*:\s*column/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('640px zmienia .form-grid na 1fr 1fr', () => {
        const css = fs.readFileSync('public/css/index.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*640px\)[\s\S]*?\.form-grid[\s\S]*?grid-template-columns\s*:\s*1fr\s+1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('index.html ma viewport meta', () => {
        const html = fs.readFileSync('public/index.html', 'utf-8');
        expect(html).toContain('name="viewport"');
        expect(html).toContain('width=device-width');
    });
});
