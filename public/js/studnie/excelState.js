// @ts-check
/* ===== EXCEL TABLE MANAGER — Stan + Stałe ===== */

/* eslint-disable prefer-const -- świadomie współdzielony stan, mutowany cross-file (excelModal, excelTabs, excelPolling, excelSelection itd.) */
let _excelMaxTransitions = {};
let _excelActiveTab = '1000';
let _excelCreatingLock = false;
let _excelRefreshTimer = null;
let _excelSelectedCols = [];
let _excelSelectedCells = [];
let _excelLastClickedCell = null;
let _excelLastDataCol = -1;
let _excelDragState = null;
let _excelDragThrottle = null;
let _excelFocusOverlayEl = null;
let _excelFocusRaf = null;
let _excelRowSelectStates = {};
let _excelLastClickedRow = null;
let _excelRowClickHandled = false;
let _excelDirty = false;
let _excelFullscreen = false;
let _excelPollInterval = null;
let _excelLastClickedCol = -1;
let _excelColWidths = {};
let _excelAddingReliefPair = false;
let _excelUserEditing = false;
let _excelAutoSelectEnabled = true;
/* wellIndexById — canonical index SSoT (I3): wells[] + Map nie dwie kopie, sort nie rebuild */
let _excelWellIndexById = new Map();
/* filteredIndexes — SSoT widoku (C1). DOM = tylko widok. Invalidacja centralna. */
let _excelFilteredIndexes = null;
let _excelFilteredDirty = true;
let _excelFilteredCacheTab = null;
let _excelFilteredCacheQuery = null;
let _excelFilteredCacheWellsLen = -1;
/* eslint-enable prefer-const */

// eslint-disable-next-line no-unused-vars -- eksportowany przez window.KINETA_OPTIONS
const KINETA_OPTIONS = [
    ['brak', 'Brak'],
    ['beton', 'Beton'],
    ['beton_gfk', 'Beton z GFK'],
    ['klinkier', 'Klinkier'],
    ['preco', 'Preco'],
    ['precotop', 'PrecoTop'],
    ['unolith', 'UnoLith'],
    ['predl', 'Predl'],
    ['kamionka', 'Kamionka']
];

// eslint-disable-next-line no-unused-vars -- eksportowany przez window.DN_TABS
const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
// eslint-disable-next-line no-unused-vars -- eksportowany przez window.DN_COLORS
const DN_COLORS = {
    1000: {
        bg: 'rgba(var(--blue-rgb), 0.18)',
        border: 'var(--blue)',
        text: 'var(--blue-hover)',
        activeBg: 'rgba(var(--blue-rgb), 0.25)',
        borderDim: 'rgba(var(--blue-rgb), 0.45)',
        textDim: 'rgba(var(--blue-rgb), 0.75)'
    },
    1200: {
        bg: 'rgba(var(--success-rgb), 0.18)',
        border: 'var(--success)',
        text: 'var(--success-hover)',
        activeBg: 'rgba(var(--success-rgb), 0.25)',
        borderDim: 'rgba(var(--success-rgb), 0.45)',
        textDim: 'rgba(var(--success-rgb), 0.75)'
    },
    1500: {
        bg: 'rgba(var(--warn-rgb), 0.18)',
        border: 'var(--warn)',
        text: 'var(--warn-hover)',
        activeBg: 'rgba(var(--warn-rgb), 0.25)',
        borderDim: 'rgba(var(--warn-rgb), 0.45)',
        textDim: 'rgba(var(--warn-rgb), 0.75)'
    },
    2000: {
        bg: 'rgba(var(--purple-rgb), 0.18)',
        border: 'var(--purple)',
        text: 'var(--purple-hover)',
        activeBg: 'rgba(var(--purple-rgb), 0.25)',
        borderDim: 'rgba(var(--purple-rgb), 0.45)',
        textDim: 'rgba(var(--purple-rgb), 0.75)'
    },
    2500: {
        bg: 'rgba(var(--danger-rgb), 0.18)',
        border: 'var(--danger)',
        text: 'var(--danger-hover)',
        activeBg: 'rgba(var(--danger-rgb), 0.25)',
        borderDim: 'rgba(var(--danger-rgb), 0.45)',
        textDim: 'rgba(var(--danger-rgb), 0.75)'
    },
    styczne: {
        bg: 'rgba(var(--pink-rgb), 0.18)',
        border: 'var(--pink)',
        text: 'var(--pink-hover)',
        activeBg: 'rgba(var(--pink-rgb), 0.25)',
        borderDim: 'rgba(var(--pink-rgb), 0.45)',
        textDim: 'rgba(var(--pink-rgb), 0.75)'
    }
};

const _EXCEL_FONT =
    'font-size: var(--fs-sm);font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

