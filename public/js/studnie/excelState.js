// @ts-check
/* ===== EXCEL TABLE MANAGER — Stan + Stałe ===== */

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
let _excelDirty = false;
let _excelFullscreen = false;
let _excelPollInterval = null;
let _excelLastClickedCol = -1;
let _excelColWidths = {};
let _excelAddingReliefPair = false;
let _excelUserEditing = false;
let _excelAutoSelectEnabled = true;

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

const DN_TABS = ['1000', '1200', '1500', '2000', '2500', 'styczne'];
const DN_COLORS = {
    1000: {
        bg: 'rgba(var(--blue-rgb), 0.12)',
        border: 'var(--blue)',
        text: 'var(--blue-hover)',
        activeBg: 'rgba(var(--blue-rgb), 0.25)',
        borderDim: 'rgba(var(--blue-rgb), 0.4)',
        textDim: 'rgba(var(--blue-rgb), 0.6)'
    },
    1200: {
        bg: 'rgba(var(--success-rgb), 0.12)',
        border: 'var(--success)',
        text: 'var(--success-hover)',
        activeBg: 'rgba(var(--success-rgb), 0.25)',
        borderDim: 'rgba(var(--success-rgb), 0.4)',
        textDim: 'rgba(var(--success-rgb), 0.6)'
    },
    1500: {
        bg: 'rgba(var(--warn-rgb), 0.12)',
        border: 'var(--warn)',
        text: 'var(--warn-hover)',
        activeBg: 'rgba(var(--warn-rgb), 0.25)',
        borderDim: 'rgba(var(--warn-rgb), 0.4)',
        textDim: 'rgba(var(--warn-rgb), 0.6)'
    },
    2000: {
        bg: 'rgba(var(--purple-rgb), 0.12)',
        border: 'var(--purple)',
        text: 'var(--purple-hover)',
        activeBg: 'rgba(var(--purple-rgb), 0.25)',
        borderDim: 'rgba(var(--purple-rgb), 0.4)',
        textDim: 'rgba(var(--purple-rgb), 0.6)'
    },
    2500: {
        bg: 'rgba(var(--danger-rgb), 0.12)',
        border: 'var(--danger)',
        text: 'var(--danger-hover)',
        activeBg: 'rgba(var(--danger-rgb), 0.25)',
        borderDim: 'rgba(var(--danger-rgb), 0.4)',
        textDim: 'rgba(var(--danger-rgb), 0.6)'
    },
    styczne: {
        bg: 'rgba(var(--pink-rgb), 0.12)',
        border: 'var(--pink)',
        text: 'var(--pink-hover)',
        activeBg: 'rgba(var(--pink-rgb), 0.25)',
        borderDim: 'rgba(var(--pink-rgb), 0.4)',
        textDim: 'rgba(var(--pink-rgb), 0.6)'
    }
};

const _EXCEL_FONT = 'font-size:0.7rem;font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

let _excelPasteInProgress = false;

let _excelUndoStack = [];
let _excelRedoStack = [];
const _EXCEL_UNDO_LIMIT = 20;

/* ===== Column Visibility State ===== */
let _excelHiddenColumnIds = [];
const _EXCEL_COL_VISIBILITY_KEY = 'witros_excel_hidden_columns';

function _excelLoadColumnVisibility() {
    try {
        const saved = JSON.parse(localStorage.getItem(_EXCEL_COL_VISIBILITY_KEY));
        if (Array.isArray(saved)) {
            _excelHiddenColumnIds = saved;
        } else {
            _excelHiddenColumnIds = [];
        }
    } catch (e) {
        _excelHiddenColumnIds = [];
    }
}

function _excelSaveColumnVisibility() {
    try {
        localStorage.setItem(_EXCEL_COL_VISIBILITY_KEY, JSON.stringify(_excelHiddenColumnIds));
    } catch (e) {}
}

function _excelResetColumnVisibility() {
    _excelResetLayoutDependentState();
    _excelHiddenColumnIds = [];
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
}

function _excelIsColumnHidden(colId) {
    return _excelHiddenColumnIds.indexOf(colId) >= 0;
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
    _excelLastDataCol = -1;
    _excelLastClickedCol = -1;
}
