/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/* Parytet „Edytuj": przycisk w pasku trybu (#pv-mode-actions) i „Edytuj" na
 * karcie szkicu w panelu wersji muszą robić TO SAMO — przeładować siatkę,
 * wyjść z podglądu wersji i wejść w edycję szkicu. Wcześniej pasek tylko
 * ustawiał flagę, więc w siatce zostawały dane podglądu/LIVE.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const CODE = fs.readFileSync(path.join(ROOT, 'public/js/shared/pricelistVersions.js'), 'utf8');

const SUMMARY = {
    types: {
        rury: {
            active: { version: 'Rv1-20260927', effectiveFrom: '2026-09-27T10:00:00.000Z' },
            draft: { id: 'd1', version: 'Rv4-20261028', sha256: 's1', updatedAt: null },
            nextScheduled: null
        },
        studnie: { active: null, draft: null, nextScheduled: null },
        preco: { active: null, draft: null, nextScheduled: null }
    }
};

function mount() {
    window.history.replaceState({}, '', '/app.html?host=cennik');
    document.body.innerHTML =
        '<div id="pricelist-status-strip" class="pv-status-strip"></div>' +
        '<div id="pricelist-body"></div>' +
        '<div id="pv-mode-actions"></div>' +
        '<div id="pv-versions-body"></div>' +
        '<div id="pv-version-bar" hidden></div>' +
        '<button type="button" data-pv-mode="edit">Edytuj</button>';
    window.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => SUMMARY }));
    window.authHeaders = () => ({});
    window.showToast = jest.fn();
    window.showModal = jest.fn();
    window.closeModal = jest.fn();
    window.appConfirm = jest.fn(async () => true);
    window.escapeHtml = (s) => String(s ?? '');
    window.escapeHtmlAttr = (s) => String(s ?? '');
    window.escapeJsStr = (s) => String(s ?? '');
    window.lucide = { createIcons: jest.fn() };
    // Tor edycji w #/cennik: reload sekcji cennika + odświeżenie przycisku zapisu.
    window.showSection = jest.fn();
    window.updateSaveBtn = jest.fn();
    window.selectCennikTab = jest.fn();
    new Function('window', 'document', CODE)(window, document);
    return window.pricelistVersions;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('przycisk „Edytuj" w pasku trybu = panel wersji', () => {
    it('klik przeładowuje siatkę i wchodzi w edycję szkicu (jak panel wersji)', async () => {
        const pv = mount();
        document.querySelector('[data-pv-mode="edit"]').click();
        await flush();
        await flush();
        // Panel wersji woła openEditorFor → reloadEditorGrid → showSection('pricelist').
        expect(window.showSection).toHaveBeenCalledWith('pricelist');
        expect(pv.isEditing('rury')).toBe(true);
        expect(window.showToast).toHaveBeenCalledWith(
            expect.stringContaining('Rv4-20261028'),
            'info'
        );
        const host = document.getElementById('pricelist-status-strip');
        expect(host.getAttribute('data-editing')).toBe('1');
        expect(host.textContent).toContain('TRYB EDYCJI');
    });

    it('brak szkicu: wchodzi w tryb edycji bez kłamstwa o szkicu', async () => {
        mount();
        const noDraft = {
            types: {
                rury: { active: null, draft: null, nextScheduled: null },
                studnie: { active: null, draft: null, nextScheduled: null },
                preco: { active: null, draft: null, nextScheduled: null }
            }
        };
        window.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => noDraft }));
        window.pricelistVersions.clearSummaryCache();
        document.querySelector('[data-pv-mode="edit"]').click();
        await flush();
        await flush();
        expect(window.pricelistVersions.isEditing('rury')).toBe(true);
        expect(window.showToast).toHaveBeenCalledWith(
            'Edytujesz cennik — zapis utworzy szkic',
            'info'
        );
    });

    it('kontrakt w źródle: delegacja do openEditorFor, bez starego toastu', () => {
        expect(CODE).toMatch(
            /if \(act === 'edit'\) \{[\s\S]{0,500}openEditorFor\(type, draft\.version\)/
        );
        expect(CODE).not.toContain('Edytujesz szkic — zapis nie zmienia wersji obowiązującej');
    });
});
