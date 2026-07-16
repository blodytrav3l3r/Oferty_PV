// @ts-check
/* ===== EXCEL CELL NAVIGATION — Focus, Tab, Arrows, Keyboard Shortcuts ===== */

/* ===== CELL FOCUS (Excel highlight) ===== */
function excelCellFocus(el) {
    if (el.tagName === 'INPUT') {
        el.select();
    }
    _excelUserEditing = true; /* blokuje polling */
    /* Wybór wiersza obsługuje delegowany focusin na container — nie dubluj logiki */
}
function excelCellBlur(el) {
    /* Przywróć tło komórki z data-orig-bg na TD (nie na INPUT) */
    if (el.tagName === 'INPUT') {
        var td = el.closest('td');
        if (td) td.style.boxShadow = '';
    }
    _excelUserEditing = false; /* wznawia polling */
}

/* ===== TAB KEY NAVIGATION ===== */
function _excelHandleTab(e) {
    let target = e.target;
    if (!target) return;
    // Normalizuj target — SELECT → wrapper, wrapper OK, INPUT OK
    if (target.tagName === 'SELECT') {
        var w = target.closest('.excel-sel-wrap');
        if (w) target = w;
    } else if (
        target.tagName !== 'INPUT' &&
        !(target.classList && target.classList.contains('excel-sel-wrap'))
    ) {
        return;
    }

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;
    const navEls = _excelGetNavElements(tr);
    var idx = navEls.indexOf(target);
    if (idx === -1) return;

    // Szukaj następnego/poprzedniego nawigacyjnego elementu w wierszu lub następnych wierszach
    e.preventDefault();
    var allRows = Array.from(container.querySelectorAll('tbody tr[data-widx]'));
    var rowIdx = allRows.indexOf(tr);
    var next = null;
    if (!e.shiftKey) {
        next = navEls[idx + 1];
        if (!next && allRows[rowIdx + 1]) {
            var nextRowEls = _excelGetNavElements(allRows[rowIdx + 1]);
            next = nextRowEls[0];
        }
    } else {
        next = navEls[idx - 1];
        if (!next && allRows[rowIdx - 1]) {
            var prevRowEls = _excelGetNavElements(allRows[rowIdx - 1]);
            next = prevRowEls[prevRowEls.length - 1];
        }
    }
    if (next) {
        _excelFocusNavEl(next, navEls, e.shiftKey ? 'left' : 'right');
    }
}

