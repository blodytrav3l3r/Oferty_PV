// @ts-check
/* ===== EXCEL CHANGE HANDLERS — Handlery zmian wartości w tabeli studni ===== */

/* ===== HANDLERS ===== */
/* Cichy tryb paste: model+dirty+remap, ZERO renderów — jeden finalny render robi doneCallback. */
function _excelPasteQuiet() {
    return typeof _excelPasteInProgress !== 'undefined' && _excelPasteInProgress;
}
function excelOnRzednaChange(wIdx) {
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (!row) return;
    const well = wells[wIdx];
    if (!well) return;
    if (!_excelGuardWellLocked(wIdx)) return;
    _excelClearResCache(well);
    const rzWlazuInput = row.querySelector('input[data-field="rzednaWlazu"]');
    const rzDnaInput = row.querySelector('input[data-field="rzednaDna"]');
    const rzWlazuRaw = rzWlazuInput ? parseFloat(rzWlazuInput.value) : null;
    const rzWlazu = rzWlazuRaw !== null && !isNaN(rzWlazuRaw) ? rzWlazuRaw : null;
    const rzDnaRaw = rzDnaInput ? parseFloat(rzDnaInput.value) : null;
    const rzDna = rzDnaRaw !== null && !isNaN(rzDnaRaw) ? rzDnaRaw : null;

    if (rzWlazu !== null && rzDna !== null && rzWlazu <= rzDna) {
        rzWlazuInput.classList.add('inp-error');
        rzDnaInput.classList.add('inp-error');
        showToast('Rzędna włazu musi być większa od rzędnej dna', 'error');
        return;
    }
    if (rzWlazuInput) rzWlazuInput.classList.remove('inp-error');
    if (rzDnaInput) rzDnaInput.classList.remove('inp-error');

    // P4-A4: snapshot dopiero po walidacji — odrzucona wartość nie brudzi undo.
    if (typeof _excelPasteInProgress === 'undefined' || !_excelPasteInProgress)
        _excelSaveUndoSnapshot(wIdx);
    well.rzednaWlazu = rzWlazu;
    well.rzednaDna = rzDna;
    // Dno powyżej istniejących przejść: jeden toast z listą (bez auto-clampa
    // przejść — decyduje użytkownik; wiersz i tak dostaje ERROR przez refresh).
    // W trybie quiet (paste) cicho — wynika z tła wiersza.
    if (rzDna !== null && typeof listPrzejsciaBelowDna === 'function' && !_excelPasteQuiet()) {
        const _below = listPrzejsciaBelowDna(well);
        if (_below.length > 0)
            showToast('Rzędna dna powyżej przejść: ' + _below.join(', '), 'error');
    }
    _excelMarkDirty();
    // podczas bulk paste nie odpalaj solvera ani preview per komórka — zrobi to batch na końcu (Faza3)
    if (_excelPasteQuiet()) {
        _excelMarkAsManual(wIdx);
        return;
    }
    _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);

    if (
        _excelAutoSelectEnabled &&
        well.autoSelect !== false &&
        rzWlazu !== null &&
        rzDna !== null &&
        rzWlazu > rzDna &&
        typeof autoSelectComponents === 'function'
    ) {
        _excelAutoSelectForWell(wIdx);
    } else {
        _excelMarkAsManual(wIdx);
        if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
        if (typeof _excelDebouncedRefresh === 'function') _excelDebouncedRefresh(wIdx);
    }
}

/* ===== DODAWANIE / USUWANIE KOLUMNY PRZEJŚCIA ===== */
function excelRemoveTransitionColumn() {
    const tab = _excelActiveTab || '1000';
    if (_excelAnyWellLockedInTab(tab)) {
        showToast(
            'Nie można usunąć kolumny przejścia — w tej zakładce są zablokowane studnie',
            'error'
        );
        return;
    }
    const curMax = _excelMaxTransitions[tab] || 1;
    if (curMax <= 1 && wells.length > 0) {
        showToast('Nie można usunąć — minimum 1 kolumna przejścia', 'error');
        return;
    }
    const lastIdx = curMax - 1;
    let hasData = false;
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        for (const w of wells) {
            if (!_excelWellMatchesTab(w, tab)) continue;
            if (w.przejscia && w.przejscia[lastIdx]) {
                const p = w.przejscia[lastIdx];
                const _isEmpty =
                    typeof isEmptyPrzejscie === 'function'
                        ? isEmptyPrzejscie(p)
                        : !(
                              (p.productId && p.productId !== '') ||
                              (p.tempCategory && p.tempCategory !== '') ||
                              (p.rzednaWlaczenia != null && p.rzednaWlaczenia !== '') ||
                              (p.angle && p.angle !== 0)
                          );
                if (!_isEmpty) {
                    hasData = true;
                    break;
                }
            }
        }
    }
    if (hasData) {
        showToast('Nie można usunąć — ostatnia kolumna zawiera dane', 'error');
        return;
    }
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!_excelWellMatchesTab(w, tab)) return;
            if (w.przejscia && w.przejscia.length > lastIdx) {
                w.przejscia.splice(lastIdx, 1);
            }
        });
    }
    _excelResetLayoutDependentState();
    _excelMaxTransitions[tab] = Math.max(1, curMax - 1);
    _excelRenderTable(_excelActiveTab);
    _excelDebouncedRefresh();
    showToast('Usunięto kolumnę przejścia', 'info');
}
function excelAddTransitionColumn() {
    const tab = _excelActiveTab || '1000';
    if (_excelAnyWellLockedInTab(tab)) {
        showToast(
            'Nie można dodać kolumny przejścia — w tej zakładce są zablokowane studnie',
            'error'
        );
        return;
    }
    _excelResetLayoutDependentState();
    _excelMaxTransitions[tab] = (_excelMaxTransitions[tab] || 1) + 1;
    const newMax = _excelMaxTransitions[tab];
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        wells.forEach((w) => {
            if (!_excelWellMatchesTab(w, tab)) return;
            if (!w.przejscia) w.przejscia = [];
            while (w.przejscia.length < newMax) {
                w.przejscia.push(_excelCreatePrzejscie());
            }
        });
    }
    _excelRenderTable(tab);
    _excelDebouncedRefresh();
    showToast('Dodano kolumnę przejścia', 'info');
}
function _excelCleanEmptyPrzejscia(well) {
    if (!well || !well.przejscia) return;
    if (typeof isEmptyPrzejscie === 'function') {
        well.przejscia = well.przejscia.filter(function (p) {
            return !isEmptyPrzejscie(p);
        });
        return;
    }
    well.przejscia = well.przejscia.filter(function (p) {
        return (
            (p.productId && p.productId !== '') ||
            (p.tempCategory && p.tempCategory !== '') ||
            (p.rzednaWlaczenia != null && p.rzednaWlaczenia !== '') ||
            (p.angle && p.angle !== 0)
        );
    });
}

