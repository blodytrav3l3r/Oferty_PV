import fs from 'fs';
import path from 'path';

const rury = fs.readFileSync(path.join(process.cwd(), 'public/js/rury/pricelistUi.js'), 'utf-8');
const studnie = fs.readFileSync(
    path.join(process.cwd(), 'public/js/studnie/pricelistManager.js'),
    'utf-8'
);

describe('frontend: kontrakt colspan nagłówków grup (błąd #7)', () => {
    it('studnie: nagłówek grupy to labelka (colspan - 1) plus komórka akcji', () => {
        expect(studnie).toMatch('colspan="${colCount - 1}"');
        expect(studnie).toContain('cat-header-actions-cell');
        expect(studnie).not.toMatch("colspan=\"${isPrzejscia ? '11'");
    });
    it('rury: colspan grupowy zgadza się z liczbą kolumn nagłówka', () => {
        const thCount = (rury.match(/<th scope="col"/g) || []).length;
        expect(rury).toContain('<td colspan="7"');
        expect(thCount).toBe(7);
    });
});

describe('frontend: unifikacja chrome cenników (Faza A/B)', () => {
    it('rury i studnie: ten sam toolbar i tytuł bez inline style', () => {
        const ruryPartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/rury/pricelist.html'),
            'utf-8'
        );
        const studniePartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/studnie/pricelist.html'),
            'utf-8'
        );
        for (const content of [ruryPartial, studniePartial]) {
            expect(content).toContain('<div class="toolbar">');
            expect(content).toContain('pricelist-toolbar-title');
            expect(content).not.toContain('rury-toolbar');
            expect(content).not.toContain('style="margin: 0; width: 100%');
            expect(content).not.toContain('padding-left: 2.2rem');
        }
        expect(ruryPartial).toContain('id="pricelist-search"');
        expect(studniePartial).toContain('id="studnie-pricelist-search"');
    });
    it('reset ma tę samą ikonę w obu panelach (Zarządzanie cennikiem)', () => {
        const panel = fs.readFileSync(
            path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
            'utf-8'
        );
        expect(panel).toContain('data-lucide="rotate-ccw"');
        expect(panel).not.toContain('data-lucide="refresh-cw"');
    });
    it('studnie: nagłówek grupy używa wspólnego .cat-header', () => {
        expect(studnie).toContain('<div class="cat-header">');
        expect(studnie).toContain('cat-count');
        expect(studnie).not.toContain('rgba(var(--accent-rgb), 0.05)');
    });
});

