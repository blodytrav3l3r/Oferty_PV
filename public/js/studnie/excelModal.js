// @ts-check
/* ===== EXCEL MODAL — Otwarzanie/zamykanie tabeli konfiguracyjnej studni ===== */

function _excelOnFocusInRow(e) {
    const row = e.target.closest('tr[data-widx]');
    if (!row) return;
    const wIdx = parseInt(row.getAttribute('data-widx'), 10);
    if (!isNaN(wIdx) && (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)) {
        excelSelectRow(wIdx);
    }
}

function _excelOnClickCell(e) {
    if (e.target.closest('button')) return;
    const td = e.target.closest('td');
    const row = e.target.closest('tr[data-widx]');
    if (!row || !td) return;
    const wIdx = parseInt(row.getAttribute('data-widx'), 10);
    if (isNaN(wIdx)) return;
    const colIdx = Array.from(row.children).indexOf(td);
    if (e.shiftKey) {
        e.stopPropagation();
        _excelSelectCell(wIdx, colIdx, false, true);
        return;
    }
    if (e.ctrlKey) {
        e.stopPropagation();
        _excelSelectCell(wIdx, colIdx, true, false);
        return;
    }
    _excelSelectCell(wIdx, colIdx, false, false);
    if (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex) {
        excelSelectRow(wIdx);
    }
}

function _excelRegisterExcelListeners() {
    const container = document.getElementById('excel-table-container');
    if (!container || /** @type {any} */ (container)._excelListenersAttached) return;
    /** @type {any} */ (container)._excelListenersAttached = true;
    const _arrowHandler = function (e) {
        const tgt = e.target;
        if (!tgt || !container.contains(tgt)) return;
        if (!e.key.startsWith('Arrow')) return;
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        _excelHandleArrow(e);
    };
    document.addEventListener('keydown', _arrowHandler, true);
    /** @type {any} */ (container)._arrowHandler = _arrowHandler;
    container.addEventListener('focusin', _excelOnFocusInRow);
    container.addEventListener('click', _excelOnClickCell);
    document.addEventListener('copy', _excelHandleCopy);
    document.addEventListener('cut', _excelHandleCut);
    container.addEventListener('paste', _excelHandlePaste, true);
    container.addEventListener('keydown', _excelHandleKeydown);
    container.addEventListener('change', _excelOnRowSelectChange);
    container.addEventListener('mousedown', _excelOnMouseDown);
    document.addEventListener('mousemove', _excelOnMouseMove);
    document.addEventListener('mouseup', _excelOnMouseUp);
    if (!document.getElementById('excel-focus-overlay')) {
        const ov = document.createElement('div');
        ov.id = 'excel-focus-overlay';
        ov.style.cssText =
            'position:fixed;pointer-events:none;z-index:' +
            LAYERS.FOCUS_OVERLAY +
            ';border:2px solid rgba(var(--accent-rgb), 0.8);border-radius:3px;box-sizing:border-box;display:none;transition:all 0.1s ease;box-shadow:0 0 0 1px rgba(var(--black-rgb), 0.3);';
        document.body.appendChild(ov);
        _excelFocusOverlayEl = ov;
    } else {
        _excelFocusOverlayEl = document.getElementById('excel-focus-overlay');
        _excelFocusOverlayEl.style.display = 'none';
    }
    container.addEventListener('focusin', _excelOnFocusIn);
    container.addEventListener('focusout', _excelOnFocusOut);
    document.addEventListener('scroll', _excelOnOverlayScroll, true);
    window.addEventListener('resize', _excelOnOverlayScroll);
}