function excelOnPrzejscieChange(wIdx, trIdx, field, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (typeof _excelPasteInProgress === 'undefined' || !_excelPasteInProgress)
        _excelSaveUndoSnapshot(wIdx);
    const well = wells[wIdx];
    if (!well) return;
    // P2: zmiana geometrii unieważnia auto-stos, ale MANUAL nie uruchamia solvera.
    // (Wcześniej _excelMarkAsManual zawsze pierwsze → _excelAutoSelectForWell
    // wycofywał się na guardzie autoSelect===false i stary stos zostawał.)
    const isGeometryField = field === 'rzednaWlaczenia' || field === 'productId';
    const autoEnabled = typeof _excelAutoSelectEnabled === 'undefined' || _excelAutoSelectEnabled;
    const isAuto = autoEnabled && well.autoSelect !== false && !well.autoLocked;
    if (!isGeometryField || !isAuto) _excelMarkAsManual(wIdx);
    if (!well.przejscia) well.przejscia = [];
    const hasExisting = trIdx < wells[wIdx].przejscia.length;
    if (!hasExisting && (!value || value === '')) return;
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    const prz = wells[wIdx].przejscia[trIdx];
    prz[field] =
        field === 'angle'
            ? parseFloat(value) || 0
            : field === 'rzednaWlaczenia'
              ? value !== '' && !isNaN(parseFloat(String(value).replace(',', '.')))
                  ? parseFloat(String(value).replace(',', '.'))
                  : null
              : value || null;
    // Clamp rzędnej do zakresu dno–właz (jak quick-edit w konfiguratorze).
    // null przechodzi bez zmian; fill/paste (quiet) clampuje cicho, bez powiadomień.
    if (
        field === 'rzednaWlaczenia' &&
        typeof prz[field] === 'number' &&
        typeof clampRzednaWlaczenia === 'function'
    ) {
        const _c = clampRzednaWlaczenia(prz[field], well);
        if ((_c.clampedLow || _c.clampedHigh) && !_excelPasteQuiet()) {
            if (typeof announceRzednaClamp === 'function') announceRzednaClamp(_c);
            else
                showToast(
                    _c.clampedLow
                        ? 'Rzędna nie może być niższa niż rzędna dna!'
                        : 'Rzędna nie może być wyższa niż rzędna włazu!',
                    'error'
                );
        }
        prz[field] = _c.value;
    }
    if (field === 'angle') {
        prz.angleExecution = parseFloat(prz.angle) || 0;
        prz.angleGony = (parseFloat(prz.angle) || 0).toFixed(2);
        prz.flowType = (parseFloat(prz.angle) || 0) === 0 ? 'WYLOT' : 'WLOT';
    }
    wells[wIdx].przejscia.forEach((p, i) => {
        p.displayIndex = i;
    });
    if (_excelPasteQuiet()) return; /* model gotowy; preview/refresh raz w doneCallback */
    // P2 invariant: po zmianie geometrii w AUTO config musi pochodzić z bieżących
    // parametrów — pełny re-solve (wzór: excelOnRzednaChange). MANUAL: tylko refresh.
    if (
        isGeometryField &&
        isAuto &&
        well.rzednaWlazu != null &&
        well.rzednaDna != null &&
        typeof autoSelectComponents === 'function'
    ) {
        _excelAutoSelectForWell(wIdx);
        return;
    }
    _excelUpdateLeftPreview(wIdx);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    /* Natychmiastowy refresh wiersza (bez czekania na debounce 800 ms):
       OT-swap z preview (enforceOtRings) mogl podmienic krag<->krag_ot —
       odswiez liczniki w miejscu + kody h3. Wiersz pobierz swiezo z DOM
       (preview mogl zrobic re-render). */
    try {
        var _przRow =
            typeof document !== 'undefined'
                ? document.querySelector('tr[data-widx="' + wIdx + '"]')
                : null;
        if (_przRow) {
            if (typeof _excelRefreshAutoCells === 'function') _excelRefreshAutoCells(wIdx, _przRow);
            if (typeof _excelRefreshKragCells === 'function') _excelRefreshKragCells(wIdx, _przRow);
        }
        /* Baza #58: labelka selecta Średnicy (dyspozytor CSP odpala tylko slot
           modelu, $selectLabel nigdy nie leci) — inputy rzędna/kąt są natywne. */
        if (
            field === 'productId' &&
            typeof _excelSyncRowSelect === 'function' &&
            wells[wIdx] &&
            wells[wIdx].przejscia &&
            wells[wIdx].przejscia[trIdx]
        )
            _excelSyncRowSelect(
                wIdx,
                'excelOnPrzejscieChange',
                [wIdx, trIdx],
                wells[wIdx].przejscia[trIdx].productId || ''
            );
        if (typeof _excelUpdateHeaderProdCodes === 'function') _excelUpdateHeaderProdCodes();
    } catch (_ePrzRefresh) {}
    _excelDebouncedRefresh(wIdx);
}