describe('frontend: panel Zarządzanie cennikiem (3 przyciski + 3 sekcje)', () => {
    const ruryPartial = fs.readFileSync(
        path.join(process.cwd(), 'public/partials/rury/pricelist.html'),
        'utf-8'
    );
    const studniePartial = fs.readFileSync(
        path.join(process.cwd(), 'public/partials/studnie/pricelist.html'),
        'utf-8'
    );
    const panel = fs.readFileSync(
        path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
        'utf-8'
    );

    it('toolbar: Dodaj, Zapisz, Zarządzaj w tej kolejności (rury)', () => {
        const order = ['> Dodaj', '> Zapisz', '> Zarządzaj'].map((l) => ruryPartial.indexOf(l));
        expect(order.every((i) => i > -1)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(ruryPartial).toContain('id="btn-save-pricelist"');
        expect(ruryPartial).toContain('onclick="openRuryVersionsPanel()"');
        expect(ruryPartial).toContain('title="Zarządzanie cennikiem: wersje, pliki, domyślne"');
    });
    it('toolbar: Dodaj, Zapisz, Zarządzaj w tej kolejności (studnie)', () => {
        const order = ['> Dodaj', '> Zapisz', '> Zarządzaj'].map((l) => studniePartial.indexOf(l));
        expect(order.every((i) => i > -1)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(studniePartial).toContain('id="btn-save-studnie-pricelist"');
        expect(studniePartial).toContain('onclick="openStudnieVersionsPanel()"');
        expect(studniePartial).toContain('title="Zarządzanie cennikiem: wersje, pliki, domyślne"');
    });
    it('toolbar: brak Wersje/Zapisz domyślne/Eksportuj/Importuj/Przywróć + brak hidden inputów', () => {
        for (const content of [ruryPartial, studniePartial]) {
            expect(content).not.toContain('> Wersje');
            expect(content).not.toContain('Zapisz domyślne');
            expect(content).not.toContain('Eksportuj');
            expect(content).not.toContain('Importuj');
            expect(content).not.toContain('Przywróć domyślne');
            expect(content).not.toContain('import-pricelist-excel');
        }
    });
    it('panel: globalny tytuł bez typu + taby Rury/Studnie + 3 sekcje h4.pv-section', () => {
        expect(panel).toContain('Zarządzanie cennikami');
        expect(panel).not.toContain('Zarządzanie cennikiem (');
        for (const h of [
            '<h4 class="pv-section">Wersje</h4>',
            '<h4 class="pv-section">Transfer plików</h4>',
            '<h4 class="pv-section">Cenniki domyślne</h4>'
        ]) {
            expect(panel).toContain(h);
        }
        expect(panel.indexOf('>Wersje</h4>')).toBeLessThan(panel.indexOf('>Transfer plików</h4>'));
        expect(panel.indexOf('>Transfer plików</h4>')).toBeLessThan(
            panel.indexOf('>Cenniki domyślne</h4>')
        );
        for (const tab of ['data-pv-tab="rury"', 'data-pv-tab="studnie"']) {
            expect(panel).toContain(tab);
        }
        expect(panel).toContain('aria-pressed');
        expect(panel).toContain('role="tablist"');
        expect(panel).toContain('>Rury<');
        expect(panel).toContain('>Studnie<');
        expect(panel).toContain('id="pv-type-tabs"');
        expect(panel).toContain('id="pv-save-wrap"');
        expect(panel).toContain('id="pv-transfer"');
    });
    it('PRECO transfer tylko w panelu (toolbar bez Eksportuj/Importuj)', () => {
        const preco = fs.readFileSync(
            path.join(process.cwd(), 'public/js/studnie/pricelistPreco.js'),
            'utf-8'
        );
        expect(preco).not.toContain('> Eksportuj PRECO');
        expect(preco).not.toContain('> Importuj PRECO');
        expect(preco).not.toContain('import-preco-excel');
        expect(preco).toContain('window.exportPrecoToExcel = exportPrecoToExcel');
    });
    it('panel: domyślne z resetem PRECO (chowany spod rur)', () => {
        expect(panel).toContain('data-pv-reset="preco"');
        expect(panel).toContain('window.loadPrecoDefaults()');
        expect(panel).toContain('> Przywróć domyślne (PRECO)');
        expect(panel).toContain("typeof window.loadPrecoDefaults !== 'function'");
    });
    it('panel: transfer woła istniejące eksporty/importy; domyślne globalne raz', () => {
        expect(panel).toContain('onclick="exportRuryToExcel()"');
        expect(panel).toContain('onclick="exportStudnieToExcel()"');
        expect(panel).not.toContain('pv-row-label">PRECO<');
        expect(panel).not.toContain('onclick="exportPrecoToExcel()"');
        expect(panel).toContain('id="pv-import-excel"');
        expect(panel).toContain('onchange="');
        expect(panel).toContain('importRuryFromExcel(event)');
        expect(panel).toContain('importStudnieFromExcel(event)');
        expect(panel).toContain('onclick="window.parent.saveAllDefaults()"');
        expect(panel).toContain('resetPriceList()');
        expect(panel).toContain('resetStudniePriceList()');
        expect(panel).toContain('Przywróć domyślne (Rury)');
        expect(panel).toContain('Przywróć domyślne (Studnie)');
        const saveDefaultsCount = (panel.match(/id="btn-save-defaults"/g) || []).length;
        expect(saveDefaultsCount).toBe(1);
        expect(panel).toContain('obejmuje wszystkie cenniki (rury, studnie, PRECO)');
    });
    it('panel: otwarcia preselektują tab; getRows per typ (mapa + getRowsOther)', () => {
        expect(panel).toContain('getRowsByType');
        expect(panel).toContain('getRowsOther');
        expect(panel).toContain('resolveGetRows');
        expect(panel).toContain('switchType');
        expect(rury).toContain('openVersionsPanel(');
        expect(studnie).toContain('openVersionsPanel(');
        expect(rury).toContain('studnieProducts');
        expect(studnie).toContain('products');
    });
});