function _excelUnregisterExcelListeners() {
    const overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;
    if (/** @type {any} */ (overlay)._resizeHandler) {
        window.removeEventListener('resize', /** @type {any} */ (overlay)._resizeHandler);
    }
    const _container = document.getElementById('excel-table-container');
    if (_container && /** @type {any} */ (_container)._arrowHandler) {
        document.removeEventListener(
            'keydown',
            /** @type {any} */ (_container)._arrowHandler,
            true
        );
    }
    document.removeEventListener('copy', _excelHandleCopy);
    document.removeEventListener('cut', _excelHandleCut);
    if (_container) _container.removeEventListener('paste', _excelHandlePaste, true);
    if (_container) _container.removeEventListener('mousedown', _excelOnMouseDown);
    document.removeEventListener('mousemove', _excelOnMouseMove);
    document.removeEventListener('mouseup', _excelOnMouseUp);
    if (_container) {
        _container.removeEventListener('focusin', _excelOnFocusIn);
        _container.removeEventListener('focusout', _excelOnFocusOut);
        _container.removeEventListener('focusin', _excelOnFocusInRow);
        _container.removeEventListener('click', _excelOnClickCell);
        _container.removeEventListener('change', _excelOnRowSelectChange);
        _container.removeEventListener('keydown', _excelHandleKeydown);
    }
    document.removeEventListener('scroll', _excelOnOverlayScroll, true);
    window.removeEventListener('resize', _excelOnOverlayScroll);
    if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
}