/* ===== ARROW KEY NAVIGATION (Excel-like) ===== */
function _excelHandleArrow(e) {
    /* Kiedy focus jest w pustym wierszu — obsłuż strzałki specjalnie */
    var emptyInput = document.getElementById('excel-empty-name');
    var emptyRzw = document.getElementById('excel-empty-rzw');
    var emptyRzd = document.getElementById('excel-empty-rzd');
    if (emptyInput && (e.target === emptyInput || e.target === emptyRzw || e.target === emptyRzd)) {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
            return; /* nic poniżej */
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            var drUp = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
            var lastRowUp = drUp[drUp.length - 1];
            if (lastRowUp) {
                var lastElsUp = _excelGetNavElements(lastRowUp);
                /* Wybor kolumny z zapisanej wartosci _excelLastDataCol */
                var targetEl = null;
                var savedCol = typeof _excelLastDataCol === 'number' ? _excelLastDataCol : -1;
                if (savedCol >= 0 && savedCol < lastRowUp.children.length) {
                    var tdAtCol = lastRowUp.children[savedCol];
                    if (tdAtCol) {
                        var inpAtCol = tdAtCol.querySelector('input, select, .excel-sel-wrap');
                        if (inpAtCol) targetEl = inpAtCol;
                    }
                }
                if (!targetEl && lastElsUp.length > 0) {
                    /* Fallback: ostatni focusowalny element w ostatnim wierszu */
                    targetEl = lastElsUp[lastElsUp.length - 1];
                }
                if (targetEl) _excelFocusNavEl(targetEl, lastElsUp, 'up');
            }
            return;
        }
        if (e.key === 'ArrowRight' || e.key === 'Tab') {
            e.preventDefault();
            if (e.target === emptyInput && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyRzd) emptyRzd.focus();
            return;
        }
        if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            if (e.target === emptyRzd && emptyRzw) emptyRzw.focus();
            else if (e.target === emptyRzw && emptyInput) emptyInput.focus();
            return;
        }
        return;
    }

    let target = e.target;
    if (!target) return;

    // Normalizuj target do elementu nawigacyjnego: INPUT lub DIV.excel-sel-wrap
    target = _excelNormalizeNavTarget(target);
    if (!target) return;

    const container = document.getElementById('excel-table-container');
    if (!container || !container.contains(target)) return;

    const tr = target.closest('tr');
    if (!tr) return;

    // Znajdź wiersze data (pomiń empty-row)
    const allRows = Array.from(container.querySelectorAll('tbody tr'));
    const dataRows = allRows.filter((r) => r.hasAttribute('data-widx'));
    const currentRowIdx = dataRows.indexOf(tr);
    if (currentRowIdx === -1) return;

    // Zbierz fokusowalne elementy: INPUT + DIV.excel-sel-wrap
    const rowEls = _excelGetNavElements(tr);
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) {
        if (typeof window.logger !== 'undefined')
            window.logger.warn(
                'excel-nav',
                'colIdx=-1 target=' + target.tagName + ' class=' + (target.className || '')
            );
        return;
    }

    let next = null;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        var nextRow = dataRows[currentRowIdx + 1];
        if (!nextRow) {
            /* zapamietaj indeks td.children (nie index z rowEls) */
            var tddx = target.closest('td');
            if (tddx && tddx.parentElement === tr) {
                _excelLastDataCol = Array.prototype.indexOf.call(tr.children, tddx);
            }
            /* ostatni rzad danych — przejdz do pustego wiersza */
            var emptyInput = document.getElementById('excel-empty-name');
            if (emptyInput) {
                e.preventDefault();
                _excelFocusNavEl(emptyInput, [], 'down');
            }
            return;
        }
        var downWIdx = parseInt(nextRow.getAttribute('data-widx'));
        if (
            !isNaN(downWIdx) &&
            typeof currentWellIndex !== 'undefined' &&
            downWIdx !== currentWellIndex
        ) {
            excelSelectRow(downWIdx);
        }
        var nextEls = _excelGetNavElements(nextRow);
        next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        next = _excelSkipDisabled(next, nextEls, colIdx, 1);
    } else if (e.key === 'ArrowUp') {
        const prevRow = dataRows[currentRowIdx - 1];
        if (prevRow) {
            var upWIdx = parseInt(prevRow.getAttribute('data-widx'));
            if (
                !isNaN(upWIdx) &&
                typeof currentWellIndex !== 'undefined' &&
                upWIdx !== currentWellIndex
            ) {
                excelSelectRow(upWIdx);
            }
            const prevEls = _excelGetNavElements(prevRow);
            next = prevEls[Math.min(colIdx, prevEls.length - 1)] || null;
            next = _excelSkipDisabled(next, prevEls, colIdx, -1);
        }
    }

    if (next) {
        _excelFocusNavEl(next, rowEls, e.key.replace('Arrow', '').toLowerCase());
    }
}

/** Normalizuj dowolny target do elementu nawigacyjnego (INPUT lub DIV.excel-sel-wrap) */
function _excelNormalizeNavTarget(el) {
    if (!el) return null;
    // INPUT — OK
    if (el.tagName === 'INPUT') return el;
    // SELECT — szukaj wrappera, fallback na sam SELECT
    if (el.tagName === 'SELECT') {
        var wrap = el.closest('.excel-sel-wrap');
        return wrap || el;
    }
    // DIV.excel-sel-wrap — OK
    if (el.classList && el.classList.contains('excel-sel-wrap')) return el;
    // Inny element wewnątrz wrappera
    if (el.closest) {
        var parentWrap = el.closest('.excel-sel-wrap');
        if (parentWrap) return parentWrap;
    }
    return null;
}

