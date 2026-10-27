import fs from 'fs';
import path from 'path';

/**
 * Rail „Zarządzanie cennikami" — jedyny pasek zarządzania cennikami.
 * Kontrakt: trwały dock (nie modal), karty wersji, akcje siatki w stałym
 * slocie raila, toggle z aria, edycja w miejscu w #/cennik i wspólne
 * odświeżenie stanu po akcjach.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('Rail „Zarządzanie cennikami" (lewy panel edytorów)', () => {
    const panel = read('public/js/shared/pricelistVersions.js');
    const css = read('public/css/pricelist-panel.css');
    const ruryPartial = read('public/partials/rury/pricelist.html');
    const studniePartial = read('public/partials/studnie/pricelist.html');
    const ruryHtml = read('public/rury.html');
    const studnieHtml = read('public/studnie.html');

    it('rail jest trwałym elementem strony, nie modalem', () => {
        expect(panel).toContain("var DOCK_ID = 'pv-dock'");
        expect(panel).toContain('function ensureDock()');
        expect(panel).toContain("dock.className = 'pv-dock'");
        expect(panel).toContain("dock.setAttribute('role', 'complementary')");
        expect(panel).not.toContain("id: 'pv-versions-modal'");
        expect(panel).toContain('function closeVersionsPanel(');
        expect(panel).toContain('dock.hidden = !open');
    });

    it('wersje to karty w liście, pogrupowane po roku, bez akcji na karcie', () => {
        expect(panel).toContain('id="pv-versions-body" class="pv-version-list"');
        expect(panel).toContain('class="pv-vcard');
        expect(panel).not.toContain('<tbody id="pv-versions-body">');
        expect(panel).toContain('class="pv-vcard__meta"');
        expect(panel).toContain('function groupByYear');
        expect(panel).toContain('class="pv-year"');
        expect(panel).toContain('data-pv-select="');
        expect(panel).not.toContain('pv-vcard__actions');
    });

    it('jeden pasek akcji dla zaznaczonej wersji (karta tylko wybiera)', () => {
        expect(panel).toContain('id="pv-version-actions"');
        expect(panel).toContain('function actionsBarHtml');
        expect(panel).toContain('function renderActions');
        expect(panel).toContain('function rerenderCards');
        expect(panel).toContain('Zaznacz wersję na liście, aby użyć akcji');
        expect(css).toContain('.pv-year__title');
        expect(css).toContain('.pv-vcard.is-selected');
        expect(css).toContain('.pv-version-actions__grid');
        // Lista wersji przewija się bez widocznego paska (nie zabiera szerokości).
        expect(css).toContain('scrollbar-width: none');
        expect(css).toContain('.pv-dock__body::-webkit-scrollbar');
        // Kafelek: data obowiązywania pełną szerokością od lewej, etykieta w linii.
        expect(css).toContain('.pv-vcard__meta > div:first-child');
        expect(css).toContain('.pv-vcard__meta > div:last-child');
    });

    it('zaznaczenie karty pokazuje wersję w tej samej siatce (tylko odczyt)', () => {
        expect(panel).toContain('function showVersionInGrid');
        expect(panel).toContain('function restoreGrid');
        expect(panel).toContain('var GRID_STATE');
        expect(panel).toContain("render: 'renderPriceList'");
        expect(panel).toContain("render: 'renderStudniePriceList'");
        expect(panel).toContain("render: 'renderPrecoPriceList'");
        expect(panel).toContain("bar.id = 'pv-version-bar'");
        expect(panel).toContain('Wróć do edycji');
        expect(panel).toContain('var gridSnapshot');
        expect(css).toContain('.pv-version-bar');
        // Ta sama konwersja wierszy co import XLSX (identyczna tabela jak w edycji).
        expect(read('public/js/rury/pricelistUi.js')).toContain('window.ruryImportOptions');
        expect(read('public/js/studnie/pricelistImportExport.js')).toContain(
            'window.studnieImportOptions'
        );
        expect(read('public/js/shared/pricelistVersionPreview.js')).not.toContain('pv-inline');
    });

    it('klik w zaznaczony kafelek też pokazuje wersję; druga oś wraca do live', () => {
        // Samo ACTIVE (np. PRECO) nie mogło się otworzyć: warunek `picked !== selected`.
        expect(panel).not.toContain('if (picked && picked !== selectedVersionId[state.current])');
        expect(panel).toContain('openSelectedPreview(state.current);');
        // PRECO i studnie dzielą kontener — snapshot drugiej osi nie może zostać.
        expect(panel).toContain('function restoreOtherAxes');
        expect(panel).toContain('restoreOtherAxes(type);');
        expect(panel).toContain('function restoreGridDataOnly');
    });

    it('zmiana DN zostaje w wersji; tylko zmiana osi ją zwalnia', () => {
        const state = read('public/js/studnie/pricelistState.js');
        // Oś: wszystkie DN = studnie, Wkładki = [preco].
        expect(state).toContain(
            "const prevAxis = currentCennikTab === 'preco' ? 'preco' : 'studnie';"
        );
        expect(state).toContain("const nextAxis = tab === 'preco' ? 'preco' : 'studnie';");
        expect(state).toContain('releaseEditorVersion(prevAxis)');
        expect(state).not.toContain('closeEditorPreview(');
        expect(panel).toContain('function releaseEditorVersion');
        expect(panel).toContain('function watchVersionLock');
        expect(panel).toContain('function versionAxis');
        expect(panel).toContain("bar.setAttribute('data-axis', type)");
    });

    it('nagłówek: Cennik Rur / elementów studni / wkładek PRECO + numer wersji', () => {
        expect(panel).toContain("rury: 'Cennik Rur'");
        expect(panel).toContain("studnie: 'Cennik elementów studni'");
        expect(panel).toContain("preco: 'Cennik wkładek PRECO'");
        expect(panel).toContain('function syncHeaderForTab');
        expect(ruryPartial).toContain('id="pv-title-text">Cennik Rur<');
        expect(studniePartial).toContain('id="pv-title-text">Cennik elementów studni<');
        for (const partial of [ruryPartial, studniePartial]) {
            expect(partial).toContain('id="pv-title-version"');
        }
        expect(css).toContain('.pv-title-version');
        expect(read('public/js/studnie/pricelistState.js')).toContain('syncHeaderForTab(nextAxis)');
    });

    it('komplet akcji CRUD bez zmiany dyspozytora data-pv-act', () => {
        for (const act of [
            'edit',
            'clone',
            'activate',
            'diff',
            'label',
            'publish',
            'delete',
            'edit-note',
            'close'
        ]) {
            expect(panel).toContain('data-pv-act="' + act + '"');
        }
        expect(panel).not.toContain('data-pv-act="activate-reset"');
        expect(panel).not.toContain("'/active/reset'");
        expect(panel).toContain('function applyActiveOverride');
        expect(panel).toContain('var activeOverrideIds');
        // Edycja opublikowanej wersji: tryb wersji + ostrzeżenie + nagłówki zapisu.
        expect(panel).toContain('function openVersionOrDraft');
        expect(panel).toContain('function openVersionEditor');
        expect(panel).toContain("'X-Pricelist-Version-Id'");
        expect(panel).toContain('function noteVersionSaved');
        expect(panel).toContain('Edycja wersji');
        expect(panel).toContain('Zakończ edycję');
        // Podgląd w modalu zbędny — klik kafelka pokazuje wersję w siatce.
        expect(panel).not.toContain('data-pv-act="preview"');
        expect(panel).toContain('function renderRows(versions, manageable, type)');
        expect(panel).toContain('if (host.__pvWired) return;');
    });

    it('sekcje raila w kolejności: Wersje → Pliki → Domyślne → Pomoc', () => {
        const order = [
            '>Wersje</h4>',
            '>Transfer plików</h4>',
            '>Cenniki domyślne</h4>',
            '>Jak to działa</h4>'
        ].map((label) => panel.indexOf(label));
        expect(order.every((index) => index > -1)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        // Spójna typografia treści sekcji (nie dziedziczy 16 px z body).
        expect(css).toMatch(/\.pv-dock__section-body \{[^}]*font-size: var\(--fs-md\)/);
        expect(css).toContain('.pv-help-modal .pv-legend');
        expect(css).toMatch(/\.pv-help-modal \{[^}]*width: min\(1520px, 92vw\)/);
        expect(css).toContain('.pv-dock .btn-sm');
    });

    it('toggle „Panel” z aria-expanded po obu stronach', () => {
        expect(panel).toContain('function toggleVersionsPanel(');
        expect(panel).toContain("document.querySelectorAll('[data-pv-dock-toggle]')");
        expect(panel).toContain("btn.setAttribute('aria-expanded'");
        for (const partial of [ruryPartial, studniePartial]) {
            expect(partial).toContain('data-pv-dock-toggle');
            expect(partial).toContain('aria-controls="pv-dock"');
            expect(partial).toContain('aria-expanded="false"');
        }
        expect(ruryPartial).toContain('data-csp="toggleRuryVersionsPanel"');
        expect(studniePartial).toContain('data-csp="toggleStudnieVersionsPanel"');
    });

    it('jeden pasek: akcje siatki w stałym slocie raila, toolbar bez duplikatów', () => {
        expect(panel).toContain('function mountGridActions()');
        expect(panel).toContain("var content = document.getElementById('pv-dock-content')");
        expect(panel).toContain('content.innerHTML = dockHtml');
        expect(panel).toContain('id="pv-dock-content" class="pv-dock__body"');
        expect(panel).toContain("document.getElementById('pv-grid-actions')");
        expect(panel).not.toContain('stateBadge.textContent = versionMode');
        expect(panel).toContain("'Zapisz wersję'");
        // PRECO: zapis w railu, toolbar przy tabeli ukryty w #/cennik.
        expect(css).toContain(".pv-grid-actions[data-axis='preco'] #btn-save-studnie-pricelist");
        expect(css).toContain(".pv-grid-actions[data-axis='preco'] #btn-save-preco-rail");
        expect(css).toContain('body.pv-cennik-host .preco-toolbar');
        expect(studniePartial).toContain('id="btn-save-preco-rail"');
        // Stan ma jedno miejsce: otwarty rail chowa pasek nad siatką.
        expect(css).toContain('body.pv-dock-open #pricelist-status-strip');
        for (const partial of [ruryPartial, studniePartial]) {
            expect(partial).toContain('id="pv-grid-actions"');
            expect(partial).not.toContain('id="pv-grid-actions-state"');
        }
    });

    it('status w railu: każdy komunikat na pełną szerokość panelu', () => {
        expect(css).toMatch(/\.pv-dock \.pv-status-strip \{[^}]*width: 100%/);
        expect(css).toMatch(
            /\.pv-dock \.pv-status-strip \.badge,\s*\.pv-dock \.pv-status-strip \.pv-draft-banner \{[^}]*width: 100%/
        );
    });

    it('#/cennik: edycja w miejscu, bez zmiany hasha SPA', () => {
        expect(panel).toContain("get('host') === 'cennik'");
        expect(panel).toContain('function isCennikHost()');
        expect(panel).toContain('if (isCennikHost()) {');
        expect(panel).toContain('setEditing(type, true);');
        expect(panel).toContain('reloadEditorGrid(type);');
        expect(panel).not.toContain('window.location.hash = editorHash');
    });

    it('jeden lewy panel: powłoka bez slim-nav, taby raila przełączają moduł', () => {
        expect(panel).toContain('function switchCennikType(');
        expect(panel).toContain('w.CennikHost.activate(type)');
        expect(panel).toContain("if (isCennikHost()) return ['rury', 'studnie', 'preco']");
        expect(read('public/cennik.html')).not.toContain('cennik-sidebar');
        expect(read('public/css/cennik.css')).not.toContain('.cennik-sidebar');
        expect(css).toContain('body.pv-cennik-host .pv-dock__close');
        expect(css).toContain('body.pv-cennik-host [data-pv-dock-toggle]');
    });

    it('rail w #/cennik otwiera się zawsze (brak preferencji zamykania)', () => {
        expect(panel).toContain('function autoOpenVersionsPanel(');
        expect(panel).toContain('if (!isCennikHost()) return Promise.resolve();');
        expect(panel).not.toContain('DOCK_PREF_KEY');
        expect(panel).not.toContain('readDockPref');
    });

    it('akcje odświeżają listę i pasek; usunięcie szkicu wychodzi z edycji', () => {
        expect(panel).toContain('function afterVersionChange(');
        expect(panel).toContain('{ reloadGrid: wasEdited }');
        expect(panel).toContain('wasEdited = Boolean(ref && ref.id === id)');
        expect(panel).toContain("renderStatusStrip('pv-dock-status'");
        expect(panel).toContain("document.getElementById('pv-dock-status')");
    });

    it('CSS: 380 px z lewej, wypchnięcie treści, drawer i print', () => {
        expect(css).toContain('--pv-dock-w: 418px');
        expect(css).toContain('left: 0');
        expect(css).toContain('border-right: 1px solid var(--border)');
        expect(css).toContain('margin-left: var(--pv-dock-w) !important');
        expect(css).toContain('width: calc(100% - var(--pv-dock-w)) !important');
        expect(css).toContain('body.pv-cennik-host #studnie-pricelist-body table');
        expect(css).toContain('body.pv-cennik-host .preco-wrap');
        expect(css).toContain('#studnie-pricelist-body:has(.preco-accordion)');
        expect(css).toContain('max-width: 1040px');
        expect(css).toContain('min-width: 1080px');
        expect(css).not.toContain('clamp(432px');
        expect(css).toContain('body.pv-dock-open #pricelist-status-strip');
        expect(css).toContain('@media (max-width: 1024px)');
        expect(css).toContain('@media print');
        expect(ruryHtml).toContain('css/pricelist-panel.css?v=');
        expect(studnieHtml).toContain('css/pricelist-panel.css?v=');
    });

    it('rail nie wprowadza inline handlerów (CSP-E)', () => {
        expect(panel).not.toMatch(/onclick=/);
        expect(panel).not.toMatch(/onchange=/);
    });
});
