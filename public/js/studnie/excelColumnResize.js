// @ts-check
/* ===== RESIZE COLUMNS (Excel-like drag handles) ===== */
/* Kanoniczny wiersz to h1 (drugi tr thead): każda kolumna fizyczna ma własny
   TH (Rz.wlot/Kąt/Rodzaj/Średnica osobno). Pierwszy wiersz (h3) ma colspan=4
   na grupę PRZ, więc handle tam dawałyby jedną szerokość na 4 podkolumny
   i zły indeks — nie mapuj po nim. */
function _excelInitColumnResize() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;

    const headRows = table.querySelectorAll('thead tr');
    if (headRows.length < 2) return;
    const headers = headRows[1].querySelectorAll('th');
    headers.forEach((th) => {
        // Tylko ustaw position:relative dla kolumn ktore nie maja sticky w inline
        // (sticky columns maja position:sticky;left:N ustawione przez _excelApplyStickyColumns)
        if (th.style.position !== 'sticky') {
            th.style.position = 'relative';
        }

        const handle = document.createElement('div');
        handle.className = 'excel-col-resize-handle';
        handle.style.cssText =
            'position:absolute;top:2px;right:-1px;width:3px;height:calc(100% - 4px);cursor:col-resize;z-index:' +
            LAYERS_EXCEL.RESIZE_HANDLE +
            ';' +
            'background:var(--excel-border);border-radius:2px;transition:background 0.12s,width 0.12s,box-shadow 0.12s;';
        handle.addEventListener('mouseenter', () => {
            handle.style.background = 'rgba(var(--accent-rgb), 0.5)';
            handle.style.width = '4px';
            handle.style.boxShadow = '0 0 6px rgba(var(--accent-rgb), 0.3)';
        });
        handle.addEventListener('mouseleave', () => {
            handle.style.background = 'var(--excel-border)';
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
            const h2ths = headRows.length > 2 ? headRows[2].querySelectorAll('th') : [];
            const bodyRows = table.querySelectorAll('tbody tr');

            /* Szerokość trafia na h1 + h2 + td po indeksie kanonicznym.
               Wiersz h3 (colspan grup PRZ) pomijany — doliczy się sam. */
            const applyWidth = (ci, newWidth) => {
                const h1th = headers[ci];
                if (h1th) {
                    /* TASK-038: szerokości kolumn to dane runtime (resize) —
                       inline celowo, nie klasa (zgodnie z planem TASK-038). */
                    h1th.style.minWidth = newWidth + 'px';
                    h1th.style.width = newWidth + 'px';
                }
                if (h2ths[ci]) {
                    h2ths[ci].style.minWidth = newWidth + 'px';
                    h2ths[ci].style.width = newWidth + 'px';
                }
                bodyRows.forEach((row) => {
                    const cell = row.children[ci];
                    if (cell) {
                        cell.style.minWidth = newWidth + 'px';
                        cell.style.width = newWidth + 'px';
                    }
                });
            };

            const onMove = (/** @type {MouseEvent} */ e2) => {
                const diff = e2.clientX - startX;
                lastDiff = diff;
                const newWidth = Math.max(30, startWidth + diff);

                // Które kolumny zmieniamy: wszystkie zaznaczone (jeśli ta jest zaznaczona) albo tylko tę
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];

                colsToResize.forEach((ci) => applyWidth(ci, newWidth));
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                /* Zapisz szerokości pod stabilnym colId — przeżywają
                   dodanie/usunięcie kolumny przejścia (indeks nie). */
                const newWidth = Math.max(30, startWidth + lastDiff);
                const colsToResize = _excelSelectedCols.includes(colIndex)
                    ? _excelSelectedCols
                    : [colIndex];
                colsToResize.forEach((ci) => {
                    const h1th = headers[ci];
                    const colId =
                        h1th && typeof h1th.getAttribute === 'function'
                            ? h1th.getAttribute('data-excel-col')
                            : null;
                    const key =
                        typeof _excelColWidthKey === 'function'
                            ? _excelColWidthKey(_excelActiveTab, colId || String(ci))
                            : _excelActiveTab + '-' + (colId || String(ci));
                    _excelColWidths[key] = newWidth;
                    /* Migracja: usuń legacy klucz numeryczny tej kolumny */
                    if (colId) {
                        const legacyKey = _excelActiveTab + '-' + ci;
                        if (legacyKey !== key && legacyKey in _excelColWidths)
                            delete _excelColWidths[legacyKey];
                    }
                });
                /* Trwałość szerokości po zakończeniu przeciągania (localStorage) */
                if (typeof _excelSaveColWidths === 'function') _excelSaveColWidths();
                /* Sticky left zależy od rzeczywistych szerokości — przelicz */
                if (typeof _excelApplyStickyColumns === 'function') _excelApplyStickyColumns();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        th.appendChild(handle);
    });
}
