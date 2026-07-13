// @ts-check
/* ===== EXCEL TABLE MANAGER — Pozostałość po dekompozycji: konfiguracja, stan dodatkowy, CSP ===== */

/* ===== STAŁE KONFIGURACYJNE ===== */

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

var _excelPasteCancelFlag = false;
var _excelUndoStack = [];
var _excelRedoStack = [];

/* ===== POLLING ===== */

function _excelStartPolling() {
    if (_excelPollInterval || typeof wells === 'undefined') return;
    var lastSnapshot = '';
    _excelPollInterval = setInterval(function () {
        if (_excelUserEditing) return;
        if (!document.getElementById('excel-table-overlay')) return;
        var snap = _excelBuildWellsSnapshot();
        if (snap !== lastSnapshot) {
            lastSnapshot = snap;
            _excelSyncAutoManualUI();
        }
    }, 200);
    lastSnapshot = _excelBuildWellsSnapshot();
}

function _excelBuildWellsSnapshot() {
    if (typeof wells === 'undefined') return '';
    var parts = [];
    for (var i = 0; i < wells.length; i++) {
        var w = wells[i];
        if (!w) continue;
        parts.push(
            i +
                ':' +
                (w.configSource || '-') +
                ':' +
                (w.autoSelect === false ? '0' : '1') +
                ':' +
                (w.config ? w.config.length : 0)
        );
    }
    return parts.join('|');
}

function _excelSyncAutoManualUI() {
    if (typeof wells === 'undefined') return;
    for (var i = 0; i < wells.length; i++) {
        var w = wells[i];
        if (!w) continue;
        var btnMode = document.getElementById('excel-mode-btn-' + i);
        var btnRun = document.getElementById('excel-run-auto-' + i);
        if (!btnMode) continue;
        if (w.configSource === 'AUTO' && w.autoSelect === false) w.autoSelect = true;
        if (w.configSource === 'MANUAL' && w.autoSelect !== false) w.autoSelect = false;
        var isAuto = w.autoSelect !== false && w.configSource !== 'MANUAL';
        btnMode.textContent = isAuto ? 'AUTO' : 'MANUAL';
        btnMode.style.background = isAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
        btnMode.style.color = isAuto ? '#c7d2fe' : '#fbbf24';
        btnMode.title = isAuto
            ? 'Auto (klik = przełącz na Manual)'
            : 'Manual (klik = przełącz na Auto)';
        if (btnRun) {
            btnRun.disabled = !isAuto;
            btnRun.style.opacity = isAuto ? '1' : '0.4';
            btnRun.style.cursor = isAuto ? 'pointer' : 'not-allowed';
            btnRun.style.background = isAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)';
            btnRun.style.color = isAuto ? '#c7d2fe' : '#64748b';
            btnRun.style.borderColor = isAuto ? '#6366f1' : 'rgba(100,116,139,0.3)';
            btnRun.title = isAuto
                ? 'Uruchom auto-dobór elementów dla tej studni'
                : 'Przełącz na Auto aby uruchomić';
        }
    }
    _excelUpdateBulkButtons();
}

function _excelStopPolling() {
    if (_excelPollInterval) {
        clearInterval(_excelPollInterval);
        _excelPollInterval = null;
    }
}

function _excelDebouncedRefresh() {
    _excelMarkDirty();
    if (_excelRefreshTimer) clearTimeout(_excelRefreshTimer);
    _excelRefreshTimer = setTimeout(function () {
        _excelRefreshTimer = null;
        _excelUpdateHeaderProdCodes();
        if (typeof window.updateSummary === 'function') window.updateSummary();
        if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        if (typeof window.renderWellsList === 'function') window.renderWellsList();
    }, 800);
}

/* ===== DROPDOWN MENU DODAJ ===== */
function _excelToggleAddMenu() {
    var menu = document.getElementById('excel-add-dropdown');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        var close = function (e) {
            if (!e.target.closest('#excel-add-menu-container')) {
                menu.style.display = 'none';
                document.removeEventListener('click', close);
            }
        };
        setTimeout(function () {
            document.addEventListener('click', close);
        }, 10);
    }
}

/* ===== GLOBALNA ODSWIEŻALKA ===== */
window.refreshExcelFromConfig = function () {
    if (!document.getElementById('excel-table-overlay')) return;
    _excelRenderTable(_excelActiveTab);
};

window._excelSyncAutoManualUI = function () {
    if (!document.getElementById('excel-table-overlay')) return;
    /** @type {any} */
    var fn = window._excelSyncAutoManualUI;
    if (fn._inProgress) return;
    fn._inProgress = true;
    try {
        _excelSyncAutoManualUI();
    } finally {
        fn._inProgress = false;
    }
};

