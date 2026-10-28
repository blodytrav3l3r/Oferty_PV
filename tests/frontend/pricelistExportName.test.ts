/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/* Nazwa pliku eksportu cennika: serwer wysyła ją w Content-Disposition
 * (numer cennika w nazwie), FE nie nadpisuje jej generykiem.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const CODE = fs.readFileSync(path.join(ROOT, 'public/js/shared/pricelistVersions.js'), 'utf8');

function mount() {
    document.body.innerHTML = '';
    window.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
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

const resWith = (cd) => ({ headers: { get: (h) => (h === 'Content-Disposition' ? cd : null) } });

describe('nazwa pliku eksportu cennika', () => {
    it('bierze nazwę z Content-Disposition (numer cennika w środku)', () => {
        const pv = mount();
        expect(
            pv.downloadNameFrom(
                resWith('attachment; filename="Cennik_Rury_Rv1-20260927_Export.xlsx"'),
                'Cennik_Rury_Export.xlsx'
            )
        ).toBe('Cennik_Rury_Rv1-20260927_Export.xlsx');
    });

    it('bez nagłówka → fallback (starszy BE nie psuje pobrania)', () => {
        const pv = mount();
        expect(pv.downloadNameFrom(resWith(null), 'Cennik_Rury_Export.xlsx')).toBe(
            'Cennik_Rury_Export.xlsx'
        );
        expect(pv.downloadNameFrom({}, 'Cennik_Studni_Export.xlsx')).toBe(
            'Cennik_Studni_Export.xlsx'
        );
    });

    it('wszystkie trzy eksportery używają nazwy z serwera', () => {
        for (const file of [
            'public/js/rury/pricelistUi.js',
            'public/js/studnie/pricelistImportExport.js',
            'public/js/studnie/pricelistPreco.js'
        ]) {
            const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
            expect(src).toContain('downloadNameFrom');
        }
    });
});
