// @ts-check
/* ===== EXCEL TABLE BODY — Render TBODY, autoodświeżanie komórek i kolorów duplikatów ===== */

/* ===== TBODY RENDER ===== */
function _excelRenderTbody(tabWells, dn, compCols, maxTr, hasReduction) {
    let html = '</thead><tbody>';
    let dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;
    const nameCounts = {};
    const nameDnMap = {};
    wells.forEach(function (w) {
        let n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            let dnKey = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            let dnC = DN_COLORS[dnKey] || DN_COLORS['1000'];
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
    let dupNames = new Set(
        Object.keys(nameCounts).filter(function (n) {
            return nameCounts[n] > 1;
        })
    );
    tabWells.forEach(function (well, idx) {
        let wIdx = wells.indexOf(well);
        let isEven = idx % 2 === 0;
        let isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        let nameKey = (well.name || '').trim().toLowerCase();
        let isDup = dupNames.has(nameKey);
        let tabKey = dn === 'styczne' ? 'styczne' : String(dn);
        let dnKey = dn === 'styczne' ? 'styczne' : dn;
        let nameDnList = nameDnMap[nameKey] || [];
        let otherDns = nameDnList.filter(function (d) {
            return d.dn !== dnKey;
        });
        let dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        let baseBg = isEven ? '#0a0d16' : '#181c28';
        let rowDupSolid =
            {
                1000: '#162650',
                1200: '#0e2a1e',
                1500: '#2a2210',
                2000: '#241b36',
                2500: '#301818',
                styczne: '#2c1422'
            }[dupColorKey] || '#162650';
        let rowActiveDupSolid =
            {
                1000: '#1e3a6b',
                1200: '#164530',
                1500: '#3d3018',
                2000: '#352552',
                2500: '#4a2020',
                styczne: '#4a1a38'
            }[dupColorKey] || '#1e3a6b';
        let rowBg =
            isDup && isActive
                ? rowActiveDupSolid
                : isDup
                  ? rowDupSolid
                  : isActive
                    ? '#1a2645'
                    : baseBg;
        let hoverDupSolid =
            {
                1000: '#1d3460',
                1200: '#143e2e',
                1500: '#383018',
                2000: '#2e2248',
                2500: '#3e2020',
                styczne: '#3a1a2e'
            }[dupColorKey] || '#1d3460';
        let hoverActiveDupSolid =
            {
                1000: '#2a4a80',
                1200: '#1d5a3e',
                1500: '#4d3d20',
                2000: '#452e66',
                2500: '#602a2a',
                styczne: '#602848'
            }[dupColorKey] || '#2a4a80';
        let hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid
                : isDup
                  ? hoverDupSolid
                  : isActive
                    ? '#263460'
                    : '#141722';
        let przejscia = well.przejscia || [];
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
            (isDup && isActive ? rowActiveDupSolid : isDup ? hoverDupSolid : '#1a2645') +
            '" style="background:' +
            rowBg +
            ';transition:background 0.15s;" onmouseenter="this.style.background=this.getAttribute(\'data-hover-bg\')" onmouseleave="this.style.background=this.getAttribute(\'data-orig-bg\')">';
        let tdBaseStyle = _EXCEL_FONT;
        /* Checkbox */
        let cbChecked = _excelRowSelectStates[wIdx] ? ' checked' : '';
        html +=
            '<td style="' +
            tdBaseStyle +
            'background:' +
            rowBg +
            ';text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:28px;"><input type="checkbox" class="excel-row-select" data-widx="' +
            wIdx +
            '"' +
            cbChecked +
            ' tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" /></td>';
        /* AUTO/MANUAL */
        let isAuto = well.autoSelect !== false && well.configSource !== 'MANUAL';
        let autoBg = isAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
        let autoColor = isAuto ? '#c7d2fe' : '#fbbf24';
        let runDisabled = isAuto ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"';
        html +=
            '<td style="' +
            tdBaseStyle +
            'background:' +
            rowBg +
            ';text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:54px;"><button type="button" id="excel-mode-btn-' +
            wIdx +
            '" data-widx="' +
            wIdx +
            '" onclick="_excelToggleWellAutoMode(' +
            wIdx +
            ')" style="display:block;width:100%;padding:2px 0;border-radius:3px;font-size:0.55rem;cursor:pointer;background:' +
            autoBg +
            ';color:' +
            autoColor +
            ';border:1px solid ' +
            autoBg +
            ';font-weight:600;height:18px;">' +
            (isAuto ? 'AUTO' : 'MANUAL') +
            '</button><button type="button" id="excel-run-auto-' +
            wIdx +
            '" data-widx="' +
            wIdx +
            '" onclick="_excelRunAutoSelectForWell(' +
            wIdx +
            ')" ' +
            runDisabled +
            ' style="display:block;width:100%;margin-top:2px;padding:2px 0;border-radius:3px;font-size:0.65rem;cursor:' +
            (isAuto ? 'pointer' : 'not-allowed') +
            ';background:' +
            (isAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)') +
            ';color:' +
            (isAuto ? '#c7d2fe' : '#64748b') +
            ';border:1px solid ' +
            (isAuto ? '#6366f1' : 'rgba(100,116,139,0.3)') +
            ';height:18px;line-height:1;">\u25b6</button></td>';
        /* Lp */
        html +=
            '<td style="' +
            tdBaseStyle +
            'position:sticky;left:0;z-index:5;background:' +
            rowBg +
            ';text-align:center;color:#64748b;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">' +
            (idx + 1) +
            '</td>';
        /* Nazwa */
        html +=
            '<td style="' +
            tdBaseStyle +
            'position:sticky;left:32px;z-index:5;background:' +
            rowBg +
            ';border-right:1px solid rgba(255,255,255,0.08);"><input type="text" value="' +
            escapeHtml(well.name) +
            '" onchange="excelOnNameChange(' +
            wIdx +
            ',this.value)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(120) +
            'text-align:left;width:118px;" /></td>';
        /* Rz Wlazu */
        html +=
            '<td style="' +
            tdBaseStyle +
            'position:sticky;left:162px;z-index:5;background:' +
            rowBg +
            ';text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="' +
            (well.rzednaWlazu != null ? well.rzednaWlazu : '') +
            '" onchange="excelOnRzednaChange(' +
            wIdx +
            ')" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(72) +
            '" /></td>';
        /* Rz Dna */
        html +=
            '<td style="' +
            tdBaseStyle +
            'position:sticky;left:240px;z-index:5;background:' +
            rowBg +
            ';text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="' +
            (well.rzednaDna != null ? well.rzednaDna : '') +
            '" onchange="excelOnRzednaChange(' +
            wIdx +
            ')" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
            _excelCellInp(72) +
            '" /></td>';
        /* Wys auto */
        let height = _excelCalcWellHeight(well);
        html +=
            '<td style="' +
            tdBaseStyle +
            'position:sticky;left:318px;z-index:5;background:' +
            rowBg +
            ';text-align:center;color:' +
            dnColor +
            ';font-weight:600;" data-cell="height-' +
            wIdx +
            '">' +
            (height || '\u2014') +
            '</td>';
        /* Przejscia */
        for (let _i = 0; _i < maxTr; _i++) {
            let prz = przejscia[_i] || {};
            let hasExplicitRzWl = prz.rzednaWlaczenia != null && prz.rzednaWlaczenia !== '';
            let rzWlPlaceholder =
                !hasExplicitRzWl && well.rzednaDna != null
                    ? 'auto (' + well.rzednaDna.toFixed(3) + ')'
                    : '';
            let przProducts =
                typeof studnieProducts !== 'undefined' && typeof getMaxPipeDn === 'function'
                    ? studnieProducts.filter(function (p) {
                          return (
                              p.componentType === 'przejscie' &&
                              p.active !== 0 &&
                              parseInt(p.dn) <= getMaxPipeDn(well.dn)
                          );
                      })
                    : [];
            let currProduct = przProducts.find(function (p) {
                return p.id === prz.productId;
            });
            let categories = [
                ...new Set(
                    przProducts.map(function (p) {
                        return p.category;
                    })
                )
            ].sort();
            let activeCategory = currProduct ? currProduct.category : prz.tempCategory || '';
            let catOpts = [['', '&mdash;']];
            categories.forEach(function (c) {
                catOpts.push([c, c]);
            });
            let typeHtml = _excelOverlaySelectHtml(
                catOpts,
                activeCategory,
                'excelOnPrzejscieTypeChange(' + wIdx + ',' + _i + ',this.value)',
                120
            );
            let availDns = activeCategory
                ? [
                      ...przProducts.filter(function (p) {
                          return p.category === activeCategory;
                      })
                  ].sort(function (a, b) {
                      return parseFloat(a.dn) - parseFloat(b.dn);
                  })
                : [];
            let dnOpts = [['', '&mdash;']];
            availDns.forEach(function (p) {
                let dnLabel =
                    typeof p.dn === 'string' && p.dn.indexOf('/') >= 0 ? p.dn : 'DN ' + p.dn;
                dnOpts.push([p.id, dnLabel]);
            });
            let dnHtml = _excelOverlaySelectHtml(
                dnOpts,
                prz.productId,
                'excelOnPrzejscieChange(' + wIdx + ',' + _i + ",'productId',this.value)",
                110
            );
            html +=
                '<td style="' +
                tdBaseStyle +
                'text-align:right;"><input type="number" step="0.01" value="' +
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
                '<td style="' +
                tdBaseStyle +
                'text-align:center;"><input type="number" step="1" value="' +
                (prz.angle != null ? prz.angle : '') +
                '" onchange="excelOnPrzejscieChange(' +
                wIdx +
                ',' +
                _i +
                ",'angle',this.value)" +
                '" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" onblur="excelCellBlur(this)" style="' +
                _excelCellInp(50) +
                'text-align:center;" /></td>';
            html += '<td style="' + tdBaseStyle + 'text-align:left;">' + typeHtml + '</td>';
            html += '<td style="' + tdBaseStyle + 'text-align:left;">' + dnHtml + '</td>';
        }
        /* Gap */
        html +=
            '<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td>';
        /* Wlaz */
        let wlazCol = compCols.find(function (c) {
            return c.componentType === 'wlaz';
        });
        let wlazProducts = wlazCol
            ? wlazCol.products.filter(function (p) {
                  return typeof filterByWellParams !== 'function' || filterByWellParams(p, well);
              })
            : [];
        let wlazVal = _excelGetWlazFromConfig(well);
        let wlazOpts = [['', '\u2014']];
        wlazProducts.forEach(function (p) {
            let hCm = Math.round(parseInt(p.height) || 0) / 10;
            let lbl =
                hCm > 0
                    ? hCm + ' cm'
                    : p.name.length > 20
                      ? p.name.substring(0, 18) + '\u2026'
                      : p.name;
            wlazOpts.push([p.id, lbl]);
        });
        html +=
            '<td style="text-align:left;">' +
            _excelOverlaySelectHtml(
                wlazOpts,
                wlazVal,
                'excelOnWlazChange(' + wIdx + ',this.value)',
                62
            ) +
            '</td>';
        /* Komponenty */
        compCols.forEach(function (col) {
            if (col.type === 'select' || col.type === 'auto') return;
            let c = col;
            let count = _excelCountProductInConfig(
                well,
                c.componentType,
                c.height,
                c.productId,
                c.fromReduction ? c.targetDn || well.redukcjaTargetDN || 1000 : null
            );
            let pidArg = c.productId ? "'" + c.productId + "'" : 'null';
            let hArg = c.height != null ? c.height : 'null';
            let redArg = c.fromReduction ? ',' + (well.redukcjaTargetDN || 1000) : '';
            html +=
                '<td style="' +
                tdBaseStyle +
                'text-align:center;min-width:95px;"><input type="number" min="0" step="1" value="' +
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
        let dennH = _excelCalcDennicaHeight(well);
        html +=
            '<td style="' +
            tdBaseStyle +
            'text-align:center;color:#fbbf24;font-weight:600;" data-cell="denn-' +
            wIdx +
            '">' +
            (dennH || '\u2014') +
            '</td>';
        /* Uszczelki */
        let uszczCount = _excelCalcUszczelkaCount(well);
        html +=
            '<td style="' +
            tdBaseStyle +
            'text-align:center;color:#f97316;font-weight:600;" data-cell="uszcz-' +
            wIdx +
            '">' +
            uszczCount +
            '</td>';
        /* Redukcja */
        if (hasReduction) {
            let redActive = well.redukcjaDN1000;
            let redTarget = well.redukcjaTargetDN || 1000;
            let can1200 = [1500, 2000, 2500].includes(parseInt(well.dn)) || well.dn === 'styczna';
            let redOpts = [['', 'Brak']];
            if (redActive) {
                if (redTarget === 1000) redOpts.push(['1000', 'DN1000']);
                if (redTarget === 1200) redOpts.push(['1200', 'DN1200']);
            } else {
                redOpts.push(['1000', 'DN1000']);
                if (can1200) redOpts.push(['1200', 'DN1200']);
            }
            html +=
                '<td style="text-align:center;">' +
                _excelOverlaySelectHtml(
                    redOpts,
                    redActive ? String(redTarget) : '',
                    'excelOnReductionSelectChange(' + wIdx + ',this.value)',
                    105
                ) +
                '</td>';
        }
        /* Kineta */
        let kinOpts = [['', '\u2014']];
        KINETA_OPTIONS.forEach(function (ko) {
            kinOpts.push([ko[0], ko[1]]);
        });
        html +=
            '<td style="text-align:left;">' +
            _excelOverlaySelectHtml(
                kinOpts,
                well.kineta || '',
                'excelOnKinetaChange(' + wIdx + ',this.value)',
                90
            ) +
            '</td>';
        /* Psia buda */
        html +=
            '<td style="' +
            tdBaseStyle +
            'text-align:center;"><input type="checkbox"' +
            (well.psiaBuda ? ' checked' : '') +
            ' onchange="excelOnPsiaBudaChange(' +
            wIdx +
            ',this.checked)" style="accent-color:#f59e0b;cursor:pointer;transform:scale(1.3);" /></td>';
        /* Akcje */
        html +=
            '<td style="' +
            tdBaseStyle +
            'text-align:center;white-space:nowrap;"><div style="display:flex;gap:2px;justify-content:center;">';
        html +=
            '<button onclick="excelOpenWellParams(' +
            wIdx +
            ')" title="Parametry" style="background:#13151f;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;transition:all 0.1s;display:inline-flex;align-items:center;justify-content:center;" onmouseenter="this.style.background=\'rgba(129,140,248,0.1)\'" onmouseleave="this.style.background=\'#13151f\'"><i data-lucide="settings" style="width:16px;height:16px;" aria-hidden="true"></i></button>';
        html +=
            '<button onclick="excelDuplicateWell(' +
            wIdx +
            ')" title="Duplikuj" style="background:#13151f;color:#60a5fa;border:1px solid rgba(96,165,250,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;transition:all 0.1s;display:inline-flex;align-items:center;justify-content:center;" onmouseenter="this.style.background=\'rgba(96,165,250,0.1)\'" onmouseleave="this.style.background=\'#13151f\'"><i data-lucide="copy" style="width:16px;height:16px;" aria-hidden="true"></i></button>';
        html +=
            '<button onclick="excelDeleteWell(' +
            wIdx +
            ')" title="Usu\u0144" style="background:#13151f;color:#f87171;border:1px solid rgba(248,113,113,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;transition:all 0.1s;display:inline-flex;align-items:center;justify-content:center;" onmouseenter="this.style.background=\'rgba(239,68,68,0.15)\'" onmouseleave="this.style.background=\'#13151f\'"><i data-lucide="trash-2" style="width:16px;height:16px;" aria-hidden="true"></i></button>';
        html += '</div></td>';
        html += '</tr>';
    });
    /* EMPTY ROW */
    let emptyRowBg = '#0a0c10';
    html += '<tr id="excel-empty-row" style="background:' + emptyRowBg + ';">';
    let tdEmptyStyle = _EXCEL_FONT + 'color:#334155;';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'background:' +
        emptyRowBg +
        ';text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:28px;"><input type="checkbox" disabled tabindex="-1" style="cursor:default;accent-color:rgba(99,102,241,0.7);opacity:0.3;" /></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'background:' +
        emptyRowBg +
        ';text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:54px;"><button type="button" disabled style="display:block;width:100%;padding:2px 0;border-radius:3px;font-size:0.55rem;cursor:default;background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3);font-weight:600;height:18px;opacity:0.3;">\u2014</button><button type="button" disabled style="display:block;width:100%;margin-top:2px;padding:2px 0;border-radius:3px;font-size:0.65rem;cursor:default;background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3);height:18px;line-height:1;opacity:0.3;">\u25b6</button></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'position:sticky;left:0;z-index:5;background:' +
        emptyRowBg +
        ';text-align:center;color:#334155;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">\u2014</td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'position:sticky;left:32px;z-index:5;background:' +
        emptyRowBg +
        ';"><input type="text" placeholder="Wpisz nazw\u0119 i Enter aby doda\u0107" id="excel-empty-name" onkeydown="if(event.key===\'Enter\')excelCreateFromEmpty()" onblur="excelCreateFromEmpty(event)" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(125) +
        'text-align:left;color:#94a3b8;" /></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'position:sticky;left:162px;z-index:5;background:' +
        emptyRowBg +
        ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzw" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(72) +
        '" /></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'position:sticky;left:240px;z-index:5;background:' +
        emptyRowBg +
        ';text-align:right;"><input type="number" step="0.01" placeholder="\u2014" id="excel-empty-rzd" onfocus="excelCellFocus(this);_excelSelWrapFocus(this)" style="' +
        _excelCellInp(72) +
        '" /></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'position:sticky;left:318px;z-index:5;background:' +
        emptyRowBg +
        ';text-align:center;color:#1e293b;" data-cell="height-empty">\u2014</td>';
    for (let _j = 0; _j < maxTr; _j++) {
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:right;"><input type="number" step="0.01" placeholder="\u2014" disabled style="' +
            _excelCellInp(72) +
            'opacity:0.3;" /></td>';
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:center;"><input type="number" step="1" placeholder="\u2014" disabled style="' +
            _excelCellInp(50) +
            'opacity:0.3;" /></td>';
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:left;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 120, true) +
            '</td>';
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:left;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 110, true) +
            '</td>';
    }
    html +=
        '<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:left;">' +
        _excelOverlaySelectHtml([['', '\u2014']], '', null, 125, true) +
        '</td>';
    compCols.forEach(function (col) {
        if (col.type === 'select' || col.type === 'auto') return;
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:center;"><input type="number" min="0" step="1" placeholder="\u2014" disabled style="' +
            _excelCellInp(50) +
            'opacity:0.3;" /></td>';
    });
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:center;color:#1e293b;" data-cell="denn-empty">\u2014</td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:center;color:#1e293b;" data-cell="uszcz-empty">\u2014</td>';
    if (hasReduction) {
        html +=
            '<td style="' +
            tdEmptyStyle +
            'text-align:center;">' +
            _excelOverlaySelectHtml([['', '\u2014']], '', null, 105, true) +
            '</td>';
    }
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:left;">' +
        _excelOverlaySelectHtml([['', '\u2014']], '', null, 90, true) +
        '</td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:center;"><input type="checkbox" disabled style="opacity:0.3;" /></td>';
    html +=
        '<td style="' +
        tdEmptyStyle +
        'text-align:center;color:#1e293b;font-size:0.6rem;" data-cell="empty-actions"><i data-lucide="plus-circle" style="width:16px;height:16px;color:#334155;" aria-hidden="true"></i></td>';
    html += '</tr>';
    html += '</tbody>';
    return html;
}

/* ===== AUTO-ODŚWIEŻANIE KOMÓREK (height, dennica, uszczelki) ===== */
function _excelRefreshAutoCells(wIdx, row) {
    const well = wells[wIdx];
    if (!well) return;

    const dnColor = (
        DN_COLORS[well.dn === 'styczna' ? 'styczne' : String(well.dn)] || DN_COLORS['1000']
    ).border;

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
        1000: '#162650',
        1200: '#0e2a1e',
        1500: '#2a2210',
        2000: '#241b36',
        2500: '#301818',
        styczne: '#2c1422'
    };
    const rowActiveDupSolid = {
        1000: '#1e3a6b',
        1200: '#164530',
        1500: '#3d3018',
        2000: '#352552',
        2500: '#4a2020',
        styczne: '#4a1a38'
    };
    const hoverDupSolid = {
        1000: '#1d3460',
        1200: '#143e2e',
        1500: '#383018',
        2000: '#2e2248',
        2500: '#3e2020',
        styczne: '#3a1a2e'
    };
    const hoverActiveDupSolid = {
        1000: '#2a4a80',
        1200: '#1d5a3e',
        1500: '#4d3d20',
        2000: '#452e66',
        2500: '#602a2a',
        styczne: '#602848'
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
        const baseBg = isEven ? '#0a0d16' : '#181c28';

        const rowBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || '#1e3a6b'
                : isDup
                  ? rowDupSolid[dupColorKey] || '#162650'
                  : isActive
                    ? '#1a2645'
                    : baseBg;
        const hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid[dupColorKey] || '#2a4a80'
                : isDup
                  ? hoverDupSolid[dupColorKey] || '#1d3460'
                  : isActive
                    ? '#263460'
                    : '#141722';
        const activeBg =
            isDup && isActive
                ? rowActiveDupSolid[dupColorKey] || '#1e3a6b'
                : isDup
                  ? hoverDupSolid[dupColorKey] || '#1d3460'
                  : '#1a2645';

        row.setAttribute('data-base-bg', rowBg);
        row.setAttribute('data-orig-bg', rowBg);
        row.setAttribute('data-hover-bg', hoverBg);
        row.setAttribute('data-active-bg', activeBg);
        row.style.background = rowBg;
    });
}
