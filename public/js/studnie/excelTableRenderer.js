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

    // filteredIndexes SSoT — nie filtruj ręcznie, użyj cache (invalidowany przy add/delete/tab/search)
    const _filteredIdx =
        typeof _excelGetFilteredIndexes === 'function' ? _excelGetFilteredIndexes() : null;
    const tabWells =
        _filteredIdx !== null
            ? _filteredIdx.map(function (i) {
                  return wells[i];
              })
            : wells.filter(function (w) {
                  return _excelWellMatchesTab(w, dn);
              });
    const hideTr = typeof _excelTransitionsHidden === 'function' && _excelTransitionsHidden();
    const maxTr = _excelMaxTransitions[dn] || 1;
    /* Ukrycie = klasa display:none (nie usuwanie): indeksy kolumn stabilne,
       nagłówek i body zawsze mają tę samą liczbę komórek. */
    const trHideCls = hideTr ? ' excel-tr-hidden' : '';
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

    const _h1Px = typeof _excelHeaderFontPx === 'function' ? _excelHeaderFontPx('h1') : 10;
    const _h2Px = typeof _excelHeaderFontPx === 'function' ? _excelHeaderFontPx('h2') : 10;
    const _h3Px = typeof _excelHeaderFontPx === 'function' ? _excelHeaderFontPx('h3') : 9;
    const thBase =
        'padding:0.4rem 0.5rem;font-size:' +
        _h1Px +
        'px;font-weight: var(--fw-semibold);text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    const th2Base =
        'padding:0.2rem 0.5rem;font-size:' +
        _h2Px +
        'px;font-weight: var(--fw-normal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size:' +
        _h3Px +
        'px;font-weight: var(--fw-medium);color:var(--excel-text-dim);text-align:center;white-space:nowrap;background:var(--excel-header-bg);';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    /* === KOLUMNA 0: Checkbox - select-all przeniesiony do H1 (gorny) === */
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:28px;border-right:1px solid var(--excel-border-subtle);">.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:28px;border-right:1px solid var(--excel-border-subtle);">.</th>`;
    h1 += `<th scope="col" data-excel-col="sel" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:28px;border-right:1px solid var(--excel-border-subtle);"><input type="checkbox" id="excel-select-all" data-csp="_excelToggleSelectAll" data-csp-args="[&quot;$checked&quot;]" data-csp-on="change" tabindex="-1" class="cursor-accent-check" /></th>`;
    /* === KOLUMNA 1: Tryb Auto/Manual - buttony w H1 (gornym), naglowek w H3 === */
    const _bulkAutoBtn = `<button type="button" id="excel-bulk-auto" class="excel-bulk-btn excel-bulk-btn--auto" data-csp="_excelBulkSetMode" data-csp-args="[true]" title="Ustaw wszystkie widoczne studnie na AUTO">Auto</button>`;
    const _bulkManualBtn = `<button type="button" id="excel-bulk-manual" class="excel-bulk-btn excel-bulk-btn--manual" data-csp="_excelBulkSetMode" data-csp-args="[false]" title="Ustaw wszystkie widoczne studnie na MANUAL">Manual</button>`;
    h1 += `<th scope="col" data-excel-col="mode" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:70px;padding:2px;border-bottom:1px solid rgba(var(--accent-rgb), 0.2);"><b style="color:var(--warn-hover);">A/M</b></th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:70px;border-right:1px solid var(--excel-border-subtle);">.</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);text-align:center;width:70px;border-right:1px solid var(--excel-border-subtle);"><div style="display:flex;flex-direction:column;gap:2px;align-items:center;">${_bulkAutoBtn}${_bulkManualBtn}</div></th>`;
    /* === KOLUMNA 2: Lp. — sticky left:0 === */
    h1 += `<th scope="col" data-excel-col="lp" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid var(--excel-border);">Lp.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid var(--excel-border);">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid var(--excel-border);">·</th>`;
    h1 += `<th scope="col" data-excel-col="name" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;border-right:1px solid var(--excel-border);">Nr Studni</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h1 += `<th scope="col" data-excel-col="rz-wlazu" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th scope="col" data-excel-col="rz-dna" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th scope="col" data-excel-col="wys" style="${thBase}background:var(--excel-header-bg);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">·</th>`;

    for (let i = 0; i < maxTr; i++) {
        const _alt = i % 2 === 1 ? ' excel-tr-alt' : '';
        h1 += `<th scope="col" data-excel-col="trz-${i}-rzedna" class="excel-tr-first${_alt}${trHideCls}" style="${thBase}background:var(--excel-header-bg);color:${dnColor};min-width:78px;text-align:right;">Rz.wlot ${i}</th>`;
        h2 += `<th scope="col" class="excel-tr-first${_alt}${trHideCls}" style="${th2Base}background:var(--excel-header-bg);color:${dnColor};min-width:78px;text-align:right;">·</th>`;
        h3 += `<th scope="col" colspan="4" class="excel-tr-group${_alt}${trHideCls}" style="${th3Base}background:var(--excel-header-bg);color:${dnColor};text-align:center;">PRZ ${i}</th>`;
        h1 += `<th scope="col" data-excel-col="trz-${i}-kat" class="${_alt.trim()}${trHideCls}" style="${thBase}background:var(--excel-header-bg);color:${dnColor};min-width:55px;text-align:center;">Kąt ${i}°</th>`;
        h2 += `<th scope="col" class="${_alt.trim()}${trHideCls}" style="${th2Base}background:var(--excel-header-bg);color:${dnColor};min-width:55px;text-align:center;">·</th>`;
        h1 += `<th scope="col" data-excel-col="trz-${i}-rodzaj" class="${_alt.trim()}${trHideCls}" style="${thBase}background:var(--excel-header-bg);color:${dnColor};min-width:125px;text-align:left;">Rodzaj ${i}</th>`;
        h2 += `<th scope="col" class="${_alt.trim()}${trHideCls}" style="${th2Base}background:var(--excel-header-bg);color:${dnColor};min-width:125px;text-align:left;">·</th>`;
        h1 += `<th scope="col" data-excel-col="trz-${i}-srednica" class="excel-tr-last${_alt}${trHideCls}" style="${thBase}background:var(--excel-header-bg);color:${dnColor};min-width:110px;text-align:left;">Średnica ${i}</th>`;
        h2 += `<th scope="col" class="excel-tr-last${_alt}${trHideCls}" style="${th2Base}background:var(--excel-header-bg);color:${dnColor};min-width:110px;text-align:left;">·</th>`;
    }

    // Przyciski +/- (przy ukrytej sekcji display:none razem z nią)
    h1 += `<th scope="col" data-excel-col="tr-minus" class="${trHideCls.trim()}" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;"><button type="button" data-csp="excelRemoveTransitionColumn" data-csp-args="[]" class="excel-icon-btn is-danger excel-col-toggle" title="Usuń ostatnią kolumnę przejścia" aria-label="Usuń ostatnią kolumnę przejścia"><i data-lucide="minus" class="icon-sm" aria-hidden="true"></i></button></th>`;
    h2 += `<th scope="col" class="${trHideCls.trim()}" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th scope="col" class="${trHideCls.trim()}" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th scope="col" data-excel-col="tr-plus" class="${trHideCls.trim()}" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;"><button type="button" data-csp="excelAddTransitionColumn" data-csp-args="[]" class="excel-icon-btn excel-col-toggle is-plus" title="Dodaj kolumnę przejścia" aria-label="Dodaj kolumnę przejścia"><i data-lucide="plus" class="icon-sm" aria-hidden="true"></i></button></th>`;
    h2 += `<th scope="col" class="${trHideCls.trim()}" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th scope="col" class="${trHideCls.trim()}" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:24px;text-align:center;padding:0;">·</th>`;

    // Właz
    h1 += `<th scope="col" data-excel-col="wlaz" style="${thBase}background:var(--excel-header-bg);color:var(--success-hover);min-width:65px;text-align:left;">Właz</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--success-hover);min-width:65px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--success-hover);min-width:65px;text-align:left;">·</th>`;

    // Komponenty — trzy wiersze (rz1=DN, rz2=skrót, rz3=szczegół)
    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select') return;
        /** @type {any} */
        const c = col;
        const ct = c.componentType;
        // Kolor nagłówka = kolor elementu w konfiguratorze (SSoT: COMPONENT_THEME).
        // Wyjątki: avr → stroke (fill #475569 nieczytelny na ciemnym tle),
        // właz nie trafia tu (kolumna select, nagłówek zostaje zielony).
        // Dark: stroke (jasny wariant tej samej rodziny — ciemne fille
        // #9d174d/#a16207/#047857/#4338ca nieczytelne na --excel-header-bg).
        // Light: fill (ciemny na jasnym tle; jedyny jasny fill — uszczelka —
        // nie trafia tu, ma fallback --blue-hover).
        const theme = typeof COMPONENT_THEME !== 'undefined' ? COMPONENT_THEME[ct] : null;
        // Motyw sterowany CSS (.excel-hdr-themed): JS podaje oba warianty,
        // desync przy zmianie motywu bez re-renderu znika.
        const hcFill =
            ct === 'avr' ? 'var(--excel-text-dim)' : (theme && theme.fill) || 'var(--blue-hover)';
        const hcStroke =
            ct === 'avr'
                ? 'var(--excel-text-dim)'
                : (theme && theme.stroke) || (theme && theme.fill) || 'var(--blue-hover)';
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
            : ` data-fallback="${escapeHtmlAttr((c.products && c.products[0] && c.products[0].id) || '')}"`;

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
        h1 += `<th scope="col" data-col-id="${escapeHtmlAttr(c.id)}" data-excel-col="comp-${escapeHtmlAttr(c.id)}" class="excel-hdr-themed" style="${thBase}background:var(--excel-header-bg);--hc-fill:${hcFill};--hc-stroke:${hcStroke};min-width:95px;text-align:center;">${colLabel}</th>`;
        h2 += `<th scope="col" data-col-id="${escapeHtmlAttr(c.id)}" class="excel-hdr-themed" style="${th2Base}background:var(--excel-header-bg);--hc-fill:${hcFill};--hc-stroke:${hcStroke};min-width:95px;text-align:center;">${colDetail}</th>`;
        h3 += `<th scope="col" data-col-id="${escapeHtmlAttr(c.id)}" class="excel-hdr-themed" style="padding:${h3Pad};font-size:${_h3Px}px;font-weight: var(--fw-medium);color:var(--excel-text-dim);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--excel-header-bg);--hc-fill:${hcFill};--hc-stroke:${hcStroke};min-width:95px;text-align:center;">${colDnLabel}${colCode}</th>`;
    });

    h1 += `<th scope="col" data-excel-col="h-denn" style="${thBase}background:var(--excel-header-bg);color:var(--warn-hover);min-width:60px;text-align:center;">H denn</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--warn-hover);min-width:60px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--warn-hover);min-width:60px;text-align:center;">·</th>`;
    h1 += `<th scope="col" data-excel-col="uszcz" style="${thBase}background:var(--excel-header-bg);color:var(--warn-hover);min-width:50px;text-align:center;">Uszcz</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--warn-hover);min-width:50px;text-align:center;">auto</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--warn-hover);min-width:50px;text-align:center;">·</th>`;

    if (hasReduction) {
        /* Redukcja — pojedynczy select: Brak / DN1000 / DN1200 */
        h1 += `<th scope="col" data-excel-col="redukcja" style="${thBase}background:var(--excel-header-bg);color:var(--danger-hover);min-width:110px;text-align:center;">Redukcja</th>`;
        h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--danger-hover);min-width:110px;text-align:center;">·</th>`;
        h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--danger-hover);min-width:110px;text-align:center;">·</th>`;
    }

    h1 += `<th scope="col" data-excel-col="kineta" style="${thBase}background:var(--excel-header-bg);color:var(--accent2-hover);min-width:95px;text-align:left;">Kineta</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--accent2-hover);min-width:95px;text-align:left;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--accent2-hover);min-width:95px;text-align:left;">·</th>`;
    h1 += `<th scope="col" data-excel-col="pbuda" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:55px;text-align:center;">P.Buda</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:55px;text-align:center;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:55px;text-align:center;">·</th>`;
    h1 += `<th scope="col" data-excel-col="akcje" style="${thBase}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:120px;text-align:center;">Akcje</th>`;
    h2 += `<th scope="col" style="${th2Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:120px;text-align:center;">·</th>`;
    h3 += `<th scope="col" style="${th3Base}background:var(--excel-header-bg);color:var(--excel-text-dim);min-width:120px;text-align:center;">·</th>`;

    html += `<tr style="position:sticky;top:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--excel-header-bg);">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--excel-header-bg);">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:var(--excel-header-bg);">${h2}</tr>`;
    html += _excelRenderTbody(tabWells, dn, compCols, maxTr, hasReduction);

    html += '</table>';
    // Zapisz scroll przed re-renderem
    const prevScrollLeft = container.scrollLeft;
    const prevScrollTop = container.scrollTop;
    container.innerHTML = html;
    // Przywróć scroll po re-renderze
    container.scrollLeft = prevScrollLeft;
    container.scrollTop = prevScrollTop;
    /* Zastosuj zapisane szerokości kolumn (stabilne data-excel-col) */
    _excelApplyColWidths(dn);
    /* Autofit kolumn bez zapisanego draga do najszerszego tekstu */
    if (typeof _excelAutoFitColumns === 'function') _excelAutoFitColumns(dn);
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
                /* preventScroll: scroll jest juz odtworzony powyzej; natywny
                   focus sciagnalby widok do komorki (skok przy wierszu ~100). */
                try {
                    restoreEl.focus({ preventScroll: true });
                } catch (_eFs) {
                    restoreEl.focus();
                }
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
    if (typeof _excelSyncHeaderCheckbox === 'function') _excelSyncHeaderCheckbox();
    /* Ponownie zastosuj filtr wyszukiwarki po re-renderze */
    const searchInput = document.getElementById('excel-search-input');
    if (searchInput && searchInput.value) excelFilterWells(searchInput.value);
}

