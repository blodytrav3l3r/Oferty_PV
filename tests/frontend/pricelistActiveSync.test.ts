/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/* Sygnał „zmieniono obowiązujący cennik" między oknami/iframe: zmiana pinu
 * w #/cennik ma unieważnić cache etykiet w module rury/studnie (osobny window),
 * a 409 STALE_PRICELIST ma dać własny komunikat, nie „inny użytkownik edytuje".
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const CODE = fs.readFileSync(path.join(ROOT, 'public/js/shared/pricelistVersions.js'), 'utf8');

const LABELS = {
    versions: [{ id: 'v1', version: 'v1', seq: 1, effectiveFrom: '2026-01-01T00:00:00Z' }],
    activeIds: { rury: 'v1' }
};

function mount() {
    document.body.innerHTML = '';
    window.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => LABELS
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

describe('sygnał zmiany aktywnego cennika między oknami', () => {
    it('storage event unieważnia cache etykiet (fetch leci ponownie)', async () => {
        const pv = mount();
        await pv.fetchLabels('rury');
        await pv.fetchLabels('rury');
        expect(window.fetch).toHaveBeenCalledTimes(1); // cache działa

        window.dispatchEvent(new window.StorageEvent('storage', { key: 'pv-active-changed' }));
        await pv.fetchLabels('rury');
        expect(window.fetch).toHaveBeenCalledTimes(2); // cache wyczyszczony
    });

    it('obcy klucz w storage nie rusza cache', async () => {
        const pv = mount();
        await pv.fetchLabels('rury');
        window.dispatchEvent(new window.StorageEvent('storage', { key: 'cos-innego' }));
        await pv.fetchLabels('rury');
        expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it('zmiana wersji rozgłasza sygnał (zapis do localStorage pod wspólnym kluczem)', () => {
        // Odbioru w tym samym dokumencie nie da się odegrać — jsdom nie odpala
        // `storage` w oknie, które zapisało. Kontrakt wysyłania: po akcji na
        // wersji leci ping, a odbiorca nasłuchuje tego samego klucza.
        expect(CODE).toMatch(
            /function afterVersionChange\(type, opts\) \{[\s\S]{0,200}broadcastActiveChange\(\);/
        );
        expect(CODE).toContain('localStorage.setItem(ACTIVE_PING_KEY');
        expect(CODE).toContain("addEventListener('storage'");
        expect(CODE).toContain('e.key !== ACTIVE_PING_KEY');
    });
});

describe('409 STALE_PRICELIST ma własny komunikat', () => {
    const rury = fs.readFileSync(path.join(ROOT, 'public/js/rury/offerCrud.js'), 'utf8');
    const studnie = fs.readFileSync(path.join(ROOT, 'public/js/studnie/offerSave.js'), 'utf8');

    it('gałąź STALE_PRICELIST przed gałęzią konfliktu wersji (rury + studnie)', () => {
        for (const src of [rury, studnie]) {
            const stale = src.indexOf("err.code === 'STALE_PRICELIST'");
            const conflict = src.indexOf('isVersionConflict(err)');
            expect(stale).toBeGreaterThan(-1);
            expect(conflict).toBeGreaterThan(-1);
            expect(stale).toBeLessThan(conflict);
        }
    });

    it('komunikat mówi o cenniku, nie o innym użytkowniku', () => {
        for (const src of [rury, studnie]) {
            expect(src).toContain('Cennik obowiązujący się zmienił');
        }
    });
});
