// @ts-check
/* ===== EXCEL MODALS — Okna modalne (tabela, parametry, dodawanie) ===== */

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
                    <button data-action="_excelToggleAddMenu" id="excel-add-btn" title="Dodaj studnię do bieżącej zakładki" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.25);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.3rem;"><i data-lucide="plus" style="width:12px;height:12px;"></i> + Dodaj</button>
                    <div id="excel-add-dropdown" style="display:none;position:absolute;top:100%;left:0;margin-top:4px;background:#161923;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.4rem;z-index:100;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                        <label style="display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.4rem;font-size:0.65rem;color:#94a3b8;cursor:pointer;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:0.3rem;">
                            <input type="checkbox" id="excel-auto-select-check" ${_excelAutoSelectEnabled ? 'checked' : ''} data-action="excelToggleAutoSelect" style="accent-color:#6366f1;cursor:pointer;" />
                            Auto-dobór
                        </label>
                        <button data-action="excelAddWellToTabAndClose" class="excel-hover-btn" style="--hb:rgba(59,130,246,0.2);display:block;width:100%;text-align:left;background:rgba(59,130,246,0.1);color:#93c5fd;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;">Szybko (puste)</button>
                        <button data-action="excelShowAddDialogAndClose" class="excel-hover-btn" style="--hb:rgba(255,255,255,0.08);display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;margin-bottom:2px;">Ręcznie (parametry)</button>
                        <button data-action="excelShowPasteDialogAndClose" class="excel-hover-btn" style="--hb:rgba(255,255,255,0.08);display:block;width:100%;text-align:left;background:rgba(255,255,255,0.04);color:#e2e8f0;border:none;padding:0.3rem 0.5rem;border-radius:3px;font-size:0.65rem;cursor:pointer;font-weight:500;">Wklej listę</button>
                    </div>
                </div>
                <input type="text" id="excel-search-input" placeholder="Szukaj studni..." data-action="excelFilterWells" style="background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;padding:0.25rem 0.4rem;font-size:0.6rem;color:#e2e8f0;outline:none;width:100px;" />
                <button data-action="excelToggleFullscreen" id="excel-fs-btn" title="Pełny ekran / okno" style="background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.15);padding:0.25rem 0.5rem;border-radius:3px;font-size:0.6rem;font-weight:600;cursor:pointer;">Pełny</button>
                <button data-action="excelSaveAll" id="excel-save-btn" title="Zapisz wszystkie zmiany i zamknij" style="background:rgba(16,185,129,0.15);color:#6ee7b7;border:1px solid rgba(16,185,129,0.3);padding:0.3rem 0.9rem;border-radius:3px;font-size:0.65rem;font-weight:700;cursor:pointer;">Gotowe (Zapisz)</button>
                <button data-action="closeExcelTableModal" title="Zamknij bez zapisywania" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.7rem;border-radius:3px;font-size:0.65rem;font-weight:600;cursor:pointer;">✕</button>
            </div>
        </div>
        <div id="excel-tabs" style="display:flex;gap:0;padding:0;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;"></div>
        <div id="excel-table-container" style="flex:1;overflow:auto;background:#0c0e14;"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Delegowany klik na wiersze — bardziej niezawodny niż inline onclick
    const container = document.getElementById('excel-table-container');
    if (container && !(/** @type {any} */ (container)._excelListenersAttached)) {
        /** @type {any} */ (container)._excelListenersAttached = true;
        /* Capture phase — przechwytuje strzałki ZANIM input/select je przetworzy */
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
        /* CSP-safe: Enter/Space na .excel-sel-wrap → showPicker */
        container.addEventListener('keydown', function (e) {
            var wrap = e.target.closest('.excel-sel-wrap');
            if (!wrap) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                var s = /** @type {HTMLInputElement} */ (wrap.querySelector('select'));
                if (typeof s.showPicker === 'function') {
                    s.showPicker();
                } else {
                    s.focus();
                    s.click();
                }
            }
        });
        /* CSP-safe: sync display text dla overlay select */
        container.addEventListener('change', function (e) {
            var sel = /** @type {HTMLSelectElement} */ (e.target.closest('.excel-sel-wrap select'));
            if (sel && sel.nextElementSibling) {
                sel.nextElementSibling.textContent = sel.options[sel.selectedIndex].text;
            }
        });
        /* Delegowany focusin — aktywuje wiersz dla każdego elementu który dostanie focus */
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
        /* Delegowany klik — excel-like cell selection */
        container.addEventListener('click', function (e) {
            if (e.target.closest('button')) return;
            var td = e.target.closest('td');
            var row = e.target.closest('tr[data-widx]');
            if (!row || !td) return;
            var wIdx = parseInt(row.getAttribute('data-widx'), 10);
            if (isNaN(wIdx)) return;
            var colIdx = Array.from(row.children).indexOf(td);
            /* Shift+click = zakres */
            if (e.shiftKey) {
                e.stopPropagation();
                _excelSelectCell(wIdx, colIdx, false, true);
                return;
            }
            /* Ctrl+click = toggle */
            if (e.ctrlKey) {
                e.stopPropagation();
                _excelSelectCell(wIdx, colIdx, true, false);
                return;
            }
            /* Zwykły klik = zaznacz komórkę + wiersz */
            _excelSelectCell(wIdx, colIdx, false, false);
            if (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex) {
                excelSelectRow(wIdx);
            }
        });
        /* Bind copy na document, paste z capture na kontenerze */
        document.addEventListener('copy', _excelHandleCopy);
        /* useCapture=true: wychwytuje event ZANIM dotrze do inputów w tabeli */
        container.addEventListener('paste', _excelHandlePaste, true);
        /* Bind keydown dla skrótów */
        container.addEventListener('keydown', _excelHandleKeydown);
        /* Checkbox column change listener */
        container.addEventListener('change', _excelOnRowSelectChange);
        /* Drag-selection: mousedown + mousemove + mouseup */
        container.addEventListener('mousedown', _excelOnMouseDown);
        document.addEventListener('mousemove', _excelOnMouseMove);
        document.addEventListener('mouseup', _excelOnMouseUp);
        /* Focus overlay - singleton div podążający za aktualnie fokusowaną komórką */
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

        /* CSP-safe: empty row Enter/blur → excelCreateFromEmpty */
        container.addEventListener('keydown', function (e) {
            if (
                e.key === 'Enter' &&
                /** @type {HTMLElement} */ (e.target).id === 'excel-empty-name'
            ) {
                e.preventDefault();
                excelCreateFromEmpty();
            }
        });
        container.addEventListener('focusout', function (e) {
            if (/** @type {HTMLElement} */ (e.target).id === 'excel-empty-name') {
                excelCreateFromEmpty();
            }
        });
    }

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