/* Zastosuj zapisane szerokości kolumn po stabilnym data-excel-col
   z kanonicznego wiersza h1 (drugi tr thead). Wiersz h3 ma colspan=4
   (grupa PRZ), więc mapowany jest helperem _excelH3CellForCol.
   Legacy klucze numeryczne "zakładka-ci" działają jako fallback po indeksie.
   Szerokość trafia na th (h1+h2+h3) i td, nie tylko na nagłówek. */
/* Mapowanie indeksu kanonicznego (wiersz h1) na komórkę wiersza h3.
   Wiersz h3 grupuje kolumny PRZ (colspan=4), więc indeksy nie są 1:1.
   Bez tego H3 trzyma twarde min-width (95px) i blokuje ściskanie kolumn. */
function _excelH3CellForCol(h3ths, ci) {
    let acc = 0;
    for (let i = 0; i < h3ths.length; i++) {
        const th = h3ths[i];
        let span = 1;
        try {
            if (th && typeof th.colSpan === 'number' && th.colSpan > 1) span = th.colSpan;
            else if (th && typeof th.getAttribute === 'function')
                span = parseInt(th.getAttribute('colspan') || '1', 10) || 1;
        } catch (_e) {}
        if (ci >= acc && ci < acc + span) return { th, span };
        acc += span;
    }
    return null;
}

