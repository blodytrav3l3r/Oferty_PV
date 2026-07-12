// @ts-check
/* ===== EXCEL RENDERER — Renderowanie tabeli ===== */

function _excelRenderTable(dn) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    // Zapisz aktualny fokus przed re-renderem
    let savedFocus = null;
    const activeEl = document.activeElement;
    if (activeEl && container.contains(activeEl)) {
        const tr = activeEl.closest('tr');
        if (tr) {
            const wIdx = tr.getAttribute('data-widx');
            if (wIdx !== null) {
                // Spróbuj zidentyfikować po atrybucie data-field (dla INPUT)
                const field = activeEl.getAttribute('data-field');
                // Jeśli to select wrapper (DIV), to ma data-field na wewnętrznym select lub divie?
                // Sprawdźmy po prostu indeks elementu w wierszu dla uniwersalności
                const navEls = _excelGetNavElements(tr);
                const colIdx = navEls.indexOf(activeEl);
                savedFocus = {
                    wIdx: parseInt(wIdx),
                    field: field,
                    colIdx: colIdx
                };
            }
        }
    }

    /* Wyczyść puste przejścia we wszystkich studniach */
    if (typeof wells !== 'undefined') {
        for (var _rwi = 0; _rwi < wells.length; _rwi++) {
            _excelCleanEmptyPrzejscia(wells[_rwi]);
        }
    }

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions[dn] || 1;
    var refWell = tabWells[0];
    if (!refWell && typeof _excelGetReferenceWell === 'function') {
        refWell = _excelGetReferenceWell(dn);
    }
    const compCols = _excelBuildComponentColumns(dn, refWell);
    const hasReduction = ['1200', '1500', '2000', '2500', 'styczne'].includes(dn);

    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;
    const dnBg = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).activeBg;

    let html =
        '<table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;">';

    /* THEAD — sticky, trzy wiersze */
    html += '<thead>';
    let h1 = ''; // rząd 2: skrócone etykiety
    let h2 = ''; // rząd 3: szczegóły
    let h3 = ''; // rząd 1: średnica (DN)

    const thBase =
        'padding:0.4rem 0.5rem;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;';
    const th2Base =
        'padding:0.2rem 0.5rem;font-size:0.6rem;font-weight:400;white-space:pre-wrap;word-break:break-word;max-width:100px;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#161923;';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    /* === KOLUMNA 0: Checkbox - select-all przeniesiony do H1 (gorny) === */
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);"><input type="checkbox" id="excel-select-all" data-action="toggleSelectAll" tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" /></th>`;
    /* === KOLUMNA 1: Tryb Auto/Manual - buttony w H1 (gornym), naglowek w H3 === */
    var _bulkAutoBtn = `<button type="button" id="excel-bulk-auto" data-action="_excelBulkSetMode" data-enabled="true" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#c7d2fe;padding:2px 0px;border-radius:2px;cursor:pointer;font-size:0.62rem;font-weight:600;width:46px;box-sizing:border-box;text-align:center;line-height:1.1;height:18px;">Auto</button>`;
    var _bulkManualBtn = `<button type="button" id="excel-bulk-manual" data-action="_excelBulkSetMode" data-enabled="false" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:2px 0px;border-radius:2px;cursor:pointer;font-size:0.62rem;font-weight:600;width:46px;box-sizing:border-box;text-align:center;line-height:1.1;height:18px;">Manual</button>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:54px;padding:2px;border-bottom:1px solid rgba(99,102,241,0.2);"><b style="color:#fbbf24;">A/M</b></th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:54px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:center;width:54px;border-right:1px solid rgba(255,255,255,0.06);"><div style="display:flex;flex-direction:column;gap:2px;align-items:center;">${_bulkAutoBtn}${_bulkManualBtn}</div></th>`;
    /* === KOLUMNA 2: Lp. — sticky left:0 === */
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">Lp.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:30;min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;border-right:1px solid rgba(255,255,255,0.1);">Nr Studni</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:30;min-width:130px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:30;min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:30;min-width:65px;text-align:center;">·</th>`;

    for (let i = 0; i < maxTr; i++) {
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">Rz.wlot ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">Rodzaj ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h1 += `<th style="${thBase}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">Średnica ${i}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">·</th>`;
        h3 += `<th style="${th3Base}background:#13151f;color:${dnColor};min-width:110px;text-align:left;">·</th>`;
    }

    // Przyciski +/-
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button data-action="excelRemoveTransitionColumn" title="Usuń ostatnią kolumnę przejścia" class="excel-hover-color" style="--hc:#f87171;background:#13151f;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;">−</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button data-action="excelAddTransitionColumn" title="Dodaj kolumnę przejścia" class="excel-hover-color" style="--hc:#94a3b8;background:#13151f;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;">+</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;

    // Właz
    h1 += `<th style="${thBase}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">Właz</th>`;
    h2 += `<th style="${th2Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;

    // Komponenty — trzy wiersze (rz1=DN, rz2=skrót, rz3=szczegół)
    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select') return;
        /** @type {any} */
        const c = col;
        const ct = c.componentType;
        const hc =
            ct === 'avr'
                ? '#fbbf24'
                : ct === 'krag' || ct === 'krag_ot'
                  ? '#34d399'
                  : ct === 'dennica'
                    ? '#f97316'
                    : ct === 'konus'
                      ? '#fb923c'
                      : ct === 'plyta_din' ||
                          ct === 'plyta_najazdowa' ||
                          ct === 'plyta_zamykajaca' ||
                          ct === 'pierscien_odciazajacy'
                        ? '#60a5fa'
                        : ct === 'plyta_redukcyjna'
                          ? '#f472b6'
                          : ct === 'osadnik'
                            ? '#a78bfa'
                            : ct === 'styczna'
                              ? '#f472b6'
                              : '#93c5fd';
        const colLabel = c.shortLabel || c.label;
        const colDetail = _excelWrapDetail(c.detailLabel) || '·';
        var isPerProduct = c.productId ? true : false;
        var colCodeId;
        if (isPerProduct) {
            /* Kolumna per-produkt — zawsze pokazuje swój stały kod */
            colCodeId = c.productId;
        } else {
            /* Kolumna grupowana — dynamicznie z configu zaznaczonej studni */
            var dynProdCode = null;
            if (
                typeof currentWellIndex !== 'undefined' &&
                currentWellIndex >= 0 &&
                wells[currentWellIndex]
            ) {
                dynProdCode = _excelGetWellProdCode(
                    wells[currentWellIndex],
                    ct,
                    c.height,
                    c.fromReduction
                        ? c.targetDn || wells[currentWellIndex].redukcjaTargetDN || 1000
                        : null
                );
            }
            var fallbackCode = (c.products && c.products[0] && c.products[0].id) || null;
            colCodeId = dynProdCode || fallbackCode;
        }
        const codeDisp = colCodeId || null;
        const perProdAttr = isPerProduct ? ' data-per-product="1"' : '';
        const fallbackAttr = isPerProduct
            ? ''
            : ` data-fallback="${escapeHtml((c.products && c.products[0] && c.products[0].id) || '')}"`;

        const colCode = codeDisp
            ? (function () {
                  var priceHtml = '';
                  if (isPerProduct && codeDisp) {
                      try {
                          /* Znajdź produkt w studnieProducts i pobierz cenę bez filtrowania */
                          var prod = (
                              typeof studnieProducts !== 'undefined' ? studnieProducts : []
                          ).find(function (pr) {
                              return pr.id === codeDisp;
                          });
                          if (prod && prod.price) {
                              var fmt =
                                  typeof fmtInt === 'function'
                                      ? fmtInt
                                      : function (n) {
                                            return Math.round(n || 0).toLocaleString('pl-PL');
                                        };
                              priceHtml = fmt(prod.price) + ' PLN';
                          }
                      } catch (e) {
                          console.error('priceHtml error:', e);
                      }
                  }
                  return (
                      '<br><span class="h3-prodcode" data-ct="' +
                      ct +
                      '" data-height="' +
                      (c.height != null ? c.height : '') +
                      '"' +
                      perProdAttr +
                      fallbackAttr +
                      ' data-reddn="' +
                      (c.fromReduction ? c.targetDn || '1000' : '') +
                      '" style="overflow:hidden;text-overflow:ellipsis;display:block;max-width:130px;">' +
                      escapeHtml(codeDisp) +
                      '</span><br><span class="h3-prodprice" data-ct="' +
                      ct +
                      '" data-height="' +
                      (c.height != null ? c.height : '') +
                      '"' +
                      perProdAttr +
                      ' style="display:block;">' +
                      priceHtml +
                      '</span>'
                  );
              })()
            : '';
        const h3Pad = colCodeId ? '0.25rem 0.5rem 0.2rem' : '0.15rem 0.5rem';
        /* Dla kolumn redukcji pokaż target DN zamiast głównego DN zakładki */
        const colDnLabel = c.fromReduction
            ? 'DN' +
              (c.targetDn ||
                  (wells[currentWellIndex] && wells[currentWellIndex].redukcjaTargetDN) ||
                  1000)
            : dnTh3(ct);
        h1 += `<th style="${thBase}background:#13151f;color:${hc};min-width:95px;text-align:center;">${colLabel}</th>`;
        h2 += `<th style="${th2Base}background:#13151f;color:${hc};min-width:95px;text-align:center;">${colDetail}</th>`;
        h3 += `<th style="padding:${h3Pad};font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#13151f;color:${hc};min-width:95px;text-align:center;">${colDnLabel}${colCode}</th>`;
    });

    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">H denn</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:60px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">Uszcz</th>`;
    h2 += `<th style="${th2Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#1a170f;color:#fbbf24;min-width:50px;text-align:center;">·</th>`;

    if (hasReduction) {
        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        h1 += `<th style="${thBase}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">Redukcja</th>`;
        h2 += `<th style="${th2Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
        h3 += `<th style="${th3Base}background:#1a1215;color:#fca5a5;min-width:110px;text-align:center;">·</th>`;
    }

    h1 += `<th style="${thBase}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">Kineta</th>`;
    h2 += `<th style="${th2Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#150f1a;color:#c4b5fd;min-width:95px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">P.Buda</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:55px;text-align:center;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">Akcje</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;min-width:90px;text-align:center;">·</th>`;

    html += `<tr style="position:sticky;top:0;z-index:20;background:#161923;">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:20;background:#161923;">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:20;background:#161923;">${h2}</tr>`;
    html += '</thead><tbody>';

    /* Wykryj duplikaty nazw — we wszystkich średnicach */
    const nameCounts = {};
    const nameDnMap = {}; // nazwa -> [{dn, label}]
    wells.forEach((w) => {
        const n = (w.name || '').trim().toLowerCase();
        if (n) {
            nameCounts[n] = (nameCounts[n] || 0) + 1;
            const dnKey = w.dn === 'styczna' ? 'styczne' : String(w.dn);
            if (!nameDnMap[n]) nameDnMap[n] = [];
            const dnC = DN_COLORS[dnKey] || DN_COLORS['1000'];
            const dnLabel = dnKey === 'styczne' ? 'Styczne' : 'DN' + dnKey;
            if (!nameDnMap[n].find((x) => x.dn === dnKey)) {
                nameDnMap[n].push({ dn: dnKey, label: dnLabel, color: dnC.border });
            }
        }
    });
    const dupNames = new Set(Object.keys(nameCounts).filter((n) => nameCounts[n] > 1));

    tabWells.forEach((well, idx) => {
        const wIdx = wells.indexOf(well);
        const isEven = idx % 2 === 0;
        const isActive = typeof currentWellIndex !== 'undefined' && wIdx === currentWellIndex;
        const nameKey = (well.name || '').trim().toLowerCase();
        const isDup = dupNames.has(nameKey);
        const tabKey = dn === 'styczne' ? 'styczne' : String(dn);
        const dnKey = dn === 'styczne' ? 'styczne' : dn;
        // Wykryj duplikaty między-średnicowe — pokaż kolor innej zakładki
        const nameDnList = nameDnMap[nameKey] || [];
        const otherDns = nameDnList.filter((d) => d.dn !== dnKey);
        const dupColorKey = isDup && otherDns.length > 0 ? otherDns[0].dn : dnKey;
        const baseBg = isEven ? '#0a0d16' : '#181c28';

        // Solidne kolory wierszy — wszystkie nieprzezroczyste
        const rowDupSolid =
            {
                1000: '#162650',
                1200: '#0e2a1e',
                1500: '#2a2210',
                2000: '#241b36',
                2500: '#301818',
                styczne: '#2c1422'
            }[dupColorKey] || '#162650';
        const rowActiveDupSolid =
            {
                1000: '#1e3a6b',
                1200: '#164530',
                1500: '#3d3018',
                2000: '#352552',
                2500: '#4a2020',
                styczne: '#4a1a38'
            }[dupColorKey] || '#1e3a6b';
        const rowBg =
            isDup && isActive
                ? rowActiveDupSolid
                : isDup
                  ? rowDupSolid
                  : isActive
                    ? '#1a2645'
                    : baseBg;

        // Solidne hover kolory
        const hoverDupSolid =
            {
                1000: '#1d3460',
                1200: '#143e2e',
                1500: '#383018',
                2000: '#2e2248',
                2500: '#3e2020',
                styczne: '#3a1a2e'
            }[dupColorKey] || '#1d3460';
        const hoverActiveDupSolid =
            {
                1000: '#2a4a80',
                1200: '#1d5a3e',
                1500: '#4d3d20',
                2000: '#452e66',
                2500: '#602a2a',
                styczne: '#602848'
            }[dupColorKey] || '#2a4a80';
        const hoverBg =
            isDup && isActive
                ? hoverActiveDupSolid
                : isDup
                  ? hoverDupSolid
                  : isActive
                    ? '#263460'
                    : '#141722';
        const przejscia = well.przejscia || [];

        html += `<tr data-widx="${wIdx}" data-base-bg="${rowBg}" data-orig-bg="${rowBg}" data-hover-bg="${hoverBg}" data-active-bg="${isDup && isActive ? rowActiveDupSolid : isDup ? hoverDupSolid : '#1a2645'}" class="excel-hover-row" style="--hr:${hoverBg};background:${rowBg};">`;

        const tdBase = `${_EXCEL_FONT}`;

        /* Checkbox column - NIE sticky, normalnie w flow */
        const cbChecked = _excelRowSelectStates[wIdx] ? ' checked' : '';
        const isAuto = well.autoSelect !== false && well.configSource !== 'MANUAL';
        const autoBg = isAuto ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.25)';
        const autoColor = isAuto ? '#c7d2fe' : '#fbbf24';
        html += `<td style="${tdBase}background:${rowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:28px;">
            <input type="checkbox" class="excel-row-select" data-widx="${wIdx}"${cbChecked} tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" />
        </td>`;
        /* AUTO/MAN mode badge + Run-Auto buttons - NIE sticky */
        const modeTitle = isAuto
            ? 'Auto (klik = przełącz na Manual)'
            : 'Manual (klik = przełącz na Auto)';
        const runDisabled = isAuto ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"';
        html += `<td style="${tdBase}background:${rowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:54px;">
            <button type="button" id="excel-mode-btn-${wIdx}" data-widx="${wIdx}" data-action="_excelToggleWellAutoMode" data-w-idx="${wIdx}" title="${modeTitle}" style="display:block;width:100%;padding:2px 0;border-radius:3px;font-size:0.55rem;cursor:pointer;background:${autoBg};color:${autoColor};border:1px solid ${autoBg};font-weight:600;height:18px;">${isAuto ? 'AUTO' : 'MANUAL'}</button>
            <button type="button" id="excel-run-auto-${wIdx}" data-widx="${wIdx}" data-action="_excelRunAutoSelectForWell" data-w-idx="${wIdx}" title="${isAuto ? 'Uruchom auto-dobór elementów dla tej studni' : 'Przełącz na Auto aby uruchomić'}" ${runDisabled} style="display:block;width:100%;margin-top:2px;padding:2px 0;border-radius:3px;font-size:0.65rem;cursor:${isAuto ? 'pointer' : 'not-allowed'};background:${isAuto ? 'rgba(99,102,241,0.35)' : 'rgba(100,116,139,0.15)'};color:${isAuto ? '#c7d2fe' : '#64748b'};border:1px solid ${isAuto ? '#6366f1' : 'rgba(100,116,139,0.3)'};height:18px;line-height:1;">\u25b6</button>
        </td>`;

        /* Lp. */
        html += `<td style="${tdBase}position:sticky;left:0;z-index:5;background:${rowBg};text-align:center;color:#64748b;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">${idx + 1}</td>`;

        /* Nr. Studni — edytowalny input + badge duplikatu, sticky */
        html += `<td style="${tdBase}position:sticky;left:32px;z-index:5;background:${rowBg};border-right:1px solid rgba(255,255,255,0.08);"><input type="text" value="${escapeHtml(well.name)}" data-action="excelOnNameChange" data-w-idx="${wIdx}" style="${_excelCellInp(120)}text-align:left;width:118px;" /></td>`;

        /* Rz. Włazu */
        html += `<td style="${tdBase}position:sticky;left:162px;z-index:5;background:${rowBg};text-align:right;"><input type="number" step="0.01" data-field="rzednaWlazu" value="${well.rzednaWlazu != null ? well.rzednaWlazu : ''}" data-action="excelOnRzednaChange" data-w-idx="${wIdx}" style="${_excelCellInp(72)}" /></td>`;

        /* Rz. Dna */
        html += `<td style="${tdBase}position:sticky;left:240px;z-index:5;background:${rowBg};text-align:right;"><input type="number" step="0.01" data-field="rzednaDna" value="${well.rzednaDna != null ? well.rzednaDna : ''}" data-action="excelOnRzednaChange" data-w-idx="${wIdx}" style="${_excelCellInp(72)}" /></td>`;

        /* Wys. — auto */
        const height = _excelCalcWellHeight(well);
        html += `<td style="${tdBase}position:sticky;left:318px;z-index:5;background:${rowBg};text-align:center;color:${dnColor};font-weight:600;" data-cell="height-${wIdx}">${height || '\u2014'}</td>`;

        /* Przejścia */
        for (let i = 0; i < maxTr; i++) {
            const prz = przejscia[i] || {};
            const hasExplicitRzWl = prz.rzednaWlaczenia != null && prz.rzednaWlaczenia !== '';
            const rzWlPlaceholder =
                !hasExplicitRzWl && well.rzednaDna != null
                    ? 'auto (' + well.rzednaDna.toFixed(3) + ')'
                    : '';
            const przProducts =
                typeof studnieProducts !== 'undefined' && typeof getMaxPipeDn === 'function'
                    ? studnieProducts.filter(
                          (p) =>
                              p.componentType === 'przejscie' &&
                              p.active !== 0 &&
                              parseInt(p.dn) <= getMaxPipeDn(well.dn)
                      )
                    : [];

            // Znajdź obecny produkt
            const currProduct = przProducts.find((p) => p.id === prz.productId);
            // Wybierz unikalne kategorie (Rodzaje) dla tej studni
            const categories = [...new Set(przProducts.map((p) => p.category))].sort();

            // Określ aktywny rodzaj
            const activeCategory = currProduct ? currProduct.category : prz.tempCategory || '';

            var catOpts2 = [['', '&mdash;']];
            categories.forEach(function (c) {
                catOpts2.push([c, c]);
            });
            var typeHtml = _excelOverlaySelectHtml(
                catOpts2,
                activeCategory,
                { a: 'excelOnPrzejscieTypeChange', p: { wIdx: wIdx, przIdx: i } },
                120
            );

            // Wybierz średnice dostępne tylko dla wybranego rodzaju
            const availDns = activeCategory
                ? [...przProducts.filter((p) => p.category === activeCategory)].sort(
                      (a, b) => parseFloat(a.dn) - parseFloat(b.dn)
                  )
                : [];

            var dnOpts2 = [['', '&mdash;']];
            availDns.forEach(function (p) {
                var dnLabel2 =
                    typeof p.dn === 'string' && p.dn.indexOf('/') >= 0 ? p.dn : 'DN ' + p.dn;
                dnOpts2.push([p.id, dnLabel2]);
            });
            var dnHtml = _excelOverlaySelectHtml(
                dnOpts2,
                prz.productId,
                { a: 'excelOnPrzejscieChange', p: { wIdx: wIdx, przIdx: i, field: 'productId' } },
                110
            );

            html += `<td style="${tdBase}text-align:right;"><input type="number" step="0.01" value="${hasExplicitRzWl ? prz.rzednaWlaczenia : ''}" placeholder="${rzWlPlaceholder}" data-action="excelOnPrzejscieChange" data-w-idx="${wIdx}" data-prz-idx="${i}" data-field="rzednaWlaczenia" style="${_excelCellInp(72)}" /></td>`;
            html += `<td style="${tdBase}text-align:center;"><input type="number" step="1" value="${prz.angle != null ? prz.angle : ''}" data-action="excelOnPrzejscieChange" data-w-idx="${wIdx}" data-prz-idx="${i}" data-field="angle" style="${_excelCellInp(50)}text-align:center;" /></td>`;
            html += `<td style="${tdBase}text-align:left;">${typeHtml}</td>`;
            html += `<td style="${tdBase}text-align:left;">${dnHtml}</td>`;
        }

        html += `<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;text-align:center;color:#1e293b;background:#0c0e14;"></td>`;
        /* Właz — użyj produktów z definicji kolumny (spójne z nagłówkiem) */
        const wlazCol = compCols.find((c) => c.componentType === 'wlaz');
        const wlazProducts = wlazCol
            ? wlazCol.products.filter(
                  (p) => typeof filterByWellParams !== 'function' || filterByWellParams(p, well)
              )
            : [];
        const wlazVal = _excelGetWlazFromConfig(well);
        var wlazOpts2 = [['', '—']];
        wlazProducts.forEach(function (p) {
            var hCm2 = Math.round(parseInt(p.height) || 0) / 10;
            var lbl2 =
                hCm2 > 0
                    ? hCm2 + ' cm'
                    : p.name.length > 20
                      ? p.name.substring(0, 18) + '…'
                      : p.name;
            wlazOpts2.push([p.id, lbl2]);
        });
        html +=
            '<td style="text-align:left;">' +
            _excelOverlaySelectHtml(
                wlazOpts2,
                wlazVal,
                { a: 'excelOnWlazChange', p: { wIdx: wIdx } },
                62
            ) +
            '</td>';

        /* Komponenty — ilości z kodem produktu */
        compCols.forEach((col) => {
            if (col.type === 'select' || col.type === 'auto') return;
            const c = /** @type {any} */ (col);
            const count = _excelCountProductInConfig(
                well,
                c.componentType,
                c.height,
                c.productId,
                c.fromReduction ? c.targetDn || well.redukcjaTargetDN || 1000 : null
            );
            const pidArg = c.productId ? `'${c.productId}'` : 'null';
            const hArg = c.height != null ? c.height : 'null';
            var disabledAttr = '';
            html +=
                `<td style="${tdBase}text-align:center;min-width:95px;">` +
                `<input type="number" min="0" step="1" value="${count || ''}"${disabledAttr} data-action="excelOnCompChange" data-w-idx="${wIdx}" data-comp-type="${c.componentType}" data-h-arg="${hArg}" data-pid-arg="${c.productId || ''}" data-red-dn="${c.fromReduction ? well.redukcjaTargetDN || 1000 : ''}" style="${_excelCellInp(50)}text-align:center;width:52px;" />` +
                `</td>`;
        });

        /* H dennica — auto */
        const dennH = _excelCalcDennicaHeight(well);
        html += `<td style="${tdBase}text-align:center;color:#fbbf24;font-weight:600;" data-cell="denn-${wIdx}">${dennH || '—'}</td>`;

        /* Uszczelki — auto (z compCols) */
        const uszczCount = _excelCalcUszczelkaCount(well);
        html += `<td style="${tdBase}text-align:center;color:#f97316;font-weight:600;" data-cell="uszcz-${wIdx}">${uszczCount}</td>`;

        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        if (hasReduction) {
            var redActive = well.redukcjaDN1000;
            var redTarget = well.redukcjaTargetDN || 1000;
            /* DN1200 dostępne tylko dla DN>=1500 lub stycznych */
            var can1200 = [1500, 2000, 2500].includes(parseInt(well.dn)) || well.dn === 'styczna';
            var redOpts = '<option value="">Brak</option>';
            redOpts +=
                '<option value="1000"' +
                (redActive && redTarget === 1000 ? ' selected' : '') +
                '>DN1000</option>';
            if (can1200) {
                redOpts +=
                    '<option value="1200"' +
                    (redActive && redTarget === 1200 ? ' selected' : '') +
                    '>DN1200</option>';
            }
            var redOpts2 = [['', 'Brak']];
            if (redActive) {
                if (redTarget === 1000) redOpts2.push(['1000', 'DN1000']);
                if (redTarget === 1200) redOpts2.push(['1200', 'DN1200']);
            } else {
                redOpts2.push(['1000', 'DN1000']);
                if (can1200) redOpts2.push(['1200', 'DN1200']);
            }
            html +=
                '<td style="text-align:center;">' +
                _excelOverlaySelectHtml(
                    redOpts2,
                    redActive ? String(redTarget) : '',
                    { a: 'excelOnReductionSelectChange', p: { wIdx: wIdx } },
                    105
                ) +
                '</td>';
        }

        /* Kineta */
        var kinOpts2 = [['', '—']];
        KINETA_OPTIONS.forEach(function (ko) {
            kinOpts2.push([ko[0], ko[1]]);
        });
        html +=
            '<td style="text-align:left;">' +
            _excelOverlaySelectHtml(
                kinOpts2,
                well.kineta || '',
                { a: 'excelOnKinetaChange', p: { wIdx: wIdx } },
                90
            ) +
            '</td>';

        /* Psia buda */
        html += `<td style="${tdBase}text-align:center;"><input type="checkbox"${well.psiaBuda ? ' checked' : ''} data-action="excelOnPsiaBudaChange" data-w-idx="${wIdx}" style="accent-color:#f59e0b;cursor:pointer;transform:scale(1.3);" /></td>`;

        /* Akcje: Param, Duplikuj, Usuń */
        html += `<td style="${tdBase}text-align:center;white-space:nowrap;">`;
        html += '<div style="display:flex;gap:2px;justify-content:center;">';
        html += `<button data-action="excelOpenWellParams" data-w-idx="${wIdx}" title="Parametry" class="excel-hover-btn" style="--hb:rgba(129,140,248,0.1);background:#13151f;color:#818cf8;border:1px solid rgba(129,140,248,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;"><i data-lucide="settings" style="width:16px;height:16px;" aria-hidden="true"></i></button>`;
        html += `<button data-action="excelDuplicateWell" data-w-idx="${wIdx}" title="Duplikuj" class="excel-hover-btn" style="--hb:rgba(96,165,250,0.1);background:#13151f;color:#60a5fa;border:1px solid rgba(96,165,250,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;"><i data-lucide="copy" style="width:16px;height:16px;" aria-hidden="true"></i></button>`;
        html += `<button data-action="excelDeleteWell" data-w-idx="${wIdx}" title="Usuń" class="excel-hover-btn" style="--hb:rgba(239,68,68,0.15);background:#13151f;color:#f87171;border:1px solid rgba(248,113,113,0.2);padding:0.25rem 0.45rem;border-radius:2px;font-size:0.65rem;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;"><i data-lucide="trash-2" style="width:16px;height:16px;" aria-hidden="true"></i></button>`;
        html += '</div></td>';

        html += '</tr>';
    });

    /* ===== EMPTY ROW — wiersz na nową studnię ===== */
    const emptyRowBg = '#0a0c10';
    html += `<tr id="excel-empty-row" style="background:${emptyRowBg};">`;

    const tdBase = `${_EXCEL_FONT}`;
    const tdEmpty = `${tdBase}color:#334155;`;

    /* Checkbox — disabled dla pustego wiersza */
    html += `<td style="${tdEmpty}background:${emptyRowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:28px;">
        <input type="checkbox" disabled tabindex="-1" style="cursor:default;accent-color:rgba(99,102,241,0.7);opacity:0.3;" />
    </td>`;
    /* A/M — disabled dla pustego wiersza */
    html += `<td style="${tdEmpty}background:${emptyRowBg};text-align:center;padding:2px;border-right:1px solid rgba(255,255,255,0.06);width:54px;">
        <button type="button" disabled style="display:block;width:100%;padding:2px 0;border-radius:3px;font-size:0.55rem;cursor:default;background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3);font-weight:600;height:18px;opacity:0.3;">\u2014</button>
        <button type="button" disabled style="display:block;width:100%;margin-top:2px;padding:2px 0;border-radius:3px;font-size:0.65rem;cursor:default;background:rgba(100,116,139,0.15);color:#64748b;border:1px solid rgba(100,116,139,0.3);height:18px;line-height:1;opacity:0.3;">\u25b6</button>
    </td>`;

    /* Lp. */
    html += `<td style="${tdEmpty}position:sticky;left:0;z-index:5;background:${emptyRowBg};text-align:center;color:#334155;font-size:0.65rem;border-right:1px solid rgba(255,255,255,0.08);min-width:32px;">—</td>`;

    /* Nazwa — sticky left */
    html += `<td style="${tdEmpty}position:sticky;left:32px;z-index:5;background:${emptyRowBg};"><input type="text" placeholder="Wpisz nazwę i Enter aby dodać" id="excel-empty-name" style="${_excelCellInp(125)}text-align:left;color:#94a3b8;" /></td>`;

    /* Rz. Włazu */
    html += `<td style="${tdEmpty}position:sticky;left:162px;z-index:5;background:${emptyRowBg};text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzw" style="${_excelCellInp(72)}" /></td>`;

    /* Rz. Dna */
    html += `<td style="${tdEmpty}position:sticky;left:240px;z-index:5;background:${emptyRowBg};text-align:right;"><input type="number" step="0.01" placeholder="—" id="excel-empty-rzd" style="${_excelCellInp(72)}" /></td>`;

    /* Wys. — placeholder */
    html += `<td style="${tdEmpty}position:sticky;left:318px;z-index:5;background:${emptyRowBg};text-align:center;color:#1e293b;" data-cell="height-empty">—</td>`;

    /* Przejścia — puste */
    for (let i = 0; i < maxTr; i++) {
        html += `<td style="${tdEmpty}text-align:right;"><input type="number" step="0.01" placeholder="—" disabled style="${_excelCellInp(72)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
        html += `<td style="${tdEmpty}text-align:left;">${_excelOverlaySelectHtml([['', '—']], '', null, 120, true)}</td>`;
        html += `<td style="${tdEmpty}text-align:left;">${_excelOverlaySelectHtml([['', '—']], '', null, 110, true)}</td>`;
    }

    html += `<td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td><td style="padding:0.3rem 0;font-size:0.67rem;font-family:Consolas,Menlo,monospace;color:#334155;background:#0a0c10;"></td>`;
    /* Właz */
    html += `<td style="${tdEmpty}text-align:left;">${_excelOverlaySelectHtml([['', '—']], '', null, 125, true)}</td>`;

    /* Komponenty */
    compCols.forEach((col) => {
        if (col.type === 'select' || col.type === 'auto') return;
        html += `<td style="${tdEmpty}text-align:center;"><input type="number" min="0" step="1" placeholder="—" disabled style="${_excelCellInp(50)}opacity:0.3;" /></td>`;
    });

    /* Auto-kolumny — placeholder */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="denn-empty">—</td>`;
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;" data-cell="uszcz-empty">—</td>`;

    /* Redukcja — pusty wiersz, disabled select */
    if (hasReduction) {
        html += `<td style="${tdEmpty}text-align:center;">${_excelOverlaySelectHtml([['', '—']], '', null, 105, true)}</td>`;
    }

    /* Kineta */
    html += `<td style="${tdEmpty}text-align:left;">${_excelOverlaySelectHtml([['', '—']], '', null, 90, true)}</td>`;

    /* P.Buda */
    html += `<td style="${tdEmpty}text-align:center;"><input type="checkbox" disabled style="opacity:0.3;" /></td>`;

    /* Akcje */
    html += `<td style="${tdEmpty}text-align:center;color:#1e293b;font-size:0.6rem;" data-cell="empty-actions"><i data-lucide="plus-circle" style="width:16px;height:16px;color:#334155;" aria-hidden="true"></i></td>`;

    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
    /* Zastosuj zapisane szerokości kolumn */
    if (_excelColWidths) {
        var tbl = container.querySelector('table');
        if (tbl) {
            Object.keys(_excelColWidths).forEach(function (key) {
                var d = key.split('-', 1)[0];
                if (d === dn) {
                    var ci = parseInt(key.split('-')[1]);
                    var th = tbl.querySelectorAll('thead tr:first-child th')[ci];
                    if (th) {
                        th.style.minWidth = _excelColWidths[key] + 'px';
                        th.style.width = _excelColWidths[key] + 'px';
                    }
                }
            });
        }
    }
    _excelInitColumnResize();
    _excelInitColumnSelect();
    _excelUpdateHeaderProdCodes();
    _excelApplyStickyColumns();
    /* Odśwież ikony Lucide w kontenerze (nie skanuj całego dokumentu) */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons({ root: container });
        } catch (e) {}
    }

    // Przywróć fokus po re-renderze
    if (savedFocus) {
        const targetRow = container.querySelector(`tr[data-widx="${savedFocus.wIdx}"]`);
        if (targetRow) {
            const navEls = _excelGetNavElements(targetRow);
            const restoreEl = navEls[savedFocus.colIdx];
            if (restoreEl && !restoreEl.disabled) {
                /* Ustaw currentWellIndex ZANIM focus, by excelCellFocus nie
                   wywolal excelSelectRow (focus triggeruje onfocus -> excelCellFocus) */
                if (typeof savedFocus.wIdx !== 'undefined' && !isNaN(savedFocus.wIdx)) {
                    currentWellIndex = savedFocus.wIdx;
                }
                restoreEl.focus();
                // Jeśli to input, zaznacz zawartość
                if (restoreEl.tagName === 'INPUT' && restoreEl.select) {
                    restoreEl.select();
                }
            }
        }
    }
    /* Ponownie zastosuj filtr wyszukiwarki po re-renderze */
    var searchInput = document.getElementById('excel-search-input');
    if (searchInput && searchInput.value) excelFilterWells(searchInput.value);
}
