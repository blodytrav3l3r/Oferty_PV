// @ts-check
/* ===== EXCEL RENDERER — Nagłówek tabeli (thead) ===== */

function _excelBuildThead(dn, maxTr, compCols, hasReduction, dnColor, dnBg) {
    let h1 = '';
    let h2 = '';
    let h3 = '';

    const thBase =
        'padding:0.4rem 0.5rem;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap;';
    const th2Base =
        'padding:0.2rem 0.5rem;font-size:0.6rem;font-weight:400;white-space:pre-wrap;word-break:break-word;max-width:100px;line-height:1.3;';
    const th3Base =
        'padding:0.1rem 0.5rem;font-size:0.55rem;font-weight:500;color:#64748b;text-align:center;white-space:nowrap;background:#161923;';

    const dnLabel = dn === 'styczne' ? 'Styczne' : 'DN' + dn;
    const dnTh3 = (ct) => (ct === 'avr' ? 'uniw.' : dnLabel);

    /* === KOLUMNA 0: Checkbox === */
    h3 += `<th style="${th3Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h2 += `<th style="${th2Base}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);">.</th>`;
    h1 += `<th style="${thBase}background:#161923;color:#94a3b8;text-align:center;width:28px;border-right:1px solid rgba(255,255,255,0.06);"><input type="checkbox" id="excel-select-all" data-action="toggleSelectAll" tabindex="-1" style="cursor:pointer;accent-color:rgba(99,102,241,0.7);" /></th>`;

    /* === KOLUMNA 1: Tryb Auto/Manual === */
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

    /* Przyciski +/− */
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button data-action="excelRemoveTransitionColumn" title="Usuń ostatnią kolumnę przejścia" class="excel-hover-color" style="--hc:#f87171;background:#13151f;color:#ef4444;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;">−</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h1 += `<th style="${thBase}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;"><button data-action="excelAddTransitionColumn" title="Dodaj kolumnę przejścia" class="excel-hover-color" style="--hc:#94a3b8;background:#13151f;color:#64748b;border:none;cursor:pointer;font-size:0.9rem;font-weight:700;padding:0.15rem 0;width:100%;">+</button></th>`;
    h2 += `<th style="${th2Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;
    h3 += `<th style="${th3Base}background:#13151f;color:#64748b;min-width:24px;text-align:center;padding:0;">·</th>`;

    /* Właz */
    h1 += `<th style="${thBase}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">Właz</th>`;
    h2 += `<th style="${th2Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;
    h3 += `<th style="${th3Base}background:#0f1a15;color:#6ee7b7;min-width:65px;text-align:left;">·</th>`;

    /* Komponenty */
    compCols.forEach((col) => {
        if (col.type === 'auto' || col.type === 'select') return;
        var c = col;
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
            colCodeId = c.productId;
        } else {
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
                  if (codeDisp) {
                      try {
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

    return (
        '<thead>' +
        `<tr style="position:sticky;top:0;z-index:20;background:#161923;">${h3}</tr>` +
        `<tr style="position:sticky;top:1.4rem;z-index:20;background:#161923;">${h1}</tr>` +
        `<tr style="position:sticky;top:3.2rem;z-index:20;background:#161923;">${h2}</tr>` +
        '</thead>'
    );
}