/* ===== KONTRAKT REFRESHA EXCELA (baza #58) =====
 * L0 sync / wiersz: _excelRefreshAutoCells + _excelRefreshKragCells +
 *   _excelRefreshReliefCells + _excelRefreshTransitionDnOptions + kody h3 +
 *   paint statusu (rAF) — natychmiast, bez czekania.
 * L1 sync / panele: _excelUpdateLeftPreview + _excelImmediatePreview
 *   (kafelki + diagram) — na każdy change, natychmiast.
 * L2 async / kolejka: _excelDebouncedRefresh (800 ms, maxWait 1200 ms) —
 *   TYLKO kolejka błędów + kolory duplikatów + flaga listy; panele pomija,
 *   bo L1 już je policzył (ciężkie robi gdy _excelRefreshAllErrorsPending,
 *   czyli operacje strukturalne).
 * FULL _excelRenderTable TYLKO na zdarzenia strukturalne: tab DN, +/− kolumna
 * przejścia, redukcja (inne kolumny), solver AUTO (inny config), paste/undo/
 * filtr/sort. EDYCJA KOMÓRKI NIGDY NIE ROBI FULL-RENDERA. */

/* Synchronizacja wartości + widocznej labelki overlay-selecta w edytowanym
   wierszu (baza #58). Tło: dyspozytor CSP (cspActions.js) odpala tylko PIERWSZY
   pasujący slot na event (`break`), więc przy `change` działa handler modelu
   (data-csp) ALBO `$selectLabel` (data-csp-2) — nigdy oba. Labelka nigdy nie
   odświeżała się live; maskował to pełny re-render. Selekcja po data-csp-args
   (statyczny prefiks bez "$value"), labelka z tekstu wybranej opcji
   (jak $selectLabel). No-op poza DOM (virtual slice) i bez document (testy vm).
   Zwraca true gdy zsynchronizowano. */
function _excelSyncRowSelect(wIdx, cspName, staticArgs, value) {
    try {
        if (typeof document === 'undefined') return false;
        var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
        if (!row || !row.querySelectorAll) return false;
        var sels = /** @type {any} */ (null);
        try {
            sels = row.querySelectorAll('select[data-csp="' + cspName + '"]');
        } catch (_eQ) {
            return false;
        }
        if (!sels || !sels.length) return false;
        var want = value == null ? '' : String(value);
        for (var i = 0; i < sels.length; i++) {
            var sel = sels[i];
            var raw = sel.getAttribute ? sel.getAttribute('data-csp-args') : null;
            if (!raw) continue;
            var arr = null;
            try {
                arr = JSON.parse(raw);
            } catch (_eJ) {
                continue;
            }
            if (!Array.isArray(arr)) continue;
            var ok = true;
            for (var k = 0; k < staticArgs.length; k++) {
                if (arr[k] !== staticArgs[k]) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;
            if (sel.value !== want) {
                var has = false;
                try {
                    for (var o = 0; o < sel.options.length; o++) {
                        if (String(sel.options[o].value) === want) {
                            has = true;
                            break;
                        }
                    }
                } catch (_eO) {}
                try {
                    sel.value = has ? want : '';
                } catch (_eV) {}
            }
            try {
                var wrap = sel.closest ? sel.closest('.excel-sel-wrap') : null;
                var labelEl = wrap ? wrap.querySelector('div') : null;
                if (labelEl) {
                    var txt = '—';
                    if (sel.options && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex])
                        txt = sel.options[sel.selectedIndex].text;
                    if (labelEl.textContent !== txt) labelEl.textContent = txt;
                }
            } catch (_eL) {}
            return true;
        }
    } catch (_eS) {}
    return false;
}

/* Przebudowa opcji selecta Średnica (DN) w miejscu po zmianie Rodzaju —
   bez full-rendera (baza #58). Parytet z TBODY: te same opcje
   ([['', '—'], ...availDns], label 'DN x' lub DN z '/'), ten sam SSoT
   (_excelPrzejsciaAvailDn). Nie rusza fokusa ani scrolla; no-op gdy wiersz
   poza DOM (virtual slice) — model jest źródłem prawdy, render dorysuje. */
