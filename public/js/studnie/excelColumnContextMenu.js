// @ts-check
/* ===== EXCEL COLUMN CONTEXT MENU — menu kontekstowe nagłówka kolumny (prawy przycisk) ===== */

let _excelContextMenuColId = null;
let _excelContextMenuColIdx = null;
let _excelContextMenuCleanup = null;

/* Czysta logika akcji — testowalna (test vm nie dotyka DOM). */
function _excelGetColMenuActions(col) {
    const actions = [];
    actions.push({ id: 'sortAsc', label: 'Sortuj rosnąco', disabled: false });
    actions.push({ id: 'sortDesc', label: 'Sortuj malejąco', disabled: false });
    if (_excelSortState) {
        actions.push({ id: 'sortClear', label: 'Wyczyść sortowanie', disabled: false });
    }
    if (col && col.type !== 'select' && col.type !== 'auto') {
        actions.push({
            id: 'hide',
            label: _excelIsColumnHidden(col.id) ? 'Pokaż kolumnę' : 'Ukryj kolumnę',
            disabled: false
        });
    } else {
        actions.push({
            id: 'static',
            label: 'Kolumna stała — nie można ukryć',
            disabled: true
        });
    }
    if (_excelHiddenColumnIds.length > 0) {
        actions.push({ id: 'showAll', label: 'Pokaż wszystkie kolumny', disabled: false });
    }
    actions.push({ id: 'manage', label: 'Zarządzaj kolumnami…', disabled: false });
    return actions;
}

function _excelColMenuActionHtml(action) {
    let onclick = '';
    if (action.id === 'sortAsc') onclick = "_excelSortColumnFromMenu('asc')";
    else if (action.id === 'sortDesc') onclick = "_excelSortColumnFromMenu('desc')";
    else if (action.id === 'sortClear') onclick = '_excelSortColumnFromMenu(null)';
    else if (action.id === 'hide') onclick = '_excelToggleColumnFromMenu()';
    else if (action.id === 'showAll') onclick = '_excelShowAllColumnsFromMenu()';
    else if (action.id === 'manage') onclick = '_excelManageColumnsFromMenu()';
    const cursor = action.disabled ? 'default' : 'pointer';
    const color = action.disabled ? 'var(--slate-600)' : 'var(--slate-200)';
    const hover = action.disabled
        ? ''
        : ' onmouseenter="this.style.background=\'rgba(var(--white-rgb),0.08)\'" onmouseleave="this.style.background=\'transparent\'"';
    return (
        '<div' +
        (onclick ? ' onclick="' + onclick + '"' : '') +
        hover +
        ' style="padding:0.35rem 0.6rem;font-size:0.62rem;color:' +
        color +
        ';cursor:' +
        cursor +
        ';white-space:nowrap;border-radius:2px;background:transparent;">' +
        escapeHtml(action.label) +
        '</div>'
    );
}

