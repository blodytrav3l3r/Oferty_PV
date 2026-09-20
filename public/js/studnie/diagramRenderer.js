// @ts-check
/**
 * diagramRenderer.js — Główna funkcja renderująca diagram studni oraz podświetlanie SVG.
 *
 * Wyodrębnione z wellDiagram.js (faza 2 refaktoryzacji).
 * Ładowany jako ostatni z grupy diagram-*.
 *
 * Zawiera:
 *   renderWellDiagram()        — główna funkcja renderowania schematu studni
 *   window.highlightSvg()      — podświetla elementy SVG
 *   window.unhighlightSvg()    — usuwa podświetlenie
 *   window.svgPointerEnter()   — hover na elemencie konfiguracji
 *   window.svgPointerLeave()   — koniec hovera konfiguracji
 *   window.svgPrzPointerEnter() — hover na przejściu
 *   window.svgPrzPointerLeave() — koniec hovera przejścia
 *   window.svgPrzPointerClick() — trwała selekcja przejścia (klik)
 *
 * Zależności globalne:
 *   SVG_COLORS (diagramTheme.js)
 *   enforceOtRings, buildVisibleComponents, calculateCanvasParams,
 *   drawAllComponents, drawTransitions, drawPrecoInsertLine,
 *   drawSegmentDimensions, drawTotalHeightBar, drawDnLabel
 *   getCurrentWell, renderWellConfig
 */

/* ===== PODŚWIETLANIE SVG ===== */

/**
 * Rozwiązuje cel podświetlenia przejścia.
 * Preferuje stabilne pr.id (string, globalnie unikalne — niezależne od
 * sortowania/filtrowania); legacy indeks liczbowy mapuje na id przez
 * bieżącą studnię z fallbackiem na data-prz-idx.
 * @param {string|number} arg id przejścia lub legacy indeks
 * @returns {{ przId: string|null, legacyIdx: number|null }}
 */
function resolvePrzTarget(arg) {
    if (typeof arg === 'string' && arg !== '') {
        if (!/^-?\d+$/.test(arg.trim())) return { przId: arg, legacyIdx: null };
        arg = parseInt(arg, 10);
    }
    if (typeof arg === 'number' && !isNaN(arg)) {
        let list = [];
        try {
            const w = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
            if (w && Array.isArray(w.przejscia)) list = w.przejscia;
        } catch (_e) {}
        const found = list[arg] && list[arg].id != null ? String(list[arg].id) : null;
        return { przId: found, legacyIdx: arg };
    }
    return { przId: null, legacyIdx: null };
}

/**
 * Przełącza podświetlenie przejścia na wszystkich listach: kafelki
 * konfiguratora, kafelki zlecenia (zl-przejscia-list) oraz 4 komórki
 * Excela. Bez scrollowania — hover to akcja chwilowa. JS tylko
 * przełącza klasy CSS, bez inline stylingu.
 */
function setPrzHighlight(arg, on) {
    if (typeof document === 'undefined') return;
    const target = resolvePrzTarget(arg);
    if (!target.przId && target.legacyIdx === null) return;
    document.querySelectorAll('.prz-tile[data-prz-id]').forEach((el) => {
        let match = false;
        if (target.przId) {
            match = el.getAttribute('data-prz-id') === target.przId;
        } else {
            match = el.getAttribute('data-prz-idx') === String(target.legacyIdx);
        }
        if (match) el.classList.toggle('prz-tile--svg-hover', on);
    });
    const overlay =
        typeof document.getElementById === 'function'
            ? document.getElementById('excel-table-overlay')
            : null;
    if (overlay && target.przId) {
        let matched = 0;
        let candidates = 0;
        overlay.querySelectorAll('td[data-prz-id]').forEach((td) => {
            candidates++;
            if (td.getAttribute('data-prz-id') === target.przId) {
                td.classList.toggle('excel-tr-hover', on);
                matched++;
            }
        });
        // Diagnostyka rozjazdu ID (tylko za flagą — zero szumu produkcyjnie).
        if (matched === 0 && on && typeof window !== 'undefined' && window.__SOK_DEBUG) {
            let wellId = null;
            try {
                const w = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
                wellId = w && w.id != null ? w.id : null;
            } catch (_e) {}
            let gCount = 0;
            try {
                document.querySelectorAll('g[data-prz-id]').forEach((el) => {
                    if (el.getAttribute('data-prz-id') === target.przId) gCount++;
                });
            } catch (_e2) {}
            if (typeof console !== 'undefined' && typeof console.debug === 'function') {
                console.debug('[SOK Excel Hover] brak dopasowania TD', {
                    przejscieId: target.przId,
                    wellId,
                    tdCandidates: candidates,
                    gCount,
                    currentWellIndex:
                        typeof currentWellIndex !== 'undefined' ? currentWellIndex : null
                });
            }
        }
    }
}