function _excelRefreshTransitionDnOptions(wIdx, trIdx) {
    try {
        if (typeof wells === 'undefined' || !wells[wIdx]) return;
        if (typeof document === 'undefined') return;
        var well = wells[wIdx];
        var prz = well.przejscia ? well.przejscia[trIdx] : null;
        if (!prz) return;
        var tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
        var maxTr =
            typeof _excelMaxTransitions !== 'undefined' && _excelMaxTransitions[tab]
                ? _excelMaxTransitions[tab]
                : 1;
        if (trIdx < 0 || trIdx >= maxTr) return;
        var row = document.querySelector('tr[data-widx="' + wIdx + '"]');
        if (!row) return;
        var logical = 7 + trIdx * 4 + 3;
        var cell = null;
        try {
            if (typeof _excelGetCellByLogical === 'function')
                cell = _excelGetCellByLogical(row, logical);
        } catch (_eCell) {}
        if (!cell && row.children) cell = row.children[logical] || null;
        if (!cell || !cell.querySelector) return;
        var wrap = cell.querySelector('.excel-sel-wrap');
        if (!wrap) return;
        var sel = wrap.querySelector('select');
        if (!sel) return;
        var prod = null;
        try {
            prod =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(prz.productId)
                    : (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(
                          function (p) {
                              return p.id === prz.productId;
                          }
                      );
        } catch (_eProd) {}
        var activeCat = prod ? prod.category : prz.tempCategory || '';
        var refDn = null;
        try {
            if (typeof _excelPrzejsciaRefDn === 'function') refDn = _excelPrzejsciaRefDn(tab);
        } catch (_eRef) {}
        var avail = [];
        try {
            if (typeof _excelPrzejsciaAvailDn === 'function')
                avail = _excelPrzejsciaAvailDn(activeCat, refDn) || [];
        } catch (_eAvail) {}
        var esc =
            typeof escapeHtml === 'function'
                ? escapeHtml
                : function (s) {
                      return String(s);
                  };
        var escA =
            typeof escapeHtmlAttr === 'function'
                ? escapeHtmlAttr
                : function (s) {
                      return String(s == null ? '' : s).replace(/"/g, '&quot;');
                  };
        var labelFor = function (pid) {
            if (!pid) return '—';
            for (var i = 0; i < avail.length; i++) {
                if (avail[i].id !== pid) continue;
                var _lbl = null;
                try {
                    _lbl =
                        typeof _excelPrzejsciaDnLabel === 'function'
                            ? _excelPrzejsciaDnLabel(avail[i])
                            : 'DN ' + avail[i].dn;
                } catch (_eLbl) {
                    _lbl = 'DN ' + avail[i].dn;
                }
                return _lbl;
            }
            return '—';
        };
        var html = '<option value="">—</option>';
        for (var k = 0; k < avail.length; k++) {
            var _id = avail[k].id || '';
            var _lb = null;
            try {
                _lb =
                    typeof _excelPrzejsciaDnLabel === 'function'
                        ? _excelPrzejsciaDnLabel(avail[k])
                        : 'DN ' + avail[k].dn;
            } catch (_eLb) {
                _lb = 'DN ' + avail[k].dn;
            }
            html +=
                '<option value="' +
                escA(_id) +
                '"' +
                (_id === prz.productId ? ' selected' : '') +
                '>' +
                esc(_lb) +
                '</option>';
        }
        sel.innerHTML = html;
        if (sel.value !== (prz.productId || '')) {
            try {
                sel.value = prz.productId || '';
            } catch (_eVal) {}
        }
        var labelEl = wrap.querySelector('div');
        if (labelEl) {
            var _txt = labelFor(prz.productId);
            if (labelEl.textContent !== _txt) labelEl.textContent = _txt;
        }
    } catch (_eDn) {}
}

function excelOnPrzejscieTypeChange(wIdx, trIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (typeof _excelPasteInProgress === 'undefined' || !_excelPasteInProgress)
        _excelSaveUndoSnapshot(wIdx);
    const _hasExisting = wells[wIdx].przejscia && trIdx < wells[wIdx].przejscia.length;
    const _isEmptyVal = !value || String(value).trim() === '';
    if (!_hasExisting && _isEmptyVal) return;
    if (!wells[wIdx].przejscia) wells[wIdx].przejscia = [];
    while (wells[wIdx].przejscia.length <= trIdx) {
        wells[wIdx].przejscia.push(_excelCreatePrzejscie());
    }
    wells[wIdx].przejscia[trIdx].tempCategory = value || '';
    if (!value) {
        wells[wIdx].przejscia[trIdx].productId = '';
    } else {
        const currProduct = studnieProducts.find(
            (p) => p.id === wells[wIdx].przejscia[trIdx].productId
        );
        if (!currProduct || currProduct.category !== value) {
            wells[wIdx].przejscia[trIdx].productId = '';
        }
    }
    // P2: zmiana rodzaju/DN to zmiana geometrii — w AUTO z kompletnym przejściem
    // pełny re-solve (niekompletne = sam refresh, jak dotąd; ta ścieżka nie markuje MANUAL).
    const typeWell = wells[wIdx];
    const typeAutoEnabled =
        typeof _excelAutoSelectEnabled === 'undefined' || _excelAutoSelectEnabled;
    if (
        typeAutoEnabled &&
        typeWell.autoSelect !== false &&
        !typeWell.autoLocked &&
        wells[wIdx].przejscia[trIdx].productId &&
        typeWell.rzednaWlazu != null &&
        typeWell.rzednaDna != null &&
        typeof autoSelectComponents === 'function' &&
        !_excelPasteQuiet()
    ) {
        _excelAutoSelectForWell(wIdx);
        return;
    }
    /* Baza #58: brak full-rendera — liczba kolumn się nie zmienia, więc wystarczy
       in-place selectów w tym wierszu (najpierw labelka Rodzaju, potem opcje
       Średnicy). currentWellIndex nietknięty (poprzednie -1 gasiło
       podświetlenie wiersza i psuło kody h3 — bug S7). */
    if (typeof _excelPasteInProgress === 'undefined' || !_excelPasteInProgress) {
        if (typeof recalculateWellErrors === 'function' && wells[wIdx]) {
            try {
                recalculateWellErrors(wells[wIdx]);
            } catch (_e) {}
        }
        if (typeof _excelSyncRowSelect === 'function')
            _excelSyncRowSelect(wIdx, 'excelOnPrzejscieTypeChange', [wIdx, trIdx], value || '');
        if (typeof _excelRefreshTransitionDnOptions === 'function')
            _excelRefreshTransitionDnOptions(wIdx, trIdx);
        if (typeof _excelUpdateHeaderProdCodes === 'function') _excelUpdateHeaderProdCodes();
    }
    if (typeof _excelImmediatePreview === 'function' && !_excelPasteQuiet())
        _excelImmediatePreview(wIdx);
    if (!_excelPasteQuiet()) {
        if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
        _excelDebouncedRefresh(wIdx);
    }
}

/* Wspólny rdzeń modelowy włazu — handler DOM i ścieżka model-only wklejania. */
function _excelWlazModelUpdate(wIdx, productId) {
    const well = wells[wIdx];
    if (!well) return;
    well.config = (well.config || []).filter((item) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'wlaz');
    });
    if (productId) _excelInsertConfigItem(well, 'wlaz', productId, 1);
    if (typeof recalcGaskets === 'function') {
        try {
            recalcGaskets(well);
            _excelClearResCache(well);
        } catch (_e) {}
    }
    _excelMarkAsManual(wIdx);
}