function closeExcelTableModal() {
    if (_excelDirty && typeof appConfirm === 'function') {
        if (!appConfirm('Są niezapisane zmiany. Czy na pewno zamknąć?')) return;
    }
    _excelStopPolling();
    const overlay = document.getElementById('excel-table-overlay');
    if (overlay) {
        /* Usuń handler resize */
        if (/** @type {any} */ (overlay)._resizeHandler) {
            window.removeEventListener('resize', /** @type {any} */ (overlay)._resizeHandler);
        }
        /* Usuń handler strzałek (capture phase) */
        var _container = document.getElementById('excel-table-container');
        if (_container && /** @type {any} */ (_container)._arrowHandler) {
            document.removeEventListener(
                'keydown',
                /** @type {any} */ (_container)._arrowHandler,
                true
            );
        }
        /* Usuń globalne handlery copy/paste */
        document.removeEventListener('copy', _excelHandleCopy);
        document.removeEventListener('paste', _excelHandlePaste);
        if (_container) _container.removeEventListener('paste', _excelHandlePaste, true);
        /* Drag-selection cleanup */
        if (_container) _container.removeEventListener('mousedown', _excelOnMouseDown);
        document.removeEventListener('mousemove', _excelOnMouseMove);
        document.removeEventListener('mouseup', _excelOnMouseUp);
        /* Focus overlay cleanup */
        if (_container) {
            _container.removeEventListener('focusin', _excelOnFocusIn);
            _container.removeEventListener('focusout', _excelOnFocusOut);
            _container.removeEventListener('change', _excelOnRowSelectChange);
        }
        document.removeEventListener('scroll', _excelOnOverlayScroll, true);
        window.removeEventListener('resize', _excelOnOverlayScroll);
        if (_excelFocusOverlayEl) _excelFocusOverlayEl.style.display = 'none';
        overlay.remove();
    }
    _excelDirty = false;
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

function excelOpenWellParams(wIdx) {
    const well = wells[wIdx];
    if (!well) return;

    const existing = document.getElementById('excel-params-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'excel-params-popup';
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    /* Oblicz szerokość okna dynamicznie: wszystkie kafelki ten sam rozmiar, brak zawijania */
    const maxOptions = Math.max(...WELL_PARAM_DEFS.map((d) => d.options.length));
    const TILE_W = 90;
    const gapPx = 5.6;
    const gridW = maxOptions * TILE_W + (maxOptions - 1) * gapPx;
    const popupW = Math.min(Math.round(gridW + 185 + 42), 1200);

    const modal = document.createElement('div');
    modal.style.cssText = `width:${popupW}px;max-height:90vh;background:var(--bg-primary);border:1px solid rgba(255,255,255,0.06);border-radius:6px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);`;

    let bodyHtml = `<div style="display:flex;flex-direction:column;gap:0.55rem;">`;
    if (typeof WELL_PARAM_DEFS !== 'undefined') {
        const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);
        WELL_PARAM_DEFS.forEach((def) => {
            if (
                def.key === 'precoFullHeight' &&
                well.kineta !== 'preco' &&
                well.kineta !== 'precotop'
            )
                return;

            let isGreyedOut = false;
            if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) isGreyedOut = true;
            if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop'))
                isGreyedOut = true;
            if (
                well.wkladkaOsadnikPreco === 'tak' &&
                (def.key === 'kineta' || def.key === 'spocznik')
            )
                return;

            const currentVal = well[def.key] || '';
            bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;${isGreyedOut ? 'opacity:0.5;' : ''}">`;
            bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">${def.label}</span>`;
            const cols = def.options.length;
            bodyHtml += `<div style="display:grid;grid-template-columns:repeat(${cols}, ${TILE_W}px);gap:0.35rem;flex:1;">`;
            def.options.forEach(([val, lbl]) => {
                const active = val === currentVal;
                bodyHtml += `<button data-action="excelUpdateWellParam" data-active="${active}" data-w-idx="${wIdx}" data-param-key="${def.key}" data-param-val="${val}" style="height:34px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:${active ? '800' : '600'};border:1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};background:${active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};color:${active ? '#a5b4fc' : 'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;${active ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}">${lbl}</button>`;
            });
            bodyHtml += `</div></div>`;

            /* Pola dodatkowe — malowanie wew. */
            if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. wew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="powlokaNameW" data-w-idx="${wIdx}" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. wew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="malowanieWewCena" data-w-idx="${wIdx}" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
            /* Pola dodatkowe — malowanie zew. */
            if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Nazwa p. zew.</span>`;
                bodyHtml += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="powlokaNameZ" data-w-idx="${wIdx}" placeholder="Nazwa powłoki..." style="flex:1;max-width:260px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
                bodyHtml += `<div style="display:flex;align-items:center;gap:0.2rem;min-height:32px;margin-top:0.3rem;">`;
                bodyHtml += `<span style="font-size:0.85rem;color:var(--text-muted);font-weight:700;white-space:nowrap;min-width:185px;text-align:left;">Koszt p. zew.</span>`;
                bodyHtml += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" data-select-on-click="true" data-action="excelUpdateWellParamAndRefresh" data-param-field="malowanieZewCena" data-w-idx="${wIdx}" placeholder="PLN / m²" style="width:100px;height:36px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);color:var(--text-primary);padding:0 0.7rem;font-size:0.85rem;border-radius:6px;">`;
                bodyHtml += `</div>`;
            }
        });
    }
    bodyHtml += `</div>`;

    modal.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.8rem;background:#10131a;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text-primary);">Parametry: ${escapeHtml(well.name)}</span>
            <button data-action="closeExcelParamsPopup" style="background:#13151f;color:var(--text-muted);border:none;cursor:pointer;font-size:1.1rem;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0.8rem;">
            ${bodyHtml}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.5rem 0.8rem;background:#10131a;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">
            <button data-action="closeExcelParamsPopup" style="background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);padding:0.4rem 1.2rem;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:600;">Zamknij</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function excelRefreshParamsPopup(wIdx) {
    _excelDebouncedRefresh();
    _excelRenderTable(_excelActiveTab);
    const existing = document.getElementById('excel-params-popup');
    if (existing) {
        existing.remove();
        excelOpenWellParams(wIdx);
    }
}