/**
 * Ustawia filtr podświetlenia na samym kształcie SVG przejścia (<g>).
 * Dopasowanie po data-prz-id (porównanie atrybutu — brak ryzyka iniekcji
 * selektora); legacy indeks liczbowy po klasie .svg-prz-N.
 */
function setPrzSvgFilter(arg, value) {
    if (typeof document === 'undefined') return;
    const target = resolvePrzTarget(arg);
    if (!target.przId && target.legacyIdx === null) return;
    if (target.przId) {
        document.querySelectorAll('g[data-prz-id]').forEach((el) => {
            if (el.getAttribute('data-prz-id') === target.przId) el.style.filter = value;
        });
    } else {
        document.querySelectorAll('.svg-prz-' + target.legacyIdx).forEach((el) => {
            el.style.filter = value;
        });
    }
}

window.highlightSvg = function (type, index) {
    if (type === 'prz') {
        // Sam kształt na podglądzie + odpowiednik na liście.
        setPrzSvgFilter(
            index,
            'drop-shadow(0px 0px 8px rgba(var(--blue-hover-rgb), 0.9)) brightness(1.3)'
        );
        setPrzHighlight(index, true);
        return;
    }
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter =
            'drop-shadow(0px 0px 8px rgba(var(--blue-hover-rgb), 0.9)) brightness(1.3)';
    });

    // Automatycznie podświetl odpowiedni kafel listy
    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    }
};
window.unhighlightSvg = function (type, index) {
    if (type === 'prz') {
        setPrzSvgFilter(index, '');
        setPrzHighlight(index, false);
        return;
    }
    document.querySelectorAll('.svg-' + type + '-' + index).forEach((el) => {
        el.style.filter = '';
    });

    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    }
};

window.svgPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return; // blokowanie hovera w trakcie ciągnięcia
    window.highlightSvg('cfg', idx);
};

window.svgPointerLeave = function (ev, idx) {
    window.unhighlightSvg('cfg', idx);
};

window.svgPrzPointerEnter = function (ev, idOrIdx) {
    if (window.svgDragStartIndex >= 0) return;
    window.highlightSvg('prz', idOrIdx);
};

window.svgPrzPointerLeave = function (ev, idOrIdx) {
    window.unhighlightSvg('prz', idOrIdx);
};

/* ===== TRWAŁA SELEKCJA PRZEJŚCIA (klik w podglądzie) =====
 * Hover jest chwilowy (znika przy mouseleave) i działa tylko przy otwartym
 * Excelu — klik daje trwałą selekcję: kształt + kafelek + 4 komórki Excela
 * (klasa .excel-tr-selected) + scroll do pierwszej komórki. Drugi klik
 * na to samo przejście zdejmuje selekcję. Osobne klasy niż hover, więc
 * svgPrzPointerLeave selekcji nie rusza. */

if (typeof window !== 'undefined' && window.__przSelectedId === undefined) {
    window.__przSelectedId = null;
}

/**
 * Przełącza trwałą selekcję przejścia na wszystkich listach.
 * @param {string|null} przId id przejścia lub null (zdjęcie selekcji)
 * @returns {number} liczba dopasowanych komórek TD w Excelu
 */