/* Szerokość na wiersz h3: pojedyncza kolumna dostaje wymiar wprost,
   grupa (PRZ i, colspan>1) dostaje minWidth 0 — szerokość wyznaczają dzieci. */
function _excelApplyWidthToH3(h3ths, ci, newWidth) {
    const hit = _excelH3CellForCol(h3ths, ci);
    if (!hit || !hit.th || !hit.th.style) return;
    if (hit.span > 1) {
        hit.th.style.minWidth = '0px';
    } else {
        hit.th.style.minWidth = newWidth + 'px';
        hit.th.style.width = newWidth + 'px';
        hit.th.style.maxWidth = newWidth + 'px';
    }
}
if (typeof window !== 'undefined') {
    window._excelH3CellForCol = _excelH3CellForCol;
    window._excelApplyWidthToH3 = _excelApplyWidthToH3;
}
/* Naturalna szerokość komórki body — po najszerszym tekście.
   Input: scrollWidth pełnego tekstu; select: labelka; tekst: cała zawartość. */
function _excelCellNaturalWidth(td) {
    if (!td) return 0;
    try {
        const inp = td.querySelector ? td.querySelector('input') : null;
        if (inp && typeof inp.scrollWidth === 'number' && inp.scrollWidth > 0)
            return inp.scrollWidth;
        const lab = td.querySelector ? td.querySelector('.excel-sel-wrap div') : null;
        if (lab && typeof lab.scrollWidth === 'number' && lab.scrollWidth > 0)
            return lab.scrollWidth;
        if (typeof td.scrollWidth === 'number') return td.scrollWidth;
    } catch (_e) {}
    return 0;
}

