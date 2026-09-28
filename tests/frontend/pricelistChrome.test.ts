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
        for (const tab of ['data-pv-tab="', 'aria-pressed', 'role="tablist"']) {
            expect(panel).toContain(tab);
        }
        expect(panel).toContain('labels[t]');
        expect(panel).toContain('id="pv-type-tabs"');
    });
    it('panel: taby tylko dla załadowanych modułów (fix obcej strony)', () => {
        expect(panel).toContain('function availableTypes()');
        expect(panel).toContain('window.exportRuryToExcel');
        expect(panel).toContain('window.exportStudnieToExcel');
        expect(panel).toContain('function isAvailable(type)');
        expect(panel).toContain('if (types.length < 2) return');
        expect(panel).toContain('if (!isAvailable(type)) type = availableTypes()[0]');
        expect(panel).toContain('isAvailable(next)');
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
    it('panel: eksport ostrzega o braku PRECO same-seq', () => {
        expect(panel).toContain('X-Preco-Included');
        expect(panel).toContain('Wersja PRECO o tym samym numerze nie istnieje');
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

describe('frontend: przycisk Usuń zawsze widoczny (wyszarzony gdy nie wolno)', () => {
    const panel = fs.readFileSync(
        path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
        'utf-8'
    );
    const route = fs.readFileSync(
        path.join(process.cwd(), 'src/routes/pricelistVersions.ts'),
        'utf-8'
    );

    it('renderRows: Usuń zawsze w źródle (data-pv-act="delete"), nigdy warunkowe znikanie', () => {
        expect(panel).toContain('data-pv-act="delete"');
        expect(panel).not.toMatch(/isDeletable\(v\.status\)\s*\?\s*'<button/);
    });
    it('renderRows: enabled dla allowlist albo usedBy===0 poza ACTIVE/BACKDATE; brak usedBy = blokada', () => {
        expect(panel).toContain('usedBy');
        expect(panel).toContain("v.status === 'ACTIVE'");
        expect(panel).toContain("v.status === 'BACKDATE'");
        expect(panel).toContain("typeof v.usedBy !== 'number'");
        expect(panel).toContain('v.usedBy > 0');
        expect(panel).toContain('deleteReason');
        expect(panel).toContain('reason === null');
    });
    it('renderRows: disabled + title z powodem (aktywna / użycie / brak danych)', () => {
        expect(panel).toContain('disabled');
        expect(panel).toContain('Wersja aktywna — nieusuwalna');
        expect(panel).toContain('Wersja wsteczna — nieusuwalna');
        expect(panel).toContain('Używana przez ');
        expect(panel).toContain('ofert/zamówień');
        expect(panel).toContain('Brak danych o użyciu — nieusuwalna');
    });
    it('route GET /: dokleja usedBy per wersję (batch countVersionUsage)', () => {
        expect(route).toContain('countVersionUsage');
        expect(route).toContain('usedBy');
    });
});

describe('frontend: widoczność wersji cennika (dopisek typu, pasek, kartoteka)', () => {
    const panel = fs.readFileSync(
        path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
        'utf-8'
    );
    const topbar = fs.readFileSync(
        path.join(process.cwd(), 'public/js/versionDisplay.js'),
        'utf-8'
    );
    const appHtml = fs.readFileSync(path.join(process.cwd(), 'public/app.html'), 'utf-8');
    const kartHtml = fs.readFileSync(path.join(process.cwd(), 'public/kartoteka.html'), 'utf-8');
    const kartHelpers = fs.readFileSync(
        path.join(process.cwd(), 'public/js/kartoteka/kartotekaHelpers.js'),
        'utf-8'
    );
    const kartSearch = fs.readFileSync(
        path.join(process.cwd(), 'public/js/kartoteka/kartotekaSearch.js'),
        'utf-8'
    );

    it('badge ZAWSZE z typem (labelka + tooltip), labelki DB nietknięte', () => {
        expect(panel).toContain('function badgeHtml(versionId, type)');
        expect(panel).toContain('data-pv-type="');
        expect(panel).toContain("' · ' + label");
        expect(panel).toContain("• Typ: ' + label");
        // Wyświetlanie tylko — brak mutacji version w źródle panelu.
        expect(panel).not.toMatch(/v\.version\s*=[^=]/);
    });
    it('tabela wersji BEZ sufiksu typu (kontekst taba) + title z typem', () => {
        expect(panel).toContain('function renderRows(versions, manageable, type)');
        expect(panel).toContain('title="Typ cennika: ');
        expect(panel).not.toContain("v.version + ' · '");
    });
    it('tankowanie per typ bez N+1 (grupowanie + cache fetchLabels)', () => {
        expect(panel).toContain('function groupSpotsByType(');
        expect(panel).toContain('function hydrateActiveBadges(');
        expect(panel).toContain('function activeBadgeHtml(');
        expect(panel).toContain('function pickActiveLabel(');
        expect(panel).toContain('data-pv-active="');
        expect(panel).toContain('brak aktywnego cennika');
        expect(panel).toContain('hydrateActiveBadges');
    });
    it('pasek górny: aktywne cenniki obok wersji aplikacji, istniejąca logika nietknięta', () => {
        expect(topbar).toContain("versionEl.textContent = 'v' + data.version");
        expect(topbar).toContain('app-pricelists-toolbar');
        expect(topbar).toContain('/api/pricelist-versions/labels?type=');
        expect(topbar).toContain("parts.join(' · ')");
        expect(topbar).toContain('brak aktywnego cennika');
        expect(topbar).toContain('header-version text-muted');
        // textContent, nie innerHTML (kontrakt SEC-01 jak wersja aplikacji).
        expect(topbar).not.toMatch(/pricelists-toolbar['"]?\)\.innerHTML/);
        expect(appHtml).toContain('id="app-version-toolbar"');
        // Span paska cenników tworzony dynamicznie — brak statycznego duplikatu.
        expect(appHtml).not.toContain('app-pricelists-toolbar');
    });
    it('kartoteka: badge per karta (pieczątka albo aktywna per typ) + hydratacja', () => {
        expect(kartHtml).toContain('js/shared/pricelistVersions.js');
        expect(kartHelpers).toContain('badgeHtml(offer.pricelistVersionId, pvType)');
        expect(kartHelpers).toContain('activeBadgeHtml(pvType)');
        expect(kartHelpers).toContain("offer.type === 'studnia_oferta' ? 'studnie' : 'rury'");
        expect(kartHelpers).toContain('offer-meta');
        expect(kartSearch).toContain('hydrateBadges(listDiv)');
        expect(kartSearch).toContain('hydrateActiveBadges(listDiv)');
    });
    it('listy ofert przekazują typ do badgeHtml (studnie/rury)', () => {
        const studnie = fs.readFileSync(
            path.join(process.cwd(), 'public/js/studnie/offerSavedList.js'),
            'utf-8'
        );
        const rury = fs.readFileSync(
            path.join(process.cwd(), 'public/js/rury/offerCrudHelpers.js'),
            'utf-8'
        );
        expect(studnie).toContain("badgeHtml(o.pricelistVersionId, 'studnie')");
        expect(rury).toContain("badgeHtml(o.pricelistVersionId, 'rury')");
    });
});

describe('frontend: edycja noty + nota przy aktywacji (źródło)', () => {
    const panel = fs.readFileSync(
        path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
        'utf-8'
    );

    it('kolumna Nota: ołówek pencil tylko dla edytowalnych (DRAFT/SCHEDULED/BACKDATE_REQUESTED)', () => {
        expect(panel).toContain('data-pv-act="edit-note"');
        expect(panel).toContain('data-lucide="pencil"');
        expect(panel).toContain('title="Edytuj notę"');
        expect(panel).toContain('function isEditableStatus(status)');
        expect(panel).toContain('data-pv-note="');
    });
    it('openNoteModal reuse: tryb opcjonalny (required:false, initial, okText)', () => {
        expect(panel).toContain('o.required !== false');
        expect(panel).toContain('(opcjonalna)');
        expect(panel).toContain('o.initial');
        expect(panel).toContain('o.okText');
    });
    it('aktywacja pyta o opcjonalną notę (tylko SCHEDULED), pustka = bez noty', () => {
        expect(panel).toContain("'Aktywuj wersję'");
        expect(panel).toContain('Opcjonalna nota do aktywacji');
        expect(panel).toContain("required: false, okText: 'Aktywuj'");
        expect(panel).toContain('trimmed ? { note: note } : undefined');
    });
    it('edycja noty woła PUT samą notą (bez rows)', () => {
        expect(panel).toContain("'Edytuj notę'");
        expect(panel).toContain("authed('PUT', { note: note })");
        expect(panel).toContain('Nota zapisana');
    });
});
