import fs from 'fs';
import path from 'path';

/**
 * #/cennik — host istniejących edytorów cenników (bez zmiany hasha SPA).
 * Kontrakt: trasa w routerze + kafelek w app.html + osadzone sekcje „pricelist"
 * z rury.html i studnie.html (studnie/PRECO), nie read-only kopie tabel.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Cennik #/cennik — edycja na istniejących tabelach', () => {
    const html = read('public/cennik.html');
    const router = read('public/js/spa/router.js');
    const app = read('public/app.html');
    const page = read('public/js/cennik/cennik.js');

    it('router i nagłówek SPA znają trasę #/cennik', () => {
        expect(router).toContain("cennik: {\n            src: 'cennik.html'");
        expect(router).toContain("cennik: 'spa-app-cennik'");
        expect(app).toContain('href="#/cennik"');
        expect(app).toContain('id="spa-app-cennik"');
    });

    it('osadza istniejące sekcje cennika zamiast własnych tabel', () => {
        expect(page).toContain("src: 'rury.html?tab=pricelist&host=cennik'");
        expect(page).toContain("src: 'studnie.html?tab=pricelist&host=cennik'");
        expect(page).toContain("win.showSection('pricelist')");
        expect(page).toContain("win.selectCennikTab(type === 'preco' ? 'preco' : 'dn1000')");
        expect(page).toContain('pv.autoOpenVersionsPanel(type)');
        expect(html).not.toContain('cennik-body');
    });

    it('rail jest jedynym lewym paskiem — powłoka nie ma slim-nav', () => {
        expect(html).not.toContain('cennik-sidebar');
        expect(html).not.toContain('cennik-tabs');
        expect(page).not.toContain('setActiveTab');
        expect(page).not.toContain('setRailOpen');
        expect(page).toContain('pv.autoOpenVersionsPanel(type)');
        expect(page).toContain('window.CennikHost = {');
        expect(page).toContain(
            '#wizard-bottom-nav, #studnie-wizard-bottom-nav { display: none !important; }'
        );
    });

    it('strona nie dokłada inline script/handlerów (CSP-A)', () => {
        expect(html).not.toMatch(/<script(?![^>]*src=)/i);
        expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    });
});
