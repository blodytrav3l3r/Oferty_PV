// @ts-check
/* ===== EXCEL CELL NAVIGATION — Focus, Tab, Arrows, Keyboard Shortcuts ===== */

/* ===== CELL FOCUS (Excel highlight) ===== */
function excelCellFocus(el) {
    if (el.tagName === 'INPUT' && el.type !== 'number' && el.type !== 'range') {
        try {
            el.select();
        } catch (_e) {}
    }
    _excelUserEditing = true; /* blokuje polling */
    /* Wybór wiersza obsługuje delegowany focusin na container — nie dubluj logiki */
}
function excelCellBlur(el) {
    /* Przywróć tło komórki z data-orig-bg na TD (nie na INPUT) */
    if (el.tagName === 'INPUT') {
        const td = el.closest('td');
        if (td) td.style.boxShadow = '';
    }
    _excelUserEditing = false; /* wznawia polling */
}

/* ===== ARROW KEY NAVIGATION — virtual-aware (excelVirtualActiveCell SSoT) ===== */
function _excelVirtualHandleArrow(e) {
    const key = e.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight')
        return false;
    // composing guard — nie niszcz edycji IME
    const ae0 = /** @type {any} */ (document.activeElement);
    if (
        ae0 &&
        (ae0.isComposing || (ae0.getAttribute && ae0.getAttribute('data-composing') === '1'))
    )
        return true;
    const emptyRow = document.getElementById('excel-empty-row');
    const inEmpty = emptyRow && emptyRow.contains(e.target);
    // ensure active cursor initialized from current target
    if (typeof _excelVirtualSyncActiveFromElement === 'function') {
        if (!_excelVirtualActiveCell) _excelVirtualSyncActiveFromElement(e.target);
        // jeśli nadal brak (focus poza grid), init na first visible
        if (
            !_excelVirtualActiveCell &&
            typeof _excelVirtualTotal !== 'undefined' &&
            _excelVirtualTotal > 0
        ) {
            // start na pierwszej fokusowalnej ('name'), nie na LogicalCols[0]='check'
            const cols =
                typeof _excelVirtualLogicalCols !== 'undefined' ? _excelVirtualLogicalCols : [];
            const firstCol = cols.indexOf('name') >= 0 ? 'name' : cols[0] || 'name';
            _excelVirtualActiveCell = { logicalRow: 0, logicalColId: firstCol };
        }
    }
    if (!_excelVirtualActiveCell) return true;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const step = key === 'ArrowRight' ? 1 : -1;
        // Wiersz spod fokusu — jedyne źródło prawdy. Brak wiersza = bezpieczny
        // no-op (bez globalnego fallbacku — druga definicja fokusowalności
        // wprowadziłaby kolejny rozjazd modeli).
        const focusTr =
            e.target && e.target.closest
                ? e.target.closest('tr[data-logical-row],tr#excel-empty-row')
                : null;
        let row = focusTr;
        if (!row && typeof document !== 'undefined') {
            const container = document.getElementById('excel-table-container');
            row =
                _excelVirtualActiveCell.logicalRow === _excelVirtualTotal
                    ? document.getElementById('excel-empty-row')
                    : container
                      ? container.querySelector(
                            'tr[data-logical-row="' + _excelVirtualActiveCell.logicalRow + '"]'
                        )
                      : null;
        }
        if (!row) return true;
        // samonaprawa kursora: wiersz spod fokusu wygrywa ze starym active
        if (row.id === 'excel-empty-row') {
            _excelVirtualActiveCell.logicalRow = _excelVirtualTotal;
        } else if (row.getAttribute) {
            const lr = parseInt(row.getAttribute('data-logical-row'), 10);
            if (!isNaN(lr)) _excelVirtualActiveCell.logicalRow = lr;
        }
        // krok po fokusowalnych logicalColId (nie po TD-index — Lp/Wys/gap/akcje
        // nie mają inputa; TD-index != rowEls-index). Invariant: ta sama
        // sekwencja co legacy rowEls.
        const ids =
            typeof _excelVirtualFocusableIds === 'function' ? _excelVirtualFocusableIds(row) : [];
        if (ids.length === 0) return true;
        let pos = ids.indexOf(_excelVirtualActiveCell.logicalColId);
        if (pos < 0) {
            // stary cursor na nie-fokusowalnej (np. 'wys'/'check' sprzed fixa
            // albo Up/Down na kolumnie-tekście) — zakotwicz do elementu spod
            // fokusu, w kierunku kroku (wstawienie, nie zgadywanie).
            const cols =
                typeof _excelVirtualLogicalCols !== 'undefined' ? _excelVirtualLogicalCols : [];
            const curTd = e.target && e.target.closest ? e.target.closest('td') : null;
            const curTdIdx =
                curTd && row.contains && row.contains(curTd) && row.children
                    ? Array.prototype.indexOf.call(row.children, curTd)
                    : -1;
            if (curTdIdx >= 0) {
                let best = -1;
                for (let i = 0; i < ids.length; i++) {
                    const ti =
                        typeof _excelVirtualGetColIdxForId === 'function'
                            ? _excelVirtualGetColIdxForId(ids[i])
                            : cols.indexOf(ids[i]);
                    if (step > 0 ? ti > curTdIdx : ti < curTdIdx) {
                        if (best < 0 || (step > 0 ? ti < best : ti > best)) best = ti;
                    }
                }
                if (best >= 0) {
                    _excelVirtualActiveCell.logicalColId = cols[best];
                    pos = ids.indexOf(cols[best]);
                } else {
                    return true; // krawędź — no-op jak legacy
                }
            } else {
                return true;
            }
        } else {
            const nextPos = pos + step;
            if (nextPos < 0 || nextPos >= ids.length) return true; // krawędź — no-op
            _excelVirtualActiveCell.logicalColId = ids[nextPos];
        }
        if (inEmpty) {
            if (typeof _excelVirtualFocusCell === 'function')
                _excelVirtualFocusCell(_excelVirtualActiveCell);
            return true;
        }
        // jeśli wiersz w viewport — fokus bez rendera, inaczej ensureVisible+render
        const inView =
            _excelVirtualActiveCell.logicalRow >= _excelVirtualStart &&
            _excelVirtualActiveCell.logicalRow < _excelVirtualEnd;
        if (inView) {
            if (typeof _excelVirtualFocusCell === 'function')
                _excelVirtualFocusCell(_excelVirtualActiveCell);
        } else {
            if (typeof _excelVirtualEnsureVisible === 'function')
                _excelVirtualEnsureVisible(_excelVirtualActiveCell.logicalRow);
            if (typeof _excelVirtualFocusCell === 'function')
                _excelVirtualFocusCell(_excelVirtualActiveCell);
        }
        return true;
    }

    // ArrowUp / ArrowDown — dokładnie 1 logiczny wiersz
    const dir = key === 'ArrowDown' ? 1 : -1;
    const total = typeof _excelVirtualTotal !== 'undefined' ? _excelVirtualTotal : 0;
    let nextRow = _excelVirtualActiveCell.logicalRow + dir;
    // clamp do [0, total] gdzie total = pozycja pustego wiersza
    if (nextRow < 0) nextRow = 0;
    if (nextRow > total) nextRow = total;
    // jeśli już na granicy i próba wyjścia poza total — no-op (ArrowDown na empty)
    if (nextRow === _excelVirtualActiveCell.logicalRow) {
        // na pustym wierszu ArrowDown = no-op, ArrowUp z pustego = ostatni wiersz (już obsłużone clamp)
        return true;
    }
    // zapamiętaj kolumnę (TD index) dla zachowania kolumny przy przejściu data<->empty
    if (!inEmpty && nextRow === total) {
        // data → empty: zachowaj colId (już w active), dodatkowo _excelLastDataCol dla legacy compat
        const curTd = e.target.closest ? e.target.closest('td') : null;
        const curTr = e.target.closest ? e.target.closest('tr') : null;
        if (curTd && curTr) {
            try {
                _excelLastDataCol = Array.prototype.indexOf.call(curTr.children, curTd);
            } catch (_f) {}
        }
    }
    if (inEmpty && dir === -1) {
        // empty → data: użyj zachowanej kolumny jeśli logicalColId nie pasuje
        // active already has logicalColId from empty, keep it
    }
    _excelVirtualActiveCell.logicalRow = nextRow;
    // jeśli target w viewport — fokus bez scrolla (kluczowe doprecyzowanie 1)
    const needsScroll = !(nextRow >= _excelVirtualStart && nextRow < _excelVirtualEnd);
    // empty row poza normalnym zakresem: zawsze wymaga render jeśli nie na dole
    const needsScrollEmpty = nextRow === total && _excelVirtualEnd !== total;
    if (needsScroll || needsScrollEmpty) {
        if (typeof _excelVirtualEnsureVisible === 'function') _excelVirtualEnsureVisible(nextRow);
    }
    if (typeof _excelVirtualFocusCell === 'function')
        _excelVirtualFocusCell(_excelVirtualActiveCell);
    else {
        // fallback: legacy focus
        const container = document.getElementById('excel-table-container');
        const row = container
            ? container.querySelector('tr[data-logical-row="' + nextRow + '"]')
            : null;
        if (row) {
            const colIdx = _excelVirtualLogicalCols.indexOf(_excelVirtualActiveCell.logicalColId);
            const td = row.children[colIdx];
            const el = td ? td.querySelector('input, select, .excel-sel-wrap') : null;
            if (el) el.focus();
        }
    }
    return true;
}