/* ===== CSP ACTION REGISTRATIONS ===== */
if (typeof registerCspAction === 'function') {
    registerCspAction('_excelToggleAddMenu', _excelToggleAddMenu);
    registerCspAction('excelToggleFullscreen', excelToggleFullscreen);
    registerCspAction('excelSaveAll', excelSaveAll);
    registerCspAction('closeExcelTableModal', closeExcelTableModal);
    registerCspAction('excelRemoveTransitionColumn', excelRemoveTransitionColumn);
    registerCspAction('excelAddTransitionColumn', excelAddTransitionColumn);
    registerCspAction('_excelCreateFromDialog', _excelCreateFromDialog);
    registerCspAction('_excelImportPasteList', _excelImportPasteList);
    registerCspAction('excelSwitchTab', {
        handler: function (p) {
            excelSwitchTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('_excelBulkSetMode', {
        handler: function (p) {
            _excelBulkSetMode(p.enabled);
        },
        params: ['enabled']
    });
    registerCspAction('_excelToggleWellAutoMode', {
        handler: function (p) {
            _excelToggleWellAutoMode(p.wIdx);
        },
        params: ['wIdx']
    });
    registerCspAction('_excelRunAutoSelectForWell', {
        handler: function (p) {
            _excelRunAutoSelectForWell(p.wIdx);
        },
        params: ['wIdx']
    });
    registerCspAction('excelOpenWellParams', {
        handler: function (p) {
            excelOpenWellParams(p.wIdx);
        },
        params: ['wIdx']
    });
    registerCspAction('excelDuplicateWell', {
        handler: function (p) {
            excelDuplicateWell(p.wIdx);
        },
        params: ['wIdx']
    });
    registerCspAction('excelDeleteWell', {
        handler: function (p) {
            excelDeleteWell(p.wIdx);
        },
        params: ['wIdx']
    });
    registerCspAction('excelFilterWells', function (t) {
        excelFilterWells(t.value);
    });
    registerCspAction('toggleSelectAll', function (t) {
        _excelToggleSelectAll(t.checked);
    });
    registerCspAction('excelOnRzednaChange', function (t) {
        excelOnRzednaChange(parseInt(t.dataset.wIdx, 10));
    });
    registerCspAction('excelToggleAutoSelect', function (t) {
        _excelAutoSelectEnabled = t.checked;
        window._excelAutoSelectEnabled = t.checked;
    });
    registerCspAction('excelAddWellToTabAndClose', function () {
        excelAddWellToTab();
        _excelToggleAddMenu();
    });
    registerCspAction('excelShowAddDialogAndClose', function () {
        excelShowAddDialog();
        _excelToggleAddMenu();
    });
    registerCspAction('excelShowPasteDialogAndClose', function () {
        excelShowPasteDialog();
        _excelToggleAddMenu();
    });
    registerCspAction('excelUpdateWellParam', function (t) {
        _excelUpdateWellParam(parseInt(t.dataset.wIdx, 10), t.dataset.paramKey, t.dataset.paramVal);
    });
    registerCspAction('excelUpdateWellParamAndRefresh', function (t) {
        _excelUpdateWellParam(
            t.dataset.paramField,
            t.dataset.paramField === 'malowanieWewCena' ||
                t.dataset.paramField === 'malowanieZewCena'
                ? parseFloat(t.value) || 0
                : t.value
        );
        excelRefreshParamsPopup(parseInt(t.dataset.wIdx, 10));
    });
    registerCspAction('excelOnCompChange', {
        params: ['wIdx', 'compType', 'hArg', 'pidArg', 'redDn'],
        handler: function (p, t) {
            excelOnCompChange(
                parseInt(p.wIdx, 10),
                p.compType,
                p.hArg === '' ? null : parseInt(p.hArg, 10),
                t.value,
                p.pidArg || null,
                p.redDn === '' ? null : parseInt(p.redDn, 10)
            );
        }
    });
    registerCspAction('closeExcelParamsPopup', function () {
        var el = document.getElementById('excel-params-popup');
        if (el) el.remove();
    });
    registerCspAction('closeExcelAddDialog', function () {
        var el = document.getElementById('excel-add-dialog-overlay');
        if (el) el.remove();
    });
    registerCspAction('closeExcelPasteDialog', function () {
        var el = document.getElementById('excel-paste-dialog-overlay');
        if (el) el.remove();
    });
    registerCspAction('excelOverlaySync', function (t) {
        var fn = t.dataset.oa;
        if (fn && typeof window[fn] === 'function') {
            var args = [parseInt(t.dataset.opWIdx, 10), t.value];
            if (t.dataset.opPrzIdx !== undefined)
                args.splice(1, 0, parseInt(t.dataset.opPrzIdx, 10));
            if (t.dataset.opField !== undefined) args.splice(2, 0, t.dataset.opField);
            window[fn].apply(
                null,
                args.filter(function (a) {
                    return !isNaN(a) || typeof a === 'string';
                })
            );
        }
    });
}