function setPrzSelected(przId) {
    if (typeof document === 'undefined') return 0;
    const prev = typeof window !== 'undefined' ? window.__przSelectedId : null;
    if (typeof window !== 'undefined') window.__przSelectedId = przId;
    // Zdejmij starą selekcję.
    document.querySelectorAll('.prz-tile--svg-selected').forEach((el) => {
        el.classList.remove('prz-tile--svg-selected');
    });
    document.querySelectorAll('td.excel-tr-selected').forEach((td) => {
        td.classList.remove('excel-tr-selected');
    });
    if (prev) setPrzSvgFilter(prev, '');
    if (!przId) return 0;
    // Załóż nową.
    document.querySelectorAll('.prz-tile[data-prz-id]').forEach((el) => {
        if (el.getAttribute('data-prz-id') === przId) el.classList.add('prz-tile--svg-selected');
    });
    setPrzSvgFilter(
        przId,
        'drop-shadow(0px 0px 8px rgba(var(--blue-hover-rgb), 0.9)) brightness(1.3)'
    );
    let matched = 0;
    const overlay =
        typeof document.getElementById === 'function'
            ? document.getElementById('excel-table-overlay')
            : null;
    if (overlay) {
        overlay.querySelectorAll('td[data-prz-id]').forEach((td) => {
            if (td.getAttribute('data-prz-id') === przId) {
                td.classList.add('excel-tr-selected');
                matched++;
            }
        });
    }
    return matched;
}

/**
 * Szuka studni (indeks w wells) zawierającej przejście o danym id.
 * @param {string} przId
 * @returns {number} indeks w wells lub -1
 */
function findWellIndexByPrzId(przId) {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return -1;
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (
            w &&
            Array.isArray(w.przejscia) &&
            w.przejscia.some((p) => p && String(p.id) === String(przId))
        ) {
            return i;
        }
    }
    return -1;
}

window.svgPrzPointerClick = function (ev, idOrIdx) {
    if (typeof window !== 'undefined' && window.svgDragStartIndex >= 0) return;
    const target = resolvePrzTarget(idOrIdx);
    if (!target.przId) return;
    const przId = target.przId;
    // Toggle: drugi klik zdejmuje selekcję.
    if (typeof window !== 'undefined' && window.__przSelectedId === przId) {
        setPrzSelected(null);
        return;
    }
    let matched = setPrzSelected(przId);
    const overlay =
        typeof document !== 'undefined' && typeof document.getElementById === 'function'
            ? document.getElementById('excel-table-overlay')
            : null;
    if (!overlay) return;
    if (matched === 0) {
        /* Wiersz studni niewidoczny — zwykle inny tab DN (modal otwiera się
           zawsze na DN_TABS[0], a s1 może być na innym). Przełącz na tab
           studni-właściciela i załóż selekcję ponownie. */
        const wIdx = findWellIndexByPrzId(przId);
        if (wIdx >= 0 && typeof excelSwitchTab === 'function') {
            const w = wells[wIdx];
            const tab = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            excelSwitchTab(tab);
            matched = setPrzSelected(przId);
        }
    }
    if (matched > 0) {
        const first = overlay.querySelector('td[data-prz-id].excel-tr-selected');
        if (first) {
            if (typeof first.scrollIntoView === 'function') {
                try {
                    first.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                } catch (_e) {}
            }
            const inp = first.querySelector('input, select');
            if (inp && typeof inp.focus === 'function') {
                try {
                    inp.focus({ preventScroll: true });
                } catch (_e2) {}
            }
        }
    }
};

/* ===== GŁÓWNA FUNKCJA RENDEROWANIA SCHEMATU ===== */

