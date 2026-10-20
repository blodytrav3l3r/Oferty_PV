/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Podgląd wersji cennika: read-only modal, escape komórek, JSON jako tekst,
 * pusty stan i brak inline handlerów. Runtime w jsdom (bez sieci).
 */

import fs from 'fs';
import path from 'path';

const code = fs.readFileSync(
    path.join(process.cwd(), 'public/js/shared/pricelistVersionPreview.js'),
    'utf-8'
);

function escapeHtml(value: unknown): string {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function escapeHtmlAttr(value: unknown): string {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const preview = {
    version: {
        id: 'v1',
        version: 'v1',
        type: 'studnie',
        status: 'ACTIVE',
        effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    sheets: {
        DN1000: [
            { Indeks: 'K1', Nazwa: '<img src=x onerror="alert(1)">', Cena: 100 },
            { Indeks: 'K2', Nazwa: 'Krąg', Cena: { a: 1 } }
        ],
        Akcesoria: [{ Indeks: 'A1', Nazwa: 'Właz', Cena: 50 }]
    },
    counts: { totalRows: 3, bySheet: { DN1000: 2, Akcesoria: 1 } },
    totalRows: 3,
    truncated: false,
    precoIncluded: true,
    precoVersion: { id: 'p1', version: 'v1', seq: 1 }
};

function mount(): void {
    document.body.innerHTML = '';
    Object.assign(window, { escapeHtml, escapeHtmlAttr });
    window.showToast = jest.fn();
    window.lucide = { createIcons: jest.fn() };
    window.showModal = (opts: { id: string; html: string }) => {
        const overlay = document.createElement('div');
        overlay.id = opts.id;
        overlay.className = 'modal-overlay';
        overlay.innerHTML = opts.html;
        document.body.appendChild(overlay);
        return overlay;
    };
    window.pricelistVersions = {
        _apiJson: jest.fn().mockResolvedValue(preview),
        _authed: jest.fn().mockReturnValue({ method: 'GET', headers: {} }),
        openDiff: jest.fn()
    };
    new Function('window', 'document', code)(window, document);
}

describe('frontend: podgląd wersji', () => {
    beforeEach(mount);

    it('renderuje arkusze i escapuje HTML z danych', async () => {
        window.pricelistVersions.openPreview('v1', 'studnie');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const overlay = document.getElementById('pv-preview-modal');
        expect(overlay).not.toBeNull();
        expect(overlay.querySelector('img')).toBeNull();
        expect(overlay.innerHTML).toContain('&lt;img');
        expect(overlay.innerHTML).toContain('Akcesoria');
    });

    it('JSON w komórce renderuje jako tekst, nie HTML', async () => {
        window.pricelistVersions.openPreview('v1', 'studnie');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const overlay = document.getElementById('pv-preview-modal');
        expect(overlay.textContent).toContain('{"a":1}');
        expect(overlay.querySelector('table')).not.toBeNull();
    });

    it('pokazuje licznik, informację o PRECO i przełącza arkusze', async () => {
        window.pricelistVersions.openPreview('v1', 'studnie');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const overlay = document.getElementById('pv-preview-modal');
        expect(overlay.textContent).toContain('łącznie 3');
        expect(overlay.textContent).toContain('PRECO v1');
        const tabs = overlay.querySelectorAll('[data-pv-preview-sheet]');
        expect(tabs.length).toBe(2);
        tabs[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(overlay.textContent).toContain('Właz');
    });

    it('pusty stan bez arkuszy', async () => {
        window.pricelistVersions._apiJson.mockResolvedValueOnce({
            ...preview,
            sheets: {},
            totalRows: 0,
            counts: { totalRows: 0, bySheet: {} }
        });
        window.pricelistVersions.openPreview('v1', 'rury');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.getElementById('pv-preview-modal').textContent).toContain(
            'nie ma zapisanych wierszy'
        );
    });

    it('brak globalnego escapera nie wstrzykuje HTML (fallback fail-closed)', async () => {
        delete (window as unknown as Record<string, unknown>).escapeHtml;
        delete (window as unknown as Record<string, unknown>).escapeHtmlAttr;
        window.pricelistVersions.openPreview('v1', 'studnie');
        await new Promise((resolve) => setTimeout(resolve, 0));
        const overlay = document.getElementById('pv-preview-modal');
        expect(overlay.querySelector('img')).toBeNull();
        expect(overlay.innerHTML).toContain('&lt;img');
    });

    it('deep-link: wersja bez against otwiera podgląd, z against porównanie', () => {
        window.pricelistVersions.openFromDeepLink({ type: 'studnie', versionId: 'v1' });
        expect(window.pricelistVersions._apiJson).toHaveBeenCalledWith(
            '/api/pricelist-versions/v1/preview',
            expect.any(Object)
        );
        window.pricelistVersions.openFromDeepLink({
            type: 'studnie',
            versionId: 'v1',
            againstId: 'v0'
        });
        expect(window.pricelistVersions.openDiff).toHaveBeenCalledWith('v1', 'v0', 'studnie');
    });
});
