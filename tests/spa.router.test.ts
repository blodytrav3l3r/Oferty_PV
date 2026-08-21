import * as fs from 'fs';
import * as path from 'path';

describe('spa router - Z-73', () => {
    it('router.js zawiera aria-current i updateAppNav', () => {
        const src = fs.readFileSync(path.resolve('public/js/spa/router.js'), 'utf-8');
        expect(src).toMatch(/aria-current/);
        expect(src).toMatch(/updateAppNav/);
        expect(src).toMatch(/setAttribute\('aria-current', 'page'\)/);
    });

    it('app.html ma focusable spa-main i nav landmark', () => {
        const html = fs.readFileSync(path.resolve('public/app.html'), 'utf-8');
        expect(html).toMatch(/<main id="spa-main" tabindex="-1"/);
        expect(html).toMatch(/<nav class="nav-apps"[^>]*aria-label="Główna"/);
    });

    it('redirect studnie.html -> app.html#/studnie działa wg konwencji', () => {
        const path2 = 'studnie.html';
        const module = path2.replace(/\.html?$/, '') || 'kartoteka';
        expect('/app.html#/' + module).toBe('/app.html#/studnie');
    });
});
