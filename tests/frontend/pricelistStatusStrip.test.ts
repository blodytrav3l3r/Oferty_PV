/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Pasek stanu cennika w edytorach (rury/studnie): co admin edytuje (szkic)
 * vs co liczy oferta (wersja obowiązująca) + skrót do panelu cenników.
 */

import fs from 'fs';
import path from 'path';

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

const shared = read('public/js/shared/pricelistVersions.js');
const ruryPartial = read('public/partials/rury/pricelist.html');
const studniePartial = read('public/partials/studnie/pricelist.html');
const ruryNav = read('public/js/rury/offerNavigation.js');
const studnieGlobals = read('public/js/studnie/globals.js');
const studnieState = read('public/js/studnie/pricelistState.js');
const utilities = read('public/css/style.utilities.css');

describe('frontend: pasek stanu cennika w edytorze', () => {
    it('kontener paska w obu edytorach', () => {
        expect(ruryPartial).toContain('id="pricelist-status-strip"');
        expect(studniePartial).toContain('id="pricelist-status-strip"');
        expect(utilities).toContain('.pv-status-strip');
    });

    it('helper w namespace pricelistVersions (bez nowego globala)', () => {
        expect(shared).toContain('function renderStatusStrip(');
        expect(shared).toContain('renderStatusStrip: renderStatusStrip');
        expect(shared).toContain('/api/pricelist-versions/summary');
    });

    it('pasek pokazuje szkic, obowiązującą i do wdrożenia', () => {
        expect(shared).toContain('✎ Szkic ');
        expect(shared).toContain('✓ Obowiązuje ');
        expect(shared).toContain('◷ Do wdrożenia ');
        expect(shared).toContain('Zmiany w edytorze nie ruszają ofert do publikacji');
    });

    it('edytory wołają pasek po załadowaniu cennika', () => {
        expect(ruryNav).toContain("renderStatusStrip('pricelist-status-strip', 'rury')");
        expect(studnieGlobals).toContain("renderStatusStrip('pricelist-status-strip', 'studnie')");
        // Zakładka PRECO to osobna oś — pasek pokazuje status osi PRECO.
        expect(studnieState).toContain("tab === 'preco' ? 'preco' : 'studnie'");
    });

    it('skrót do panelu cenników (tylko w SPA, bez cross-origin awarii)', () => {
        expect(shared).toContain('data-pv-strip="panel"');
        expect(shared).toContain("window.parent.location.hash = '#/cenniki'");
        expect(shared).not.toContain('onclick=');
    });
});
