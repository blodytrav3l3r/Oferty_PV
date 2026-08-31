// @ts-check
/* ===== EXCEL MODAL — Otwarzanie/zamykanie tabeli konfiguracyjnej studni ===== */

function _excelOnFocusInRow(e) {
    if (e.target.closest('.excel-mode-btn, .excel-run-btn')) return;
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
            ';border:2px solid rgba(var(--accent-rgb), 0.8);border-radius: var(--radius-2xs);box-sizing:border-box;display:none;transition:all 0.1s ease;box-shadow:0 0 0 1px rgba(var(--black-rgb), 0.3);';
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
    if (/** @type {any} */ (overlay)._excelKeyHandler) {
        overlay.removeEventListener('keydown', /** @type {any} */ (overlay)._excelKeyHandler);
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

    /* Snapshot wells — "Zamknij bez zapisu" przywraca ten stan */
    _excelOpenSnapshot = structuredClone(wells);

    /* Każda sesja modala zaczyna czysty stack undo/redo — inaczej Ctrl+Z
       w nowej sesji przywraca przestarzałe wells z poprzedniej. */
    _excelUndoStack.length = 0;
    _excelRedoStack.length = 0;

    /* Wyczyść puste przejścia przy otwarciu (PRZED obliczeniem maxTr) */
    if (typeof wells !== 'undefined') {
        for (let _rwo = 0; _rwo < wells.length; _rwo++) {
            _excelCleanEmptyPrzejscia(wells[_rwo]);
        }
        // Normalizacja: uszczelki AUTO (jak w konfiguratorze) + rozbicie legacy qty>1 na N x qty1
        for (let _rwo = 0; _rwo < wells.length; _rwo++) {
            const _w = wells[_rwo];
            if (!_w || !_w.config) continue;
            // 1) Uszczelki auto
            if (typeof recalcGaskets === 'function') {
                try {
                    recalcGaskets(_w);
                } catch (_e) {}
            }
            // 2) Legacy expand qty>1 (np. AVR 5 jako jeden wpis) -> 5 x qty1
            //    Singular clamp pozostaje w _excelInsertConfigItem, tu tylko stackowalne.
            const singular = new Set([
                'wlaz',
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy',
                'plyta_redukcyjna',
                'uszczelka'
            ]);
            let needs = false;
            for (let _ci = 0; _ci < _w.config.length; _ci++) {
                if (_w.config[_ci].quantity > 1) {
                    const pr =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find(function (x) {
                                  return x.id === _w.config[_ci].productId;
                              })
                            : null;
                    if (pr && !singular.has(pr.componentType) && pr.componentType !== 'uszczelka') {
                        needs = true;
                        break;
                    }
                }
            }
            if (needs) {
                const _exp = [];
                for (let _ci = 0; _ci < _w.config.length; _ci++) {
                    const it = _w.config[_ci];
                    const pr =
                        typeof studnieProducts !== 'undefined'
                            ? studnieProducts.find(function (x) {
                                  return x.id === it.productId;
                              })
                            : null;
                    if (
                        pr &&
                        !singular.has(pr.componentType) &&
                        pr.componentType !== 'uszczelka' &&
                        it.quantity > 1
                    ) {
                        for (let _k = 0; _k < it.quantity; _k++) {
                            const isLast = _k === it.quantity - 1;
                            _exp.push({
                                productId: it.productId,
                                quantity: 1,
                                autoAdded: false,
                                ...(pr.componentType === 'dennica' && !isLast
                                    ? { isPsiaBuda: true }
                                    : {})
                            });
                        }
                    } else {
                        _exp.push(it);
                    }
                }
                _w.config = _exp;
            }
            if (typeof _excelClearResCache === 'function') _excelClearResCache(_w);
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

    const diagramPanel = document.querySelector('.well-diagram-panel');
    const isDiagramVisible = diagramPanel && diagramPanel.offsetParent !== null;
    const modalStyle = isDiagramVisible
        ? 'width:100%;height:100%;min-height:0;background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.05);border-radius: var(--radius-2xs);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(var(--black-rgb), 0.8);box-sizing:border-box;'
        : 'width:100%;height:100%;min-height:0;background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.05);border-radius: var(--radius-2xs);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(var(--black-rgb), 0.8);box-sizing:border-box;';
    const excelInnerHtml = `
        <div id="excel-modal-inner" style="${modalStyle}">
        <style>
            #excel-table-overlay .excel-toolbar-btn { flex:0 1 auto; min-width:8.5rem; justify-content:center; white-space:nowrap; text-align:center; }
            #excel-table-overlay .excel-toolbar-btn--danger { min-width:0; }
            #excel-table-overlay ::-webkit-scrollbar { width:8px; height:10px; }
            #excel-table-overlay ::-webkit-scrollbar-track { background:var(--scrollbar-track); }
            #excel-table-overlay ::-webkit-scrollbar-thumb { background:var(--scrollbar-thumb); border-radius: var(--radius-2xs); }
            #excel-table-overlay ::-webkit-scrollbar-thumb:hover { background:var(--scrollbar-thumb-hover); }
            #excel-table-overlay ::-webkit-scrollbar-corner { background:transparent; }
            #excel-table-container td:focus-within { box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb), 0.3) !important; }
            #excel-table-container td.excel-col-selected { outline:2px solid rgba(var(--accent-rgb), 0.3); outline-offset:-2px; }
            #excel-table-container td.excel-col-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.cell-selected { outline:2px solid rgba(var(--accent-rgb), 0.5); outline-offset:-2px; background:rgba(var(--accent-rgb), 0.05); }
            #excel-table-container td.cell-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.drag-preview { outline:2px dashed rgba(var(--accent-rgb), 0.5); outline-offset:-2px; background:rgba(var(--accent-rgb), 0.05); }
            #excel-table-container td.drag-preview .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-empty-name::placeholder { color: rgba(var(--accent-rgb), 0.65); font-style: italic; font-size: var(--fs-xs); }
            #excel-table-container th.excel-col-selected { background:rgba(var(--accent-rgb), 0.3) !important; box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb), 0.3); }
            #excel-table-container .h3-prodcode { font-size: var(--fs-3xs);font-weight: var(--fw-semibold);color:var(--slate-400);line-height:1.45; }
            #excel-table-container .h3-prodprice { font-size: var(--fs-3xs);color:var(--success-hover);font-weight: var(--fw-bold);line-height:1.4;white-space:nowrap;background:rgba(var(--success-rgb), 0.05);border-radius: var(--radius-2xs);padding:1px 5px;margin-top:2px;display:inline-block; }
            #excel-table-container tbody tr:hover { background:rgba(var(--white-rgb), 0.05); }
            #excel-table-container .excel-resize-handle { width:4px !important;background:rgba(var(--white-rgb), 0.1); }
            #excel-table-container .excel-resize-handle:hover { background:rgba(var(--accent-rgb), 0.5) !important; }
            #excel-table-container .excel-sel-wrap.disabled { opacity:.35;pointer-events:none; }
            #excel-table-container thead { position:sticky;top:0;z-index:${LAYERS_EXCEL.STICKY_THEAD};background:var(--slate-950);isolation:isolate; }
            #excel-table-container tr.excel-row-error { color:var(--danger-hover) !important; }
            #excel-table-container tr.excel-row-warning { color:var(--warn-hover) !important; }
            #excel-table-container tr.excel-row-error input, #excel-table-container tr.excel-row-error select, #excel-table-container tr.excel-row-error .excel-sel-wrap div { color:var(--danger-hover) !important; font-weight:var(--fw-semibold); }
            #excel-table-container tr.excel-row-warning input, #excel-table-container tr.excel-row-warning select, #excel-table-container tr.excel-row-warning .excel-sel-wrap div { color:var(--warn-hover) !important; font-weight:var(--fw-semibold); }
            #excel-table-container tr.excel-row-error td[data-cell^="height"], #excel-table-container tr.excel-row-error td[data-cell^="denn"], #excel-table-container tr.excel-row-error td[data-cell^="uszcz"] { color:var(--danger-hover) !important; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;padding:0.45rem 0.8rem;background:var(--slate-950);border-bottom:1px solid rgba(var(--white-rgb), 0.05);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
                <i data-lucide="table" class="icon-sm" style="color:var(--success);"></i>
                <span style="font-size: var(--fs-base);font-weight: var(--fw-bold);color:var(--slate-200);letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size: var(--fs-2xs);color:var(--slate-500);padding:0.1rem 0.5rem;background:rgba(var(--white-rgb), 0.05);border-radius: var(--radius-2xs);"></span>
                <span id="excel-selection-summary" style="display:none;font-size: var(--fs-2xs);color:var(--accent-text);padding:0.1rem 0.5rem;background:rgba(var(--white-rgb), 0.05);border-radius: var(--radius-2xs);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex:1 1 320px;min-width:280px;">

                <div style="position:relative;display:flex;align-items:center;flex:0 0 auto;">
                    <input type="text" id="excel-search-input" placeholder="Szukaj studni..." oninput="excelFilterWells(this.value)" aria-label="Szukaj studni" style="background:var(--slate-950);border:1px solid rgba(var(--white-rgb), 0.1);border-radius: var(--radius-2xs);padding:0.25rem 1.4rem 0.25rem 0.4rem;font-size: var(--fs-2xs);color:var(--slate-200);outline:none;width:220px;" />
                    <button type="button" id="excel-search-clear" onclick="excelClearSearch()" title="Wyczyść filtr" aria-label="Wyczyść filtr" class="excel-icon-btn" style="display:none;position:absolute;right:2px;"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button>
                </div>
                <button onclick="_excelToggleColumnPopup()" id="excel-col-vis-btn" class="excel-toolbar-btn" title="Pokaż/ukryj kolumny"><i data-lucide="table-properties" class="icon-xs" aria-hidden="true"></i>Kolumny</button>
                <button onclick="openPrzejsciaVisibilityPopup('excel')" class="excel-toolbar-btn" title="Pokaż/ukryj typy przejść"><i data-lucide="arrow-right-left" class="icon-xs" aria-hidden="true"></i>Przejścia</button>
                <button onclick="_excelBulkRunAutoSelect()" id="excel-bulk-recalc" class="excel-toolbar-btn" style="background:rgba(var(--success-rgb),0.15);border-color:rgba(var(--success-rgb),0.3);color:var(--success-hover);" title="Auto-dobór dla zaznaczonych (checkbox)"><i data-lucide="refresh-cw" class="icon-xs" aria-hidden="true"></i>Auto-dobór zaznaczonych</button>
                <button onclick="_excelBulkDeleteSelected()" id="excel-bulk-delete" class="excel-toolbar-btn excel-toolbar-btn--danger" style="background:rgba(var(--danger-rgb),0.12);border-color:rgba(var(--danger-rgb),0.25);color:var(--danger-hover);" title="Usuń zaznaczone studnie (checkbox)"><i data-lucide="trash-2" class="icon-xs" aria-hidden="true"></i>Usuń zaznaczone</button>
                <button onclick="openWellNotesForExcelSelection()" class="excel-toolbar-btn" title="Uwagi do zaznaczonej studni"><i data-lucide="file-text" class="icon-xs" aria-hidden="true"></i>Uwagi</button>
                <button onclick="openExcelShortcutsPopup()" class="excel-toolbar-btn" title="Skróty klawiszowe"><i data-lucide="keyboard" class="icon-xs" aria-hidden="true"></i>Skróty</button>
                <button onclick="excelToggleFullscreen()" id="excel-fs-btn" class="excel-toolbar-btn" title="Pełny ekran / okno"><i data-lucide="maximize-2" class="icon-xs" aria-hidden="true"></i><span id="excel-fs-btn-label">Pełny</span></button>
                <button onclick="excelSaveAll()" id="excel-save-btn" class="excel-toolbar-btn excel-toolbar-btn--success" title="Zapisz wszystkie zmiany i zamknij"><i data-lucide="check" class="icon-xs" aria-hidden="true"></i>Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" class="excel-toolbar-btn excel-toolbar-btn--danger" title="Zamknij bez zapisywania" aria-label="Zamknij bez zapisywania"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:var(--slate-950);border-bottom:1px solid rgba(var(--white-rgb), 0.05);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1 1 auto;min-height:0;overflow:auto;background:var(--slate-950);"></div>
        </div>
    `;
    // SSoT: Excel używa modalCore.js — overlay tworzony przez showModal, pozycjonowanie dalej via LAYERS
    const overlay = window.showModal({
        id: 'excel-table-overlay',
        html: excelInnerHtml,
        title: 'Tabela konfiguracyjna studni',
        titleId: 'excel-modal-title',
        onClose: function () {
            // Staged Esc: sprawdź aktywny element przed zamknięciem
            const ae = document.activeElement;
            if (
                ae instanceof HTMLElement &&
                ae.closest('#excel-table-container') &&
                (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')
            ) {
                ae.blur();
                _excelResetLayoutDependentState();
                return false;
            }
            const si = document.getElementById('excel-search-input');
            if (ae === si && si && si.value) {
                if (typeof excelClearSearch === 'function') excelClearSearch();
                return false;
            }
            if (_excelSelectedCells.length > 0 || _excelSelectedCols.length > 0) {
                _excelResetLayoutDependentState();
                return false;
            }
            closeExcelTableModal();
            return false;
        }
    });
    overlay.setAttribute('aria-label', 'Tabela konfiguracyjna studni');
    _excelPositionOverlay(overlay);
    // Ctrl+S / Ctrl+R — showModal obsługuje tylko Escape; te skróty dokładamy
    const _excelOverlayKeyHandler = function (e) {
        if (document.querySelector('.modal-overlay:not(#excel-table-overlay)')) return;
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof excelSaveAll === 'function') excelSaveAll();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
            if (!e.defaultPrevented) e.preventDefault();
        }
    };
    overlay.addEventListener('keydown', _excelOverlayKeyHandler);
    /** @type {any} */ (overlay)._excelKeyHandler = _excelOverlayKeyHandler;
    /* Nasłuchuj resize — odśwież pozycjonowanie */
    const _resizeHandler = function () {
        _excelPositionOverlay(overlay);
    };
    window.addEventListener('resize', _resizeHandler);
    /** @type {any} */ (overlay)._resizeHandler = _resizeHandler;

    _excelRegisterExcelListeners();

    _excelLoadColumnVisibility();
    _excelLoadColWidths();
    /* Aktualne statusy konfiguracji przed renderem (podświetlenie wierszy F4) */
    if (typeof refreshAllWellErrors === 'function') refreshAllWellErrors();
    _excelActiveTab = DN_TABS[0];
    /* Nie zaznaczaj żadnego wiersza przy otwarciu — currentWellIndex=-1 PRZED renderem */
    if (typeof currentWellIndex !== 'undefined') currentWellIndex = -1;
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
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
/* Snapshot wells przy otwarciu — do "Zamknij bez zapisu" (przywrócenie stanu sprzed edycji) */
let _excelOpenSnapshot = null;

/* Fizyczne zamknięcie overlayu — wydzielone, by excelSaveAll mógł je wywołać bez rekurencji */
function _excelCloseOverlay() {
    if (typeof _excelCancelPasteBatch === 'function') _excelCancelPasteBatch();
    _excelStopPolling();
    _excelUnregisterExcelListeners();
    _excelResetLayoutDependentState();
    if (typeof _excelResetSort === 'function') _excelResetSort();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        if (typeof untrapFocus === 'function') untrapFocus(overlay);
        overlay.remove();
        // modalCore showModal ustawia body overflow hidden — przywróć gdy brak innych overlayów
        if (!document.querySelector('.js-modal-overlay')) document.body.style.overflow = '';
    }
    _excelDirty = false;
    _excelClosing = false;
    _excelOpenSnapshot = null;
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
            await excelSaveAll();
            /* Zapisz się nie powiódł — modal został otwarty, zwolnij guard zamknięcia */
            if (document.getElementById('excel-table-overlay')) _excelClosing = false;
            return;
        }
        /* Zamknij bez zapisu — przywróć stan sprzed edycji */
        if (_excelDirty && _excelOpenSnapshot) {
            wells.splice(0, wells.length, ..._excelOpenSnapshot);
        }
    }
    // Defense-in-depth: usuń ewentualne puste przejścia które przeszły guard (np. legacy)
    if (typeof _excelCleanEmptyPrzejscia === 'function' && Array.isArray(wells)) {
        wells.forEach(function (w) {
            _excelCleanEmptyPrzejscia(w);
        });
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
            const prevStickyTds = prevRow.querySelectorAll('td:nth-child(-n+7)');
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
            const stickyTds = newRow.querySelectorAll('td:nth-child(-n+7)');
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
