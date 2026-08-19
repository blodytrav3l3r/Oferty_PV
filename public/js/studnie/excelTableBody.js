// @ts-check
/* ===== EXCEL TABLE BODY — Render TBODY, autoodświeżanie komórek i kolorów duplikatów ===== */

/* Tint wiersza wg configStatus — ERROR dominuje nad WARNING. Wspólny punkt
   prawdy dla renderu i _excelRefreshDupColors (DRY, priorytet:
   ERROR > WARNING > duplikat > aktywny > base). */
function _excelGetRowStatus(well) {
    if (!well) return null;
    const s = well.configStatus;
    if (s === 'ERROR') {
        return {
            base: 'rgba(var(--danger-rgb), 0.12)',
            active: 'rgba(var(--danger-rgb), 0.22)',
            hover: 'rgba(var(--danger-rgb), 0.18)'
        };
    }
    if (s === 'WARNING') {
        return {
            base: 'rgba(var(--warn-rgb), 0.1)',
            active: 'rgba(var(--warn-rgb), 0.2)',
            hover: 'rgba(var(--warn-rgb), 0.16)'
        };
    }
    return null;
}

/* ===== TBODY RENDER ===== */
function _excelRenderTbody(tabWells, dn, visibleCols, maxTr, hasReduction) {
    let html = '</thead><tbody>';
    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;
    const nameCounts = {};
    const nameDnMap = {};
    wells.forEach(function (w) {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const dnKey = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            const dnC = DN_COLORS[dnKey] || DN_COLORS['1000'];
            if (
                !nameDnMap[n].find(function (x) {
                    return x.dn === dnKey;
                })
            ) {
                nameDnMap[n].push({
                    dn: dnKey,
                    label: dnKey === 'styczne' ? 'Styczne' : 'DN' + dnKey,
                    color: dnC.border
                });
            }
        }
    });
    const dupNames = new Set(
        Object.keys(nameCounts).filter(function (n) {
            return nameCounts[n] > 1;
        })
    );
    tabWells.forEach(function (well, idx) {
        const wIdx = wells.indexOf(well);
        const isLockedRow = _excelIsWellLocked(wIdx);
        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        const dnKey = dn === 'styczne' ? 'styczne' : dn;
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter(function (d) {
            return d.dn !== dnKey;
        });
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const dupRgb =
            {
                1000: 'var(--blue-rgb)',
                1200: 'var(--success-rgb)',
                1500: 'var(--warn-rgb)',
                2000: 'var(--purple-rgb)',
                2500: 'var(--danger-rgb)',
                styczne: 'var(--pink-rgb)'
            }[dupColorKey] || 'var(--blue-rgb)';
        const baseBg = isEven ? 'var(--bg-primary)' : 'var(--bg-secondary)';
        const rowDupSolid = 'rgba(' + dupRgb + ', 0.2)';
        const rowActiveDupSolid = 'rgba(' + dupRgb + ', 0.3)';
        const hoverDupSolid = 'rgba(' + dupRgb + ', 0.25)';
        const hoverActiveDupSolid = 'rgba(' + dupRgb + ', 0.35)';
        let rowBg =
            isDup && isActive
                ? rowActiveDupSolid
                : isDup
                  ? rowDupSolid
                  : isActive
                    ? 'rgba(var(--blue-rgb), 0.18)'
                    : baseBg;
        let hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid
                : isDup
                  ? hoverDupSolid
                  : isActive
                    ? 'rgba(var(--blue-rgb), 0.28)'
                    : 'var(--bg-tertiary)';
        let activeBg =
            isDup && isActive
                ? rowActiveDupSolid
                : isDup
                  ? hoverDupSolid
                  : 'rgba(var(--blue-rgb), 0.18)';
        /* Status konfiguracji dominuje nad duplikatem/aktywnym (ERROR > WARNING) */
        const wellStatus = _excelGetRowStatus(well);
        if (wellStatus) {
            rowBg = isActive ? wellStatus.active : wellStatus.base;
            hoverBg = wellStatus.hover;
            activeBg = wellStatus.active;
        }
        const statusTitle =
            well && well.configErrors && well.configErrors.length > 0
                ? ' title="' +
                  escapeHtml(String(well.configErrors[0])) +
                  (well.configErrors.length > 1
                      ? ' (+' + (well.configErrors.length - 1) + ')'
                      : '') +
                  '"'
                : '';
        const przejscia = well.przejscia || [];
        const solidBase = isEven ? 'var(--bg-primary)' : 'var(--bg-secondary)';
        const stickyBg = _excelStickyCellBg(rowBg, solidBase);
        html +=
            '<tr data-widx="' +
            wIdx +
            '" data-base-bg="' +
            rowBg +
            '" data-orig-bg="' +
            rowBg +
            '" data-hover-bg="' +
            hoverBg +
            '" data-active-bg="' +
            activeBg +
            '" data-solid-bg="' +
            solidBase +
            '" style="background:' +
            rowBg +
            ';transition:background 0.15s;"' +
            statusTitle +
            (isLockedRow
                ? ' title="Studnia zablokowana — zaakceptowane PZ / część zamówienia"'
                : '') +
            ' onmouseenter="this.style.background=this.getAttribute(\'data-hover-bg\')" onmouseleave="this.style.background=this.getAttribute(\'data-orig-bg\')">';
        /* Checkbox */
        const cbChecked = _excelRowSelectStates[wIdx] ? ' checked' : '';
        html +=
            '<td class="excel-td" style="' +
            'background:' +
            stickyBg +
            ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:28px;"><input type="checkbox" class="excel-row-select" data-widx="' +
            wIdx +
            '"' +
            cbChecked +
            ' tabindex="-1" class="cursor-accent-check" /></td>';
        /* AUTO/MANUAL */
        const isAuto = window.isWellAuto(well);
        html +=
            '<td class="excel-td" style="' +
            'background:' +
            stickyBg +
            ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:54px;min-width:54px;"><button type="button" id="excel-mode-btn-' +
            wIdx +
            '" data-widx="' +
            wIdx +
            '" onclick="_excelToggleWellAutoMode(' +
            wIdx +
            ')" class="excel-mode-btn ' +
            (isAuto ? 'is-auto' : 'is-manual') +
            '">' +
            (isAuto ? 'AUTO' : 'MANUAL') +
            '</button><button type="button" id="excel-run-auto-' +
            wIdx +
            '" data-widx="' +
            wIdx +
            '" onclick="_excelRunAutoSelectForWell(' +
            wIdx +
            ')"' +
            (isAuto ? '' : ' disabled') +
            ' class="excel-run-btn ' +
            (isAuto ? 'is-auto' : 'is-manual') +
            '"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="d-block"><polygon points="3,2 15,8 3,14"/></svg></button></td>';
        /* Lp */
        html +=
            '<td class="excel-td" style="' +
            'position:sticky;left:0;z-index:' +
            LAYERS_EXCEL.STICKY_COLUMN +
            ';background:' +
            stickyBg +
            ';text-align:center;color:var(--slate-500);font-size: var(--fs-xs);border-right:1px solid rgba(var(--white-rgb), 0.1);min-width:32px;">' +
            (idx + 1) +
            '</td>';
        /* Nazwa */
        html +=
            '<td class="excel-td" style="' +
            'position:sticky;left:32px;z-index:' +
            LAYERS_EXCEL.STICKY_COLUMN +
            ';background:' +
            stickyBg +
            ';border-right:1px solid rgba(var(--white-rgb), 0.1);"><input type="text" value="' +
            escapeHtmlAttr(well.name) +
            '" onchange="excelOnNameChange(' +
            wIdx +
            ',this.value)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(120) +
            'text-align:left;width:118px;" /></td>';
        /* Rz Wlazu */
        html +=
            '<td class="excel-td" style="' +
            'position:sticky;left:162px;z-index:' +
            LAYERS_EXCEL.STICKY_COLUMN +
            ';background:' +
            stickyBg +
            ';text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="' +
            (well.rzednaWlazu != null ? well.rzednaWlazu : '') +
            '" onchange="excelOnRzednaChange(' +
            wIdx +
            ')" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(72) +
            '" /></td>';
        /* Rz Dna */
        html +=
            '<td class="excel-td" style="' +
            'position:sticky;left:240px;z-index:' +
            LAYERS_EXCEL.STICKY_COLUMN +
            ';background:' +
            stickyBg +
            ';text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="' +
            (well.rzednaDna != null ? well.rzednaDna : '') +
            '" onchange="excelOnRzednaChange(' +
            wIdx +
            ')" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(72) +
            '" /></td>';
        /* Wys auto */
        const height = _excelCalcWellHeight(well);
        html +=
            '<td class="excel-td" style="' +
            'position:sticky;left:318px;z-index:' +
            LAYERS_EXCEL.STICKY_COLUMN +
            ';background:' +
            stickyBg +
            ';text-align:center;color:' +
            dnColor +
            ';font-weight: var(--fw-semibold);" data-cell="height-' +
            wIdx +
            '">' +
            (height || '\u2014') +
            '</td>';
        /* Przejscia */
        for (let _i = 0; _i < maxTr; _i++) {
            const prz = przejscia[_i] || {};
            const hasExplicitRzWl = prz.rzednaWlaczenia != null && prz.rzednaWlaczenia !== '';
            const rzWlPlaceholder =
                !hasExplicitRzWl && well.rzednaDna != null
                    ? 'auto (' + well.rzednaDna.toFixed(3) + ')'
                    : '';
            const przProducts =
                typeof studnieProducts !== 'undefined' && typeof getMaxPipeDn === 'function'
                    ? studnieProducts.filter(function (p) {
                          return (
                              p.componentType === 'przejscie' &&
                              p.active !== 0 &&
                              parseInt(p.dn) <= getMaxPipeDn(well.dn)
                          );
                      })
                    : [];
            const currProduct = przProducts.find(function (p) {
                return p.id === prz.productId;
            });
            const categories = [
                ...new Set(
                    przProducts.map(function (p) {
                        return p.category;
                    })
                )
            ]
                .filter(function (c) {
                    return (
                        typeof visiblePrzejsciaTypes !== 'undefined' && visiblePrzejsciaTypes.has(c)
                    );
                })
                .sort();
            const activeCategory = currProduct ? currProduct.category : prz.tempCategory || '';
            if (activeCategory && categories.indexOf(activeCategory) < 0) {
                categories.push(activeCategory);
            }
            const catOpts = [['', '\u2014']];
            categories.forEach(function (c) {
                catOpts.push([c, c]);
            });
            const typeHtml = _excelOverlaySelectHtml(
                catOpts,
                activeCategory,
                'excelOnPrzejscieTypeChange(' + wIdx + ',' + _i + ',this.value)',
                120
            );
            const availDns = activeCategory
                ? [
                      ...przProducts.filter(function (p) {
                          return p.category === activeCategory;
                      })
                  ].sort(function (a, b) {
                      return parseFloat(a.dn) - parseFloat(b.dn);
                  })
                : [];
            const dnOpts = [['', '\u2014']];
            availDns.forEach(function (p) {
                const dnLabel =
                    typeof p.dn === 'string' && p.dn.indexOf('/') >= 0 ? p.dn : 'DN ' + p.dn;
                dnOpts.push([p.id, dnLabel]);
            });
            const dnHtml = _excelOverlaySelectHtml(
                dnOpts,
                prz.productId,
                'excelOnPrzejscieChange(' + wIdx + ',' + _i + ",'productId',this.value)",
                110
            );
            html +=
                '<td class="excel-td excel-td-right"><input type="number" step="0.01" value="' +
                (hasExplicitRzWl ? prz.rzednaWlaczenia : '') +
                '" placeholder="' +
                rzWlPlaceholder +
                '" onchange="excelOnPrzejscieChange(' +
                wIdx +
                ',' +
                _i +
                ",'rzednaWlaczenia',this.value)" +
                '" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
                _excelCellInp(72) +
                '" /></td>';
            html +=
                '<td class="excel-td excel-td-center"><input type="number" step="1" value="' +
                (prz.angle != null ? prz.angle : '') +
                '" onchange="excelOnPrzejscieChange(' +
                wIdx +
                ',' +
                _i +
                ",'angle',this.value)" +
                '" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
                _excelCellInp(50) +
                'text-align:center;" /></td>';
            html += '<td class="excel-td excel-td-left">' + typeHtml + '</td>';
            html += '<td class="excel-td excel-td-left">' + dnHtml + '</td>';
        }
        /* Gap */
        html += '<td class="code-cell-center"></td><td class="code-cell-center"></td>';
        /* Wlaz */
        const wlazCol = visibleCols.find(function (c) {
            return c.componentType === 'wlaz';
        });
        const wlazProducts = wlazCol
            ? wlazCol.products.filter(function (p) {
                  return typeof filterByWellParams !== 'function' || filterByWellParams(p, well);
              })
            : [];
        const wlazVal = _excelGetWlazFromConfig(well);
        const wlazOpts = [['', '\u2014']];
        wlazProducts.forEach(function (p) {
            const hCm = Math.round(parseInt(p.height) || 0) / 10;
            const lbl =
                hCm > 0
                    ? hCm + ' cm'
                    : (p.name || '').length > 20
                      ? (p.name || '').substring(0, 18) + '\u2026'
                      : p.name || '';
            wlazOpts.push([p.id, lbl]);
        });
        html +=
            '<td class="text-left">' +
            _excelOverlaySelectHtml(
                wlazOpts,
                wlazVal,
                'excelOnWlazChange(' + wIdx + ',this.value)',
                62
            ) +
            '</td>';
        /* Komponenty */
        visibleCols.forEach(function (col) {
            if (col.type === 'select' || col.type === 'auto') return;
            const c = col;
            const count = _excelCountProductInConfig(
                well,
                c.componentType,
                c.height,
                c.productId,
                c.fromReduction ? c.targetDn || well.redukcjaTargetDN || 1000 : null
            );
            const pidArg = c.productId ? "'" + c.productId + "'" : 'null';
            const hArg = c.height != null ? c.height : 'null';
            const redArg = c.fromReduction ? ',' + (c.targetDn || 1000) : '';
            html +=
                '<td class="excel-td excel-td-center" style="min-width:95px;"><input type="number" min="0" step="1" value="' +
                (count || '') +
                '" oninput="excelOnCompChange(' +
                wIdx +
                ",'" +
                c.componentType +
                "'," +
                hArg +
                ',this.value,' +
                pidArg +
                redArg +
                ')" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
                _excelCellInp(50) +
                'text-align:center;width:52px;" /></td>';
        });
        /* H dennica */
        const dennH = _excelCalcDennicaHeight(well);
        html +=
            '<td class="excel-td excel-td-center" style="color:var(--warn-hover);font-weight: var(--fw-semibold);" data-cell="denn-' +
            wIdx +
            '">' +
            (dennH || '\u2014') +
            '</td>';
        /* Uszczelki */
        const uszczCount = _excelCalcUszczelkaCount(well);
        html +=
            '<td class="excel-td excel-td-center" style="color:var(--warn);font-weight: var(--fw-semibold);" data-cell="uszcz-' +
            wIdx +
            '">' +
            uszczCount +
            '</td>';
        /* Redukcja */
        if (hasReduction) {
            const redActive = well.redukcjaDN1000;
            const redTarget = well.redukcjaTargetDN || 1000;
            const can1200 = [1500, 2000, 2500].includes(parseInt(well.dn)) || well.dn === 'styczna';
            const redOpts = [['', 'Brak']];
            redOpts.push(['1000', 'DN1000']);
            if (can1200 || (redActive && redTarget === 1200)) redOpts.push(['1200', 'DN1200']);
            html +=
                '<td class="excel-td excel-td-center">' +
                _excelOverlaySelectHtml(
                    redOpts,
                    redActive ? String(redTarget) : '',
                    'excelOnReductionSelectChange(' + wIdx + ',this.value)',
                    105
                ) +
                '</td>';
        }
        /* Kineta */
        const kinOpts = [['', '\u2014']];
        KINETA_OPTIONS.forEach(function (ko) {
            kinOpts.push([ko[0], ko[1]]);
        });
        html +=
            '<td class="text-left">' +
            _excelOverlaySelectHtml(
                kinOpts,
                well.kineta || '',
                'excelOnKinetaChange(' + wIdx + ',this.value)',
                90,
                !!well.psiaBuda
            ) +
            '</td>';
        /* Psia buda */
        html +=
            '<td class="excel-td excel-td-center"><input type="checkbox"' +
            (well.psiaBuda ? ' checked' : '') +
            ' onchange="excelOnPsiaBudaChange(' +
            wIdx +
            ',this.checked)" class="excel-check-pb" /></td>';
        /* Akcje */
        html +=
            '<td class="excel-td excel-td-center" style="white-space:nowrap;"><div style="display:flex;gap:2px;justify-content:center;">';
        if (isLockedRow) {
            html +=
                '<span title="Studnia zablokowana — edycja niedostępna" style="color:var(--danger-hover);display:inline-flex;align-items:center;margin-right:2px;"><i data-lucide="lock" class="icon-xs" aria-hidden="true"></i></span>';
        }
        html +=
            '<button onclick="excelOpenWellParams(' +
            wIdx +
            ')" title="Parametry" class="excel-action-btn is-accent"><i data-lucide="settings" class="icon-sm" aria-hidden="true"></i></button>';
        html +=
            '<button onclick="excelDuplicateWell(' +
            wIdx +
            ')" title="Duplikuj" class="excel-action-btn is-blue"><i data-lucide="copy" class="icon-sm" aria-hidden="true"></i></button>';
        html +=
            '<button onclick="excelDeleteWell(' +
            wIdx +
            ')" title="Usu\u0144" class="excel-action-btn is-danger"><i data-lucide="trash-2" class="icon-sm" aria-hidden="true"></i></button>';
        html += '</div></td>';
        html += '</tr>';
    });
    /* EMPTY ROW */
    const emptyRowBg = 'var(--slate-950)';
    html += '<tr id="excel-empty-row" style="background:' + emptyRowBg + ';">';
    html += '<td class="excel-td excel-td-empty" style="';
    'background:' +
        emptyRowBg +
        ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:28px;"><input type="checkbox" disabled tabindex="-1" style="cursor:default;accent-color:rgba(var(--accent-rgb), 0.8);opacity:0.3;" /></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'background:' +
        emptyRowBg +
        ';text-align:center;padding:2px;border-right:1px solid rgba(var(--white-rgb), 0.05);width:54px;min-width:54px;"><button type="button" disabled style="display:block;width:100%;padding:2px 0;border-radius: var(--radius-2xs);font-size: var(--fs-3xs);cursor:default;background:rgba(var(--slate-500-rgb), 0.15);color:var(--slate-500);border:1px solid rgba(var(--slate-500-rgb), 0.3);font-weight: var(--fw-semibold);height:18px;opacity:0.3;">\u2014</button><button type="button" disabled style="display:flex;width:100%;margin-top:2px;padding:2px 0;border-radius: var(--radius-2xs);font-size: var(--fs-base);cursor:default;background:rgba(var(--slate-500-rgb), 0.15);color:var(--slate-500);border:1px solid rgba(var(--slate-500-rgb), 0.3);height:18px;align-items:center;justify-content:center;opacity:0.3;"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="d-block"><polygon points="3,2 15,8 3,14"/></svg></button></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'position:sticky;left:0;z-index:' +
        LAYERS_EXCEL.STICKY_COLUMN +
        ';background:' +
        emptyRowBg +
        ';text-align:center;color:var(--slate-700);font-size: var(--fs-xs);border-right:1px solid rgba(var(--white-rgb), 0.1);min-width:32px;">\u2014</td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'position:sticky;left:32px;z-index:' +
        LAYERS_EXCEL.STICKY_COLUMN +
        ';background:' +
        emptyRowBg +
        ';"><input type="text" placeholder="Wpisz nazw\u0119 i Enter aby doda\u0107" id="excel-empty-name" onkeydown="if(event.key===\'Enter\')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(125) +
        'text-align:left;color:var(--slate-400);" /></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'position:sticky;left:162px;z-index:' +
        LAYERS_EXCEL.STICKY_COLUMN +
        ';background:' +
        emptyRowBg +
        ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzw" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(72) +
        '" /></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'position:sticky;left:240px;z-index:' +
        LAYERS_EXCEL.STICKY_COLUMN +
        ';background:' +
        emptyRowBg +
        ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzd" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(72) +
        '" /></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'position:sticky;left:318px;z-index:' +
        LAYERS_EXCEL.STICKY_COLUMN +
        ';background:' +
        emptyRowBg +
        ';text-align:center;color:var(--slate-800);" data-cell="height-empty">\u2014</td>';
    for (let _j = 0; _j < maxTr; _j++) {
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:right;"><input type="number" step="0.01" placeholder="\u2014" disabled style="' +
            _excelCellInp(72) +
            'opacity:0.3;" /></td>';
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:center;"><input type="number" step="1" placeholder="\u2014" disabled style="' +
            _excelCellInp(50) +
            'opacity:0.3;" /></td>';
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:left;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 120, true) +
            '</td>';
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:left;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 110, true) +
            '</td>';
    }
    html += '<td class="code-cell"></td><td class="code-cell"></td>';
    html += '<td class="excel-td excel-td-empty" style="';
    'text-align:left;">' + _excelOverlaySelectHtml([['', '\u2014']], '', null, 125, true) + '</td>';
    visibleCols.forEach(function (col) {
        if (col.type === 'select' || col.type === 'auto') return;
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:center;"><input type="number" min="0" step="1" placeholder="\u2014" disabled style="' +
            _excelCellInp(50) +
            'opacity:0.3;" /></td>';
    });
    html += '<td class="excel-td excel-td-empty" style="';
    ('text-align:center;color:var(--slate-800);" data-cell="denn-empty">\u2014</td>');
    html += '<td class="excel-td excel-td-empty" style="';
    ('text-align:center;color:var(--slate-800);" data-cell="uszcz-empty">\u2014</td>');
    if (hasReduction) {
        html += '<td class="excel-td excel-td-empty" style="';
        'text-align:center;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 105, true) +
            '</td>';
    }
    html += '<td class="excel-td excel-td-empty" style="';
    'text-align:left;">' + _excelOverlaySelectHtml([['', '\u2014']], '', null, 90, true) + '</td>';
    html += '<td class="excel-td excel-td-empty" style="';
    ('text-align:center;"><input type="checkbox" disabled class="opacity-3" /></td>');
    html += '<td class="excel-td excel-td-empty" style="';
    ('text-align:center;color:var(--slate-800);font-size: var(--fs-2xs);" data-cell="empty-actions"><i data-lucide="plus-circle" style="width:16px;height:16px;color:var(--slate-700);" aria-hidden="true"></i></td>');
    html += '</tr>';
    html += '</tbody>';
    return html;
}

