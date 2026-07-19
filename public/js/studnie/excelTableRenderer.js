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

    /* Wyczyść puste przejścia we wszystkich studniach */
    if (typeof wells !== 'undefined') {
        for (let _rwi = 0; _rwi < wells.length; _rwi++) {
            _excelCleanEmptyPrzejscia(wells[_rwi]);
        }
    }

    const tabWells = wells.filter((w) => _excelWellMatchesTab(w, dn));
    const maxTr = _excelMaxTransitions[dn] || 1;
    let refWell = tabWells[0];
    if (!refWell && typeof _excelGetReferenceWell === 'function') {
        refWell = _excelGetReferenceWell(dn);
    }
    const compCols = _excelGetVisibleComponentColumns(dn, refWell);
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
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);"><input type="checkbox" id="excel-select-all" onchange="_excelToggleSelectAll(this.checked)" tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" /></th>`;
    /* === KOLUMNA 1: Tryb Auto/Manual - buttony w H1 (gornym), naglowek w H3 === */
    let _bulkAutoBtn = `<button type="button" id="excel-bulk-auto" onclick="_excelBulkSetMode(true)" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#c7d2fe;padding:2px 0px;border-radius:2px;cursor:pointer;font-size:0.62rem;font-weight:600;width:46px;box-sizing:border-box;text-align:center;line-height:1.1;height:18px;">Auto</button>`;
    let _bulkManualBtn = `<button type="button" id="excel-bulk-manual" onclick="_excelBulkSetMode(false)" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:2px 0px;border-radius:2px;cursor:pointer;font-size:0.62rem;font-weight:600;width:46px;box-sizing:border-box;text-align:center;line-height:1.1;height:18px;">Manual</button>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:54px;padding:2px;border-bottom:1px solid rgba(99,102,241,0.2);"><b style="color:#fbbf24;">A/M</b></th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:54px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:center;width:54px;border-right:1px solid rgba(255,255,255,0.06);"><div style="display:flex;flex-direction:column;gap:2px;align-items:center;">${_bulkAutoBtn}${_bulkManualBtn}</div></th>`;
    /* === KOLUMNA 2: Lp. — sticky left:0 === */
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">Lp.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:32px;text-align:center;border-right:1px solid rgba(255,255,255,0.08);">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;border-right:1px solid rgba(255,255,255,0.1);">Nr Studni</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:32px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:130px;text-align:left;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Włazu</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:162px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">Rz. Dna</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;position:sticky;left:240px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:78px;text-align:right;">·</th>`;
    h1 += `<th style="${thBase}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">Wys.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">auto</th>`;
    h3 += `<th style="${th3Base}background:#161923;color:${dnColor};position:sticky;left:318px;z-index:${LAYERS_EXCEL.STICKY_HEADER_TH};min-width:65px;text-align:center;">·</th>`;

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
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelRemoveTransitionColumn()" title="Usuń ostatnią kolumnę przejścia" style="background:#13151f;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='#ef4444'">−</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button onclick="excelAddTransitionColumn()" title="Dodaj kolumnę przejścia" style="background:#13151f;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;transition:color 0.1s;" onmouseenter="this.style.color='#94a3b8'" onmouseleave="this.style.color='#64748b'">+</button></th>`;
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
        let isPerProduct = c.productId ? true : false;
        let colCodeId;
        if (isPerProduct) {
            /* Kolumna per-produkt — zawsze pokazuje swój stały kod */
            colCodeId = c.productId;
        } else {
            /* Kolumna grupowana — dynamicznie z configu zaznaczonej studni */
            let dynProdCode = null;
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
            let fallbackCode = (c.products && c.products[0] && c.products[0].id) || null;
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
                          let prod = (
                              typeof studnieProducts !== 'undefined' ? studnieProducts : []
                          ).find(function (pr) {
                              return pr.id === codeDisp;
                          });
                          if (prod && prod.price) {
                              let fmt =
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

    html += `<tr style="position:sticky;top:0;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:#161923;">${h3}</tr>`;
    html += `<tr style="position:sticky;top:1.4rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:#161923;">${h1}</tr>`;
    html += `<tr style="position:sticky;top:3.2rem;z-index:${LAYERS_EXCEL.STICKY_HEADER_ROW};background:#161923;">${h2}</tr>`;
    html += _excelRenderTbody(tabWells, dn, compCols, maxTr, hasReduction);

    html += '</table>';
    // Zapisz scroll przed re-renderem
    var prevScrollLeft = container.scrollLeft;
    var prevScrollTop = container.scrollTop;
    container.innerHTML = html;
    // Przywróć scroll po re-renderze
    container.scrollLeft = prevScrollLeft;
    container.scrollTop = prevScrollTop;
    /* Zastosuj zapisane szerokości kolumn */
    if (_excelColWidths) {
        let tbl = container.querySelector('table');
        if (tbl) {
            Object.keys(_excelColWidths).forEach(function (key) {
                let d = key.split('-', 1)[0];
                if (d === dn) {
                    let ci = parseInt(key.split('-')[1]);
                    let th = tbl.querySelectorAll('thead tr:first-child th')[ci];
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
    let searchInput = document.getElementById('excel-search-input');
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
    let leftPos = 0;
    let offsets = [0];
    for (let i = 0; i < stickyThs.length - 1; i++) {
        leftPos += /** @type {HTMLElement} */ (stickyThs[i]).offsetWidth;
        offsets.push(leftPos);
    }
    /* Zastosuj do wszystkich th i td w pierwszych 7 kolumnach */
    let sel = 'th:nth-child(-n+7), td:nth-child(-n+7)';
    let cells = table.querySelectorAll(sel);
    for (let i = 0; i < cells.length; i++) {
        let colIdx = 0;
        let el = cells[i];
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
