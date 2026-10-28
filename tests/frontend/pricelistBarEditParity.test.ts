/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/* Kafelek „Edytuj" w pasku trybu (#pv-mode-actions) ma być KOPIĄ kafelka
 * z sekcji wersji: ten sam builder (markup + ikona + klasa) i ta sama funkcja
 * `openVersionOrDraft` (szkic → edytor, opublikowana → edycja w miejscu).
 * Wcześniej pasek miał własną logikę: tylko flaga edycji, bez reloadu siatki.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const CODE = fs.readFileSync(path.join(ROOT, 'public/js/shared/pricelistVersions.js'), 'utf8');

const SUMMARY = {
    types: {
        rury: {
            active: { version: 'Rv1-20260927', effectiveFrom: '2026-09-27T10:00:00.000Z' },
            draft: {
                id: 'd1',
                version: 'Rv4-20261028',
                seq: 4,
                status: 'DRAFT',
                state: 'DRAFT',
                sha256: 's1',
                updatedAt: null
            },
            nextScheduled: null
        },
        studnie: { active: null, draft: null, nextScheduled: null },
        preco: { active: null, draft: null, nextScheduled: null }
    }
};

function mount(summary) {
    window.history.replaceState({}, '', '/app.html?host=cennik');
    document.body.innerHTML =
        '<div id="pricelist-status-strip" class="pv-status-strip"></div>' +
        '<div id="pricelist-body"></div>' +
        '<div id="pv-mode-actions"></div>' +
        '<div id="pv-versions-body"></div>' +
        '<div id="pv-version-bar" hidden></div>';
    window.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => summary || SUMMARY
    }));
    window.authHeaders = () => ({});
    window.showToast = jest.fn();
    window.showModal = jest.fn();
    window.closeModal = jest.fn();
    window.appConfirm = jest.fn(async () => true);
    window.escapeHtml = (s) => String(s ?? '');
    window.escapeHtmlAttr = (s) => String(s ?? '');
    window.escapeJsStr = (s) => String(s ?? '');
    window.lucide = { createIcons: jest.fn() };
    window.showSection = jest.fn();
    window.updateSaveBtn = jest.fn();
    window.selectCennikTab = jest.fn();
    new Function('window', 'document', CODE)(window, document);
    return window.pricelistVersions;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('kafelek „Edytuj" w pasku trybu = kopia kafelka z sekcji wersji', () => {
    it('renderuje ten sam markup co panel wersji (btn-sm + ikona + Edytuj)', async () => {
        const pv = mount();
        await pv.syncEditor('rury');
        const tile = document.querySelector('#pv-mode-actions [data-pv-mode="edit"]');
        expect(tile).not.toBeNull();
        expect(tile.className).toBe('btn btn-sm btn-secondary');
        expect(tile.innerHTML).toBe('<i data-lucide="pencil"></i> Edytuj');
        expect(tile.getAttribute('title')).toBe(
            'Przejdź do edytora cennika — zapis trafia do tego szkicu (LIVE bez zmian)'
        );
    });

    it('klik robi to samo co panel: przeładowuje siatkę i wchodzi w edycję szkicu', async () => {
        const pv = mount();
        await pv.syncEditor('rury');
        document.querySelector('#pv-mode-actions [data-pv-mode="edit"]').click();
        await flush();
        await flush();
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

    it('brak jakiejkolwiek wersji: ostrzeżenie, bez wchodzenia w edycję na ślepo', async () => {
        mount({
            types: {
                rury: { active: null, draft: null, nextScheduled: null },
                studnie: { active: null, draft: null, nextScheduled: null },
                preco: { active: null, draft: null, nextScheduled: null }
            }
        });
        window.pricelistVersions.clearSummaryCache();
        document
            .getElementById('pv-mode-actions')
            .insertAdjacentHTML('beforeend', '<button type="button" data-pv-mode="edit"></button>');
        document.querySelector('#pv-mode-actions [data-pv-mode="edit"]').click();
        await flush();
        await flush();
        expect(window.pricelistVersions.isEditing('rury')).toBe(false);
        expect(window.showToast).toHaveBeenCalledWith(
            'Brak wersji do edycji — najpierw zapisz cennik',
            'warning'
        );
    });

    it('kontrakt: jeden builder i jedna akcja dla obu miejsc', () => {
        expect(CODE).toContain('function editTileHtml(');
        // Pasek trybu i panel wersji wołają ten sam builder…
        expect(CODE.match(/editTileHtml\(/g)).toHaveLength(3); // deklaracja + 2 użycia
        // …i tę samą funkcję akcji.
        expect(CODE.match(/openVersionOrDraft\(type\)/g).length).toBeGreaterThanOrEqual(2);
        expect(CODE).not.toContain('Edytujesz szkic — zapis nie zmienia wersji obowiązującej');
    });
});
