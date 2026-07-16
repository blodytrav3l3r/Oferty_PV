// @ts-check
/* ===== EXCEL MODAL — Otwarzanie/zamykanie tabeli konfiguracyjnej studni ===== */

function _excelRegisterExcelListeners() {
    const container = document.getElementById('excel-table-container');
    if (!container || /** @type {any} */ (container)._excelListenersAttached) return;
    /** @type {any} */ (container)._excelListenersAttached = true;
    var _arrowHandler = function (e) {
        var tgt = e.target;
        if (!tgt || !container.contains(tgt)) return;
        if (!e.key.startsWith('Arrow')) return;
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        _excelHandleArrow(e);
    };
    document.addEventListener('keydown', _arrowHandler, true);
    /** @type {any} */ (container)._arrowHandler = _arrowHandler;
    container.addEventListener('focusin', function (e) {
        var row = e.target.closest('tr[data-widx]');
        if (!row) return;
        var wIdx = parseInt(row.getAttribute('data-widx'), 10);
        if (
            !isNaN(wIdx) &&
            (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)
        ) {
            excelSelectRow(wIdx);
        }
    });
    container.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        var td = e.target.closest('td');
        var row = e.target.closest('tr[data-widx]');
        if (!row || !td) return;
        var wIdx = parseInt(row.getAttribute('data-widx'), 10);
        if (isNaN(wIdx)) return;
        var colIdx = Array.from(row.children).indexOf(td);
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
    });
    document.addEventListener('copy', _excelHandleCopy);
    container.addEventListener('paste', _excelHandlePaste, true);
    container.addEventListener('keydown', _excelHandleKeydown);
    container.addEventListener('change', _excelOnRowSelectChange);
    container.addEventListener('mousedown', _excelOnMouseDown);
    document.addEventListener('mousemove', _excelOnMouseMove);
    document.addEventListener('mouseup', _excelOnMouseUp);
    if (!document.getElementById('excel-focus-overlay')) {
        var ov = document.createElement('div');
        ov.id = 'excel-focus-overlay';
        ov.style.cssText =
            'position:fixed;pointer-events:none;z-index:99998;border:2px solid rgba(99,102,241,0.6);border-radius:3px;box-sizing:border-box;display:none;transition:all 0.1s ease;box-shadow:0 0 0 1px rgba(0,0,0,0.3);';
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
    var _container = document.getElementById('excel-table-container');
    if (_container && /** @type {any} */ (_container)._arrowHandler) {
        document.removeEventListener(
            'keydown',
            /** @type {any} */ (_container)._arrowHandler,
            true
        );
    }
    document.removeEventListener('copy', _excelHandleCopy);
    document.removeEventListener('paste', _excelHandlePaste);
    if (_container) _container.removeEventListener('paste', _excelHandlePaste, true);
    if (_container) _container.removeEventListener('mousedown', _excelOnMouseDown);
    document.removeEventListener('mousemove', _excelOnMouseMove);
    document.removeEventListener('mouseup', _excelOnMouseUp);
    if (_container) {
        _container.removeEventListener('focusin', _excelOnFocusIn);
        _container.removeEventListener('focusout', _excelOnFocusOut);
        _container.removeEventListener('change', _excelOnRowSelectChange);
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
        for (var _rwo = 0; _rwo < wells.length; _rwo++) {
            _excelCleanEmptyPrzejscia(wells[_rwo]);
        }
    }

    /* Inicjalizuj _excelMaxTransitions dla WSZYSTKICH zakładek */
    var _allTabs = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    _allTabs.forEach(function (t) {
        var _tw =
            typeof wells !== 'undefined' && Array.isArray(wells)
                ? wells.filter(function (w) {
                      return _excelWellMatchesTab(w, t);
                  })
                : [];
        var _tm = _tw.reduce(function (m, w) {
            return w.przejscia && w.przejscia.length > m ? w.przejscia.length : m;
        }, 0);
        _excelMaxTransitions[t] = Math.max(1, _tm);
    });

    /* Zainicjuj stan — brak zmian */
    _excelDirty = false;

    const existing = document.getElementById('excel-table-overlay');
    if (existing) {
        /* Wyczyść stary capture handler przed usunięciem overlay */
        var _oldContainer = document.getElementById('excel-table-container');
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
        if (e.key === 'Escape') closeExcelTableModal();
    });

    /* Nasłuchuj resize — odśwież pozycjonowanie */
    var _resizeHandler = function () {
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
            'width:calc(100% - 1rem);height:calc(100% - 1rem);background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    } else {
        modal.style.cssText =
            'width:96vw;height:96vh;background:#0c0e14;border:1px solid rgba(255,255,255,0.06);border-radius:4px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);';
    }

    modal.innerHTML = `
        <style>
            #excel-table-overlay ::-webkit-scrollbar { width:8px; height:10px; }
            #excel-table-overlay ::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); }
            #excel-table-overlay ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.25); border-radius:4px; }
            #excel-table-overlay ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.35); }
            #excel-table-overlay ::-webkit-scrollbar-corner { background:transparent; }
            #excel-table-container td:focus-within { box-shadow:inset 0 0 0 1px rgba(99,102,241,0.25) !important; }
            #excel-table-container td.excel-col-selected { outline:2px solid rgba(99,102,241,0.3); outline-offset:-2px; }
            #excel-table-container td.excel-col-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.cell-selected { outline:2px solid rgba(99,102,241,0.5); outline-offset:-2px; background:rgba(99,102,241,0.06); }
            #excel-table-container td.cell-selected .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container td.drag-preview { outline:2px dashed rgba(99,102,241,0.5); outline-offset:-2px; background:rgba(99,102,241,0.03); }
            #excel-table-container td.drag-preview .excel-sel-wrap { outline:inherit; outline-offset:-2px; }
            #excel-table-container th.excel-col-selected { background:rgba(99,102,241,0.25) !important; box-shadow:inset 0 0 0 1px rgba(99,102,241,0.35); }
            #excel-table-container .h3-prodcode { font-size:0.5rem;font-weight:600;color:#a4b3cb;line-height:1.45; }
            #excel-table-container .h3-prodprice { font-size:0.55rem;color:#34d399;font-weight:700;line-height:1.4;white-space:nowrap;background:rgba(52,211,153,0.07);border-radius:3px;padding:1px 5px;margin-top:2px;display:inline-block; }
            #excel-table-container tbody tr:hover { background:rgba(255,255,255,0.02); }
            #excel-table-container .excel-resize-handle { width:4px !important;background:rgba(255,255,255,0.08); }
            #excel-table-container .excel-resize-handle:hover { background:rgba(99,102,241,0.5) !important; }
            #excel-table-container .excel-sel-wrap.disabled { opacity:.35;pointer-events:none; }
            #excel-table-container thead { position:sticky;top:0;z-index:50;background:#161923;isolation:isolate; }
        </style>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="table" style="width:16px;height:16px;color:#10b981;"></i>
                <span style="font-size:0.75rem;font-weight:700;color:#e2e8f0;letter-spacing:0.3px;">Tabela konfiguracyjna</span>
                <span id="excel-well-count" style="font-size:0.6rem;color:#64748b;padding:0.1rem 0.5rem;background:rgba(255,255,255,0.04);border-radius:3px;"></span>
            </div>
            <div style="display:flex;gap:0.4rem;align-items:center;">
                <div style="position:relative;" id="excel-add-menu-container">
                    <button onclick="_excelToggleAddMenu()" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> + Dodaj</button>
                    <div id="excel-add-dropdown" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:#161923;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.4rem;z-index:100;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.4rem;font-size:0.65rem;color:#94a3b8;cursor:pointer;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:0.3rem;">
                            <input type="checkbox" id="excel-auto-select-check" ${_excelAutoSelectEnabled ? 'checked' : ''} onchange="_excelAutoSelectEnabled=this.checked;window._excelAutoSelectEnabled=this.checked" style="accent-color:#6366f1;cursor:pointer;" />
                            Auto-dobór
                        </label>
                        <button onclick="excelAddWellToTab();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(59,130,246,0.1);color:#93c5fd;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;transition:background 0.1s;" onmouseenter="this.style.background='rgba(59,130,246,0.2)'" onmouseleave="this.style.background='rgba(59,130,246,0.1)'">Szybko (puste)</button>
                        <button onclick="excelShowAddDialog();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;transition:background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.08)'" onmouseleave="this.style.background='rgba(255,255,255,0.04)'">Ręcznie (parametry)</button>
                        <button onclick="excelShowPasteDialog();_excelToggleAddMenu()" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;transition:background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.08)'" onmouseleave="this.style.background='rgba(255,255,255,0.04)'">Wklej listę</button>
                    </div>
                </div>
                <input type="text" id="excel-search-input" placeholder="Szukaj studni..." oninput="excelFilterWells(this.value)" style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:0.25rem 0.4rem;font-size:0.6rem;color:#e2e8f0;outline:none;width:100px;" />
                <button onclick="excelToggleFullscreen()" id="excel-fs-btn" title="Pełny ekran / okno" style="background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;">Pełny</button>
                <button onclick="excelSaveAll()" id="excel-save-btn" title="Zapisz wszystkie zmiany i zamknij" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button onclick="closeExcelTableModal()" title="Zamknij bez zapisywania" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    _excelRegisterExcelListeners();

    _excelActiveTab = DN_TABS[0];
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    /* Nie zaznaczaj żadnego wiersza przy otwarciu — usuń aktywny styl z pierwszej studni */
    if (typeof currentWellIndex !== 'undefined' && currentWellIndex >= 0) {
        var firstRow = document.querySelector(
            '#excel-table-container tr[data-widx="' + currentWellIndex + '"]'
        );
        if (firstRow) {
            var baseRef = firstRow.getAttribute('data-base-bg');
            if (baseRef) {
                firstRow.style.background = baseRef;
                firstRow.setAttribute('data-orig-bg', baseRef);
                /* Przywróć tło sticky kolumn */
                var stTds = firstRow.querySelectorAll('td:nth-child(-n+5)');
                stTds.forEach(function (td) {
                    td.style.background = baseRef;
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
    _excelUpdateBulkButtons();

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

/* ===== CLOSE ===== */
function closeExcelTableModal() {
    if (_excelDirty && typeof appConfirm === 'function') {
        if (!appConfirm('Są niezapisane zmiany. Czy na pewno zamknąć?')) return;
    }
    _excelStopPolling();
    _excelUnregisterExcelListeners();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        overlay.remove();
    }
    _excelDirty = false;
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
            var prevStickyTds = prevRow.querySelectorAll('td:nth-child(-n+5)');
            var baseBg = prevRow.getAttribute('data-base-bg') || '#0a0d16';
            prevStickyTds.forEach(function (td) {
                td.style.background = baseBg;
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
            var stickyTds = newRow.querySelectorAll('td:nth-child(-n+5)');
            stickyTds.forEach(function (td) {
                td.style.background = activeBg;
            });
        }
    }

    _excelUpdateLeftPreview(wIdx);
    /* Aktualizuj h3 — kody produktów ZALEŻĄ od zaznaczonej studni */
    _excelUpdateHeaderProdCodes();
}