/* eslint-disable prefer-const -- świadomie współdzielony stan, mutowany cross-file (excelCopyPaste, excelWellActions, excelTableManager itd.) */
let _excelPasteInProgress = false;
/* Batch dotknął kręgu krag/krag_ot — wymaga jednego odroczonego pełnego
   re-rendera na koniec operacji (fill/paste), zamiast re-rendera per komórka. */
let _excelBatchKragTouched = false;

let _excelUndoStack = [];
let _excelRedoStack = [];
const _EXCEL_UNDO_LIMIT = 50;
// v1.1: bytes budget > entry count — hard cap measured baseline (Expected 8-12MB, Actual TBD)
const _EXCEL_UNDO_MAX_BYTES = 12 * 1024 * 1024;
const _EXCEL_UNDO_MAX_BYTES_PER_ENTRY = 1 * 1024 * 1024;
/* eslint-enable prefer-const */

/* ===== Column Visibility State ===== */
let _excelHiddenColumnIds = [];
const _EXCEL_COL_VISIBILITY_KEY = 'sok_excel_hidden_columns';
const _EXCEL_COL_VISIBILITY_LEGACY_KEY = 'witros_excel_hidden_columns';

/* Jednorazowa migracja: przenieś dane użytkownika ze starego (legacy) klucza
   "witros_*" na nowy "sok_*", spójny ze STORAGE_PREFIX. */
function _excelMigrateLegacyKey(newKey, legacyKey) {
    try {
        if (localStorage.getItem(legacyKey) === null) return;
        if (localStorage.getItem(newKey) === null) {
            localStorage.setItem(newKey, localStorage.getItem(legacyKey));
        }
        localStorage.removeItem(legacyKey);
    } catch (_e) {}
}

function _excelLoadColumnVisibility() {
    try {
        _excelMigrateLegacyKey(_EXCEL_COL_VISIBILITY_KEY, _EXCEL_COL_VISIBILITY_LEGACY_KEY);
        const saved = JSON.parse(localStorage.getItem(_EXCEL_COL_VISIBILITY_KEY));
        if (Array.isArray(saved)) {
            _excelHiddenColumnIds = saved;
        } else {
            _excelHiddenColumnIds = [];
        }
    } catch (_e) {
        _excelHiddenColumnIds = [];
    }
}

function _excelSaveColumnVisibility() {
    try {
        localStorage.setItem(_EXCEL_COL_VISIBILITY_KEY, JSON.stringify(_excelHiddenColumnIds));
    } catch (_e) {}
}

function _excelResetColumnVisibility() {
    _excelResetLayoutDependentState();
    _excelHiddenColumnIds = [];
    _excelSaveColumnVisibility();
    /* Wyczyść szerokości kolumn aktywnej zakładki — tylko klucze "tab-" */
    Object.keys(_excelColWidths).forEach((k) => {
        if (k.indexOf(_excelActiveTab + '-') === 0) delete _excelColWidths[k];
    });
    _excelSaveColWidths();
    _excelRenderTable(_excelActiveTab);
}

function _excelIsColumnHidden(colId) {
    return _excelHiddenColumnIds.indexOf(colId) >= 0;
}

/* ===== Column Widths State (trwałość szerokości kolumn, wzorzec jak visibility) ===== */
const _EXCEL_COL_WIDTHS_KEY = 'sok_excel_col_widths';
const _EXCEL_COL_WIDTHS_LEGACY_KEY = 'witros_excel_col_widths';

function _excelLoadColWidths() {
    try {
        _excelMigrateLegacyKey(_EXCEL_COL_WIDTHS_KEY, _EXCEL_COL_WIDTHS_LEGACY_KEY);
        const saved = JSON.parse(localStorage.getItem(_EXCEL_COL_WIDTHS_KEY));
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            _excelColWidths = saved;
        } else {
            _excelColWidths = {};
        }
    } catch (_e) {
        _excelColWidths = {};
    }
}

function _excelSaveColWidths() {
    try {
        localStorage.setItem(_EXCEL_COL_WIDTHS_KEY, JSON.stringify(_excelColWidths));
    } catch (_e) {}
}

/* ===== wellIndexById — canonical wellId → wellIdx index ===== */
function _excelBuildWellIndex() {
    _excelWellIndexById = new Map();
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (!w || !w.id) continue;
        if (_excelWellIndexById.has(w.id)) {
            console.error('[Excel] duplicate well.id FAIL FAST:', w.id, 'at', i);
            throw new Error('Duplicate well.id: ' + w.id);
        }
        _excelWellIndexById.set(w.id, i);
    }
}
function _excelRebuildWellIndex() {
    _excelBuildWellIndex();
    if (typeof _excelInvalidateFilteredIndexes === 'function') {
        _excelInvalidateFilteredIndexes();
    }
}
function _excelGetWellIdxById(id) {
    const v = _excelWellIndexById.get(id);
    return v !== undefined ? v : -1;
}
if (typeof window !== 'undefined') {
    window._excelBuildWellIndex = _excelBuildWellIndex;
    window._excelRebuildWellIndex = _excelRebuildWellIndex;
    window._excelGetWellIdxById = _excelGetWellIdxById;
}