/* Tekst komórki body do pomiaru autofit: wartosc inputa, labelka selecta,
   inaczej przyciety textContent. */
function _excelCellText(td) {
    if (!td) return '';
    try {
        const inp = td.querySelector ? td.querySelector('input') : null;
        if (inp && typeof inp.value === 'string' && inp.value) return inp.value;
        const lab = td.querySelector ? td.querySelector('.excel-sel-wrap div') : null;
        if (lab && typeof lab.textContent === 'string' && lab.textContent.trim())
            return lab.textContent.trim();
        if (typeof td.textContent === 'string') return td.textContent.trim();
    } catch (_e) {}
    return '';
}

/* Pomiar szerokosci tekstu (canvas 2d, font komórki). 0 gdy brak kontekstu. */
let _excelFitCanvas = null;
function _excelMeasureTextWidth(text, font) {
    try {
        if (typeof document === 'undefined' || !document.createElement) return 0;
        if (!_excelFitCanvas) _excelFitCanvas = document.createElement('canvas');
        const ctx = _excelFitCanvas.getContext ? _excelFitCanvas.getContext('2d') : null;
        if (!ctx || typeof ctx.measureText !== 'function') return 0;
        if (font) ctx.font = font;
        const m = ctx.measureText(String(text));
        return m && typeof m.width === 'number' ? m.width : 0;
    } catch (_e) {
        return 0;
    }
}