function _excelOpenColContextMenu(th, x, y) {
    _excelCloseColContextMenu();

    const colId = th.getAttribute('data-col-id');
    _excelContextMenuColId = colId;
    const thRow = th.parentElement;
    _excelContextMenuColIdx = thRow ? Array.from(thRow.children).indexOf(th) : null;
    let col = null;
    if (colId) {
        const refWell =
            typeof _excelGetReferenceWell === 'function'
                ? _excelGetReferenceWell(_excelActiveTab)
                : null;
        const cols = _excelGetVisibleComponentColumns(_excelActiveTab, refWell);
        col = cols.find((c) => c.id === colId) || null;
    }
    const actions = _excelGetColMenuActions(col);

    const menu = document.createElement('div');
    menu.id = 'excel-col-context-menu';
    menu.setAttribute('role', 'menu');
    /* Dołączamy do body (nie overlayu): overlay ma backdrop-filter, który tworzy
       containing block dla position:fixed i rozjeżdżał pozycję względem clientX/Y. */
    menu.style.cssText =
        'position:fixed;z-index:' +
        LAYERS.EXCEL_POPUP_CONTENT +
        ';min-width:185px;background:var(--slate-800);border:1px solid rgba(var(--white-rgb),0.12);border-radius:4px;padding:2px;box-shadow:0 8px 24px rgba(var(--black-rgb),0.5);';
    if (col) {
        menu.innerHTML =
            '<div style="padding:0.3rem 0.6rem;font-size:0.55rem;color:var(--slate-400);text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid rgba(var(--white-rgb),0.06);">' +
            escapeHtml(col.shortLabel || col.label || col.id) +
            '</div>';
    }
    menu.innerHTML += actions.map(_excelColMenuActionHtml).join('');
    document.body.appendChild(menu);

    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    menu.style.left =
        Math.min(x, Math.max(0, document.documentElement.clientWidth - mw - 4)) + 'px';
    menu.style.top =
        Math.min(y, Math.max(0, document.documentElement.clientHeight - mh - 4)) + 'px';

    const onDocMouseDown = (e) => {
        if (!menu.contains(e.target)) _excelCloseColContextMenu();
    };
    const onDocKeydown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            _excelCloseColContextMenu();
        }
    };
    const onScroll = () => _excelCloseColContextMenu();
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onDocKeydown, true);
    document.addEventListener('scroll', onScroll, true);
    _excelContextMenuCleanup = function () {
        document.removeEventListener('mousedown', onDocMouseDown, true);
        document.removeEventListener('keydown', onDocKeydown, true);
        document.removeEventListener('scroll', onScroll, true);
    };
}

function _excelCloseColContextMenu() {
    const menu = document.getElementById('excel-col-context-menu');
    if (menu) menu.remove();
    if (_excelContextMenuCleanup) {
        _excelContextMenuCleanup();
        _excelContextMenuCleanup = null;
    }
    _excelContextMenuColId = null;
    _excelContextMenuColIdx = null;
}

/* Sortowanie z menu kontekstowego — dir: 'asc' | 'desc' | null (wyczyść). */
function _excelSortColumnFromMenu(dir) {
    const colIdx = _excelContextMenuColIdx;
    _excelCloseColContextMenu();
    if (colIdx == null || typeof _excelSetSort !== 'function') return;
    if (dir === null) {
        _excelResetSort();
        return;
    }
    _excelSetSort(colIdx);
}

/* Rdzeń ukrycia — odpowiednik _excelOnColumnToggle bez ponownego otwierania popupu. */
function _excelToggleColumnFromMenu() {
    const colId = _excelContextMenuColId;
    _excelCloseColContextMenu();
    if (!colId) return;
    const hide = !_excelIsColumnHidden(colId);
    _excelResetLayoutDependentState();
    const idx = _excelHiddenColumnIds.indexOf(colId);
    if (hide) {
        if (idx < 0) _excelHiddenColumnIds.push(colId);
    } else {
        if (idx >= 0) _excelHiddenColumnIds.splice(idx, 1);
    }
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
}

function _excelShowAllColumnsFromMenu() {
    _excelCloseColContextMenu();
    if (_excelHiddenColumnIds.length === 0) return;
    _excelResetLayoutDependentState();
    _excelHiddenColumnIds = [];
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
}

function _excelManageColumnsFromMenu() {
    _excelCloseColContextMenu();
    _excelToggleColumnPopup();
}

window._excelOpenColContextMenu = _excelOpenColContextMenu;
window._excelCloseColContextMenu = _excelCloseColContextMenu;
window._excelToggleColumnFromMenu = _excelToggleColumnFromMenu;
window._excelShowAllColumnsFromMenu = _excelShowAllColumnsFromMenu;
window._excelGetColMenuActions = _excelGetColMenuActions;
window._excelSortColumnFromMenu = _excelSortColumnFromMenu;