function excelOnWlazChange(wIdx, productId) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!_excelPasteQuiet()) _excelSaveUndoSnapshot(wIdx);
    _excelWlazModelUpdate(wIdx, productId);
    if (_excelPasteQuiet()) return; /* model gotowy; render/preview raz w doneCallback */
    const well = wells[wIdx];
    if (typeof recalculateWellErrors === 'function' && well) {
        try {
            recalculateWellErrors(well);
        } catch (_e) {}
    }
    /* Baza #58: sam model — kolumny stałe; labelkę selecta synchronizuje
       _excelSyncRowSelect (single-slot dyspozytora), panele robi L1 poniżej. */
    if (typeof _excelMarkManualModel === 'function') _excelMarkManualModel(well);
    else _excelMarkManual(well);
    if (typeof _excelSyncRowSelect === 'function')
        _excelSyncRowSelect(wIdx, 'excelOnWlazChange', [wIdx], productId || '');
    _excelUpdateLeftPreview(wIdx);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    _excelDebouncedRefresh(wIdx);
}

/* Modelowa połowa _excelMarkManual: same flagi + sync przycisków, ZERO renderów.
   Ścieżki edycji komórki (Właz, kręgi) nie zmieniają struktury kolumn, więc
   full-render jest tam czystym kosztem (baza #58) — ciężkie panele robi L1. */
function _excelMarkManualModel(well) {
    if (!well) return;
    well.autoLocked = true;
    well.configSource = 'MANUAL';
    well.autoSelect = false;
    if (typeof _excelSyncAutoManualUI === 'function') _excelSyncAutoManualUI();
    try {
        if (typeof window !== 'undefined' && typeof window.updateAutoLockUI === 'function')
            window.updateAutoLockUI();
    } catch (_eLockUI) {}
}
function _excelMarkManual(well) {
    _excelMarkManualModel(well);
    if (typeof _excelRenderTable === 'function') _excelRenderTable(_excelActiveTab);
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
    if (typeof window.renderWellsList === 'function') window.renderWellsList();
}

function _excelWellHasHoles(well) {
    if (!well || !well.przejscia || well.przejscia.length === 0) return false;
    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
    if (rzDna === null || isNaN(rzDna)) return false;
    return well.przejscia.some((pr) => !isNaN(parseFloat(pr.rzednaWlaczenia)));
}

/* Wspólny rdzeń modelowy zmiany komponentu — jedno źródło dla handlera DOM
   (excelOnCompChange) i ścieżki model-only wklejania (brak TR w DOM przy wirtualizacji).
   Nie dotyka DOM ani nie renderuje; ogon DOM/preview jest w excelOnCompChange.
   Zwraca otMutated (realna zamiana krag <-> krag_ot). */
