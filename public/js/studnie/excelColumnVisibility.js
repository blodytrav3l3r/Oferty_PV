// @ts-check
/* ===== EXCEL COLUMN VISIBILITY — modal do ukrywania/pokazywania kolumn ===== */

function _excelToggleColumnPopup() {
    const refWell =
        typeof _excelGetReferenceWell === 'function'
            ? _excelGetReferenceWell(_excelActiveTab)
            : null;
    const allCols = _excelBuildComponentColumns(_excelActiveTab, refWell);
    if (!allCols || allCols.length === 0) return;

    const groups = {};
    allCols.forEach(function (col) {
        const c = /** @type {any} */ (col);
        const g = c.fromReduction ? '_reduction_' + (c.targetDn || 1000) : col.componentType;
        if (!groups[g]) groups[g] = { cols: [] };
        groups[g].cols.push(col);
    });

    const groupLabels = {
        wlaz: 'Właz',
        avr: 'AVR / Pierścienie',
        konus: 'Konus / Stożek',
        plyta_din: 'Płyta DIN',
        plyta_najazdowa: 'Płyta najazdowa',
        plyta_zamykajaca: 'Płyta zamykająca',
        pierscien_odciazajacy: 'Pierścień odciążający',
        plyta_redukcyjna: 'Płyta redukcyjna',
        krag: 'Kręgi',
        krag_ot: 'Kręgi OT',
        dennica: 'Dennica',
        osadnik: 'Osadnik',
        styczna: 'Styczna',
        uszczelka: 'Uszczelki'
    };

    const staticGroupOrder = [
        'wlaz',
        'avr',
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy',
        'plyta_redukcyjna',
        'krag',
        'krag_ot',
        'dennica',
        'osadnik',
        'styczna',
        'uszczelka'
    ];
    const reductionKeys = Object.keys(groups)
        .filter(function (k) {
            return k.indexOf('_reduction_') === 0;
        })
        .sort();

    function _excelColCheckboxHtml(col, padLeft) {
        const hidden = _excelIsColumnHidden(col.id);
        const colName = col.shortLabel || col.label || col.id;
        const detail =
            col.detailLabel && col.detailLabel !== '·' ? ' (' + col.detailLabel + ')' : '';
        let h = '<label class="excel-colcheck" style="padding-left:' + padLeft + '">';
        h += '<input type="checkbox"';
        if (!hidden) h += ' checked';
        h +=
            ' onchange="_excelOnColumnToggle(\'' +
            col.id.replace(/'/g, "\\'") +
            '\',this.checked)" style="accent-color:var(--accent2);cursor:pointer;" />';
        h +=
            escapeHtml(colName) +
            (detail
                ? ' <span style="color:var(--slate-500);font-size: var(--fs-3xs);">' +
                  escapeHtml(detail) +
                  '</span>'
                : '');
        h += '</label>';
        return h;
    }

    function _excelBuildColumnGridHtml(gridCols, allCts, groupLabels) {
        let html = '';
        html +=
            '<div id="excel-col-vis-grid" style="display:grid;grid-template-columns:auto repeat(' +
            gridCols.length +
            ',minmax(max-content,1fr));border:1px solid rgba(var(--white-rgb), 0.05);border-radius: var(--radius-2xs);overflow:hidden;width:max-content;min-width:100%;">';

        /* Nagłówek — wiersz 1: DN */
        html +=
            '<div style="padding:0.25rem 0.3rem;background:rgba(var(--white-rgb), 0.05);font-size: var(--fs-3xs);font-weight: var(--fw-medium);color:var(--slate-500);border-bottom:1px solid rgba(var(--white-rgb), 0.05);"></div>';
        gridCols.forEach(function (col, cIdx) {
            const sepStyle =
                cIdx < gridCols.length - 1
                    ? 'border-right:1px solid rgba(var(--white-rgb), 0.05);'
                    : '';
            const bg = col.isBase
                ? 'background:rgba(var(--accent2-rgb), 0.05);'
                : 'background:rgba(var(--white-rgb), 0.05);';
            html +=
                '<div style="padding:0.25rem 0.3rem;' +
                bg +
                'font-size: var(--fs-3xs);font-weight: var(--fw-semibold);color:var(--accent2-hover);text-align:center;border-bottom:1px solid rgba(var(--white-rgb), 0.05);' +
                sepStyle +
                '">' +
                escapeHtml(col.label) +
                '</div>';
        });

        /* Nagłówek — wiersz 2: checkbox "Wszystkie" per kolumna */
        html +=
            '<div style="padding:0.2rem 0.3rem;background:rgba(var(--white-rgb), 0.05);font-size: var(--fs-3xs);color:var(--slate-500);border-bottom:1px solid rgba(var(--white-rgb), 0.05);"></div>';
        gridCols.forEach(function (col, cIdx) {
            const sepStyle =
                cIdx < gridCols.length - 1
                    ? 'border-right:1px solid rgba(var(--white-rgb), 0.05);'
                    : '';
            const bg = col.isBase
                ? 'background:rgba(var(--accent2-rgb), 0.05);'
                : 'background:rgba(var(--white-rgb), 0.05);';
            const allIds = [];
            Object.keys(col.groups).forEach(function (ct) {
                col.groups[ct].forEach(function (c) {
                    allIds.push(c.id);
                });
            });
            const allVis = allIds.every(function (id) {
                return !_excelIsColumnHidden(id);
            });
            html +=
                '<div style="padding:0.15rem 0.2rem;text-align:center;' +
                bg +
                'border-bottom:1px solid rgba(var(--white-rgb), 0.05);' +
                sepStyle +
                '">';
            html +=
                '<label style="display:inline-flex;align-items:center;gap:0.25rem;font-size: var(--fs-3xs);color:var(--slate-400);cursor:pointer;white-space:nowrap;">';
            html += '<input type="checkbox"';
            if (allVis) html += ' checked';
            html +=
                ' onchange="_excelOnDnSelectAll(\'' +
                col.id.replace(/'/g, "\\'") +
                '\',this.checked)" style="accent-color:var(--accent2);cursor:pointer;width:10px;height:10px;" />';
            html += 'Wszystkie</label>';
            html += '</div>';
        });

        /* Wiersze danych */
        allCts.forEach(function (ct, rIdx) {
            const ctLabel = groupLabels[ct] || ct;
            const lastRow = rIdx === allCts.length - 1;
            const rowStyle = lastRow ? '' : 'border-bottom:1px solid rgba(var(--white-rgb), 0.05);';

            html +=
                '<div style="padding:0.25rem 0.3rem;font-size: var(--fs-3xs);font-weight: var(--fw-medium);color:var(--slate-400);background:rgba(var(--white-rgb), 0.05);' +
                rowStyle +
                '">' +
                escapeHtml(ctLabel) +
                '</div>';

            gridCols.forEach(function (col, cIdx) {
                let cellStyle = rowStyle;
                if (cIdx < gridCols.length - 1)
                    cellStyle += 'border-right:1px solid rgba(var(--white-rgb), 0.05);';
                cellStyle += 'padding:0.15rem 0.2rem;';
                if (col.isBase) cellStyle += 'background:rgba(var(--accent2-rgb), 0.05);';

                const cols = col.groups[ct] || [];
                html += '<div style="' + cellStyle + '">';
                if (cols.length === 0) {
                    html +=
                        '<span style="color:var(--slate-700);font-size: var(--fs-3xs);">—</span>';
                } else {
                    if (cols.length > 1) {
                        const cellIds = cols.map(function (c) {
                            return c.id;
                        });
                        const cellAllVis = cellIds.every(function (id) {
                            return !_excelIsColumnHidden(id);
                        });
                        const cellSomeVis = cellIds.some(function (id) {
                            return !_excelIsColumnHidden(id);
                        });
                        const cellIndet = !cellAllVis && cellSomeVis;
                        const escapedIds = cellIds.map(function (id) {
                            return id.replace(/'/g, "\\'");
                        });
                        html +=
                            '<label style="display:inline-flex;align-items:center;gap:0.2rem;margin-right:0.2rem;font-size: var(--fs-3xs);color:var(--slate-500);cursor:pointer;white-space:nowrap;">';
                        html +=
                            '<input type="checkbox"' +
                            (cellAllVis ? ' checked' : '') +
                            (cellIndet ? ' data-indeterminate="true"' : '') +
                            ' onchange="_excelOnCellToggleAll([\'' +
                            escapedIds.join("','") +
                            '\'],this.checked)" style="accent-color:var(--accent2);cursor:pointer;width:8px;height:8px;" />';
                        html += '<span style="color:var(--slate-600);">wsz.</span></label>';
                    }
                    cols.forEach(function (c) {
                        html += _excelColCheckboxHtml(c, '0.2rem');
                    });
                }
                html += '</div>';
            });
        });

        html += '</div>';
        return html;
    }

    /* Buduj tablicę kolumn (DN) dla gridu */
    const baseDn = _excelActiveTab || '';
    const gridCols = [];

    /* 1. Kolumna podstawowa */
    const baseGroups = {};
    staticGroupOrder.forEach(function (g) {
        if (groups[g]) baseGroups[g] = groups[g].cols;
    });
    gridCols.push({
        id: '_base',
        label: baseDn ? 'DN' + baseDn : 'Podstawowa',
        isBase: true,
        groups: baseGroups
    });

    /* 2. Kolumny redukcji */
    reductionKeys.forEach(function (key) {
        const dn = key.replace('_reduction_', '');
        const grp = groups[key];
        const sub = {};
        grp.cols.forEach(function (c) {
            const ct = c.componentType;
            if (!sub[ct]) sub[ct] = [];
            sub[ct].push(c);
        });
        gridCols.push({ id: key, label: 'DN' + dn, isBase: false, groups: sub });
    });

    /* Wszystkie unikalne typy komponentów */
    const allCts = [];
    gridCols.forEach(function (col) {
        Object.keys(col.groups).forEach(function (ct) {
            if (allCts.indexOf(ct) < 0) allCts.push(ct);
        });
    });
    allCts.sort(function (a, b) {
        const ai = staticGroupOrder.indexOf(a);
        const bi = staticGroupOrder.indexOf(b);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

    const existingModal = document.getElementById('excel-col-vis-modal');
    if (existingModal) {
        const gridHtml = _excelBuildColumnGridHtml(gridCols, allCts, groupLabels);
        const oldGrid = existingModal.querySelector('#excel-col-vis-grid');
        if (oldGrid) oldGrid.outerHTML = gridHtml;
        const cbs = existingModal.querySelectorAll(
            'input[type="checkbox"][data-indeterminate="true"]'
        );
        cbs.forEach(function (cb) {
            /** @type {HTMLInputElement} */ (cb).indeterminate = true;
        });
        return;
    }

    const gridHtml = _excelBuildColumnGridHtml(gridCols, allCts, groupLabels);
    let html = '';
    html +=
        '<div class="modal" style="max-width:min(96vw,1400px);max-height:90vh;overflow:auto;width:auto;">';
    html +=
        '<div class="modal-header"><h3>Wybór kolumn Excel</h3><button onclick="this.closest(\'.modal-overlay\').remove()" class="btn-icon" aria-label="Zamknij"><i data-lucide="x" aria-hidden="true"></i></button></div>';
    html += gridHtml;
    html +=
        '<div style="padding-top:0.5rem;margin-top:0.5rem;border-top:1px solid rgba(var(--white-rgb), 0.1);">';
    html +=
        '<button type="button" onclick="let o=this.closest(\'.modal-overlay\');_excelResetColumnVisibility();if(o)o.remove()" class="excel-reset-btn">Przywróć domyślne</button>';
    html += '</div></div>';

    const overlay = window.showModal({
        id: 'excel-col-vis-modal',
        html: html,
        onOpen: function () {
            const modal = document.getElementById('excel-col-vis-modal');
            if (!modal) return;
            const cbs = modal.querySelectorAll('input[type="checkbox"][data-indeterminate="true"]');
            cbs.forEach(function (cb) {
                /** @type {HTMLInputElement} */ (cb).indeterminate = true;
            });
        }
    });
    /* Ikony Lucide w treści modala (showModal nie wywołuje createIcons) */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons({ root: overlay });
        } catch (_e) {}
    }
}

function _excelOnDnSelectAll(dnKey, checked) {
    const refWell =
        typeof _excelGetReferenceWell === 'function'
            ? _excelGetReferenceWell(_excelActiveTab)
            : null;
    const allCols = _excelBuildComponentColumns(_excelActiveTab, refWell);
    if (!allCols) return;
    const ids = [];
    allCols.forEach(function (col) {
        const c = /** @type {any} */ (col);
        const g = c.fromReduction ? '_reduction_' + (c.targetDn || 1000) : col.componentType;
        if (dnKey === '_base' && !c.fromReduction) ids.push(col.id);
        else if (c.fromReduction && g === dnKey) ids.push(col.id);
    });
    _excelResetLayoutDependentState();
    ids.forEach(function (id) {
        if (checked) {
            const idx = _excelHiddenColumnIds.indexOf(id);
            if (idx >= 0) _excelHiddenColumnIds.splice(idx, 1);
        } else {
            if (_excelHiddenColumnIds.indexOf(id) < 0) _excelHiddenColumnIds.push(id);
        }
    });
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
    _excelToggleColumnPopup();
}

function _excelOnCellToggleAll(ids, checked) {
    _excelResetLayoutDependentState();
    ids.forEach(function (id) {
        if (checked) {
            const idx = _excelHiddenColumnIds.indexOf(id);
            if (idx >= 0) _excelHiddenColumnIds.splice(idx, 1);
        } else {
            if (_excelHiddenColumnIds.indexOf(id) < 0) _excelHiddenColumnIds.push(id);
        }
    });
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
    _excelToggleColumnPopup();
}

function _excelOnColumnToggle(colId, checked) {
    _excelResetLayoutDependentState();
    if (checked) {
        const idx = _excelHiddenColumnIds.indexOf(colId);
        if (idx >= 0) _excelHiddenColumnIds.splice(idx, 1);
    } else {
        if (_excelHiddenColumnIds.indexOf(colId) < 0) {
            _excelHiddenColumnIds.push(colId);
        }
    }
    _excelSaveColumnVisibility();
    _excelRenderTable(_excelActiveTab);
    _excelToggleColumnPopup();
}
