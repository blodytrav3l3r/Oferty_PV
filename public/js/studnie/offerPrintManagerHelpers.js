// @ts-check
/* ===== HELPERY WYDRUKU OFERTY STUDNI ===== */
/* Pure/HTML-buildery wydzielone z offerPrintManager.js */

function getWellZwienczenieName(well) {
    if (!well || !well.config) return '—';

    const topTypes = [
        'konus',
        'plyta_zamykajaca',
        'plyta_najazdowa',
        'plyta_din',
        'pierscien_odciazajacy'
    ];
    const topItem = well.config.find((item) => {
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(item.productId)
                : studnieProducts.find((pr) => pr.id === item.productId);
        return p && topTypes.includes(p.componentType);
    });

    if (!topItem) return '—';

    const product =
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(topItem.productId)
            : studnieProducts.find((p) => p.id === topItem.productId);
    if (!product) return '—';

    let name = product.name;
    name = name.replace(/\s*\(?[hH]\s*=?\s*\d+([.,]\d+)?\s*(mm|cm|m)?\)?\s*/gi, ' ');
    name = name.replace(/\s*(bez\s+stopni|z\s+drabinką|drabinka|ze\s+stopniami|-B|-D|-N)/gi, '');
    name = name.trim().replace(/\s+/g, ' ');

    return name;
}

function groupWellsByDiameter(wellsList) {
    const groups = new Map();
    const dnOrder = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    wellsList.forEach((well) => {
        const key = well.dn;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(well);
    });

    const sorted = new Map();
    dnOrder.forEach((dn) => {
        if (groups.has(dn)) sorted.set(dn, groups.get(dn));
    });
    groups.forEach((v, k) => {
        if (!sorted.has(k)) sorted.set(k, v);
    });

    return sorted;
}

function buildDiameterTableHtml(dn, wellsGroup, globalLpOffset, transportCostMap) {
    const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;

    let html = `<div class="dn-section">
        <div class="dn-header">${dnLabel}</div>
        <table class="offer-table">
            <thead>
                <tr>
                    <th scope="col" style="width:5%;">Lp.</th>
                    <th scope="col" style="width:30%;">Nr studni</th>
                    <th scope="col" class="w-10pct">Średnica</th>
                    <th scope="col" style="width:8%;">H [mm]</th>
                    <th scope="col" style="width:32%;">Zwieńczenie</th>
                    <th scope="col" class="w-15pct">Cena netto [PLN]</th>
                </tr>
            </thead>
            <tbody>`;

    let groupTotal = 0;
    let lp = globalLpOffset;

    wellsGroup.forEach((well) => {
        const stats = calcWellStats(well);
        const transportCost = transportCostMap.get(well) || 0;
        const wellPrice = stats.price + transportCost;
        groupTotal += wellPrice;

        const zwienczenie = getWellZwienczenieName(well);
        const dnDisplay = well.dn === 'styczna' ? 'Styczna' : `DN${well.dn}`;

        html += `<tr>
            <td class="text-center">${lp}</td>
            <td class="text-center bold">${escapeHtml(well.name || '—')}</td>
            <td class="text-center">${dnDisplay}</td>
            <td class="text-center">${fmtInt(stats.height)}</td>
            <td class="zwienczenie-cell text-center">${zwienczenie}</td>
            <td class="text-center bold">${fmt(wellPrice)}</td>
        </tr>`;
        lp++;
    });

    html += `<tr class="dn-summary-row">
        <td colspan="4"></td>
        <td class="text-right">Razem ${dnLabel} (${wellsGroup.length} szt.):</td>
        <td class="text-center">${fmt(groupTotal)} PLN</td>
    </tr>`;

    html += `</tbody></table></div>`;

    return { html, count: wellsGroup.length, totalPrice: groupTotal, nextLp: lp };
}

function buildOfferSummaryHtml(summaries, totalNettoAll) {
    let html = `<div class="summary-section">
        <h3>Podsumowanie oferty</h3>
        <table class="summary-table">`;

    summaries.forEach((s) => {
        html += `<tr>
            <td class="text-center">${s.label}</td>
            <td class="text-center">${s.count} szt.</td>
            <td class="text-center bold">${fmt(s.totalPrice)} PLN</td>
        </tr>`;
    });

    html += `<tr class="grand-total">
            <td class="text-center">RAZEM NETTO</td>
            <td class="text-center">${summaries.reduce((s, x) => s + x.count, 0)} szt.</td>
            <td class="text-center">${fmt(totalNettoAll)} PLN</td>
        </tr>`;

    html += `</table></div>`;
    return html;
}

function buildOfferNotesHtml(notes, paymentTerms, _validity, wellsList) {
    let html = '';

    if (notes) {
        html += `<div class="notes-section">
            <div class="note-box">${escapeHtml(notes).replace(/\n/g, '<br>')}</div>
        </div>`;
    }

    const perWell =
        Array.isArray(wellsList) && wellsList.length
            ? wellsList
            : typeof wells !== 'undefined' && Array.isArray(wells)
              ? wells
              : [];
    const withUwagi = perWell.filter((w) => w && w.uwagi && String(w.uwagi).trim());
    if (withUwagi.length > 0) {
        html += `<div class="well-notes-section" style="margin-top:10px;">
            <div><strong>Uwagi do studni:</strong></div>
            <ul style="margin:4px 0 0 16px; padding:0; list-style:disc;">
                ${withUwagi.map((w) => `<li><strong>${escapeHtml(w.name || '—')} (DN${escapeHtml(String(w.dn ?? ''))}):</strong> ${escapeHtml(String(w.uwagi)).replace(/\n/g, '<br>')}</li>`).join('')}
            </ul>
        </div>`;
    }

    if (paymentTerms) {
        html += `<div class="conditions" style="margin-top: 10px;">
            <div><strong>Warunki płatności:</strong> ${escapeHtml(paymentTerms).replace(/\n/g, '<br>')}</div>
        </div>`;
    }

    return html;
}

/* ===== Rejestracja globali ===== */
window.groupWellsByDiameter = groupWellsByDiameter;
window.buildDiameterTableHtml = buildDiameterTableHtml;
window.buildOfferSummaryHtml = buildOfferSummaryHtml;
window.buildOfferNotesHtml = buildOfferNotesHtml;