function _excelCompModelUpdate(wIdx, componentType, height, value, productId, redDn) {
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    const newQty = parseInt(value) || 0;
    _excelClearResCache(well);

    const filterDn = redDn
        ? parseInt(redDn)
        : well.dn === 'styczna' || well.dn === 'styczne'
          ? well.stycznaNadbudowa1200
              ? 1200
              : 1000
          : parseInt(well.dn);

    const isRingType = componentType === 'krag' || componentType === 'krag_ot';
    const hasHoles = isRingType && _excelWellHasHoles(well);

    /* Para odciążająca: czy zmieniana strona istniała przed mutacją (guard przed
       czyszczeniem pustej komórki — wtedy sync przy qty 0 robi no-op). */
    const isReliefType =
        componentType === 'pierscien_odciazajacy' ||
        componentType === 'plyta_najazdowa' ||
        componentType === 'plyta_zamykajaca';
    let hadReliefSide = false;
    if (isReliefType) {
        const wantSide =
            componentType === 'pierscien_odciazajacy'
                ? ['pierscien_odciazajacy']
                : ['plyta_najazdowa', 'plyta_zamykajaca'];
        for (const item of well.config || []) {
            const hp =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (hp && wantSide.indexOf(hp.componentType) !== -1 && (item.quantity || 0) > 0) {
                hadReliefSide = true;
                break;
            }
        }
    }

    const existingItems = [];
    if (!productId) {
        for (const item of well.config || []) {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(item.productId)
                    : studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) continue;
            if (p.componentType !== componentType) continue;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) continue;
            existingItems.push({ productId: item.productId, quantity: item.quantity });
        }
    }

    well.config = (well.config || []).filter((item) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return true;
        if (productId) return item.productId !== productId;
        if (isRingType && !hasHoles) {
            if (p.componentType !== 'krag' && p.componentType !== 'krag_ot') return true;
            if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
            return false;
        }
        if (p.componentType !== componentType) return true;
        if (height !== undefined && parseInt(p.height) !== parseInt(height)) return true;
        return false;
    });

    if (newQty > 0) {
        // Suma obu magazynów: kandydat znaleziony gdy jest w puli SWOJEJ części.
        const _excelPool =
            typeof getAvailableProductsUnion === 'function'
                ? getAvailableProductsUnion(well)
                : typeof getAvailableProducts === 'function'
                  ? getAvailableProducts(well, 'dennica').concat(
                        getAvailableProducts(well, 'nadbudowa')
                    )
                  : studnieProducts;
        let candidates;
        if (productId) {
            candidates = _excelPool.filter((p) => p.id === productId);
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        } else {
            candidates = _excelPool.filter(
                (p) =>
                    p.componentType === componentType &&
                    (p.dn === null || parseInt(p.dn) === filterDn)
            );
            if (height !== undefined)
                candidates = candidates.filter((p) => parseInt(p.height) === parseInt(height));
            if (typeof filterByWellParams === 'function')
                candidates = candidates.filter((p) => filterByWellParams(p, well));
        }
        if (existingItems.length > 0 && !productId) {
            const firstPid = existingItems[0].productId;
            const stillAvail = candidates.some((c) => c.id === firstPid);
            const pid = stillAvail ? firstPid : candidates.length > 0 ? candidates[0].id : null;
            if (pid) _excelInsertConfigItem(well, componentType, pid, newQty);
        } else if (candidates.length > 0) {
            _excelInsertConfigItem(well, componentType, candidates[0].id, newQty);
        }
    }

    let otMutated = false;
    if (componentType === 'krag' || componentType === 'krag_ot') {
        _excelCleanEmptyPrzejscia(well);
        _excelClearResCache(well);
        if (typeof enforceOtRings === 'function') {
            try {
                otMutated = enforceOtRings(well);
            } catch (_e) {}
        }
        if (otMutated && typeof _excelClearResCache === 'function') _excelClearResCache(well);
    }

    /* Para odciążająca płyta<->pierścień — kierunkowy sync w modelu (SSoT
       _excelSyncReliefPair): działa dla wpisywania, paste, fill i Delete. */
    let reliefMutated = false;
    if (isReliefType) {
        if (typeof _excelSyncReliefPair === 'function') {
            try {
                reliefMutated = _excelSyncReliefPair(well, componentType, newQty, hadReliefSide);
            } catch (_e) {}
        }
        if (reliefMutated) {
            if (typeof _excelClearResCache === 'function') _excelClearResCache(well);
            if (_excelPasteQuiet() && typeof _excelBatchReliefTouched !== 'undefined')
                _excelBatchReliefTouched = true;
        }
    }

    // Uszczelki jak w głównym konfiguratorze — auto przeliczenie po każdej zmianie nośników
    if (typeof recalcGaskets === 'function') {
        try {
            recalcGaskets(well);
            _excelClearResCache(well);
        } catch (_e) {}
    }
    return otMutated || reliefMutated;
}

/* Odświeżenie komórek pary odciążającej w miejscu (bez re-rendera).
   Po mutacji modelu partner (płyta<->pierścień) siedzi w innej kolumnie niż
   edytowana — pełny render wymieniłby DOM i wyrzucił fokus/selekcję przy
   wpisywaniu (oninput). Wartości liczy ten sam _excelCountProductInConfig
   co render TBODY; mapowanie kolumna->TD przez _excelBuildVisibleSeq
   (vis == indeks TD: select/auto pomijane, baza #47; ukryte kolumny pomijane). */