/** Pomiń disabled elementy — szukaj enabled w kierunku +1/-1 */
function _excelSkipDisabled(el, els, startIdx, dir) {
    if (!el || !_excelIsDisabledNav(el)) return el;
    var from = Math.min(startIdx, els.length - 1);
    // Szukaj dalej w kierunku dir
    for (var i = from + dir; i >= 0 && i < els.length; i += dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    // Szukaj w przeciwnym kierunku
    for (i = from - dir; i >= 0 && i < els.length; i -= dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    return null;
}

/** Sprawdź czy element nawigacyjny jest disabled */
function _excelIsDisabledNav(el) {
    if (!el) return true;
    if (el.disabled) return true;
    // Wrapper z disabled selectem
    if (el.classList && el.classList.contains('excel-sel-wrap')) {
        var sel = el.querySelector('select');
        return sel && sel.disabled;
    }
    return false;
}

/** Focusuj element nawigacji, pomijając disabled — iteracyjnie (bez ryzyka stack overflow) */
function _excelFocusNavEl(el, rowEls, dir) {
    if (!el) return;
    var step = dir === 'right' || dir === 'down' ? 1 : -1;
    var limit = rowEls.length + 1; /* max iteracji = rozmiar wiersza + 1 */
    var cur = el;
    while (cur && limit-- > 0) {
        if (!_excelIsDisabledNav(cur)) {
            cur.focus();
            /* Scroll-into-view bez scrollIntoView (nie uwzglednia sticky headera) */
            var container = document.getElementById('excel-table-container');
            var headerEl = document.querySelector('#excel-table-container thead');
            var headerH = headerEl ? /** @type {HTMLElement} */ (headerEl).offsetHeight : 60;
            var MARGIN = 5;
            /* Reczna korekta scroll — element MUSI byc widoczny ponizej sticky headera */
            if (container) {
                var elRect = cur.getBoundingClientRect();
                var containerRect = container.getBoundingClientRect();
                /* Jesli element jest nad widocznym obszarem (elRect.top < containerRect.top + headerH)
                   lub calkowicie poza viewport — przewin w dol */
                if (elRect.top < containerRect.top + headerH + MARGIN) {
                    /* Element za wysoko / zakryty headerm — przewin w dol */
                    var diffDown = containerRect.top + headerH + MARGIN - elRect.top;
                    container.scrollTop -= diffDown;
                } else if (elRect.top + elRect.height > containerRect.bottom) {
                    /* Element za nisko — przewin w gore (w gore kontenera) */
                    var diffUp = elRect.bottom - containerRect.bottom + MARGIN;
                    container.scrollTop += diffUp;
                }
            }
            if (cur.tagName === 'INPUT' && !cur.disabled && cur.select) cur.select();
            var tr = cur.closest('tr[data-widx]');
            if (tr) {
                var wIdx = parseInt(tr.getAttribute('data-widx'), 10);
                if (
                    !isNaN(wIdx) &&
                    (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)
                ) {
                    excelSelectRow(wIdx);
                }
            }
            return;
        }
        var curIdx = rowEls.indexOf(cur);
        cur = rowEls[curIdx + step] || null;
    }
}

/* ===== KEYBOARD SHORTCUTS (Excel-like) ===== */
function _excelHandleKeydown(e) {
    /* Tylko gdy kontener Excela jest otwarty */
    var overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;

    var isCtrl = e.ctrlKey || e.metaKey;

    /* Ctrl+Z = undo */
    if (isCtrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        _excelUndo();
        return;
    }
    /* Ctrl+Y / Ctrl+Shift+Z = redo */
    if (
        (isCtrl && !e.shiftKey && e.key === 'y') ||
        (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
    ) {
        e.preventDefault();
        _excelRedo();
        return;
    }

    /* Delete = wyczyść zaznaczone komórki */
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
            return; /* edycja w komórce */
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wyczyszczono ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+A = zaznacz wszystko */
    if (isCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        var allRows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelDeselectAllCells();
        allRows.forEach(function (row, rIdx) {
            var tds = row.querySelectorAll('td');
            tds.forEach(function (td, cIdx) {
                if (cIdx < 2) return; /* pomiń Lp + Nr Studni */
                _excelSelectedCells.push({ wIdx: rIdx, colIdx: cIdx });
                td.classList.add('cell-selected');
            });
        });
        _excelLastClickedCell = null;
        showToast('Zaznaczono wszystkie komórki', 'info');
        return;
    }

    /* Ctrl+X = wytnij */
    if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        /* Uzyj oryginalnego eventu — clipboardData istnieje w keydown */
        _excelHandleCopy(/** @type {any} */ (e));
        /* Potem wyczyść */
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var inputs = row.querySelectorAll('input, select');
            var target = inputs[cell.colIdx];
            if (!target) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = '';
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Wycinanie: ' + _excelSelectedCells.length + ' komórek', 'info');
        return;
    }

    /* Ctrl+D = kopiuj w dół */
    if (isCtrl && (e.key === 'd' || e.key === 'D')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            if (cell.wIdx === 0) return;
            var srcRow = document.querySelector('tr[data-widx="' + (cell.wIdx - 1) + '"]');
            var dstRow = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!srcRow || !dstRow) return;
            var tdDst = dstRow.children[cell.colIdx];
            var tdSrc = srcRow.children[cell.colIdx];
            var target = tdDst ? tdDst.querySelector('input, select') : null;
            var src = tdSrc ? tdSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w dół', 'info');
        return;
    }

    /* Ctrl+R = kopiuj w prawo */
    if (isCtrl && (e.key === 'r' || e.key === 'R')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        var rows = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
        _excelSelectedCells.forEach(function (cell) {
            if (cell.colIdx <= 1) return;
            var row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
            if (!row) return;
            var tdR = row.children[cell.colIdx];
            var tdRSrc = row.children[cell.colIdx - 1];
            var target = tdR ? tdR.querySelector('input, select') : null;
            var src = tdRSrc ? tdRSrc.querySelector('input, select') : null;
            if (!target || !src) return;
            if (target.tagName === 'SELECT') {
                /** @type {HTMLSelectElement} */ (target).value = /** @type {HTMLSelectElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (target.tagName === 'INPUT') {
                /** @type {HTMLInputElement} */ (target).value = /** @type {HTMLInputElement} */ (
                    src
                ).value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        showToast('Skopiowano w prawo', 'info');
        return;
    }
}
