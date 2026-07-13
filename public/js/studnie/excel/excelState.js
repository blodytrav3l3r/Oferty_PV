// @ts-check
/* ===== EXCEL TABLE MANAGER — Stan globalny (CSS + zmienne) ===== */

/* CSP-safe: CSS hover */
(function () {
    var s = document.createElement('style');
    s.textContent =
        '.excel-hover-btn{transition:all 0.1s}.excel-hover-btn:hover{background:var(--hb)!important;color:var(--hc,inherit)!important;border-color:var(--hbc,initial)!important}.excel-hover-row{transition:background 0.15s}.excel-hover-row:hover{background:var(--hr)!important}.excel-hover-color{transition:color 0.1s}.excel-hover-color:hover{color:var(--hc)!important}button[data-action="excelUpdateWellParam"][data-active="false"]:hover{border-color:rgba(99,102,241,0.3)!important;background:rgba(255,255,255,0.08)!important}';
    document.head.appendChild(s);
})();

var _excelMaxTransitions = {};
var _excelActiveTab = '1000';
var _excelCreatingLock = false;
var _excelRefreshTimer = null;
var _excelSelectedCols = [];
var _excelSelectedCells = [];
var _excelLastClickedCell = null;
var _excelLastDataCol = -1;
var _excelDragState = null;
var _excelDragThrottle = null;
var _excelFocusOverlayEl = null;
var _excelFocusRaf = null;
var _excelRowSelectStates = {};
var _excelDirty = false;
var _excelFullscreen = false;
var _excelPollInterval = null;
var _excelLastClickedCol = -1;
var _excelColWidths = {};
var _excelAddingReliefPair = false;
var _excelUserEditing = false;
var _excelAutoSelectEnabled = true;
var _EXCEL_UNDO_LIMIT = 50;