function excelShowAddDialog() {
    var dns = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
    var dnOpts = dns
        .map(function (d) {
            var label = d === 'styczne' ? 'Styczna' : 'DN' + d;
            var sel =
                d === _excelActiveTab || (d === 'styczne' && _excelActiveTab === 'styczne')
                    ? ' selected'
                    : '';
            return '<option value="' + d + '"' + sel + '>' + label + '</option>';
        })
        .join('');

    var html =
        '<div id="excel-add-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:380px;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">' +
        '<strong style="color:#e2e8f0;font-size:0.75rem;">Dodaj studnię</strong>' +
        '<button data-action="closeExcelAddDialog" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:80px 1fr;gap:0.5rem 0.7rem;font-size:0.65rem;color:#94a3b8;margin-bottom:1rem;">' +
        '<label>Nazwa</label><input id="dlg-name" type="text" placeholder="np. a1" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>DN</label><select id="dlg-dn" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;">' +
        dnOpts +
        '</select>' +
        '<label>Rz. włazu</label><input id="dlg-rzw" type="number" step="0.01" placeholder="np. 5.00" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '<label>Rz. dna</label><input id="dlg-rzd" type="number" step="0.01" placeholder="np. 0.00" value="0" style="padding:0.3rem 0.5rem;background:#13151f;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;" />' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:0.7rem;display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button data-action="closeExcelAddDialog" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button data-action="_excelCreateFromDialog" style="padding:0.3rem 1rem;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.3);border-radius:3px;color:#6ee7b7;font-size:0.65rem;font-weight:700;cursor:pointer;">Dodaj</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(function () {
        var inp = document.getElementById('dlg-name');
        if (inp) inp.focus();
    }, 100);
    var container = document.getElementById('excel-add-dialog-overlay');
    if (container) {
        container.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') _excelCreateFromDialog();
            if (e.key === 'Escape') container.remove();
        });
    }
}