/* Maks. szerokosc tekstu w elemencie liczona PER LINIA: dzieci blokowe
   (naglowki H3 maja DN / kod / cene w osobnych liniach) mierzone osobno.
   textContent calosci sklejalby linie w jeden dlugi lancuch i rozjezdzal fit. */
function _excelStackedMaxWidth(el, font) {
    if (!el) return 0;
    try {
        const kids = el.childNodes;
        if (!kids || kids.length === 0)
            return _excelMeasureTextWidth((el.textContent || '').trim(), font);
        let m = 0;
        for (let i = 0; i < kids.length; i++) {
            const n = kids[i];
            let t = '';
            if (n.nodeType === 3) t = (n.nodeValue || '').trim();
            else if (n.nodeType === 1 && n.tagName !== 'BR' && n.tagName !== 'SCRIPT')
                t = (n.textContent || '').trim();
            if (t) m = Math.max(m, _excelMeasureTextWidth(t, font));
        }
        return m;
    } catch (_e) {
        return 0;
    }
}
function _excelFitFont(el) {
    try {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && el) {
            const cs = window.getComputedStyle(el);
            if (cs && cs.font) return cs.font;
        }
    } catch (_e) {}
    return '';
}

function _excelFitPadX(el) {
    try {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && el) {
            const cs = window.getComputedStyle(el);
            const px = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            if (px > 0) return Math.ceil(px);
        }
    } catch (_e) {}
    return 8;
}
/* Autofit: domyślna szerokość kolumn bez zapisanego draga = najszerszy tekst
   (nagłówki h1/h2/h3-single + wiersze w DOM). Zapisany drag nietknięty.
   onlyCi != null → dopasuj tylko tę kolumnę (dblclick na uchwycie). */
