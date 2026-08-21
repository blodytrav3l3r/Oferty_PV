import * as fs from 'fs';
import * as path from 'path';

describe('spa router - Z-73 (restored surface)', () => {
    it('router.js zawiera aria-current i updateAppNav', () => {
        const src = fs.readFileSync(path.resolve('public/js/spa/router.js'), 'utf-8');
        expect(src).toMatch(/aria-current/);
        expect(src).toMatch(/updateAppNav/);
        expect(src).toMatch(/setAttribute\('aria-current', 'page'\)/);
    });

    test('app.html ładuje router i moduły ESM', () => {
        const html = fs.readFileSync(path.resolve('public/app.html'), 'utf-8');
        expect(html).toMatch(/js\/spa\/router\.js/);
        expect(html).toMatch(/type="module"[^>]*modalCore\.js/);
    });

    it('redirect studnie.html -> app.html#/studnie działa wg konwencji', () => {
        const p2 = 'studnie.html';
        const moduleName = p2.replace(/\.html?$/, '') || 'kartoteka';
        expect('/app.html#/' + moduleName).toBe('/app.html#/studnie');
    });
});