/* ===== filteredIndexes SSoT — centralna invalidacja ===== */
function _excelInvalidateFilteredIndexes() {
    _excelFilteredDirty = true;
    _excelFilteredIndexes = null;
}
function _excelRebuildFilteredIndexes() {
    const dn = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    const qEl =
        typeof document !== 'undefined' ? document.getElementById('excel-search-input') : null;
    const q = qEl
        ? String(qEl.value || '')
              .trim()
              .toLowerCase()
        : '';
    const wLen = typeof wells !== 'undefined' && Array.isArray(wells) ? wells.length : 0;
    if (
        !(_excelFilteredDirty || _excelFilteredIndexes === null) &&
        _excelFilteredCacheTab === dn &&
        _excelFilteredCacheQuery === q &&
        _excelFilteredCacheWellsLen === wLen
    )
        return _excelFilteredIndexes;
    const arr = [];
    if (typeof wells !== 'undefined' && Array.isArray(wells)) {
        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            if (!w) continue;
            const matchesTab =
                typeof _excelWellMatchesTab === 'function'
                    ? _excelWellMatchesTab(w, dn)
                    : String(w.dn) === String(dn) || (dn === 'styczne' && w.dn === 'styczna');
            if (!matchesTab) continue;
            if (q) {
                const name = String(w.name || w.numer || '').toLowerCase();
                if (name.indexOf(q) < 0) continue;
            }
            arr.push(i);
        }
    }
    _excelFilteredIndexes = arr;
    _excelFilteredCacheTab = dn;
    _excelFilteredCacheQuery = q;
    _excelFilteredCacheWellsLen =
        typeof wells !== 'undefined' && Array.isArray(wells) ? wells.length : 0;
    _excelFilteredDirty = false;
    if (typeof window !== 'undefined') {
        window._excelFilteredIndexes = _excelFilteredIndexes;
        // sync virtual filtered gdy virtual enabled (jedno źródło)
        try {
            window._excelVirtualFiltered = arr;
            window._excelVirtualTotal = arr.length;
        } catch (_e) {}
    }
    return _excelFilteredIndexes;
}
function _excelGetFilteredIndexes() {
    if (_excelFilteredDirty || _excelFilteredIndexes === null)
        return _excelRebuildFilteredIndexes();
    // query mogło się zmienić bez dirty (input event nie zawsze invaliduje)
    const qEl =
        typeof document !== 'undefined' ? document.getElementById('excel-search-input') : null;
    const q = qEl
        ? String(qEl.value || '')
              .trim()
              .toLowerCase()
        : '';
    const dn = typeof _excelActiveTab !== 'undefined' ? _excelActiveTab : '1000';
    const wLen = typeof wells !== 'undefined' && Array.isArray(wells) ? wells.length : 0;
    if (
        q !== _excelFilteredCacheQuery ||
        dn !== _excelFilteredCacheTab ||
        wLen !== _excelFilteredCacheWellsLen
    )
        return _excelRebuildFilteredIndexes();
    return _excelFilteredIndexes;
}
if (typeof window !== 'undefined') {
    window._excelInvalidateFilteredIndexes = _excelInvalidateFilteredIndexes;
    window._excelRebuildFilteredIndexes = _excelRebuildFilteredIndexes;
    window._excelGetFilteredIndexes = _excelGetFilteredIndexes;
}

/* Reset stanu selekcji zależnego od układu tabeli. Wołaj przy każdej zmianie
    struktury: zmianie zakładki DN, toggle widoczności kolumn, dodaniu/usunięciu
    kolumny przejścia oraz zamknięciu modala (reguła AGENTS.md sekcja 4). */
function _excelResetLayoutDependentState() {
    if (_excelSelectedCells.length > 0) {
        const copy = [..._excelSelectedCells];
        _excelSelectedCells = [];
        copy.forEach(function (cell) {
            _excelToggleCellClass(cell.wIdx, cell.colIdx, false);
        });
    }
    if (_excelSelectedCols.length > 0) _excelDeselectAllCols();
    _excelLastClickedCell = null;
    _excelLastClickedRow = null;
    _excelRowClickHandled = false;
    _excelLastDataCol = -1;
    _excelLastClickedCol = -1;
}