/* ===== AUTO-ODŚWIEŻANIE KOMÓREK (height, dennica, uszczelki) ===== */
function _excelRefreshAutoCells(wIdx, row) {
    const well = wells[wIdx];
    if (!well) return;

    const height = _excelCalcWellHeight(well);
    const hCell = row.querySelector(`[data-cell="height-${wIdx}"]`);
    if (hCell) hCell.textContent = height || '\u2014';

    const dennH = _excelCalcDennicaHeight(well);
    const dCell = row.querySelector(`[data-cell="denn-${wIdx}"]`);
    if (dCell) dCell.textContent = dennH || '\u2014';

    const uszcz = _excelCalcUszczelkaCount(well);
    const uCell = row.querySelector(`[data-cell="uszcz-${wIdx}"]`);
    if (uCell) uCell.textContent = uszcz;
}

/* ===== NATYCHMIASTOWE ODŚWIEŻENIE KOLORÓW DUPLIKATÓW (bez re-rendera) ===== */
function _excelRefreshDupColors() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const dn = _excelActiveTab === 'styczne' ? 'styczne' : _excelActiveTab;
    const dnKey = dn === 'styczne' ? 'styczne' : dn;

    const nameCounts = {};
    const nameDnMap = {};
    wells.forEach((w) => {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const wDn = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            if (!nameDnMap[n].find((x) => x.dn === wDn)) {
                nameDnMap[n].push({ dn: wDn });
            }
        }
    });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));

    const rowDupSolid = {
        1000: 'rgba(var(--blue-rgb), 0.2)',
        1200: 'rgba(var(--success-rgb), 0.2)',
        1500: 'rgba(var(--warn-rgb), 0.2)',
        2000: 'rgba(var(--purple-rgb), 0.2)',
        2500: 'rgba(var(--danger-rgb), 0.2)',
        styczne: 'rgba(var(--pink-rgb), 0.2)'
    };
    const rowActiveDupSolid = {
        1000: 'rgba(var(--blue-rgb), 0.3)',
        1200: 'rgba(var(--success-rgb), 0.3)',
        1500: 'rgba(var(--warn-rgb), 0.3)',
        2000: 'rgba(var(--purple-rgb), 0.3)',
        2500: 'rgba(var(--danger-rgb), 0.3)',
        styczne: 'rgba(var(--pink-rgb), 0.3)'
    };
    const hoverDupSolid = {
        1000: 'rgba(var(--blue-rgb), 0.25)',
        1200: 'rgba(var(--success-rgb), 0.25)',
        1500: 'rgba(var(--warn-rgb), 0.25)',
        2000: 'rgba(var(--purple-rgb), 0.25)',
        2500: 'rgba(var(--danger-rgb), 0.25)',
        styczne: 'rgba(var(--pink-rgb), 0.25)'
    };
    const hoverActiveDupSolid = {
        1000: 'rgba(var(--blue-rgb), 0.35)',
        1200: 'rgba(var(--success-rgb), 0.35)',
        1500: 'rgba(var(--warn-rgb), 0.35)',
        2000: 'rgba(var(--purple-rgb), 0.35)',
        2500: 'rgba(var(--danger-rgb), 0.35)',
        styczne: 'rgba(var(--pink-rgb), 0.35)'
    };

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const row = container.querySelector(`tr[data-widx="${wIdx}"]`);
        if (!row) return;

        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter((d) => d.dn !== dnKey);
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const baseBg = isEven ? 'var(--bg-primary)' : 'var(--bg-secondary)';

        const rowBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.3)'
                : isDup
                  ? rowDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.2)'
                  : isActive
                    ? 'rgba(var(--blue-rgb), 0.18)'
                    : baseBg;
        const hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.35)'
                : isDup
                  ? hoverDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.25)'
                  : isActive
                    ? 'rgba(var(--blue-rgb), 0.28)'
                    : 'var(--bg-tertiary)';
        const activeBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.3)'
                : isDup
                  ? hoverDupSolid[dupColorKey] || 'rgba(var(--blue-rgb), 0.25)'
                  : 'rgba(var(--blue-rgb), 0.18)';
        let effRowBg = rowBg;
        let effHoverBg = hoverBg;
        let effActiveBg = activeBg;
        /* Status konfiguracji dominuje nad duplikatem/aktywnym (ERROR > WARNING) */
        const wellStatus = _excelGetRowStatus(well);
        if (wellStatus) {
            effRowBg = isActive ? wellStatus.active : wellStatus.base;
            effHoverBg = wellStatus.hover;
            effActiveBg = wellStatus.active;
        }

        row.setAttribute('data-base-bg', effRowBg);
        row.setAttribute('data-orig-bg', effRowBg);
        row.setAttribute('data-hover-bg', effHoverBg);
        row.setAttribute('data-active-bg', effActiveBg);
        row.style.background = effRowBg;
        /* Zaktualizuj tła kolumn sticky — inaczej część wiersza (Lp, nazwa,
           rzędne) ma inną barwę niż reszta (bug S4). */
        const solidBg = row.getAttribute('data-solid-bg') || 'var(--bg-primary)';
        row.querySelectorAll('td:nth-child(-n+7)').forEach(function (td) {
            td.style.background = _excelStickyCellBg(effRowBg, solidBg);
        });
    });
}