function renderWellDiagram(targetSvg, targetWell) {
    const well = targetWell || (typeof getCurrentWell === 'function' ? getCurrentWell() : null);

    /* Backfill stabilnych id przejść dla danych legacy (np. zamówienia
       zapisane przed ensurePrzejsciaIds — SA/ZS/000050/2026 ma wszystkie
       pr.id === undefined). Bez id <g> dostaje puste data-prz-id i hover
       SVG → Excel/kafelki jest martwy (resolvePrzTarget('') → null).
       Idempotentne — jeden guard tutaj naprawia wszystkie ~38 callerów
       (konfigurator, zlecenia, Excel), zamiast łatać każde miejsce. */
    if (well && Array.isArray(well.przejscia) && typeof ensurePrzejsciaIds === 'function') {
        try {
            ensurePrzejsciaIds(well.przejscia);
        } catch (_e) {}
    }

    // BEZWZGLĘDNA REGUŁA: zamień zwykłe kręgi na wiercone i na odwrót w zależności od przejść
    if (well && typeof enforceOtRings === 'function') {
        try {
            /* Wyczyść cache produktów PRZED enforceOtRings — inaczej stare ID
               w cache maskują zamianę krag↔krag_ot i diagram rysuje stary typ. */
            if (typeof _excelClearResCache === 'function') _excelClearResCache(well);
            let _didMutate = false;
            try {
                _didMutate = enforceOtRings(well);
            } catch (_e2) {}
            if (_didMutate) {
                /* Drugi clear PO mutacji — nowy productId (krag_ot) nie był w cache,
                   stary cache dla krag maskowałby nowy typ w buildVisibleComponents. */
                if (typeof _excelClearResCache === 'function') _excelClearResCache(well);
                /* Config zmutowany (krag↔krag_ot) — odśwież listę kafelków i Excel */
                if (typeof renderWellConfig === 'function') renderWellConfig();
                if (
                    typeof document !== 'undefined' &&
                    document.getElementById('excel-table-overlay') &&
                    typeof _excelRenderTable === 'function' &&
                    typeof _excelActiveTab !== 'undefined'
                ) {
                    _excelRenderTable(_excelActiveTab);
                }
            }
        } catch (_e) {}
    }

    const svg = targetSvg || document.getElementById('well-diagram');

    if (!svg) return;

    if (!well || well.config.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `
      <text x="150" y="240" text-anchor="middle" style="fill:${SVG_COLORS.dnLabel}" font-size="13" font-family="Inter,sans-serif">Dodaj elementy</text>
      <text x="150" y="260" text-anchor="middle" style="fill:${SVG_COLORS.emptyState}" font-size="11" font-family="Inter,sans-serif">aby zobaczyć podgląd</text>`;
        return;
    }

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config
    const visible = buildVisibleComponents(well);

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" style="fill:${SVG_COLORS.dnLabel}" font-size="12">Brak elementów z wysokością</text>`;
        return;
    }

    const bodyDN = well.dn;
    const canvas = /** @type {any} */ (calculateCanvasParams(visible, bodyDN));
    canvas.bodyDN = bodyDN;

    svg.setAttribute('viewBox', `0 0 ${canvas.svgW} ${canvas.svgH}`);

    // Rysowanie elementów studni (kręgi, płyty, konus, dennica, itp.)
    const { svg: componentsSvg, dimLinesY } = drawAllComponents(visible, canvas);

    // Rysowanie przejść (rury)
    const transitionsSvg = drawTransitions(well, canvas, dimLinesY);

    // Linia wysokości wkładki PRECO (przerywana czerwona)
    const precoLineSvg = drawPrecoInsertLine(well, canvas);

    // Zunifikowana linia wymiarowa segmentów
    const segmentDimSvg = drawSegmentDimensions(dimLinesY, canvas.pxMm);

    // Łączna wysokość studni (pasek po lewej)
    const totalHeightSvg = drawTotalHeightBar(canvas, canvas.totalMm);

    // Oznaczenie DN na dole
    const dnLabelSvg = drawDnLabel(canvas.cx, bodyDN, canvas);

    svg.innerHTML =
        componentsSvg + transitionsSvg + precoLineSvg + segmentDimSvg + totalHeightSvg + dnLabelSvg;

    /* Re-render czyści style inline kształtów — odtwórz trwałą selekcję
       (klasy kafelków/TD też mogły zniknąć przy ich własnych renderach).
       Nieistniejące już id (usunięte przejście) czyści selekcję. */
    if (typeof window !== 'undefined' && window.__przSelectedId) {
        const stillThere =
            well &&
            Array.isArray(well.przejscia) &&
            well.przejscia.some((p) => p && String(p.id) === String(window.__przSelectedId));
        setPrzSelected(stillThere ? window.__przSelectedId : null);
    }
}

/* ===== Rejestracja globali ===== */
window.renderWellDiagram = renderWellDiagram;