function openExcelTableModal() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) {
        window.wells = [];
    }

    /* Wyczyść puste przejścia przy otwarciu (PRZED obliczeniem maxTr) */
    if (typeof wells !== 'undefined') {
        for (let _rwo = 0; _rwo < wells.length; _rwo++) {
            _excelCleanEmptyPrzejscia(wells[_rwo]);
        }
    }

    /* Inicjalizuj _excelMaxTransitions dla WSZYSTKICH zakładek */
    const _allTabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    _allTabs.forEach(function (t) {
        const _tw =
            typeof wells !== 'undefined' && Array.isArray(wells)
                ? wells.filter(function (w) {
                      return _excelWellMatchesTab(w, t);
                  })
                : [];
        const _tm = _tw.reduce(function (m, w) {
            return w.przejscia && w.przejscia.length > m ? w.przejscia.length : m;
        }, 0);
        _excelMaxTransitions[t] = Math.max(1, _tm);
    });

    /* Zainicjuj stan — brak zmian */
    _excelDirty = false;

    const existing = document.getElementById('excel-table-overlay');
    if (existing) {
        /* Wyczyść stary capture handler przed usunięciem overlay */
        const _oldContainer = document.getElementById('excel-table-container');
        if (_oldContainer && /** @type {any} */ (_oldContainer)._arrowHandler) {
            document.removeEventListener(
                'keydown',
                /** @type {any} */ (_oldContainer)._arrowHandler,
                true
            );
        }
        /* Wyczyść stary capture paste handler */
        if (_oldContainer) {
            _oldContainer.removeEventListener('paste', _excelHandlePaste, true);
        }
        existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'excel-table-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Tabela konfiguracyjna studni');

    // Pozycjonuj overlay między górnym banerem a dolnym paskiem, przylegający do lewego panelu
    _excelPositionOverlay(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeExcelTableModal();
    });
    overlay.addEventListener('keydown', (e) => {
        /* Ctrl+S = zapisz i zamknij (jak przycisk "Gotowe") — blokuje też
           przeglądarkowe "Zapisz stronę" (dashboard.js:97 nie robi preventDefault
           przy focusie w inpucie). */
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof excelSaveAll === 'function') excelSaveAll();
            return;
        }
        /* Ctrl+R: w kontenerze robi to _excelHandleKeydown (fill right);
           poza kontenerem (wyszukiwarka) blokujemy refresh przeglądarki. */
        if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
            if (!e.defaultPrevented) e.preventDefault();
            return;
        }
        if (e.key !== 'Escape') return;
        const t = /** @type {EventTarget | null} */ (e.target);
        /* Esc 1×: wyjście z edycji komórki (anuluj, nie zamykaj modala) */
        if (
            t instanceof HTMLElement &&
            t.closest('#excel-table-container') &&
            (t.tagName === 'INPUT' || t.tagName === 'SELECT')
        ) {
            e.preventDefault();
            e.stopPropagation();
            /** @type {HTMLElement} */ (t).blur();
            _excelResetLayoutDependentState();
            return;
        }
        /* Esc 1×: wyczyść wyszukiwarkę gdy aktywny filtr */
        const si = document.getElementById('excel-search-input');
        if (t === si && si && si.value) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof excelClearSearch === 'function') excelClearSearch();
            return;
        }
        /* Esc 1×: usuń zaznaczenie komórek/kolumn */
        if (_excelSelectedCells.length > 0 || _excelSelectedCols.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            _excelResetLayoutDependentState();
            return;
        }
        closeExcelTableModal();
    });

    /* Nasłuchuj resize — odśwież pozycjonowanie */
    const _resizeHandler = function () {
        _excelPositionOverlay(overlay);
    };
    window.addEventListener('resize', _resizeHandler);
    /* Zapisz handler do usunięcia przy close */
    /** @type {any} */ (overlay)._resizeHandler = _resizeHandler;

    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isDiagramVisible = diagramPanel && diagramPanel.offsetParent !== null;
    const modal = document.createElement('div');
    if (isDiagramVisible) {
        modal.style.cssText =
            'width:calc(100% - 1rem);height:calc(100% - 1rem);background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.05);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(var(--black-rgb), 0.8);';
    } else {
        modal.style.cssText =
            'width:96vw;height:96vh;background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.05);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(var(--black-rgb), 0.8);';
    }

    modal.innerHTML = `
        <style>
            #excel-table-overlay .excel-toolbar-btn { flex:0 1 auto; min-width:8.5rem; justify-content:center; white-space:nowrap; text-align:center; }
            #excel-table-overlay ::-webkit-scrollbar { width:8px; height:10px; }
            #excel-table-overlay ::-webkit-scrollbar-track { background:rgba(var(--white-rgb), 0.05); }
            #excel-table-overlay ::-webkit-scrollbar-thumb { background:rgba(var(--white-rgb), 0.3); border-radius:4px; }
            #excel-table-overlay ::-webkit-scrollbar-thumb:hover { background:rgba(var(--white-rgb), 0.3); }
            #excel-table-overlay ::-webkit-scrollbar-corner { background:transparent; }
            #excel-table-container td:focus-within { box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb), 0.3) !important; }
            #excel-table-container td.excel-col-selected { outline:2px solid rgba(var(--accent-rgb), 0.3); outline-offset:-2px; }
            #excel-table-container td.excel-col-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.cell-selected { outline:2px solid rgba(var(--accent-rgb), 0.5); outline-offset:-2px; background:rgba(var(--accent-rgb), 0.05); }
            #excel-table-container td.cell-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.drag-preview { outline:2px dashed rgba(var(--accent-rgb), 0.5); outline-offset:-2px; background:rgba(var(--accent-rgb), 0.05); }
            #excel-table-container td.drag-preview .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container th.excel-col-selected { background:rgba(var(--accent-rgb), 0.3) !important; box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb), 0.3); }
            #excel-table-container .h3-prodcode { font-size:0.5rem;font-weight:600;color:var(--slate-400);line-height:1.45; }
            #excel-table-container .h3-prodprice { font-size:0.55rem;color:var(--success-hover);font-weight:700;line-height:1.4;white-space:nowrap;background:rgba(var(--success-rgb), 0.05);border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block; }
            #excel-table-container tbody tr:hover { background:rgba(var(--white-rgb), 0.05); }
            #excel-table-container .excel-resize-handle { width:4px !important;background:rgba(var(--white-rgb), 0.1); }
            #excel-table-container .excel-resize-handle:hover { background:rgba(var(--accent-rgb), 0.5) !important; }
            #excel-table-container .excel-sel-wrap.disabled { opacity:.35;pointer-events:none; }
            #excel-table-container thead { position:sticky;top:0;z-index:${LAYERS_EXCEL.STICKY_THEAD};background:var(--slate-950);isolation:isolate; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:var(--slate-950);border-bottom:1px solid rgba(var(--white-rgb), 0.05);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:var(--success);"></i>
                <span style="font-size:0.75rem;font-weight:700;color:var(--slate-200);letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:var(--slate-500);padding:0.1rem 0.5rem;background:rgba(var(--white-rgb), 0.05);border-radius:3px;"></span>
                <span id="excel-selection-summary" style="display:none;font-size:0.6rem;color:var(--accent-text);padding:0.1rem 0.5rem;background:rgba(var(--white-rgb), 0.05);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">

                <div style="position:relative;display:flex;align-items:center;">
                    <input type="text" id="excel-search-input" placeholder="Szukaj studni..." oninput="excelFilterWells(this.value)" aria-label="Szukaj studni" style="background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.1);border-radius:3px;padding:0.25rem 1.4rem 0.25rem 0.4rem;font-size:0.6rem;color:var(--slate-200);outline:none;width:220px;" />
                    <button type="button" id="excel-search-clear" onclick="excelClearSearch()" title="Wyczyść filtr" aria-label="Wyczyść filtr" style="display:none;position:absolute;right:4px;background:none;border:none;color:var(--slate-400);cursor:pointer;font-size:0.7rem;padding:2px;line-height:1;">✕</button>
                </div>
                <button onclick="_excelToggleColumnPopup()" id="excel-col-vis-btn" class="excel-toolbar-btn" title="Pokaż/ukryj kolumny" style="background:rgba(var(--accent2-rgb), 0.1);color:var(--accent2-hover);border:1px solid rgba(var(--accent2-rgb), 0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;display:flex;align-items:center;">Kolumny</button>
                <button onclick="openPrzejsciaVisibilityPopup('excel')" class="excel-toolbar-btn" title="Pokaż/ukryj typy przejść" style="background:rgba(var(--accent-rgb), 0.1);color:var(--accent-text);border:1px solid rgba(var(--accent-rgb), 0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;display:flex;align-items:center;">Przejścia</button>
                <button onclick="openExcelShortcutsPopup()" class="excel-toolbar-btn" title="Skróty klawiszowe" style="background:rgba(var(--accent-rgb), 0.1);color:var(--accent-text);border:1px solid rgba(var(--accent-rgb), 0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;display:flex;align-items:center;">Skróty</button>
                <button onclick="excelToggleFullscreen()" id="excel-fs-btn" class="excel-toolbar-btn" title="Pełny ekran / okno" style="background:rgba(var(--accent-rgb), 0.1);color:var(--accent-text);border:1px solid rgba(var(--accent-rgb), 0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;">Pełny</button>
                <button onclick="excelSaveAll()" id="excel-save-btn" class="excel-toolbar-btn" title="Zapisz wszystkie zmiany i zamknij" style="background:rgba(var(--success-rgb), 0.15);color:var(--success-hover);border:1px solid rgba(var(--success-rgb), 0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" title="Zamknij bez zapisywania" style="background:rgba(var(--danger-rgb), 0.1);color:var(--danger-hover);border:1px solid rgba(var(--danger-rgb), 0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:var(--slate-950);border-bottom:1px solid rgba(var(--white-rgb), 0.05);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:var(--slate-950);"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _excelRegisterExcelListeners();

    _excelLoadColumnVisibility();
    _excelLoadColWidths();
    /* Aktualne statusy konfiguracji przed renderem (podświetlenie wierszy F4) */
    if (typeof refreshAllWellErrors === 'function') refreshAllWellErrors();
    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    /* Nie zaznaczaj żadnego wiersza przy otwarciu — usuń aktywny styl z pierwszej studni */
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0) {
        const firstRow = document.querySelector(
            '#excel-table-container tr[data-widx="' + currentWellIndex + '"]'
        );
        if (firstRow) {
            const baseRef = firstRow.getAttribute('data-base-bg');
            if (baseRef) {
                firstRow.style.background = baseRef;
                firstRow.setAttribute('data-orig-bg', baseRef);
                /* Przywróć tło sticky kolumn */
                const stTds = firstRow.querySelectorAll('td:nth-child(-n+5)');
                const stSolid = firstRow.getAttribute('data-solid-bg') || 'var(--bg-primary)';
                stTds.forEach(function (td) {
                    td.style.background = _excelStickyCellBg(baseRef, stSolid);
                });
            }
        }
        currentWellIndex = -1;
    }
    _excelStopPolling();
    _excelStartPolling();
    _excelUpdateWellCount();
    /* Migracja autoSelect - wszystkie istniejace studnie dostaja default true */
    if (typeof wells !== 'undefined') {
        wells.forEach(function (w) {
            if (w && typeof w.autoSelect === 'undefined') w.autoSelect = true;
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

/* ===== CLOSE ===== */
let _excelClosing = false;

/* Fizyczne zamknięcie overlayu — wydzielone, by excelSaveAll mógł je wywołać bez rekurencji */
function _excelCloseOverlay() {
    _excelStopPolling();
    _excelUnregisterExcelListeners();
    _excelResetLayoutDependentState();
    if (typeof _excelResetSort === 'function') _excelResetSort();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        overlay.remove();
    }
    _excelDirty = false;
    _excelClosing = false;
}

async function closeExcelTableModal() {
    if (_excelClosing) return;
    _excelClosing = true;
    if (_excelDirty && typeof appConfirm === 'function') {
        const shouldSave = await appConfirm(
            'Są niezapisane zmiany. Czy zapisać przed zamknięciem?',
            {
                title: 'Niezapisane zmiany',
                okText: '<i data-lucide="save"></i> Zapisz i zamknij',
                cancelText: 'Zamknij bez zapisu',
                type: 'warning'
            }
        );
        if (shouldSave) {
            excelSaveAll();
            return;
        }
    }
    _excelCloseOverlay();
    if (typeof refreshAll === 'function') refreshAll();
}

/* ===== WYBÓR WIERSZA ===== */
function _excelUpdateLeftPreview(wIdx) {
    const well = typeof wells !== 'undefined' && wells[wIdx] ? wells[wIdx] : null;
    if (!well) return;
    if (typeof currentWellIndex !== 'undefined') {
        currentWellIndex = wIdx;
    }
    if (typeof renderWellDiagram === 'function') {
        renderWellDiagram();
    }
}

function excelSelectRow(wIdx) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const prevIdx = typeof currentWellIndex !== 'undefined' ? currentWellIndex : -1;
    currentWellIndex = wIdx;

    // Przywróć poprzedni wiersz do oryginalnego tła (z data-base-bg)
    if (prevIdx >= 0) {
        const prevRow = container.querySelector(`tr[data-widx="${prevIdx}"]`);
        if (prevRow) {
            const base = prevRow.getAttribute('data-base-bg');
            if (base) {
                prevRow.style.background = base;
                prevRow.setAttribute('data-orig-bg', base);
            }
            /* Przywróć tło sticky kolumn do base-bg */
            const prevStickyTds = prevRow.querySelectorAll('td:nth-child(-n+5)');
            const baseBg = prevRow.getAttribute('data-base-bg') || 'var(--bg-primary)';
            const prevSolid = prevRow.getAttribute('data-solid-bg') || 'var(--bg-primary)';
            prevStickyTds.forEach(function (td) {
                td.style.background = _excelStickyCellBg(baseBg, prevSolid);
            });
        }
    }

    // Zaznacz nowy aktywny wiersz - tylko tło, zero ramek
    const newRow = container.querySelector(`tr[data-widx="${wIdx}"]`);
    if (newRow) {
        const activeBg = newRow.getAttribute('data-active-bg');
        if (activeBg) {
            newRow.style.background = activeBg;
            newRow.setAttribute('data-orig-bg', activeBg);
            /* Zaktualizuj tło sticky kolumn (Lp, NrStudni, RzWlazu, RzDna, Wys) */
            const stickyTds = newRow.querySelectorAll('td:nth-child(-n+5)');
            const solidBg = newRow.getAttribute('data-solid-bg') || 'var(--bg-primary)';
            stickyTds.forEach(function (td) {
                td.style.background = _excelStickyCellBg(activeBg, solidBg);
            });
        }
    }

    _excelUpdateLeftPreview(wIdx);
    /* Aktualizuj h3 — kody produktów ZALEŻĄ od zaznaczonej studni */
    _excelUpdateHeaderProdCodes();
}

/* ===== Rejestracja globali ===== */
window.openExcelTableModal = openExcelTableModal;
