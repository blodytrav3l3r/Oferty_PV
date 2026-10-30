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
        expect(shared).toContain('zmiany w edytorze nie ruszają ofert do publikacji');
    });

    it('A5: baner „siatka pokazuje szkic" tylko w trybie edycji', () => {
        expect(shared).toContain('pv-draft-banner');
        expect(shared).toContain('Siatka pokazuje szkic');
        expect(shared).toContain('oferty liczą z obowiązującej');
        expect(shared).toMatch(/if \(data\.draft && editingGrid\) \{/);
        // Podgląd w ofercie mówi, że siatka pokazuje cennik obowiązujący.
        expect(shared).toContain('Podgląd cennika oferty');
        expect(utilities).toContain('.pv-draft-banner');
    });

    it('tryb edycji: banner z osią + obrys siatki (widoczny stan edycji)', () => {
        expect(shared).toContain('pv-edit-banner');
        expect(shared).toContain('TRYB EDYCJI');
        expect(shared).toContain('data-editing');
        expect(shared).toContain('data-pv-editing');
        expect(utilities).toContain('.pv-edit-banner');
        expect(utilities).toContain("[data-pv-editing='1']");
    });

    it('tryb zapisu LIVE jest widoczny w pasku (rollback = split-brain)', () => {
        expect(shared).toContain('Tryb zapisu LIVE');
        expect(shared).toContain("window.__pricelistWriteTarget === 'live'");
    });

    it('edytory wołają pasek po załadowaniu cennika', () => {
        expect(ruryNav).toContain("renderStatusStrip('pricelist-status-strip', 'rury')");
        expect(studnieGlobals).toContain("renderStatusStrip('pricelist-status-strip', 'studnie')");
        // Zakładka PRECO to osobna oś — pasek pokazuje status osi PRECO.
        expect(studnieState).toContain("tab === 'preco' ? 'preco' : 'studnie'");
    });

    it('pasek nie wstrzykuje inline onclick (CSP-E)', () => {
        expect(shared).not.toContain('onclick=');
    });
});