function _excelAutoFitColumns(dn, onlyCi) {
    if (typeof _excelColWidths === 'undefined') return;
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const tbl = container.querySelector('table');
    if (!tbl) return;
    const headRows = tbl.querySelectorAll('thead tr');
    if (headRows.length < 2) return;
    const h1ths = headRows[1].querySelectorAll('th');
    if (h1ths.length === 0) return;
    const h2ths = headRows.length > 2 ? headRows[2].querySelectorAll('th') : [];
    const h3ths = headRows[0].querySelectorAll('th');
    const tab = String(dn);
    const minW = typeof _excelColMinWidth === 'function' ? _excelColMinWidth() : 10;
    let maxW = 320;
    try {
        if (typeof _EXCEL_COL_FIT_MAX === 'number') maxW = _EXCEL_COL_FIT_MAX;
    } catch (_e) {}
    const rows = tbl.querySelectorAll('tbody tr[data-widx]');
    const hideTr = typeof _excelTransitionsHidden === 'function' && _excelTransitionsHidden();
    const cols = onlyCi != null && onlyCi >= 0 ? [onlyCi] : null;
    const fitOne = function (ci) {
        const h1th = h1ths[ci];
        if (!h1th) return;
        const colId =
            typeof h1th.getAttribute === 'function' ? h1th.getAttribute('data-excel-col') : null;
        /* Ukryte kolumny PRZ: scrollWidth 0 zatrułby fit (10px po odkryciu) */
        if (
            hideTr &&
            colId &&
            (colId.indexOf('trz-') === 0 || colId === 'tr-minus' || colId === 'tr-plus')
        )
            return;
        const key =
            typeof _excelColWidthKey === 'function'
                ? _excelColWidthKey(tab, colId || String(ci))
                : tab + '-' + (colId || String(ci));
        // zapisany drag wygrywa — autofit go nie rusza
        if (_excelColWidths[key] != null) {
            if (typeof _excelAutoFittedWidths !== 'undefined') delete _excelAutoFittedWidths[key];
            return;
        }
        /* Pomiar po TEKSCIE (canvas), nie po scrollWidth zywych komorek:
           input/select rozciagaja sie na komorke, wiec scrollWidth zwracal
           istniejaca szerokosc zamiast tresci (samospelniajacy sie pomiar). */
        const FIT_BREATH = 2;
        const fitFont = _excelFitFont(h1th);
        const fitPadX = _excelFitPadX(h1th);
        let w = 0;
        let tw = 0;
        try {
            if (h1th) tw = Math.max(tw, _excelStackedMaxWidth(h1th, fitFont));
            if (h2ths[ci]) tw = Math.max(tw, _excelStackedMaxWidth(h2ths[ci], fitFont));
            const hit =
                typeof _excelH3CellForCol === 'function' ? _excelH3CellForCol(h3ths, ci) : null;
            if (hit && hit.span === 1 && hit.th)
                tw = Math.max(tw, _excelStackedMaxWidth(hit.th, fitFont));
            for (let r = 0; r < rows.length; r++) {
                const cell = rows[r].children[ci];
                if (cell) tw = Math.max(tw, _excelMeasureTextWidth(_excelCellText(cell), fitFont));
            }
        } catch (_e2) {}
        if (!(tw > 0)) return;
        w = tw + fitPadX + FIT_BREATH;
        if (!(w > 0)) return;
        w = Math.max(minW, Math.min(maxW, Math.ceil(w)));
        if (typeof _excelAutoFittedWidths !== 'undefined') _excelAutoFittedWidths[key] = w;
        h1th.style.minWidth = w + 'px';
        h1th.style.width = w + 'px';
        if (h2ths[ci]) {
            h2ths[ci].style.minWidth = w + 'px';
            h2ths[ci].style.width = w + 'px';
        }
        if (typeof _excelApplyWidthToH3 === 'function') {
            const hit2 =
                typeof _excelH3CellForCol === 'function' ? _excelH3CellForCol(h3ths, ci) : null;
            if (hit2 && hit2.span === 1 && hit2.th && hit2.th.style) {
                hit2.th.style.minWidth = w + 'px';
                hit2.th.style.width = w + 'px';
            } else if (hit2 && hit2.span > 1 && hit2.th && hit2.th.style) {
                hit2.th.style.minWidth = '0px';
            }
        }
        const bodyRows = tbl.querySelectorAll('tbody tr');
        bodyRows.forEach(function (row) {
            const cell = row.children[ci];
            if (cell) {
                cell.style.minWidth = w + 'px';
                cell.style.width = w + 'px';
            }
        });
    };
    if (cols) {
        fitOne(cols[0]);
    } else {
        for (let ci = 0; ci < h1ths.length; ci++) fitOne(ci);
    }
    if (typeof _excelApplyStickyColumns === 'function') _excelApplyStickyColumns();
}
if (typeof window !== 'undefined') {
    window._excelCellNaturalWidth = _excelCellNaturalWidth;
    window._excelCellText = _excelCellText;
    window._excelMeasureTextWidth = _excelMeasureTextWidth;
    window._excelStackedMaxWidth = _excelStackedMaxWidth;
    window._excelAutoFitColumns = _excelAutoFitColumns;
}
function _excelApplyColWidths(dn) {
    if (typeof _excelColWidths === 'undefined' || !_excelColWidths) return;
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const tbl = container.querySelector('table');
    if (!tbl) return;
    const headRows = tbl.querySelectorAll('thead tr');
    if (headRows.length < 2) return;
    const h1ths = headRows[1].querySelectorAll('th');
    if (h1ths.length === 0) return;
    const h2ths = headRows.length > 2 ? headRows[2].querySelectorAll('th') : [];
    const h3ths = headRows[0].querySelectorAll('th');
    const tab = String(dn);
    const byId = {};
    const legacyByIdx = {};
    const fitById = {};
    const fitLegacyByIdx = {};
    const minW = typeof _excelColMinWidth === 'function' ? _excelColMinWidth() : 10;
    Object.keys(_excelColWidths).forEach(function (key) {
        const parsed =
            typeof _excelParseColWidthKey === 'function' ? _excelParseColWidthKey(key) : null;
        if (!parsed || parsed.tab !== tab) return;
        const w = parseFloat(_excelColWidths[key]);
        if (!isFinite(w) || w < minW) return;
        if (/^-?\d+$/.test(parsed.colId)) legacyByIdx[parseInt(parsed.colId, 10)] = w;
        else byId[parsed.colId] = w;
    });
    /* Autofit z poprzedniego pełnego rendera (virtual dokleja slice) — zapisany drag wygrywa */
    try {
        if (typeof _excelAutoFittedWidths !== 'undefined' && _excelAutoFittedWidths) {
            Object.keys(_excelAutoFittedWidths).forEach(function (key) {
                const parsed =
                    typeof _excelParseColWidthKey === 'function'
                        ? _excelParseColWidthKey(key)
                        : null;
                if (!parsed || parsed.tab !== tab) return;
                const w = parseFloat(_excelAutoFittedWidths[key]);
                if (!isFinite(w) || w < minW) return;
                if (/^-?\d+$/.test(parsed.colId)) fitLegacyByIdx[parseInt(parsed.colId, 10)] = w;
                else fitById[parsed.colId] = w;
            });
        }
    } catch (_eFit) {}
    const bodyRows = tbl.querySelectorAll('tbody tr');
    h1ths.forEach(function (th, ci) {
        const colId =
            typeof th.getAttribute === 'function' ? th.getAttribute('data-excel-col') : null;
        const saved = colId && byId[colId] != null ? byId[colId] : legacyByIdx[ci];
        const fitted =
            saved == null
                ? colId && fitById[colId] != null
                    ? fitById[colId]
                    : fitLegacyByIdx[ci]
                : null;
        const w = saved != null ? saved : fitted;
        if (w == null) return;
        th.style.minWidth = w + 'px';
        th.style.width = w + 'px';
        /* maxWidth tylko dla twardego draga; fitted rośnie naturalnie do kolejnego fita */
        if (saved != null) th.style.maxWidth = w + 'px';
        else th.style.maxWidth = '';
        if (h2ths[ci]) {
            h2ths[ci].style.minWidth = w + 'px';
            h2ths[ci].style.width = w + 'px';
            if (saved != null) h2ths[ci].style.maxWidth = w + 'px';
            else h2ths[ci].style.maxWidth = '';
        }
        if (typeof _excelApplyWidthToH3 === 'function') _excelApplyWidthToH3(h3ths, ci, w);
        bodyRows.forEach(function (row) {
            const cell = row.children[ci];
            if (cell) {
                cell.style.minWidth = w + 'px';
                cell.style.width = w + 'px';
                if (saved != null) cell.style.maxWidth = w + 'px';
                else cell.style.maxWidth = '';
            }
        });
    });
}
if (typeof window !== 'undefined') window._excelApplyColWidths = _excelApplyColWidths;

/** Wymuś poprawne sticky left — dopasowuje do rzeczywistej szerokości kolumn */
function _excelApplyStickyColumns(retry) {
    retry = retry || 0;
    const container = document.getElementById('excel-table-container');
    if (!container) return;
    const table = container.querySelector('table');
    if (!table) return;
    /* P4-A7: mierz wiersz kanoniczny h1 (thead tr:nth-child(2) — komórki per
       kolumna z data-excel-col), nie h3 (grupowane, colspan). */
    const headRow = table.querySelector('thead tr:nth-child(2)') || table.querySelector('thead tr');
    if (!headRow) return;
    const stickyThs = headRow.querySelectorAll('th:nth-child(-n+7)');
    if (stickyThs.length < 2) return;
    // rAF retry gdy layout jeszcze 0 (fonty/webview nie przeliczone) — max 5.
    let zeroCount = 0;
    for (let _z = 0; _z < stickyThs.length; _z++) {
        if (/** @type {HTMLElement} */ (stickyThs[_z]).offsetWidth === 0) zeroCount++;
    }
    if (zeroCount > 0) {
        if (retry >= 5) return;
        requestAnimationFrame(function () {
            _excelApplyStickyColumns(retry + 1);
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
