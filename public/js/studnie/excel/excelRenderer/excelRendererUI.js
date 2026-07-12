// @ts-check
/* ===== EXCEL RENDERER — UI: sticky, resize, select kolumn, filter, tabs ===== */

function _excelApplyStickyColumns() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    /* Zmierz rzeczywiste szerokości pierwszych 7 kolumn (checkbox, tryb, Lp, NrStudni, RzWlazu, RzDna, Wys) */
    const firstRow = table.querySelector('thead tr');
    if (!firstRow) return;
    const stickyThs = firstRow.querySelectorAll('th:nth-child(-n+7)');
    if (stickyThs.length < 2) return;
    var leftPos = 0;
    var offsets = [0];
    for (var i = 0; i < stickyThs.length - 1; i++) {
        leftPos += /** @type {HTMLElement} */ (stickyThs[i]).offsetWidth;
        offsets.push(leftPos);
    }
    /* Zastosuj do wszystkich th i td w pierwszych 7 kolumnach */
    var sel = 'th:nth-child(-n+7), td:nth-child(-n+7)';
    var cells = table.querySelectorAll(sel);
    for (var i = 0; i < cells.length; i++) {
        var colIdx = 0;
        var el = cells[i];
        var prev = el.previousElementSibling;
        while (prev) {
            colIdx++;
            prev = prev.previousElementSibling;
        }
        if (colIdx < 7 && offsets[colIdx] != null) {
            el.style.left = offsets[colIdx] + 'px';
            el.style.position = 'sticky';
            // Z-index: 30 dla thead, 5 dla tbody
            if (el.closest('thead')) {
                el.style.zIndex = '30';
            } else {
                el.style.zIndex = '5';
            }
        }
    }
}

function _excelInitColumnResize() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th) => {
        // Tylko ustaw position:relative dla kolumn ktore nie maja sticky w inline
        // (sticky columns maja position:sticky;left:N ustawione przez _excelApplyStickyColumns)
        if (th.style.position !== 'sticky') {
            th.style.position = 'relative';
        }

        const handle = document.createElement('div');
        handle.className = 'excel-col-resize-handle';
        handle.style.cssText =
            'position:absolute;top:2px;right:-1px;width:3px;height:calc(100% - 4px);cursor:col-resize;z-index:40;' +
            'background:rgba(148,163,184,0.15);border-radius:2px;transition:background 0.12s,width 0.12s,box-shadow 0.12s;';
        handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(99,102,241,0.45)';
            handle.style.width = '4px';
            handle.style.boxShadow = '0 0 6px rgba(99,102,241,0.25)';
        });
        handle.addEventListener('mouseleave', () => {
            handle.style.background = 'rgba(148,163,184,0.15)';
            handle.style.width = '3px';
            handle.style.boxShadow = 'none';
        });

        let startX = 0;
        let startWidth = 0;
        let lastDiff = 0;

        handle.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            startX = e.clientX;
            startWidth = /** @type {HTMLElement} */ (th).offsetWidth;
            lastDiff = 0;
            e.preventDefault();

            const colIndex = Array.from(headers).indexOf(th);
            const rows = table.querySelectorAll('tr');

            const onMove = (/** @type {MouseEvent} */ e2) => {
                const diff = e2.clientX - startX;
                lastDiff = diff;
                const newWidth = Math.max(30, startWidth + diff);

                // Które kolumny zmieniamy: wszystkie zaznaczone (jeśli ta jest zaznaczona) albo tylko tę
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];

                colsToResize.forEach((ci) => {
                    rows.forEach((row) => {
                        const cell = row.children[ci];
                        if (cell) {
                            cell.style.minWidth = newWidth + 'px';
                            cell.style.width = newWidth + 'px';
                        }
                    });
                });
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                /* Zapisz szerokości dla trwałości po re-renderze */
                const newWidth = Math.max(30, startWidth + lastDiff);
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];
                colsToResize.forEach((ci) => {
                    _excelColWidths[_excelActiveTab + '-' + ci] = newWidth;
                });
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        th.appendChild(handle);
    });
}

function _excelInitColumnSelect() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headers = table.querySelectorAll('thead tr:first-child th');
    headers.forEach((th, colIdx) => {
        th.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
            if (e.target.closest('.excel-col-resize-handle')) return;
            if (e.target.closest('button')) return;
            if (!e.ctrlKey && !e.shiftKey) {
                _excelSelectCol(colIdx, false, false);
                e.preventDefault();
                return;
            }
            e.preventDefault();
            _excelSelectCol(colIdx, e.ctrlKey || e.metaKey, e.shiftKey);
        });
    });

    // Klik w wiersz/tbody odznacza kolumny
    table.addEventListener('mousedown', (/** @type {MouseEvent} */ e) => {
        if (e.target.closest('thead')) return;
        if (e.ctrlKey || e.shiftKey) return;
        if (_excelSelectedCols.length > 0) _excelDeselectAllCols();
    });
}

function excelFilterWells(value) {
    const q = (value || '').trim().toLowerCase();
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const rows = container.querySelectorAll('tbody tr[data-widx]');
    rows.forEach(function (row) {
        if (!q) {
            row.style.display = '';
            return;
        }
        /* Najpierw szukaj inputa — dopiero potem fallback do TD */
        var nameInp = row.querySelector('td:nth-child(2) input');
        var name = nameInp
            ? nameInp.value
            : (row.querySelector('td:nth-child(2)') || {}).textContent || '';
        name = (name || '').toLowerCase();
        row.style.display = name.indexOf(q) >= 0 ? '' : 'none';
    });
}

function _excelRenderTabs() {
    const container = document.getElementById('excel-tabs');
    if (!container) return;

    const dnCounts = {};
    wells.forEach((w) => {
        const key = w.dn === 'styczna' ? 'styczne' : String(w.dn);
        dnCounts[key] = (dnCounts[key] || 0) + 1;
    });

    let html = '';
    DN_TABS.forEach((tab) => {
        const count = dnCounts[tab] || 0;
        const c = DN_COLORS[tab] || DN_COLORS['1000'];
        const isActive = tab === _excelActiveTab;
        const tabLabel = tab === 'styczne' ? 'Styczne' : 'DN' + tab;
        html += `<button data-action="excelSwitchTab" data-tab="${tab}" style="
            padding:0.4rem 1rem;border:none;cursor:pointer;font-size:0.67rem;font-weight:600;
            border-bottom:2px solid ${isActive ? c.border : c.border + '66'};
            background:${isActive ? c.activeBg : c.bg};
            color:${isActive ? c.text : c.border + '99'};
            transition:all 0.12s;letter-spacing:0.2px;">
            ${tabLabel}<span style="opacity:0.5;margin-left:0.3rem;font-size:0.6rem;">${count}</span>
        </button>`;
    });
    container.innerHTML = html;
}

function _excelUpdateWellCount() {
    const el = document.getElementById('excel-well-count');
    if (el) el.textContent = wells.length + ' studni';
}