function excelShowPasteDialog() {
    if (!document.getElementById('excel-table-overlay')) return;
    var html =
        '<div id="excel-paste-dialog-overlay" style="position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:1.2rem;min-width:420px;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">' +
        '<strong style="color:#e2e8f0;font-size:0.75rem;">Wklej listę studni</strong>' +
        '<button data-action="closeExcelPasteDialog" style="background:none;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:0.6rem;color:#64748b;margin-bottom:0.5rem;">Wklej dane z arkusza (TAB, przecinek, średnik, | lub odstęp)</div>' +
        '<textarea id="paste-textarea" style="width:100%;height:140px;padding:0.5rem;background:#0c0e14;border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:#e2e8f0;font-size:0.65rem;font-family:Consolas,Menlo,monospace;resize:vertical;white-space:pre;tab-size:2;" placeholder="Nazwa	DN	Rz.włazu	Rz.dna&#10;a1	1000	5.00	0.00&#10;a2	1000	4.50	0.00"></textarea>' +
        '<div id="paste-preview" style="font-size:0.6rem;color:#64748b;max-height:60px;overflow-y:auto;margin:0.3rem 0;padding:0.2rem;background:#0c0e14;border-radius:3px;"></div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">' +
        '<button data-action="closeExcelPasteDialog" style="padding:0.3rem 0.7rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:#94a3b8;font-size:0.65rem;cursor:pointer;">Anuluj</button>' +
        '<button data-action="_excelImportPasteList" style="padding:0.3rem 1rem;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);border-radius:3px;color:#93c5fd;font-size:0.65rem;font-weight:700;cursor:pointer;">Importuj</button>' +
        '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var ta = document.getElementById('paste-textarea');
    if (ta) {
        ta.addEventListener('input', _excelUpdatePastePreview);
        ta.focus();
    }
    var c = document.getElementById('excel-paste-dialog-overlay');
    if (c)
        c.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') c.remove();
        });
}

