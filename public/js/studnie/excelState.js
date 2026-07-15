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
        bg: 'rgba(59,130,246,0.12)',
        border: '#3b82f6',
        text: '#93c5fd',
        activeBg: 'rgba(59,130,246,0.25)'
    },
    1200: {
        bg: 'rgba(16,185,129,0.12)',
        border: '#10b981',
        text: '#6ee7b7',
        activeBg: 'rgba(16,185,129,0.25)'
    },
    1500: {
        bg: 'rgba(245,158,11,0.12)',
        border: '#f59e0b',
        text: '#fbbf24',
        activeBg: 'rgba(245,158,11,0.25)'
    },
    2000: {
        bg: 'rgba(168,85,247,0.12)',
        border: '#a855f7',
        text: '#c4b5fd',
        activeBg: 'rgba(168,85,247,0.25)'
    },
    2500: {
        bg: 'rgba(239,68,68,0.12)',
        border: '#ef4444',
        text: '#fca5a5',
        activeBg: 'rgba(239,68,68,0.25)'
    },
    styczne: {
        bg: 'rgba(236,72,153,0.12)',
        border: '#ec4899',
        text: '#f9a8d4',
        activeBg: 'rgba(236,72,153,0.25)'
    }
};

const _EXCEL_FONT = 'font-size:0.7rem;font-family:Inter,Segoe UI,sans-serif;letter-spacing:0.1px;';

var _excelPasteCancelFlag = false;

let _excelUndoStack = [];
let _excelRedoStack = [];
const _EXCEL_UNDO_LIMIT = 20;
