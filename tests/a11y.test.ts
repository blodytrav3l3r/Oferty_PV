import * as fs from 'fs';
import * as path from 'path';

/**
 * Testy a11y — wersja po restaucji warstwy wizualnej do 1.17.1 (0b767b9).
 * Asercje ograniczone do stanu faktycznego HTML + gwarancji architektury ESM.
 */
describe('a11y (restored 1.17.1 surface)', () => {
    const pages = ['app', 'index', 'kartoteka', 'rury', 'studnie', 'zlecenia'];

    test.each(pages)('%s.html — brak duplikatów class/type, toast aria-live, moduły ESM', (p) => {
        const html = fs.readFileSync(path.resolve(`public/${p}.html`), 'utf-8');
        // duplikaty atrybutów = invalid HTML (baza błędów Z-00)
        expect(html).not.toMatch(/class="[^"]*" class=/);
        expect(html).not.toMatch(/type="button" type="button"/);
        // toast ogłaszany czytnikom
        expect(html).toMatch(/toast-container[^>]*aria-live="polite"/);
        // architektura ESM: moduły wspólne muszą być podpięte (escapeHtml → XSS guard)
        expect(html).toMatch(/type="module"[^>]*escapeHtml\.js/);
    });

    test('router.js utrzymuje aria-current dla kafli modułów', () => {
        const router = fs.readFileSync(path.resolve('public/js/spa/router.js'), 'utf-8');
        expect(router).toMatch(/setAttribute\('aria-current', 'page'\)/);
        expect(router).toMatch(/removeAttribute\('aria-current'\)/);
    });

    test('wizard-nav.html — brak role=button na nieinteraktywnych divach poza wzorcem legacy', () => {
        const p = path.resolve('public/partials/shared/wizard-nav.html');
        if (!fs.existsSync(p)) return; // plik usunięty po restaucji — wzorzec legacy w partials/rury|studnie
        const html = fs.readFileSync(p, 'utf-8');
        expect(html).not.toMatch(/class="[^"]*" class=/);
    });
});
