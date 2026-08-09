// @ts-check
/* ===== EXCEL SORT — Sortowanie wierszy wg kolumny (warstwa widoku) =====
   Sortujemy wyłącznie kolejność DOM wierszy tbody (data-widx zostaje globalnym
   indeksem studni), więc selekcje, checkboxy, stany PZ i duplikacje działają
   bez zmian. Stan per zakładka — reset przy zmianie zakładki i zamknięciu. */

let _excelSortState = null;

/* Czysty porównywacz wartości komórki — liczby numerycznie, reszta po polsku.
   Testowalny (test vm nie dotyka DOM). */
function _excelCompareCellValues(a, b) {
    const sa = String(a == null ? '' : a).trim();
    const sb = String(b == null ? '' : b).trim();
    const na = parseFloat(sa.replace(',', '.'));
    const nb = parseFloat(sb.replace(',', '.'));
    const aNum = sa !== '' && !isNaN(na);
    const bNum = sb !== '' && !isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1; /* liczby przed tekstem */
    if (bNum) return 1;
    if (sa === '') return sb === '' ? 0 : 1; /* puste zawsze na końcu (jak Excel) */
    if (sb === '') return -1;
    return sa.localeCompare(sb, 'pl');
}

/* Cykl sortowania: brak → asc → desc → brak. Czysta i testowalna. */
function _excelNextSortState(colIdx, current) {
    if (!current || current.colIdx !== colIdx) return { colIdx: colIdx, dir: 'asc' };
    if (current.dir === 'asc') return { colIdx: colIdx, dir: 'desc' };
    return null;
}

/* Wartość komórki wiersza (input/select, fallback textContent) — wzorzec z _excelHandleCopy */
function _excelRowCellValue(row, colIdx) {
    const td = row.children[colIdx];
    if (!td) return '';
    const target = td.querySelector('input, select');
    if (!target) return td.textContent.trim();
    if (target.tagName === 'SELECT') {
        const opt = /** @type {HTMLSelectElement} */ (target).options[
            /** @type {HTMLSelectElement} */ (target).selectedIndex
        ];
        return opt ? opt.text : '';
    }
    return /** @type {HTMLInputElement} */ (target).value || '';
}

/* Przebudowa kolejności wierszy tbody wg _excelSortState + renumeracja Lp (colIdx 2). */
function _excelApplySort() {
    if (typeof document === 'undefined') return; /* test vm */
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;
    if (!_excelSortState) {
        _excelRenderSortIndicator();
        return;
    }
    const colIdx = _excelSortState.colIdx;
    const dir = _excelSortState.dir;
    const emptyRow = tbody.querySelector('#excel-empty-row');
    const rows = Array.from(tbody.querySelectorAll('tr[data-widx]')).map(function (row) {
        return { row: /** @type {HTMLElement} */ (row), val: _excelRowCellValue(row, colIdx) };
    });
    rows.sort(function (a, b) {
        const c = _excelCompareCellValues(a.val, b.val);
        return dir === 'asc' ? c : -c;
    });
    rows.forEach(function (item, i) {
        /* Pusty wiersz (dodawanie studni) zawsze na końcu */
        if (emptyRow) tbody.insertBefore(item.row, emptyRow);
        else tbody.appendChild(item.row);
        const lp = item.row.children[2];
        if (lp) lp.textContent = String(i + 1);
    });
    _excelRenderSortIndicator();
}

/* Zastosuj sort jeśli aktywny — wołane po każdym re-renderze (toggle kolumny,
   zmiana przejścia itd.), bo render naturalnie przywraca kolejność wells[]. */
function _excelApplySortIfActive() {
    if (_excelSortState) _excelApplySort();
}

/* Znacznik sortowania w nagłówku (▲/▼) — usuwa stary i dokleja do aktywnej kolumny. */
function _excelRenderSortIndicator() {
    if (typeof document === 'undefined') return; /* test vm */
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    container.querySelectorAll('.excel-sort-mark').forEach(function (m) {
        m.remove();
    });
    if (!_excelSortState) return;
    const th = /** @type {HTMLElement} */ (
        container.querySelectorAll('thead tr:first-child th')[_excelSortState.colIdx]
    );
    if (!th) return;
    const mark = document.createElement('span');
    mark.className = 'excel-sort-mark';
    mark.textContent = _excelSortState.dir === 'asc' ? ' ▲' : ' ▼';
    mark.style.cssText = 'color:var(--accent);font-size:0.55rem;';
    th.title = 'Prawy przycisk na nagłówku → zmiana/wyłączenie sortowania';
    th.appendChild(mark);
}

/* Ustaw sortowanie dla kolumny (cykl) i przebuduj kolejność. */
function _excelSetSort(colIdx) {
    _excelSortState = _excelNextSortState(colIdx, _excelSortState);
    _excelApplySort();
}

function _excelResetSort() {
    _excelSortState = null;
    _excelRenderSortIndicator();
}

window._excelSetSort = _excelSetSort;
window._excelResetSort = _excelResetSort;