function _excelCreateFromDialog() {
    var name = (document.getElementById('dlg-name')?.value || '').trim();
    var dn = document.getElementById('dlg-dn')?.value || '1000';
    var rzwParsed = parseDecimal(document.getElementById('dlg-rzw')?.value);
    var rzdParsed = parseDecimal(document.getElementById('dlg-rzd')?.value);
    var rzw = isNaN(rzwParsed) ? null : rzwParsed;
    var rzd = isNaN(rzdParsed) ? null : rzdParsed;
    if (!name) {
        showToast('Podaj nazwę studni', 'error');
        return;
    }
    if (
        wells.some(function (w) {
            return w.name === name;
        })
    ) {
        showToast('Nazwa "' + name + '" już istnieje', 'error');
        return;
    }
    if (rzw === null) {
        showToast('Podaj rządną włazu', 'error');
        return;
    }
    if (rzd === null) rzd = 0;
    if (rzw <= rzd) {
        showToast('Rzędna włazu musi być > rzędnej dna', 'error');
        return;
    }
    var dnVal = dn === 'styczne' ? 'styczna' : parseInt(dn);
    var well =
        typeof createNewWell === 'function'
            ? createNewWell(name, dnVal)
            : {
                  id: 'well_' + Date.now(),
                  name: name,
                  dn: dnVal,
                  config: [],
                  przejscia: [],
                  rzednaWlazu: rzw,
                  rzednaDna: rzd,
                  kineta: 'brak',
                  psiaBuda: false,
                  redukcjaDN1000: false,
                  redukcjaMinH: 2500
              };
    well.name = name;
    well.rzednaWlazu = rzw;
    well.rzednaDna = rzd;
    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    var overlay = document.getElementById('excel-add-dialog-overlay');
    if (overlay) overlay.remove();
    var newWIdx = wells.length - 1;
    if (_excelAutoSelectEnabled && rzw != null && rzd != null) {
        setTimeout(function () {
            _excelAutoSelectForWell(newWIdx);
        }, 100);
    }
    setTimeout(function () {
        excelSelectRow(newWIdx);
    }, 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + name, 'success');
}