function _excelRefreshReliefCells(wIdx, row) {
    if (typeof wells === 'undefined' || !wells[wIdx] || !row) return;
    if (typeof _excelGetVisibleComponentColumns !== 'function') return;
    if (typeof _excelCountProductInConfig !== 'function') return;
    if (typeof _excelBuildVisibleSeq !== 'function') return;
    var well = wells[wIdx];
    var tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    var cols = [];
    try {
        cols = (_excelGetVisibleComponentColumns(tab, well) || []).filter(function (c) {
            return (
                c &&
                c.type !== 'select' &&
                c.type !== 'auto' &&
                (c.componentType === 'plyta_najazdowa' ||
                    c.componentType === 'plyta_zamykajaca' ||
                    c.componentType === 'pierscien_odciazajacy')
            );
        });
    } catch (_e) {
        return;
    }
    if (cols.length === 0) return;
    var seq = [];
    try {
        seq = _excelBuildVisibleSeq() || [];
    } catch (_e) {
        return;
    }
    cols.forEach(function (c) {
        var expected = 0;
        try {
            expected = _excelCountProductInConfig(
                well,
                c.componentType,
                c.height,
                c.productId,
                c.fromReduction ? c.targetDn || well.redukcjaTargetDN || 1000 : null
            );
        } catch (_e) {
            return;
        }
        var visIdx = -1;
        for (var i = 0; i < seq.length; i++) {
            if (seq[i] && seq[i].id === c.id) {
                visIdx = seq[i].vis;
                break;
            }
        }
        if (visIdx < 0 || !row.children || !row.children[visIdx]) return;
        var input = row.children[visIdx].querySelector
            ? row.children[visIdx].querySelector('input')
            : null;
        if (!input) return;
        var want = expected ? String(expected) : '';
        if (input.value !== want) input.value = want;
    });
}

/* Odświeżenie komórek kręgów (krag/krag_ot) w miejscu po zmianie przejścia
   (OT-swap enforceOtRings zamienia typy bez re-rendera). Wzorzec jak
   _excelRefreshReliefCells powyżej: wartości liczy ten sam
   _excelCountProductInConfig co render TBODY; mapowanie kolumna->TD przez
   _excelBuildVisibleSeq. Pomija element aktualnie edytowany (activeElement),
   żeby nie nadpisać wpisywanej wartości. */
function _excelRefreshKragCells(wIdx, row) {
    if (typeof wells === 'undefined' || !wells[wIdx] || !row) return;
    if (typeof _excelGetVisibleComponentColumns !== 'function') return;
    if (typeof _excelCountProductInConfig !== 'function') return;
    if (typeof _excelBuildVisibleSeq !== 'function') return;
    var well = wells[wIdx];
    var tab = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    var cols = [];
    try {
        cols = (_excelGetVisibleComponentColumns(tab, well) || []).filter(function (c) {
            return (
                c &&
                c.type !== 'select' &&
                c.type !== 'auto' &&
                (c.componentType === 'krag' || c.componentType === 'krag_ot')
            );
        });
    } catch (_e) {
        return;
    }
    if (cols.length === 0) return;
    var seq = [];
    try {
        seq = _excelBuildVisibleSeq() || [];
    } catch (_e2) {
        return;
    }
    var activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    cols.forEach(function (c) {
        var expected = 0;
        try {
            expected = _excelCountProductInConfig(
                well,
                c.componentType,
                c.height,
                c.productId,
                c.fromReduction ? c.targetDn || well.redukcjaTargetDN || 1000 : null
            );
        } catch (_e3) {
            return;
        }
        var visIdx = -1;
        for (var i = 0; i < seq.length; i++) {
            if (seq[i] && seq[i].id === c.id) {
                visIdx = seq[i].vis;
                break;
            }
        }
        if (visIdx < 0 || !row.children || !row.children[visIdx]) return;
        var input = row.children[visIdx].querySelector
            ? row.children[visIdx].querySelector('input')
            : null;
        if (!input) return;
        if (activeEl && input === activeEl) return;
        var want = expected ? String(expected) : '';
        if (input.value !== want) input.value = want;
    });
}

function excelOnCompChange(wIdx, componentType, height, value, productId, redDn) {
    if (componentType === 'uszczelka') {
        if (typeof showToast === 'function')
            showToast(
                'Uszczelki liczone automatycznie (jak w konfiguratorze) — zmień typ uszczelki w parametrach studni.',
                'info'
            );
        return;
    }
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!_excelPasteQuiet()) _excelSaveUndoSnapshot(wIdx);
    const modelMutated = _excelCompModelUpdate(
        wIdx,
        componentType,
        height,
        value,
        productId,
        redDn
    );
    if (_excelPasteQuiet()) {
        /* model+dirty gotowe; pełny re-render odroczony (flaga batch) zamiast rendera per komórka */
        if (componentType === 'krag' || componentType === 'krag_ot') {
            if (typeof _excelBatchKragTouched !== 'undefined') _excelBatchKragTouched = true;
        }
        return;
    }
    const well = wells[wIdx];
    const isRelief =
        componentType === 'plyta_najazdowa' ||
        componentType === 'plyta_zamykajaca' ||
        componentType === 'pierscien_odciazajacy';
    /* Baza #58: brak full-rendera także po zamianie krag <-> krag_ot —
       kolumny kręgów są stałe, zmieniają się tylko liczniki (in-place jak
       para relief). Flagi MANUAL stawia sam _excelCompModelUpdate. */
    if ((componentType === 'krag' || componentType === 'krag_ot') && modelMutated) {
        if (typeof recalculateWellErrors === 'function' && well) {
            try {
                recalculateWellErrors(well);
            } catch (_e) {}
        }
        if (typeof _excelMarkManualModel === 'function') _excelMarkManualModel(well);
        else _excelMarkManual(well);
    }

    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) {
        _excelRefreshAutoCells(wIdx, row);
        if (isRelief && modelMutated) _excelRefreshReliefCells(wIdx, row);
        if (
            (componentType === 'krag' || componentType === 'krag_ot') &&
            typeof _excelRefreshKragCells === 'function'
        )
            _excelRefreshKragCells(wIdx, row);
    }
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    else _excelUpdateLeftPreview(wIdx);
    _excelUpdateHeaderProdCodes();
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    _excelDebouncedRefresh(wIdx);
}

