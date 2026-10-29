import fs from 'fs';
import path from 'path';

/**
 * UX cennika (wariant A): obowiązujący → „Utwórz kopię jako szkic" →
 * „Edytuj" → „Zapisz" → „Opublikuj" z datą obowiązywania.
 * Podgląd blokuje siatkę (`inert`), więc przypadkowa edycja nie tworzy szkicu.
 */

const read = (p: string): string => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

const shared = read('public/js/shared/pricelistVersions.js');
const ruryPartial = read('public/partials/rury/pricelist.html');
const studniePartial = read('public/partials/studnie/pricelist.html');

describe('cennik: tryb edycji (podgląd ↔ szkic)', () => {
    it('pasek akcji + id przycisków w obu modułach', () => {
        for (const html of [ruryPartial, studniePartial]) {
            expect(html).toContain('id="pv-editor-actions"');
            expect(html).toContain('id="pricelist-status-strip"');
        }
        expect(ruryPartial).toContain('id="pv-mode-actions"');
        expect(studniePartial).toContain('id="pv-mode-actions"');
        expect(ruryPartial).not.toContain('id="btn-add-product"');
        expect(studniePartial).not.toContain('id="btn-add-studnie-product"');
    });

    it('trzy stany: kopia obowiązującego / edycja szkicu / anulowanie (publikacja w akcjach wersji)', () => {
        expect(shared).toContain("'Utwórz kopię jako szkic'");
        expect(shared).toContain('</i> Edytuj</button>');
        expect(shared).toContain("'Anuluj edycję'");
        expect(shared).toContain('data-pv-mode=');
        // „Opublikuj" należy do akcji wersji na osi, nie do paska trybu edycji.
        expect(shared).not.toContain("modeBtn('publish'");
        expect(shared).toContain('data-pv-act="publish"');
    });

    it('podgląd: siatka inert, „Zapisz" widoczny ale wyłączony', () => {
        expect(shared).toContain('grid.inert = !editing && sections.length === 0');
        expect(shared).toContain("saveBtn.classList.remove('hidden')");
        expect(shared).toContain('saveBtn.disabled = !editing');
        expect(shared).not.toContain('EDITOR_ADD');
        expect(read('public/css/style.utilities.css')).toContain('#studnie-pricelist-body[inert]');
    });

    it('zapis ma zawsze widoczny przycisk z etykietą „Zapisz”', () => {
        expect(shared).toContain('function saveButtonMeta(type)');
        expect(shared).toContain("var label = 'Zapisz';");
        expect(shared).toContain('function versionEditLabel(type)');
        expect(shared).toContain('Zapis podmienia ceny wersji');
        for (const file of [
            'public/js/rury/pricelistUi.js',
            'public/js/studnie/pricelistState.js',
            'public/js/studnie/pricelistPreco.js'
        ]) {
            expect(read(file)).toContain('saveButtonMeta');
        }
    });

    it('podgląd PRECO: inert na rozwinięciach accordionu, nagłówek klikalny', () => {
        expect(shared).toContain("grid.querySelectorAll('.preco-accordion-body')");
        expect(shared).toContain('el.inert = !editing');
        const preco = read('public/js/studnie/pricelistPreco.js');
        expect(preco).toContain("applyEditorLock('preco')");
        expect(preco).toContain('class="preco-accordion-head"');
        expect(preco).toContain('aria-expanded=');
        expect(preco).toContain('aria-controls="preco-body-');
    });

    it('render odtwarza DOM — blokada podglądu wraca po każdym renderze', () => {
        expect(read('public/js/studnie/pricelistManager.js')).toContain(
            "applyEditorLock('studnie')"
        );
        expect(read('public/js/rury/pricelistUi.js')).toContain("applyEditorLock('rury')");
    });

    it('zapis poza trybem edycji nie tworzy szkicu po cichu (3 osie)', () => {
        for (const file of [
            'public/js/rury/pricelistUi.js',
            'public/js/studnie/pricelistSaveReset.js',
            'public/js/studnie/pricelistPreco.js'
        ]) {
            expect(read(file)).toContain('pricelistVersions.isEditing');
        }
    });

    it('po zapisie pasek się odświeża (cache /summary unieważniony)', () => {
        expect(shared).toContain('function clearSummaryCache(');
        expect(shared).toContain('function refreshStatusStrip(');
        expect(read('public/js/rury/pricelistUi.js')).toContain("refreshStatusStrip('rury')");
        expect(read('public/js/studnie/pricelistSaveReset.js')).toContain(
            "refreshStatusStrip('studnie')"
        );
    });
});

describe('cennik: publikacja z wyborem daty', () => {
    it('dialog ma datę obowiązywania + podgląd etykiety po dacie', () => {
        expect(shared).toContain('id="pv-publish-date"');
        expect(shared).toContain('type="datetime-local"');
        expect(shared).toContain('id="pv-publish-hint"');
        expect(shared).toContain('versionLabel(t, draft.seq, iso)');
    });

    it('dialog używa wzorca SOK: .modal--publish + akcje w stopce po prawej', () => {
        expect(shared).toContain('class="modal modal--publish"');
        expect(shared).toContain('class="modal-footer"');
        expect(shared).not.toContain(
            'class="pv-actions"><button type="button" class="btn btn-secondary" id="pv-publish-cancel"'
        );
        const css = read('public/css/style.responsive.css');
        expect(css).toContain('.modal--publish {');
        expect(css).toContain('.modal--publish .pv-publish-input');
    });

    it('approve niesie effectiveFrom; data wsteczna wymaga noty min. 10 znaków', () => {
        expect(shared).toContain('body.effectiveFrom = opts.effectiveFrom');
        expect(shared).toContain('PAST_NOTE_MIN');
        expect(shared).toContain('Data w przeszłości');
    });
});

describe('cennik: adnotacja „ostatnia zmiana"', () => {
    it('pasek czyta updatedAt z /summary', () => {
        expect(shared).toContain('function lastChange(');
        expect(shared).toContain('ref.updatedAt');
        expect(shared).toContain('· zmiana ');
    });
});

describe('cennik: kopia jako szkic nie duplikuje szkicu', () => {
    it('clone-draft tylko gdy brak szkicu; inaczej wejście w istniejący', () => {
        expect(shared).toContain('function createDraftCopy(');
        expect(shared).toContain('/clone-draft');
        expect(shared).toContain('już istnieje — edytujesz go');
    });

    it('sukces kopii odświeża listę wersji i siatkę (bez F5)', () => {
        const start = shared.indexOf('function createDraftCopy(');
        const end = shared.indexOf('function openPublishDialog(', start);
        const body = shared.slice(start, end);
        expect(body).toContain('afterVersionChange(t, { reloadGrid: true })');
    });
});
