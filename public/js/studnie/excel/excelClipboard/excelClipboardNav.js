// @ts-check
/* ===== EXCEL CLIPBOARD — Nawigacja klawiszowa ===== */

function _excelHandleTab(e) {
    let target = e.target;
    if (!target) return;
    // Normalizuj target — SELECT → wrapper, wrapper OK, INPUT OK
    if (target.tagName === 'SELECT') {
        const w = target.closest('.excel-sel-wrap');
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
    const idx = navEls.indexOf(target);
    if (idx === -1) return;

    // Szukaj następnego/poprzedniego nawigacyjnego elementu w wierszu lub następnych wierszach
    e.preventDefault();
    const allRows = Array.from(container.querySelectorAll('tbody tr[data-widx]'));
    const rowIdx = allRows.indexOf(tr);
    let next = null;
    if (!e.shiftKey) {
        next = navEls[idx + 1];
        if (!next && allRows[rowIdx + 1]) {
            const nextRowEls = _excelGetNavElements(allRows[rowIdx + 1]);
            next = nextRowEls[0];
        }
    } else {
        next = navEls[idx - 1];
        if (!next && allRows[rowIdx - 1]) {
            const prevRowEls = _excelGetNavElements(allRows[rowIdx - 1]);
            next = prevRowEls[prevRowEls.length - 1];
        }
    }
    if (next) {
        _excelFocusNavEl(next, navEls, e.shiftKey ? 'left' : 'right');
    }
}

function _excelHandleArrow(e) {
    /* Kiedy focus jest w pustym wierszu — obsłuż strzałki specjalnie */
    var emptyInput = document.getElementById('excel-empty-name');
    const emptyRzw = document.getElementById('excel-empty-rzw');
    const emptyRzd = document.getElementById('excel-empty-rzd');
    if (emptyInput && (e.target === emptyInput || e.target === emptyRzw || e.target === emptyRzd)) {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
            return; /* nic poniżej */
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const drUp = document.querySelectorAll('#excel-table-container tbody tr[data-widx]');
            const lastRowUp = drUp[drUp.length - 1];
            if (lastRowUp) {
                const lastElsUp = _excelGetNavElements(lastRowUp);
                /* Wybor kolumny z zapisanej wartosci _excelLastDataCol */
                let targetEl = null;
                const savedCol = typeof _excelLastDataCol === 'number' ? _excelLastDataCol : -1;
                if (savedCol >= 0 && savedCol < lastRowUp.children.length) {
                    const tdAtCol = lastRowUp.children[savedCol];
                    if (tdAtCol) {
                        const inpAtCol = tdAtCol.querySelector('input, select, .excel-sel-wrap');
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
        const nextRow = dataRows[currentRowIdx + 1];
        if (!nextRow) {
            /* zapamietaj indeks td.children (nie index z rowEls) */
            const tddx = target.closest('td');
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
        }
    }

    if (next) {
        _excelFocusNavEl(next, rowEls, e.key.replace('Arrow', '').toLowerCase());
    }
}

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

function _excelGetNavElements(row) {
    const els = [];
    const cells = row.querySelectorAll('td');
    for (let i = 0; i < cells.length; i++) {
        // Priorytet: wrapper selecta (DIV.excel-sel-wrap)
        const wrap = cells[i].querySelector('.excel-sel-wrap');
        if (wrap) {
            els.push(wrap);
            continue;
        }
        // INPUT
        const inp = cells[i].querySelector('input');
        if (inp) {
            els.push(inp);
            continue;
        }
        // Fallback: natywny select bez wrappera
        const sel = cells[i].querySelector('select');
        if (sel) {
            els.push(sel);
        }
    }
    return els;
}

function _excelSkipDisabled(el, els, startIdx, dir) {
    if (!el || !_excelIsDisabledNav(el)) return el;
    const from = Math.min(startIdx, els.length - 1);
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

function _excelFocusNavEl(el, rowEls, dir) {
    if (!el) return;
    const step = dir === 'right' || dir === 'down' ? 1 : -1;
    let limit = rowEls.length + 1; /* max iteracji = rozmiar wiersza + 1 */
    let cur = el;
    while (cur && limit-- > 0) {
        if (!_excelIsDisabledNav(cur)) {
            cur.focus();
            /* Scroll-into-view bez scrollIntoView (nie uwzglednia sticky headera) */
            const container = document.getElementById('excel-table-container');
            const headerEl = document.querySelector('#excel-table-container thead');
            const headerH = headerEl ? /** @type {HTMLElement} */ (headerEl).offsetHeight : 60;
            const MARGIN = 5;
            /* Reczna korekta scroll — element MUSI byc widoczny ponizej sticky headera */
            if (container) {
                const elRect = cur.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                /* Jesli element jest nad widocznym obszarem (elRect.top < containerRect.top + headerH)
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
            }
            if (cur.tagName === 'INPUT' && !cur.disabled && cur.select) cur.select();
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
