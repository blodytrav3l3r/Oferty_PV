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
        let hidden = _excelIsColumnHidden(col.id);
        let colName = col.shortLabel || col.label || col.id;
        let detail = col.detailLabel && col.detailLabel !== '·' ? ' (' + col.detailLabel + ')' : '';
        let h =
            '<label style="display:flex;align-items:center;gap:0.4rem;padding:0.15rem 0.2rem 0.15rem ' +
            padLeft +
            ';font-size:0.6rem;color:#94a3b8;cursor:pointer;white-space:nowrap;border-radius:2px;transition:background 0.1s;" onmouseenter="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseleave="this.style.background=\'transparent\'">';
        h += '<input type="checkbox"';
        if (!hidden) h += ' checked';
        h +=
            ' onchange="_excelOnColumnToggle(\'' +
            col.id.replace(/'/g, "\\'") +
            '\',this.checked)" style="accent-color:#8b5cf6;cursor:pointer;" />';
        h +=
            escapeHtml(colName) +
            (detail
                ? ' <span style="color:#64748b;font-size:0.55rem;">' +
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
            ',minmax(140px,1fr));border:1px solid rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">';

        /* Nagłówek — wiersz 1: DN */
        html +=
            '<div style="padding:0.25rem 0.3rem;background:rgba(255,255,255,0.03);font-size:0.55rem;font-weight:500;color:#64748b;border-bottom:1px solid rgba(255,255,255,0.06);"></div>';
        gridCols.forEach(function (col, cIdx) {
            let sepStyle =
                cIdx < gridCols.length - 1 ? 'border-right:1px solid rgba(255,255,255,0.04);' : '';
            let bg = col.isBase
                ? 'background:rgba(139,92,246,0.06);'
                : 'background:rgba(255,255,255,0.03);';
            html +=
                '<div style="padding:0.25rem 0.3rem;' +
                bg +
                'font-size:0.55rem;font-weight:600;color:#c4b5fd;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);' +
                sepStyle +
                '">' +
                escapeHtml(col.label) +
                '</div>';
        });

        /* Nagłówek — wiersz 2: checkbox "Wszystkie" per kolumna */
        html +=
            '<div style="padding:0.2rem 0.3rem;background:rgba(255,255,255,0.02);font-size:0.5rem;color:#64748b;border-bottom:1px solid rgba(255,255,255,0.06);"></div>';
        gridCols.forEach(function (col, cIdx) {
            let sepStyle =
                cIdx < gridCols.length - 1 ? 'border-right:1px solid rgba(255,255,255,0.04);' : '';
            let bg = col.isBase
                ? 'background:rgba(139,92,246,0.04);'
                : 'background:rgba(255,255,255,0.02);';
            let allIds = [];
            Object.keys(col.groups).forEach(function (ct) {
                col.groups[ct].forEach(function (c) {
                    allIds.push(c.id);
                });
            });
            let allVis = allIds.every(function (id) {
                return !_excelIsColumnHidden(id);
            });
            html +=
                '<div style="padding:0.15rem 0.2rem;text-align:center;' +
                bg +
                'border-bottom:1px solid rgba(255,255,255,0.06);' +
                sepStyle +
                '">';
            html +=
                '<label style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.55rem;color:#94a3b8;cursor:pointer;white-space:nowrap;">';
            html += '<input type="checkbox"';
            if (allVis) html += ' checked';
            html +=
                ' onchange="_excelOnDnSelectAll(\'' +
                col.id.replace(/'/g, "\\'") +
                '\',this.checked)" style="accent-color:#8b5cf6;cursor:pointer;width:10px;height:10px;" />';
            html += 'Wszystkie</label>';
            html += '</div>';
        });

        /* Wiersze danych */
        allCts.forEach(function (ct, rIdx) {
            let ctLabel = groupLabels[ct] || ct;
            let lastRow = rIdx === allCts.length - 1;
            let rowStyle = lastRow ? '' : 'border-bottom:1px solid rgba(255,255,255,0.04);';

            html +=
                '<div style="padding:0.25rem 0.3rem;font-size:0.55rem;font-weight:500;color:#94a3b8;background:rgba(255,255,255,0.01);' +
                rowStyle +
                '">' +
                escapeHtml(ctLabel) +
                '</div>';

            gridCols.forEach(function (col, cIdx) {
                let cellStyle = rowStyle;
                if (cIdx < gridCols.length - 1)
                    cellStyle += 'border-right:1px solid rgba(255,255,255,0.04);';
                cellStyle += 'padding:0.15rem 0.2rem;';
                if (col.isBase) cellStyle += 'background:rgba(139,92,246,0.03);';

                let cols = col.groups[ct] || [];
                html += '<div style="' + cellStyle + '">';
                if (cols.length === 0) {
                    html += '<span style="color:#3f4356;font-size:0.5rem;">—</span>';
                } else {
                    if (cols.length > 1) {
                        let cellIds = cols.map(function (c) {
                            return c.id;
                        });
                        let cellAllVis = cellIds.every(function (id) {
                            return !_excelIsColumnHidden(id);
                        });
                        let cellSomeVis = cellIds.some(function (id) {
                            return !_excelIsColumnHidden(id);
                        });
                        let cellIndet = !cellAllVis && cellSomeVis;
                        let escapedIds = cellIds.map(function (id) {
                            return id.replace(/'/g, "\\'");
                        });
                        html +=
                            '<label style="display:inline-flex;align-items:center;gap:0.2rem;margin-right:0.2rem;font-size:0.5rem;color:#64748b;cursor:pointer;white-space:nowrap;">';
                        html +=
                            '<input type="checkbox"' +
                            (cellAllVis ? ' checked' : '') +
                            (cellIndet ? ' data-indeterminate="true"' : '') +
                            ' onchange="_excelOnCellToggleAll([\'' +
                            escapedIds.join("','") +
                            '\'],this.checked)" style="accent-color:#8b5cf6;cursor:pointer;width:8px;height:8px;" />';
                        html += '<span style="color:#475569;">wsz.</span></label>';
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
    let baseDn = _excelActiveTab || '';
    let gridCols = [];

    /* 1. Kolumna podstawowa */
    let baseGroups = {};
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
        let dn = key.replace('_reduction_', '');
        let grp = groups[key];
        let sub = {};
        grp.cols.forEach(function (c) {
            let ct = c.componentType;
            if (!sub[ct]) sub[ct] = [];
            sub[ct].push(c);
        });
        gridCols.push({ id: key, label: 'DN' + dn, isBase: false, groups: sub });
    });

    /* Wszystkie unikalne typy komponentów */
    let allCts = [];
    gridCols.forEach(function (col) {
        Object.keys(col.groups).forEach(function (ct) {
            if (allCts.indexOf(ct) < 0) allCts.push(ct);
        });
    });
    allCts.sort(function (a, b) {
        let ai = staticGroupOrder.indexOf(a);
        let bi = staticGroupOrder.indexOf(b);
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

    let existingModal = document.getElementById('excel-col-vis-modal');
    if (existingModal) {
        let gridHtml = _excelBuildColumnGridHtml(gridCols, allCts, groupLabels);
        let oldGrid = existingModal.querySelector('#excel-col-vis-grid');
        if (oldGrid) oldGrid.outerHTML = gridHtml;
        let cbs = existingModal.querySelectorAll(
            'input[type="checkbox"][data-indeterminate="true"]'
        );
        cbs.forEach(function (cb) {
            /** @type {HTMLInputElement} */ (cb).indeterminate = true;
        });
        return;
    }

    let gridHtml = _excelBuildColumnGridHtml(gridCols, allCts, groupLabels);
    let html = '';
    html += '<div class="modal" style="max-width:620px;max-height:70vh;overflow-y:auto;">';
    html +=
        '<div class="modal-header"><h3>Wybór kolumn Excel</h3><button onclick="this.closest(\'.modal-overlay\').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:0;line-height:1;">✕</button></div>';
    html += gridHtml;
    html +=
        '<div style="padding-top:0.5rem;margin-top:0.5rem;border-top:1px solid rgba(255,255,255,0.08);">';
    html +=
        '<button onclick="let o=this.closest(\'.modal-overlay\');_excelResetColumnVisibility();if(o)o.remove()" style="width:100%;background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);padding:0.3rem 0.5rem;border-radius:3px;font-size:0.6rem;cursor:pointer;font-weight:500;transition:background 0.1s;" onmouseenter="this.style.background=\'rgba(239,68,68,0.2)\'" onmouseleave="this.style.background=\'rgba(239,68,68,0.1)\'">Przywróć domyślne</button>';
    html += '</div></div>';

    window.showModal({
        id: 'excel-col-vis-modal',
        html: html,
        onOpen: function () {
            let modal = document.getElementById('excel-col-vis-modal');
            if (!modal) return;
            let cbs = modal.querySelectorAll('input[type="checkbox"][data-indeterminate="true"]');
            cbs.forEach(function (cb) {
                /** @type {HTMLInputElement} */ (cb).indeterminate = true;
            });
        }
    });
}

function _excelOnDnSelectAll(dnKey, checked) {
    let refWell =
        typeof _excelGetReferenceWell === 'function'
            ? _excelGetReferenceWell(_excelActiveTab)
            : null;
    let allCols = _excelBuildComponentColumns(_excelActiveTab, refWell);
    if (!allCols) return;
    let ids = [];
    allCols.forEach(function (col) {
        const c = /** @type {any} */ (col);
        const g = c.fromReduction ? '_reduction_' + (c.targetDn || 1000) : col.componentType;
        if (dnKey === '_base' && !c.fromReduction) ids.push(col.id);
        else if (c.fromReduction && g === dnKey) ids.push(col.id);
    });
    _excelDeselectAllCols();
    ids.forEach(function (id) {
        if (checked) {
            let idx = _excelHiddenColumnIds.indexOf(id);
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
    _excelDeselectAllCols();
    ids.forEach(function (id) {
        if (checked) {
            let idx = _excelHiddenColumnIds.indexOf(id);
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
    _excelDeselectAllCols();
    if (checked) {
        let idx = _excelHiddenColumnIds.indexOf(colId);
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