/* Wspólny rdzeń modelowy kinety — handler DOM i ścieżka model-only wklejania.
   Sync kineta->spocznik jak w głównym konfiguratorze (wellManager.js:updateWellParam)
   i popup Excel (_excelUpdateWellParam). */
function _excelKinetaModelUpdate(wIdx, value) {
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    if (!well) return;
    const oldVal = well.kineta;
    well.kineta = value;
    if (
        value === 'beton' ||
        value === 'beton_gfk' ||
        value === 'klinkier' ||
        value === 'preco' ||
        value === 'precotop' ||
        value === 'unolith' ||
        value === 'predl' ||
        value === 'kamionka' ||
        value === 'brak'
    ) {
        well.spocznik = value;
    }
    if (value === 'preco' || value === 'precotop') {
        if (oldVal !== 'preco' && oldVal !== 'precotop') {
            well.precoFullHeight = 'nie';
        }
    }
    if (value === 'preco' || value === 'precotop' || value === 'unolith') {
        well.spocznikH = '1/1';
    }
    if (value === 'brak') {
        well.spocznikH = 'brak';
    }
    if (typeof invalidateFrozenPricesForWell === 'function') {
        invalidateFrozenPricesForWell(well);
    }
    if (typeof syncKineta === 'function') syncKineta(well);
}

function excelOnKinetaChange(wIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!_excelPasteQuiet()) _excelSaveUndoSnapshot(wIdx);
    _excelKinetaModelUpdate(wIdx, value);
    if (_excelPasteQuiet()) return; /* model gotowy; preview/refresh raz w doneCallback */
    /* Baza #58: labelka selecta Kinety (single-slot dyspozytora) — in-place. */
    if (typeof _excelSyncRowSelect === 'function')
        _excelSyncRowSelect(wIdx, 'excelOnKinetaChange', [wIdx], value || '');
    _excelUpdateLeftPreview(wIdx);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    _excelDebouncedRefresh(wIdx);
}

/* Wspólny rdzeń modelowy psiej budy — handler DOM i ścieżka model-only wklejania. */
function _excelPsiaBudaModelUpdate(wIdx, checked) {
    _excelMarkAsManual(wIdx);
    const well = wells[wIdx];
    if (checked) {
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }
    well.psiaBuda = checked;
}

function excelOnPsiaBudaChange(wIdx, checked) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!_excelPasteQuiet()) _excelSaveUndoSnapshot(wIdx);
    _excelPsiaBudaModelUpdate(wIdx, checked);
    if (_excelPasteQuiet()) return; /* model gotowy; preview/refresh raz w doneCallback */
    const row = document.querySelector(`tr[data-widx="${wIdx}"]`);
    if (row) _excelRefreshAutoCells(wIdx, row);
    _excelUpdateLeftPreview(wIdx);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    _excelDebouncedRefresh(wIdx);
}

/* Wspólny rdzeń modelowy redukcji — handler DOM i ścieżka model-only wklejania.
   Bez autoSelect (asynchroniczny solver); podczas paste solver odpala raz doneCallback. */
function _excelReductionModelUpdate(wIdx, value) {
    const well = wells[wIdx];
    if (!well) return;
    if (!value) {
        well.redukcjaDN1000 = false;
        well.redukcjaTargetDN = 1000;
    } else {
        well.redukcjaDN1000 = true;
        well.redukcjaTargetDN = parseInt(value) || 1000;
    }
    _excelClearResCache(well);
}

/* ===== Redukcja — pojedynczy select: Brak / DN1000 / DN1200 ===== */
async function excelOnReductionSelectChange(wIdx, value) {
    if (!_excelGuardWellLocked(wIdx)) return;
    if (!_excelPasteQuiet()) _excelSaveUndoSnapshot(wIdx);
    _excelReductionModelUpdate(wIdx, value);
    const well = wells[wIdx];
    if (!well) return;
    if (_excelPasteQuiet()) return; /* model gotowy; solver/render raz w doneCallback */
    _excelUpdateLeftPreview(wIdx);
    if (!well.autoLocked && typeof autoSelectComponents === 'function') {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    if (typeof recalculateWellErrors === 'function' && well) {
        try {
            recalculateWellErrors(well);
        } catch (_e) {}
    }
    _excelRenderTable(_excelActiveTab);
    if (typeof _excelImmediatePreview === 'function') _excelImmediatePreview(wIdx);
    if (typeof _excelSyncActiveRowErrors === 'function') _excelSyncActiveRowErrors(wIdx);
    _excelDebouncedRefresh(wIdx);
}

/* ===== Rejestracja globali ===== */
if (typeof window !== 'undefined') {
    window.excelOnRzednaChange = excelOnRzednaChange;
    window.excelRemoveTransitionColumn = excelRemoveTransitionColumn;
    window.excelAddTransitionColumn = excelAddTransitionColumn;
    window.excelOnPrzejscieChange = excelOnPrzejscieChange;
    window.excelOnPrzejscieTypeChange = excelOnPrzejscieTypeChange;
    window.excelOnWlazChange = excelOnWlazChange;
    window.excelOnCompChange = excelOnCompChange;
    window.excelOnKinetaChange = excelOnKinetaChange;
    window.excelOnPsiaBudaChange = excelOnPsiaBudaChange;
}

/* ===== Rejestracja globali ===== */
if (typeof window !== 'undefined') {
    window.excelOnReductionSelectChange = excelOnReductionSelectChange;
}
