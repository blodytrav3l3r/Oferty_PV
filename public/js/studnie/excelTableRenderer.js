// @ts-check
/* ===== EXCEL TABLE RENDERER — Renderowanie tabeli konfiguracyjnej (Excel-style) ===== */

/* ===== TABLE RENDER (Excel-style) ===== */
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

    // ponytail: nie czyść przejść w renderze — kasowało placeholdery po "+" i psuło minus (pop na wypełnionym)
    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions[dn] || 1;
    let refWell = tabWells[0];
    if (!refWell && typeof _excelGetReferenceWell === 'function') {
        refWell = _excelGetReferenceWell(dn);
    }
    const compCols = _excelGetVisibleComponentColumns(dn, refWell);
    const hasReduction = ['1200', '1500', '2000', '2500', 'styczne'].includes(dn);

    const dnColor = (DN_COLORS[dn === 'styczne' ? 'styczne' : dn] || DN_COLORS['1000']).border;

    let html =
        '<table style="width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;">';

    /* THEAD — sticky, trzy wiersze */
    html += '<thead>';
    let h1 = ''; // rząd 2: skrócone etykiety
    let h2 = ''; // rząd 3: szczegóły
    let h3 = ''; // rząd 1: średnica (DN)

    const thBase =
        'padding:0.4rem 0.5rem;font-size: var(--fs-xs);font-weight: var(--fw-semibold);text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;';
    const th2Base =
        'padding:0.2rem 0.5rem;font-size: var(--fs-2xs);font-weight: var(--fw-normal);white-space:pre-wrap;word-break:break-word;max-width:100px;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size: var(--fs-3xs);font-weight: var(--fw-medium);color:var(--slate-500);text-align:center;white-space:nowrap;background:var(--slate-950);';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    /* === KOLUMNA 0: Checkbox - select-all przeniesiony do H1 (gorny) === */
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);text-align:center;width:28px;border-right:1px solid rgba(var(--white-rgb), 0.05);">.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);text-align:center;width:28px;border-right:1px solid rgba(var(--white-rgb), 0.05);">.</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);text-align:center;width:28px;border-right:1px solid rgba(var(--white-rgb), 0.05);"><input type="checkbox" id="excel-select-all" onchange="_excelToggleSelectAll(this.checked)" tabindex="-1" class="cursor-accent-check" /></th>`;
    /* === KOLUMNA 1: Tryb Auto/Manual - buttony w H1 (gornym), naglowek w H3 === */
    const _bulkAutoBtn = `<button type="button" id="excel-bulk-auto" class="excel-bulk-btn excel-bulk-btn--auto" onclick="_excelBulkSetMode(true)" title="Ustaw wszystkie widoczne studnie na AUTO">Auto</button>`;
    const _bulkManualBtn = `<button type="button" id="excel-bulk-manual" class="excel-bulk-btn excel-bulk-btn--manual" onclick="_excelBulkSetMode(false)" title="Ustaw wszystkie widoczne studnie na MANUAL">Manual</button>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);text-align:center;width:70px;padding:2px;border-bottom:1px solid rgba(var(--accent-rgb), 0.2);"><b style="color:var(--warn-hover);">A/M</b></th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);text-align:center;width:70px;border-right:1px solid rgba(var(--white-rgb), 0.05);">.</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);text-align:center;width:70px;border-right:1px solid rgba(var(--white-rgb), 0.05);"><div style="display:flex;flex-direction:column;gap:2px;align-items:center;">${_bulkAutoBtn}${_bulkManualBtn}</div></th>`;
    /* === KOLUMNA 2: Lp. — sticky left:0 === */
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(var(--white-rgb), 0.1);">Lp.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(var(--white-rgb), 0.1);">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(var(--white-rgb), 0.1);">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;border-right:1px solid rgba(var(--white-rgb), 0.1);">Nr Studni</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">·</th>`;

    for (let i = 0; i < maxTr; i++) {
        h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:${dnColor};min-width:78px;text-align:right;">Rz.wlot ${i}</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:${dnColor};min-width:125px;text-align:left;">Rodzaj ${i}</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:${dnColor};min-width:110px;text-align:left;">Średnica ${i}</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:${dnColor};min-width:110px;text-align:left;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:${dnColor};min-width:110px;text-align:left;">·</th>`;
    }

    // Przyciski +/-
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;"><button type="button" onclick="excelRemoveTransitionColumn()" class="excel-icon-btn is-danger excel-col-toggle" title="Usuń ostatnią kolumnę przejścia" aria-label="Usuń ostatnią kolumnę przejścia"><i data-lucide="minus" class="icon-sm" aria-hidden="true"></i></button></th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;"><button type="button" onclick="excelAddTransitionColumn()" class="excel-icon-btn excel-col-toggle is-plus" title="Dodaj kolumnę przejścia" aria-label="Dodaj kolumnę przejścia"><i data-lucide="plus" class="icon-sm" aria-hidden="true"></i></button></th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-500);min-width:24px;text-align:center;padding:0;">·</th>`;

    // Właz
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--success-hover);min-width:65px;text-align:left;">Właz</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--success-hover);min-width:65px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--success-hover);min-width:65px;text-align:left;">·</th>`;

    // Komponenty — trzy wiersze (rz1=DN, rz2=skrót, rz3=szczegół)
    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select') return;
        /** @type {any} */
        const c = col;
        const ct = c.componentType;
        const hc =
            ct === 'avr'
                ? 'var(--warn-hover)'
                : ct === 'krag' || ct === 'krag_ot'
                  ? 'var(--success-hover)'
                  : ct === 'dennica'
                    ? 'var(--warn)'
                    : ct === 'konus'
                      ? 'var(--warn-hover)'
                      : ct === 'plyta_din' ||
                          ct === 'plyta_najazdowa' ||
                          ct === 'plyta_zamykajaca' ||
                          ct === 'pierscien_odciazajacy'
                        ? 'var(--blue-hover)'
                        : ct === 'plyta_redukcyjna'
                          ? 'var(--pink-hover)'
                          : ct === 'osadnik'
                            ? 'var(--accent2-hover)'
                            : ct === 'styczna'
                              ? 'var(--pink-hover)'
                              : 'var(--blue-hover)';
        const colLabel = escapeHtml(c.shortLabel || c.label);
        /* escape przed wrapem — _excelWrapDetail dodaje <br>, które nie może być ucieczone */
        const colDetail = _excelWrapDetail(escapeHtml(c.detailLabel)) || '·';
        const isPerProduct = c.productId ? true : false;
        let colCodeId;
        if (isPerProduct) {
            /* Kolumna per-produkt — zawsze pokazuje swój stały kod */
            colCodeId = c.productId;
        } else {
            /* Kolumna grupowana — dynamicznie z configu zaznaczonej studni.
               currentWellIndex tylko gdy studnia z aktywnej zakładki (dn). */
            let dynProdCode = null;
            if (
                typeof currentWellIndex !== 'undefined' &&
                currentWellIndex >= 0 &&
                wells[currentWellIndex] &&
                _excelWellMatchesTab(wells[currentWellIndex], dn)
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
            const fallbackCode = (c.products && c.products[0] && c.products[0].id) || null;
            colCodeId = dynProdCode || fallbackCode;
        }
        const codeDisp = colCodeId || null;
        const perProdAttr = isPerProduct ? ' data-per-product="1"' : '';
        const fallbackAttr = isPerProduct
            ? ''
            : ` data-fallback="${escapeHtml((c.products && c.products[0] && c.products[0].id) || '')}"`;

        const colCode = codeDisp
            ? (function () {
                  let priceHtml = '';
                  if (isPerProduct && codeDisp) {
                      try {
                          /* Znajdź produkt w studnieProducts i pobierz cenę bez filtrowania */
                          const prod = (
                              typeof studnieProducts !== 'undefined' ? studnieProducts : []
                          ).find(function (pr) {
                              return pr.id === codeDisp;
                          });
                          if (prod && prod.price) {
                              const fmt =
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
                      '</span><br><span class="h3-prodprice d-block" data-ct="' +
                      ct +
                      '" data-height="' +
                      (c.height != null ? c.height : '') +
                      '"' +
                      perProdAttr +
                      ' >' +
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
        h1 += `<th scope="col" data-col-id="${escapeHtml(c.id)}" style="${thBase}background:var(--slate-950);color:${hc};min-width:95px;text-align:center;">${colLabel}</th>`;
        h2 += `<th scope="col" data-col-id="${escapeHtml(c.id)}" style="${th2Base}background:var(--slate-950);color:${hc};min-width:95px;text-align:center;">${colDetail}</th>`;
        h3 += `<th scope="col" data-col-id="${escapeHtml(c.id)}" style="padding:${h3Pad};font-size: var(--fs-3xs);font-weight: var(--fw-medium);color:var(--slate-500);text-align:center;white-space:nowrap;background:var(--slate-950);color:${hc};min-width:95px;text-align:center;">${colDnLabel}${colCode}</th>`;
    });

    h1 += `<th scope="col" style="${thBase}background:var(--bg-primary);color:var(--warn-hover);min-width:60px;text-align:center;">H denn</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--bg-primary);color:var(--warn-hover);min-width:60px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--bg-primary);color:var(--warn-hover);min-width:60px;text-align:center;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--bg-primary);color:var(--warn-hover);min-width:50px;text-align:center;">Uszcz</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--bg-primary);color:var(--warn-hover);min-width:50px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--bg-primary);color:var(--warn-hover);min-width:50px;text-align:center;">·</th>`;

    if (hasReduction) {
        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--danger-hover);min-width:110px;text-align:center;">Redukcja</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--danger-hover);min-width:110px;text-align:center;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--danger-hover);min-width:110px;text-align:center;">·</th>`;
    }

    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--accent2-hover);min-width:95px;text-align:left;">Kineta</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--accent2-hover);min-width:95px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--accent2-hover);min-width:95px;text-align:left;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);min-width:55px;text-align:center;">P.Buda</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);min-width:55px;text-align:center;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);min-width:55px;text-align:center;">·</th>`;
    h1 += `<th scope="col" style="${thBase}background:var(--slate-950);color:var(--slate-400);min-width:120px;text-align:center;">Akcje</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--slate-950);color:var(--slate-400);min-width:120px;text-align:center;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--slate-950);color:var(--slate-400);min-width:120px;text-align:center;">·</th>`;

    html += `<tr style="position:sticky;top:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--slate-950);">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--slate-950);">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--slate-950);">${h2}</tr>`;
    html += _excelRenderTbody(tabWells, dn, compCols, maxTr, hasReduction);

    html += '</table>';
    // Zapisz scroll przed re-renderem
    const prevScrollLeft = container.scrollLeft;
    const prevScrollTop = container.scrollTop;
    container.innerHTML = html;
    // Przywróć scroll po re-renderze
    container.scrollLeft = prevScrollLeft;
    container.scrollTop = prevScrollTop;
    /* Zastosuj zapisane szerokości kolumn */
    if (_excelColWidths) {
        const tbl = container.querySelector('table');
        if (tbl) {
            Object.keys(_excelColWidths).forEach(function (key) {
                const d = key.split('-', 1)[0];
                if (d === dn) {
                    const ci = parseInt(key.split('-')[1]);
                    const th = tbl.querySelectorAll('thead tr:first-child th')[ci];
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
    _excelApplyStickyColumns();
    /* Wylacz pola edycyjne w wierszach zablokowanych (PZ / zamówienie) */
    _excelApplyLockedRows();
    /* Zastosuj aktywne sortowanie (render przywraca naturalną kolejność wells[]) */
    if (typeof _excelApplySortIfActive === 'function') _excelApplySortIfActive();
    /* Odśwież ikony Lucide w kontenerze (nie skanuj całego dokumentu) */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons({ root: container });
        } catch (_e) {}
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
                /* Kursor na koniec zamiast select() — zaznaczenie całej wartości
                   sprawia, że kolejny klawisz ją zastępuje (niemożliwe było
                   wpisanie wielocyfrowej ilości). number/range nie wspiera selection (InvalidStateError). */
                if (
                    restoreEl.tagName === 'INPUT' &&
                    restoreEl.type !== 'number' &&
                    restoreEl.type !== 'range' &&
                    typeof restoreEl.setSelectionRange === 'function'
                ) {
                    try {
                        const _len = restoreEl.value ? restoreEl.value.length : 0;
                        restoreEl.setSelectionRange(_len, _len);
                    } catch (_e) {}
                }
            }
        }
    }
    /* Po restore fokusa — currentWellIndex jest już ustawiony, kody h3 muszą
       być liczone z właściwej studni (bug: update przed restore = złe kody) */
    _excelUpdateHeaderProdCodes();
    /* Ponownie zastosuj filtr wyszukiwarki po re-renderze */
    const searchInput = document.getElementById('excel-search-input');
    if (searchInput && searchInput.value) excelFilterWells(searchInput.value);
}