function _excelHandleArrow(e) {
    // virtual path — SSoT logicalRow, nie DOM
    try {
        const virtEnabled =
            typeof window !== 'undefined' &&
            typeof window._excelVirtualIsEnabled === 'function' &&
            window._excelVirtualIsEnabled();
        const hasVirtFlag = typeof window !== 'undefined' ? !!window._excelVirtualIsEnabled : false;
        // fallback: check let global via typeof guarded (TDZ safe via window check first)
        const letFlag = (function () {
            try {
                return typeof _excelVirtualEnabled !== 'undefined' && !!_excelVirtualEnabled;
            } catch (_ex) {
                return hasVirtFlag && virtEnabled;
            }
        })();
        if (virtEnabled && letFlag) {
            const overlay = document.getElementById('excel-table-overlay');
            const container = document.getElementById('excel-table-container');
            const inGrid = container && e.target && container.contains(e.target);
            const inEmptyCheck = document.getElementById('excel-empty-row');
            const inEmpty = inEmptyCheck && inEmptyCheck.contains(e.target);
            if (overlay && (inGrid || inEmpty)) {
                const handled = _excelVirtualHandleArrow(e);
                if (handled) return;
            }
        }
    } catch (_virtErr) {}
    /* Kiedy focus jest w pustym wierszu — obsłuż strzałki specjalnie (wszystkie komórki) */
    const emptyRow = document.getElementById('excel-empty-row');
    if (emptyRow && emptyRow.contains(e.target)) {
        _excelHandleEmptyRowArrow(e);
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

    // Znajdź wiersze data (pomiń empty-row i ukryte przez filtr wyszukiwania)
    const allRows = Array.from(container.querySelectorAll('tbody tr'));
    const dataRows = allRows.filter(
        (r) => r.hasAttribute('data-widx') && r.style.display !== 'none'
    );
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
    /* Elementy wiersza docelowego — przy nawigacji pionowej to nie jest bieżący wiersz */
    let targetEls = rowEls;

    if (e.key === 'ArrowRight') {
        next = rowEls[colIdx + 1] || null;
    } else if (e.key === 'ArrowLeft') {
        next = rowEls[colIdx - 1] || null;
    } else if (e.key === 'ArrowDown') {
        const nextRow = dataRows[currentRowIdx + 1];
        if (!nextRow) {
            /* zapamietaj indeks td.children (nie index z rowEls) */
            const tddx = target.closest('td');
            if (tddx && tddx.parentElement === tr) {
                _excelLastDataCol = Array.prototype.indexOf.call(tr.children, tddx);
            }
            /* ostatni rzad danych — przejdz do pustego wiersza na tej samej kolumnie */
            const emptyRow = document.getElementById('excel-empty-row');
            if (emptyRow) {
                e.preventDefault();
                const emptyEls = _excelGetNavElements(emptyRow);
                const tdIdx = _excelLastDataCol;
                const tdAtCol = tdIdx >= 0 ? emptyRow.children[tdIdx] : null;
                let targetEl = tdAtCol
                    ? tdAtCol.querySelector('input, select, .excel-sel-wrap')
                    : null;
                if (!targetEl || _excelIsDisabledNav(targetEl)) {
                    targetEl =
                        emptyEls[Math.min(colIdx, emptyEls.length - 1)] || emptyEls[0] || null;
                    targetEl = _excelSkipDisabled(targetEl, emptyEls, colIdx, 1) || targetEl;
                }
                if (targetEl) _excelFocusNavEl(targetEl, emptyEls, 'down');
            }
            return;
        }
        const downWIdx = parseInt(nextRow.getAttribute('data-widx'));
        if (
            !isNaN(downWIdx) &&
            typeof currentWellIndex !== 'undefined' &&
            downWIdx !== currentWellIndex
        ) {
            excelSelectRow(downWIdx);
        }
        const nextEls = _excelGetNavElements(nextRow);
        next = nextEls[Math.min(colIdx, nextEls.length - 1)] || null;
        next = _excelSkipDisabled(next, nextEls, colIdx, 1);
        targetEls = nextEls;
    } else if (e.key === 'ArrowUp') {
        const prevRow = dataRows[currentRowIdx - 1];
        if (prevRow) {
            const upWIdx = parseInt(prevRow.getAttribute('data-widx'));
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
            targetEls = prevEls;
        }
    }

    if (next) {
        _excelFocusNavEl(next, targetEls, e.key.replace('Arrow', '').toLowerCase());
    }
}

/** Obsługa strzałek gdy focus jest w pustym wierszu — pełna nawigacja po wszystkich komórkach */
function _excelHandleEmptyRowArrow(e) {
    const emptyRow = document.getElementById('excel-empty-row');
    if (!emptyRow) return;
    const rowEls = _excelGetNavElements(emptyRow);
    const target = _excelNormalizeNavTarget(e.target);
    if (!target) return;
    const colIdx = rowEls.indexOf(target);
    if (colIdx === -1) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') return; /* nic poniżej */
    if (e.key === 'ArrowUp') {
        const drUp = Array.from(
            document.querySelectorAll('#excel-table-container tbody tr[data-widx]')
        ).filter(function (r) {
            return r.style.display !== 'none';
        });
        const lastRowUp = drUp[drUp.length - 1];
        if (!lastRowUp) return;
        const lastElsUp = _excelGetNavElements(lastRowUp);
        // Mapuj po indeksie TD (nie rowEls) by zachować kolumnę przy różnej liczbie disabled w data row
        const tdIdx = Array.prototype.indexOf.call(emptyRow.children, target.closest('td'));
        const tdAtCol = lastRowUp.children[tdIdx] || null;
        let targetEl = tdAtCol ? tdAtCol.querySelector('input, select, .excel-sel-wrap') : null;
        // fallback: najbliższy enabled w pozycji colIdx
        if (!targetEl || _excelIsDisabledNav(targetEl)) {
            targetEl = lastElsUp[Math.min(colIdx, lastElsUp.length - 1)] || null;
            targetEl = _excelSkipDisabled(targetEl, lastElsUp, colIdx, -1) || targetEl;
        }
        if (targetEl) {
            // zapamiętaj kolumnę dla ArrowUp z pustego
            _excelLastDataCol = tdIdx;
            _excelFocusNavEl(targetEl, lastElsUp, 'up');
        }
        return;
    }
    if (e.key === 'ArrowRight') {
        let next = rowEls[colIdx + 1] || null;
        next = _excelSkipDisabled(next, rowEls, colIdx, 1);
        if (next) _excelFocusNavEl(next, rowEls, 'right');
        return;
    }
    if (e.key === 'ArrowLeft') {
        let prev = rowEls[colIdx - 1] || null;
        prev = _excelSkipDisabled(prev, rowEls, colIdx, -1);
        if (prev) _excelFocusNavEl(prev, rowEls, 'left');
        return;
    }
}

/** Normalizuj dowolny target do elementu nawigacyjnego (INPUT lub DIV.excel-sel-wrap) */
function _excelNormalizeNavTarget(el) {
    if (!el) return null;
    // INPUT — OK
    if (el.tagName === 'INPUT') return el;
    // SELECT — szukaj wrappera, fallback na sam SELECT
    if (el.tagName === 'SELECT') {
        const wrap = el.closest('.excel-sel-wrap');
        return wrap || el;
    }
    // DIV.excel-sel-wrap — OK
    if (el.classList && el.classList.contains('excel-sel-wrap')) return el;
    // Inny element wewnątrz wrappera
    if (el.closest) {
        const parentWrap = el.closest('.excel-sel-wrap');
        if (parentWrap) return parentWrap;
    }
    return null;
}

/** Pomiń disabled elementy — szukaj enabled w kierunku +1/-1 */
function _excelSkipDisabled(el, els, startIdx, dir) {
    if (!el || !_excelIsDisabledNav(el)) return el;
    const from = Math.min(startIdx, els.length - 1);
    // Szukaj dalej w kierunku dir
    for (let i = from + dir; i >= 0 && i < els.length; i += dir) {
        if (!_excelIsDisabledNav(els[i])) return els[i];
    }
    // Szukaj w przeciwnym kierunku
    for (let i = from - dir; i >= 0 && i < els.length; i -= dir) {
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
        const sel = el.querySelector('select');
        return sel && sel.disabled;
    }
    return false;
}

/** Zmierz laczna szerokosc sticky-left kolumn (pierwsze 7 kolumn tabeli) */
function _excelGetStickyColumnsWidth() {
    const container = document.getElementById('excel-table-container');
    const table = container ? container.querySelector('table') : null;
    const firstRow = table ? table.querySelector('thead tr') : null;
    if (!firstRow) return 0;
    let w = 0;
    for (let i = 0; i < 7 && i < firstRow.children.length; i++) {
        w += /** @type {HTMLElement} */ (firstRow.children[i]).offsetWidth;
    }
    return w;
}

/** Focusuj element nawigacji, pomijając disabled — iteracyjnie (bez ryzyka stack overflow).
 * opts.noScroll: fokus bez ruszania scrollem (restore po recyklu virtual — inaczej
 * focus() + korekta ciągną scroll z powrotem do komórki i nie da się odscrollować). */
function _excelFocusNavEl(el, rowEls, dir, opts) {
    if (!el) return;
    const noScroll = !!(opts && opts.noScroll);
    const step = dir === 'right' || dir === 'down' ? 1 : -1;
    let limit = rowEls.length + 1; /* max iteracji = rozmiar wiersza + 1 */
    let cur = el;
    while (cur && limit-- > 0) {
        if (!_excelIsDisabledNav(cur)) {
            if (noScroll) {
                try {
                    cur.focus({ preventScroll: true });
                } catch (_fs) {
                    cur.focus();
                }
            } else {
                cur.focus();
            }
            /* Scroll-into-view bez scrollIntoView (nie uwzglednia sticky headera/kolumn) */
            const container = document.getElementById('excel-table-container');
            const headerEl = document.querySelector('#excel-table-container thead');
            const headerH = headerEl ? /** @type {HTMLElement} */ (headerEl).offsetHeight : 60;
            const MARGIN = 5;
            /* Reczna korekta scroll — element MUSI byc widoczny ponizej sticky headera
               i na prawo od sticky-left kolumn (inaczej natywny focus chowa go za nie).
               Przy noScroll (restore po recyklu) pomijamy — użytkownik scrolluje gdzie chce. */
            if (container && !noScroll) {
                const elRect = cur.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                /* Pion: jesli element jest nad widocznym obszarem (elRect.top < containerRect.top + headerH)
                   lub calkowicie poza viewport — przewin w dol */
                if (elRect.top < containerRect.top + headerH + MARGIN) {
                    /* Element za wysoko / zakryty headerm — przewin w dol */
                    const diffDown = containerRect.top + headerH + MARGIN - elRect.top;
                    container.scrollTop -= diffDown;
                } else if (elRect.top + elRect.height > containerRect.bottom) {
                    /* Element za nisko — przewin w gore (w gore kontenera) */
                    const diffUp = elRect.bottom - containerRect.bottom + MARGIN;
                    container.scrollTop += diffUp;
                }
                /* Poziom: uwzglednij sticky-left kolumny (zajmuja poczatek scrollporta) */
                const stickyW = _excelGetStickyColumnsWidth();
                if (stickyW > 0) {
                    if (elRect.left < containerRect.left + stickyW + MARGIN) {
                        /* Element za sticky kolumnami — przesun w prawo (zmniejsz scrollLeft) */
                        const diffLeft = containerRect.left + stickyW + MARGIN - elRect.left;
                        container.scrollLeft -= diffLeft;
                    } else if (elRect.right > containerRect.right) {
                        /* Element poza prawa krawedzia — przesun w lewo (zwieksz scrollLeft) */
                        const diffRight = elRect.right - containerRect.right + MARGIN;
                        container.scrollLeft += diffRight;
                    }
                }
            }
            if (
                cur.tagName === 'INPUT' &&
                !cur.disabled &&
                cur.type !== 'number' &&
                cur.type !== 'range' &&
                cur.select
            )
                try {
                    cur.select();
                } catch (_e) {}
            const tr = cur.closest('tr[data-widx]');
            if (tr) {
                const wIdx = parseInt(tr.getAttribute('data-widx'), 10);
                if (
                    !isNaN(wIdx) &&
                    (typeof currentWellIndex === 'undefined' || wIdx !== currentWellIndex)
                ) {
                    excelSelectRow(wIdx);
                }
            }
            return;
        }
        const curIdx = rowEls.indexOf(cur);
        cur = rowEls[curIdx + step] || null;
    }
}

/* ===== KEYBOARD SHORTCUTS (Excel-like) ===== */
function _excelHandleKeydown(e) {
    /* Tylko gdy kontener Excela jest otwarty */
    const overlay = document.getElementById('excel-table-overlay');
    if (!overlay) return;

    const isCtrl = e.ctrlKey || e.metaKey;

    /* Ctrl+F = focus wyszukiwarki */
    if (isCtrl && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const input = document.getElementById('excel-search-input');
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    /* Ctrl+Z = undo (poza edycją w inpucie — tam natywne undo pola) */
    if (isCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (e.target.tagName === 'INPUT') return; /* natywne undo wpisywania */
        e.preventDefault();
        _excelUndo();
        return;
    }
    /* Ctrl+Y / Ctrl+Shift+Z = redo */
    if (
        (isCtrl && !e.shiftKey && (e.key === 'y' || e.key === 'Y')) ||
        (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
    ) {
        if (e.target.tagName === 'INPUT') return; /* natywne redo pola */
        e.preventDefault();
        _excelRedo();
        return;
    }

    /* Delete = wyczyść zaznaczone komórki */
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
            return; /* edycja w komórce */
        if (e.target.tagName === 'BUTTON') return; /* fokus na przycisku wiersza */
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        _excelPasteInProgress = true;
        try {
            _excelSelectedCells.forEach(function (cell) {
                if (cell.colIdx === 3) return; /* nazwa studni — nigdy nie kasuj */
                const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
                if (!row) return;
                /* Rozwiąż przez indeks TD — colIdx to indeks td, nie index z rowEls */
                const td = row.children[cell.colIdx];
                const target = td ? td.querySelector('input, select') : null;
                if (!target) return;
                _excelSetCellValue(target, '');
            });
            showToast('Wyczyszczono ' + _excelSelectedCells.length + ' komórek', 'info');
        } finally {
            _excelPasteInProgress = false;
        }
        return;
    }

    /* Ctrl+M = przełącz AUTO/MANUAL dla aktywnego wiersza */
    if (isCtrl && (e.key === 'm' || e.key === 'M')) {
        const activeRow = document.activeElement
            ? document.activeElement.closest('tr[data-widx]')
            : null;
        if (!activeRow) return;
        const wIdx = parseInt(activeRow.getAttribute('data-widx'), 10);
        if (isNaN(wIdx)) return;
        e.preventDefault();
        if (typeof _excelToggleWellAutoMode === 'function') _excelToggleWellAutoMode(wIdx);
        return;
    }

    /* Ctrl+Shift+A = auto-dobór elementów dla aktywnego wiersza (jak przycisk Run) */
    if (isCtrl && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        const activeRow = document.activeElement
            ? document.activeElement.closest('tr[data-widx]')
            : null;
        if (!activeRow) return;
        const wIdx = parseInt(activeRow.getAttribute('data-widx'), 10);
        if (isNaN(wIdx)) return;
        e.preventDefault();
        if (typeof _excelRunAutoSelectForWell === 'function') _excelRunAutoSelectForWell(wIdx);
        return;
    }

    /* Ctrl+A = zaznacz wszystko (bez Shift — Ctrl+Shift+A to auto-dobór) */
    if (isCtrl && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        /* Tylko wiersze widoczne (filtr wyszukiwarki) — ukryte pomijamy,
           inaczej Delete/Ctrl+X po Ctrl+A wyczyściłby ukryte studnie. */
        const allRows = _excelGetVisibleRows();
        _excelDeselectAllCells();
        _excelDeselectAllCols();
        allRows.forEach(function (row) {
            /* wIdx z atrybutu — DOM order może się różnić (filtrowanie, wstawianie) */
            const wIdx = parseInt(row.getAttribute('data-widx'), 10);
            if (isNaN(wIdx)) return;
            const tds = row.querySelectorAll('td');
            tds.forEach(function (td, cIdx) {
                if (cIdx < 4) return; /* pomiń checkbox, A/M, Lp + Nr Studni (nazwa nigdy) */
                _excelSelectedCells.push({ wIdx: wIdx, colIdx: cIdx });
                td.classList.add('cell-selected');
            });
        });
        _excelLastClickedCell = null;
        _excelUpdateSelectionSummary();
        showToast('Zaznaczono wszystkie komórki', 'info');
        return;
    }

    /* Ctrl+X = wytnij. Nie przechwytujemy w keydown — natywny `cut` event
       (obsługiwany na document, wzorzec jak Ctrl+C) dostarcza ClipboardEvent
       z clipboardData; _excelHandleCopy wtedy poprawnie wypełnia schowek.
       Wcześniejszy kod wołał _excelHandleCopy na KeyboardEvent (brak
       clipboardData) → schowek pusty, a komórki wyczyszczone = utrata danych. */
    if (isCtrl && (e.key === 'x' || e.key === 'X')) {
        if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
        return;
    }

    /* Ctrl+D = kopiuj w dół (z zaznaczeniem) / duplikacja studni (bez zaznaczenia) */
    if (isCtrl && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) {
            /* Bez zaznaczenia komórek: duplikuj aktywny wiersz jako nową studnię */
            const activeRow = document.activeElement
                ? document.activeElement.closest('tr[data-widx]')
                : null;
            if (!activeRow) return;
            const dupWIdx = parseInt(activeRow.getAttribute('data-widx'), 10);
            if (isNaN(dupWIdx)) return;
            e.preventDefault();
            if (typeof excelDuplicateWell === 'function') excelDuplicateWell(dupWIdx);
            return;
        }
        if (_excelSelectedCells.length === 0) {
            /* Zaznaczone tylko kolumny — deleguj do _excelHandleFillDown,
               który obsługuje kolumny (wypełnia kolumnę wartością aktywnej komórki). */
            e.preventDefault();
            if (typeof _excelHandleFillDown === 'function') _excelHandleFillDown();
            return;
        }
        e.preventDefault();
        _excelSaveUndoSnapshot();
        _excelPasteInProgress = true;
        try {
            _excelSelectedCells.forEach(function (cell) {
                if (cell.wIdx === 0) return;
                if (cell.colIdx === 3) return; /* nazwa studni — nigdy nie nadpisuj */
                const srcRow = document.querySelector('tr[data-widx="' + (cell.wIdx - 1) + '"]');
                const dstRow = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
                if (!srcRow || !dstRow) return;
                const tdDst = dstRow.children[cell.colIdx];
                const tdSrc = srcRow.children[cell.colIdx];
                const target = tdDst ? tdDst.querySelector('input, select') : null;
                const src = tdSrc ? tdSrc.querySelector('input, select') : null;
                if (!target || !src) return;
                _excelSetCellValue(
                    target,
                    /** @type {HTMLInputElement | HTMLSelectElement} */ (src).value
                );
            });
            showToast('Skopiowano w dół', 'info');
        } finally {
            _excelPasteInProgress = false;
        }
        return;
    }

    /* Ctrl+R = kopiuj w prawo (Ctrl+Shift+R = twarde odświeżenie przeglądarki) */
    if (isCtrl && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        if (_excelSelectedCells.length === 0) return;
        e.preventDefault();
        _excelSaveUndoSnapshot();
        _excelPasteInProgress = true;
        try {
            _excelSelectedCells.forEach(function (cell) {
                if (cell.colIdx <= 3) return; /* nazwa studni i kolumny strukturalne — nie kopiuj */
                const row = document.querySelector('tr[data-widx="' + cell.wIdx + '"]');
                if (!row) return;
                const tdR = row.children[cell.colIdx];
                const tdRSrc = row.children[cell.colIdx - 1];
                const target = tdR ? tdR.querySelector('input, select') : null;
                const src = tdRSrc ? tdRSrc.querySelector('input, select') : null;
                if (!target || !src) return;
                _excelSetCellValue(
                    target,
                    /** @type {HTMLInputElement | HTMLSelectElement} */ (src).value
                );
            });
            showToast('Skopiowano w prawo', 'info');
        } finally {
            _excelPasteInProgress = false;
        }
        return;
    }
    /* Ctrl+Enter = wypełnij zaznaczenie wartością komórki aktywnej */
    if (isCtrl && e.key === 'Enter') {
        if (_excelSelectedCells.length === 0 && _excelSelectedCols.length === 0) return;
        e.preventDefault();
        if (typeof _excelHandleFillDown === 'function') _excelHandleFillDown();
        return;
    }
}

/* ===== Rejestracja globali ===== */
window.excelCellFocus = excelCellFocus;
window.excelCellBlur = excelCellBlur;
