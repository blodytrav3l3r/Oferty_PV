import * as fs from 'fs';

describe('Kartoteka Zleceń — responsywność', () => {
    test('768px ukrywa kolumny Element, Wygenerował, Data', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?display\s*:\s*none/);
        expect(mqMatch).not.toBeNull();
    });

    test('600px zmienia zlecenia-stats na 1 kolumnę', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*600px\)[\s\S]*?\.zlecenia-stats[\s\S]*?grid-template-columns\s*:\s*1fr/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('768px rozciąga zakładki statusu (pasek filtrów zawija)', () => {
        const css = fs.readFileSync('public/css/zlecenia.css', 'utf-8');
        const mqMatch = css.match(
            /@media\s*\(max-width:\s*768px\)[\s\S]*?\.zlecenia-filter-tab[\s\S]*?flex\s*:\s*1 1 auto/
        );
        expect(mqMatch).not.toBeNull();
    });

    test('pasek filtrów zleceń używa układu kartoteki', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        expect(html).toContain('class="kartoteka-filter-bar zlecenia-filter-bar"');
        expect(html).toContain('class="ka-search-row"');
        expect(html).toContain('ka-filter-row ka-filter-row--secondary');
        expect(html).not.toContain('zlecenia-virtual-toolbar');
    });

    test('kafelki podsumowania są w pierwszym rzędzie, obok statusów', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        const statsIdx = html.indexOf('id="zlecenia-stats"');
        expect(statsIdx).toBeGreaterThan(html.indexOf('data-filter="accepted"'));
        expect(statsIdx).toBeLessThan(html.indexOf('ka-filter-row ka-filter-row--secondary'));
    });

    test('zlecenia.html ma .zlecenia-page', () => {
        const html = fs.readFileSync('public/zlecenia.html', 'utf-8');
        expect(html).toContain('class="zlecenia-page"');
    });

    test('hover paska filtrów nie gasi aktywnego przycisku', () => {
        const css = fs.readFileSync('public/css/style.responsive.css', 'utf-8');
        expect(css).toContain('.kartoteka-filter-bar button:not(.active):hover');
        expect(css).not.toMatch(/\.kartoteka-filter-bar button:hover\s*\{/);
    });

    test('presety dat podświetlają się według wartości pól', () => {
        const js = fs.readFileSync('public/js/spa/zlecenia.js', 'utf-8');
        expect(js).toContain('function syncDatePresetState()');
        expect(js).toContain("btn.classList.toggle('active', isActive)");
        expect(js).toContain('syncDatePresetState();');
    });
});

describe('Kartoteka — podświetlanie aktywnych filtrów', () => {
    test('wszystkie typy przycisków filtra mają styl aktywnego stanu', () => {
        const css = fs.readFileSync('public/css/style.responsive.css', 'utf-8');
        expect(css).toContain('.kartoteka-filter-bar .ka-followup-filter-btn.active');
        expect(css).toContain('.kartoteka-filter-bar .ka-hide-paused-btn.active');
    });

    test('każde ładowanie ofert synchronizuje stan przycisków', () => {
        const js = fs.readFileSync('public/js/kartoteka/kartotekaSearch.js', 'utf-8');
        const loadFn = js.slice(
            js.indexOf('async loadLocalOffers()'),
            js.indexOf('onSearchInput()')
        );
        expect(loadFn).toContain('this._syncFilterUI();');
    });
});

describe('Zlecenia — licznik wydruków', () => {
    test('konflikt wersji (409) przy liczniku pokazuje toast', () => {
        const js = fs.readFileSync('public/js/spa/zlecenia.js', 'utf-8');
        const idx = js.indexOf("'status' in error");
        expect(idx).toBeGreaterThan(-1);
        const block = js.slice(idx, idx + 400);
        expect(block).toContain('status === 409');
        expect(block).toContain('showToast(');
    });

    test('błąd HTTP niesie kod statusu (httpError)', () => {
        const js = fs.readFileSync('public/js/spa/zlecenia.js', 'utf-8');
        expect(js).toContain('function httpError(res)');
        expect(js).toContain('throw httpError(res);');
        expect(js).not.toContain("throw new Error('HTTP ' + res.status);");
    });
});
