/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/* Tryb edycji cennika musi być widoczny i wskazywać OŚ (rury/studnie/PRECO):
 * pasek stanu dostaje badge osi zawsze, a w edycji pełnowymiarowy banner
 * „TRYB EDYCJI" + obrys siatki. Podgląd = cisza (bez banera).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const CODE = fs.readFileSync(path.join(ROOT, 'public/js/shared/pricelistVersions.js'), 'utf8');

const SUMMARY = {
    generatedAt: '2026-10-28T00:00:00.000Z',
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
    document.body.innerHTML =
        '<div id="pricelist-status-strip" class="pv-status-strip"></div>' +
        '<div id="pricelist-body"></div>';
    window.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => SUMMARY
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
    new Function('window', 'document', CODE)(window, document);
    return window.pricelistVersions;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('pasek stanu: oś cennika + tryb edycji', () => {
    it('podgląd: badge osi i cennika oferty, bez banera i bez szkicu', async () => {
        const pv = mount();
        await pv.renderStatusStrip('pricelist-status-strip', 'rury');
        const host = document.getElementById('pricelist-status-strip');
        expect(host.textContent).toContain('Rury');
        expect(host.textContent).not.toContain('TRYB EDYCJI');
        expect(host.getAttribute('data-editing')).toBe('0');
        // Podgląd = cennik obowiązujący: szkic nie jest pokazywany jako źródło siatki.
        expect(host.textContent).not.toContain('Rv4-20261028');
        expect(host.textContent).not.toContain('Siatka pokazuje szkic');
        expect(host.textContent).toContain('Podgląd cennika oferty');
        expect(pv.isPricelistEditing('rury')).toBe(false);
    });

    it('edycja szkicu: banner TRYB EDYCJI z osią i wersją szkicu + obrys siatki', async () => {
        const pv = mount();
        await pv.renderStatusStrip('pricelist-status-strip', 'rury');
        pv.setEditing('rury', true);
        await flush();
        await flush();
        const host = document.getElementById('pricelist-status-strip');
        expect(host.textContent).toContain('TRYB EDYCJI');
        expect(host.textContent).toContain('Rury');
        expect(host.textContent).toContain('Rv4-20261028');
        expect(host.getAttribute('data-editing')).toBe('1');
        expect(document.getElementById('pricelist-body').getAttribute('data-pv-editing')).toBe('1');
    });

    it('wyjście z edycji: baner znika, obrys siatki gaśnie', async () => {
        const pv = mount();
        await pv.renderStatusStrip('pricelist-status-strip', 'rury');
        pv.setEditing('rury', true);
        await flush();
        pv.setEditing('rury', false);
        await flush();
        await flush();
        const host = document.getElementById('pricelist-status-strip');
        expect(host.textContent).not.toContain('TRYB EDYCJI');
        expect(host.getAttribute('data-editing')).toBe('0');
        expect(document.getElementById('pricelist-body').getAttribute('data-pv-editing')).toBe('0');
    });

    it('PRECO ma własną nazwę osi (nie „Studnie")', async () => {
        const pv = mount();
        await pv.renderStatusStrip('pricelist-status-strip', 'preco');
        const host = document.getElementById('pricelist-status-strip');
        expect(host.textContent).toContain('PRECO');
    });
});