/** Wymuś poprawne sticky left — dopasowuje do rzeczywistej szerokości kolumn */
function _excelApplyStickyColumns() {
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    /* Zmierz rzeczywiste szerokości pierwszych 7 kolumn (checkbox, tryb, Lp, NrStudni, RzWlazu, RzDna, Wys) */
    const firstRow = table.querySelector('thead tr');
    if (!firstRow) return;
    const stickyThs = firstRow.querySelectorAll('th:nth-child(-n+7)');
    if (stickyThs.length < 2) return;
    // rAF retry gdy layout jeszcze 0 (fonty/webview nie przeliczone)
    let zeroCount = 0;
    for (let _z = 0; _z < stickyThs.length; _z++) {
        if (/** @type {HTMLElement} */ (stickyThs[_z]).offsetWidth === 0) zeroCount++;
    }
    if (zeroCount > 0) {
        requestAnimationFrame(function () {
            _excelApplyStickyColumns();
        });
        return;
    }
    let leftPos = 0;
    const offsets = [0];
    for (let i = 0; i < stickyThs.length - 1; i++) {
        leftPos += /** @type {HTMLElement} */ (stickyThs[i]).offsetWidth;
        offsets.push(leftPos);
    }
    /* Zastosuj do wszystkich th i td w pierwszych 7 kolumnach */
    const sel = 'th:nth-child(-n+7), td:nth-child(-n+7)';
    const cells = table.querySelectorAll(sel);
    for (let i = 0; i < cells.length; i++) {
        let colIdx = 0;
        const el = cells[i];
        let prev = el.previousElementSibling;
        while (prev) {
            colIdx++;
            prev = prev.previousElementSibling;
        }
        if (colIdx < 7 && offsets[colIdx] != null) {
            el.style.left = offsets[colIdx] + 'px';
            el.style.position = 'sticky';
            if (el.closest('thead')) {
                el.style.zIndex = String(LAYERS_EXCEL.STICKY_HEADER_TH);
            } else {
                el.style.zIndex = String(LAYERS_EXCEL.STICKY_COLUMN);
            }
        }
    }
}