function excelCreateFromEmpty() {
    if (_excelCreatingLock) return;
    _excelCreatingLock = true;

    const nameEl = document.getElementById('excel-empty-name');
    const rzwEl = document.getElementById('excel-empty-rzw');
    const rzdEl = document.getElementById('excel-empty-rzd');
    if (!nameEl) {
        _excelCreatingLock = false;
        return;
    }

    const name = (nameEl.value || '').trim();
    const rzwRaw = rzwEl ? rzwEl.value : '';
    const rzdRaw = rzdEl ? rzdEl.value : '';
    const rzw = rzwRaw !== '' ? parseDecimal(rzwRaw) : null;
    const rzd = rzdRaw !== '' ? parseDecimal(rzdRaw) : null;

    if (!name && rzw === null && rzd === null) {
        _excelCreatingLock = false;
        return;
    }

    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);
    const autoName =
        name ||
        (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
            ' (#' +
            (wells.length + 1) +
            ')';

    let well;
    try {
        if (typeof createNewWell === 'function') {
            well = createNewWell(autoName, /** @type {any} */ (dn));
            if (name) {
                well.numer = name;
                well.name = name;
            }
        } else {
            well = {
                id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                name: autoName,
                dn: dn,
                config: [],
                przejscia: [],
                rzednaWlazu: rzw,
                rzednaDna: rzd,
                kineta: 'brak',
                psiaBuda: false,
                redukcjaDN1000: false,
                redukcjaMinH: 2500
            };
        }

        if (rzw !== null) well.rzednaWlazu = rzw;
        if (rzd !== null) well.rzednaDna = rzd;

        wells.push(well);
        _excelAutoSetWlaz(well);
        _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
        _excelRenderTabs();
        _excelRenderTable(_excelActiveTab);
        _excelUpdateWellCount();
        _excelDebouncedRefresh();
        var newWIdx = wells.length - 1;
        if (_excelAutoSelectEnabled && rzw !== null && rzd !== null && rzw > rzd) {
            setTimeout(function () {
                _excelAutoSelectForWell(newWIdx);
            }, 200);
        }
        showToast('Dodano: ' + autoName, 'success');
    } finally {
        setTimeout(() => {
            _excelCreatingLock = false;
            const newIdx = wells.length - 1;
            const row = document.querySelector(`tr[data-widx="${newIdx}"]`);
            const rzwEl = row && row.querySelector('input[data-field="rzednaWlazu"]');
            if (rzwEl) {
                rzwEl.focus();
                rzwEl.select();
            }
        }, 100);
    }
}

function excelSwitchTab(tab) {
    _excelActiveTab = tab;
    _excelRenderTabs();
    _excelRenderTable(tab);
    _excelUpdateHeaderProdCodes();
    /* Auto-focus na empty row gdy zakładka pusta */
    if (typeof wells !== 'undefined' && wells.length > 0) {
        var hasWellsInTab = false;
        for (var _st = 0; _st < wells.length; _st++) {
            if (_excelWellMatchesTab(wells[_st], tab)) {
                hasWellsInTab = true;
                break;
            }
        }
        if (!hasWellsInTab) {
            setTimeout(function () {
                var nameEl = document.getElementById('excel-empty-name');
                if (nameEl) nameEl.focus();
            }, 150);
        }
    }
}

function excelAddWellToTab() {
    const dn = _excelActiveTab === 'styczne' ? 'styczna' : parseInt(_excelActiveTab);

    let well;
    if (typeof createNewWell === 'function') {
        well = createNewWell(null, /** @type {any} */ (dn));
    } else {
        well = {
            id: 'well_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
            name:
                (dn === 'styczna' ? 'Studnia Styczna' : 'Studnia DN' + dn) +
                ' (#' +
                (wells.length + 1) +
                ')',
            dn: dn,
            config: [],
            przejscia: [],
            rzednaWlazu: null,
            rzednaDna: null,
            kineta: 'brak',
            psiaBuda: false,
            redukcjaDN1000: false,
            redukcjaMinH: 2500
        };
    }

    wells.push(well);
    _excelAutoSetWlaz(well);
    _excelMaxTransitions[_excelActiveTab] = _excelGetMaxTransitions();
    _excelRenderTabs();
    _excelRenderTable(_excelActiveTab);
    _excelUpdateWellCount();
    const newWIdx = wells.length - 1;
    setTimeout(() => excelSelectRow(newWIdx), 50);
    _excelDebouncedRefresh();
    showToast('Dodano: ' + well.name, 'success');
}
