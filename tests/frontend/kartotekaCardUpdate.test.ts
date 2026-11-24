// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SEARCH_PATH = path.join(process.cwd(), 'public/js/kartoteka/kartotekaSearch.js');

function loadSearchModule() {
    const source = fs
        .readFileSync(SEARCH_PATH, 'utf8')
        .replace(/^import .*$/gm, 'const storageService = {};')
        .replace('export default', 'globalThis.__kartotekaSearch =');
    const context = { document, window } as unknown as Record<string, unknown>;
    vm.createContext(context);
    vm.runInContext(source, context);
    return context.__kartotekaSearch as Record<string, (...args: unknown[]) => unknown>;
}

describe('kartoteka single-card update', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="ka-offers-list">
                <div class="modern-offer-card" data-offer-id="other">Unchanged</div>
                <div class="modern-offer-card" data-offer-id="offer-1">Old card</div>
                <div class="load-more-container"><button id="ka-load-more-btn">Pokaż więcej</button></div>
            </div>
            <div id="ka-offer-count"></div>
        `;
    });

    test('replaces only the changed card and keeps other cards and pagination in place', () => {
        const search = loadSearchModule();
        search.searchResults = {
            items: [{ id: 'offer-1' }],
            totalCount: 5,
            hasMore: true
        };
        search.renderOffersList = () =>
            '<div class="modern-offer-card" data-offer-id="offer-1">Updated card</div>';

        expect(search.updateOfferCard('offer-1')).toBe(true);

        expect(document.querySelector('[data-offer-id="other"]')?.textContent).toBe('Unchanged');
        expect(document.querySelector('[data-offer-id="offer-1"]')?.textContent).toBe(
            'Updated card'
        );
        expect(document.getElementById('ka-load-more-btn')?.textContent).toBe('Pokaż więcej');
    });

    test('removes a deleted card without leaving an empty pagination control', () => {
        const search = loadSearchModule();
        search.searchResults = { items: [], totalCount: 0, hasMore: false };
        search.updateOfferCounter = jest.fn();

        search.updateSearchResultControls();
        expect(search.updateOfferCard('offer-1')).toBe(true);

        expect(document.querySelector('[data-offer-id="offer-1"]')).toBeNull();
        expect(document.getElementById('ka-load-more-btn')).toBeNull();
        expect(document.querySelector('.empty-muted')?.textContent).toBe(
            'Brak ofert pasujących do filtrów.'
        );
    });
});
