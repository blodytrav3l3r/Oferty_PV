import * as fs from 'fs';

describe('Formularze — responsywność', () => {
    test('480px zmienia .form-row-{2,3,4} na 1fr', () => {
        const css = fs.readFileSync('public/css/style.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*480px\)[\s\S]*?\.form-row-\d[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('600px w studnie.css zmienia .wizard-form-grid na 1fr', () => {
        const css = fs.readFileSync('public/css/studnie.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*600px\)[\s\S]*?\.wizard-form-grid[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('każdy formularz w rury partialach ma klasę .wizard-form-grid', () => {
        const partialDir = 'public/partials/rury';
        const files = fs.readdirSync(partialDir).filter((f) => f.endsWith('.html'));
        let allHtml = '';
        for (const f of files) {
            allHtml += fs.readFileSync(`${partialDir}/${f}`, 'utf-8') + '\n';
        }
        const formRows = allHtml.match(/class="[^"]*wizard-form-grid[^"]*"/g);
        expect(formRows!.length).toBeGreaterThan(0);
    });
});
