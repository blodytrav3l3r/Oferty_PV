// @ts-check
/* ===== HELPERY OFERTY (STUDNIE) ===== */

function getWellRowStyle(change, isOrdered) {
    if (change) {
        return change.type === 'added'
            ? 'border-left:3px solid var(--success-hover); background:rgba(var(--success-rgb), 0.05);'
            : 'border-left:3px solid var(--danger); background:rgba(var(--danger-rgb), 0.05);';
    }
    return isOrdered
        ? 'border-left:3px solid rgba(var(--accent-rgb), 0.5); background:rgba(var(--accent-rgb), 0.05);'
        : '';
}

// Liczba kolumn tabeli oferty (do colspan wierszy szczegółów)
function getOfferColumnsCount(showOrderSelection, showPriceComparison) {
    let count = 9; // Lp, Expand, Nazwa, Cechy, Status, Błąd, DN, Cena, Akcje
    if (showOrderSelection) count += 1;
    if (showPriceComparison) count += 2; // Cena z oferty, Różnica
    return count;
}

// Ikona błędu konfiguracji studni (kolumna "Błąd")
function getWellErrorCell(well) {
    if (!well) return '';
    const isError = well.configStatus === 'ERROR';
    const isWarning = well.configStatus === 'WARNING';
    if (!isError && !isWarning) return '';
    const escAttr =
        typeof escapeHtmlAttr === 'function'
            ? escapeHtmlAttr
            : typeof window !== 'undefined' && typeof window.escapeHtmlAttr === 'function'
              ? window.escapeHtmlAttr
              : escapeHtml;
    const title = (well.configErrors || []).map((e) => escAttr(e)).join('; ');
    const color = isError ? 'var(--danger-hover)' : 'var(--warn-hover)';
    const rgb = isError ? 'var(--danger-rgb)' : 'var(--warn-rgb)';
    const icon = isError ? 'x-circle' : 'alert-triangle';
    return `<span title="${title}" style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:rgba(${rgb}, 0.15); color:${color}; cursor:help;">
        <i data-lucide="${icon}" class="icon-xs"></i>
    </span>`;
}

function getDiscountStr(well, p, disc) {
    // Render: corrupt stored → fallback 0% + warn + widoczny badge (kontrakt throw zostaje).
    if (typeof getWellDiscountPctSafe === 'function') {
        const wasCorrupt =
            typeof isWellDiscountCorrupt === 'function' && isWellDiscountCorrupt(well);
        const discountPct = getWellDiscountPctSafe(well, p, disc);
        if (
            typeof isWellDiscountCorrupt === 'function' &&
            isWellDiscountCorrupt(well) &&
            !wasCorrupt
        ) {
            return typeof discountCorruptBadge === 'function'
                ? discountCorruptBadge()
                : ' <span style="font-size: var(--fs-2xs); color:var(--danger); margin-left:0.3rem;">(<i data-lucide="warn-glyph" class="icon-xxs" aria-hidden="true"></i> rabat)</span>';
        }
        return discountPct > 0
            ? ` <span style="font-size: var(--fs-2xs); color:var(--success); margin-left:0.3rem;">(-${discountPct}%)</span>`
            : '';
    }
    try {
        const discountPct = getWellDiscountPct(well, p, disc);
        return discountPct > 0
            ? ` <span style="font-size: var(--fs-2xs); color:var(--success); margin-left:0.3rem;">(-${discountPct}%)</span>`
            : '';
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
        try {
            if (well && typeof well === 'object') well._discountCorrupt = true;
        } catch (_m) {}
        try {
            if (typeof logger !== 'undefined' && logger && typeof logger.warn === 'function')
                logger.warn('pricing', '[discount-corrupt] getDiscountStr: fallback 0%');
            else if (typeof console !== 'undefined' && console.warn)
                console.warn('[discount-corrupt] getDiscountStr: fallback 0%');
        } catch (_l) {}
        return typeof discountCorruptBadge === 'function'
            ? discountCorruptBadge()
            : ' <span style="font-size: var(--fs-2xs); color:var(--danger); margin-left:0.3rem;" title="Nieprawidłowy zapis rabatu — cena bez rabatu">(<i data-lucide="warn-glyph" class="icon-xxs" aria-hidden="true"></i> rabat)</span>';
    }
}

function migrateWellData(wellsArr) {
    if (!wellsArr) return wellsArr;
    wellsArr.forEach((w) => {
        if (w.material && !w.nadbudowa) {
            w.nadbudowa = w.material;
        }
        if (w.material && !w.dennicaMaterial) {
            w.dennicaMaterial = w.material;
        }
        if (!w.nadbudowa) w.nadbudowa = 'betonowa';
        if (!w.dennicaMaterial) w.dennicaMaterial = 'betonowa';
        if (!w.klasaNosnosci_korpus) w.klasaNosnosci_korpus = 'D400';
        if (!w.klasaNosnosci_zwienczenie) w.klasaNosnosci_zwienczenie = 'D400';
        if (!Array.isArray(w.config)) w.config = [];
        if (!Array.isArray(w.przejscia)) w.przejscia = [];
        if (w.uwagi == null) w.uwagi = '';
        else if (typeof w.uwagi !== 'string') w.uwagi = String(w.uwagi);
    });
    return wellsArr;
}

/* ===== Rejestracja globali ===== */
window.getWellRowStyle = getWellRowStyle;
window.getOfferColumnsCount = getOfferColumnsCount;
window.getWellErrorCell = getWellErrorCell;
window.getDiscountStr = getDiscountStr;
window.migrateWellData = migrateWellData;
