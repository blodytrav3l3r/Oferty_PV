import * as fs from 'fs';
import * as path from 'path';

describe('a11y', () => {
    const htmlFiles = ['public/app.html', 'public/studnie.html', 'public/kartoteka.html'];

    test.each(htmlFiles)('%s ma podstawowe atrybuty a11y', (rel) => {
        const full = path.resolve(rel);
        if (!fs.existsSync(full)) return;
        const html = fs.readFileSync(full, 'utf-8');
        // Sprawdź obecność landmarków i aria
        if (rel.includes('app.html')) {
            expect(html).toMatch(/<nav[^>]*aria-label="Główna"/);
            // aria-current jest dodawane dynamicznie w router.js — sprawdź w JS
            const router = fs.readFileSync(path.resolve('public/js/spa/router.js'), 'utf-8');
            expect(router).toMatch(/aria-current/);
            expect(html).toMatch(/aria-live="polite"/);
        }
        if (rel.includes('studnie.html')) {
            expect(html).toMatch(/aria-live="polite"/);
        }
        // Ogólne: brak duplikatu class
        expect(html).not.toMatch(/class="[^"]*" class=/);
        expect(html).not.toMatch(/type="button" type="button"/);
    });

    test('wizard-nav ma aria-current i role', () => {
        const p = path.resolve('public/partials/shared/wizard-nav.html');
        const html = fs.readFileSync(p, 'utf-8');
        expect(html).toMatch(/role="list"/);
        expect(html).toMatch(/aria-current="step"/);
        expect(html).toMatch(/aria-label="Krok \d z 5/);
    });

    test('modale mają role dialog', () => {
        const p = path.resolve('public/partials/studnie/modals.html');
        const html = fs.readFileSync(p, 'utf-8');
        const matches = html.match(/role="dialog"/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(3);
    });
});
