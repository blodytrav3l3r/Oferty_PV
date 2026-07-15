// @ts-check
/* ===== HELPERY OFERTY (STUDNIE) ===== */

function getWellRowStyle(change, isOrdered) {
    if (change) {
        return change.type === 'added'
            ? 'border-left:3px solid var(--success-hover); background:rgba(var(--success-rgb),0.05);'
            : 'border-left:3px solid var(--danger); background:rgba(var(--danger-rgb),0.05);';
    }
    return isOrdered
        ? 'border-left:3px solid rgba(var(--accent-rgb),0.5); background:rgba(var(--accent-rgb),0.04);'
        : '';
}

function getDiscountStr(p, disc) {
    const isDen =
        p.componentType === 'dennica' ||
        p.componentType === 'kineta' ||
        p.componentType === 'styczna';
    const val = isDen ? disc.dennica : disc.nadbudowa;
    return val > 0
        ? ` <span style="font-size:0.6rem; color:var(--success); margin-left:0.3rem;">(-${val}%)</span>`
        : '';
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
    });
    return wellsArr;
}

function normalizeValidityValue(val) {
    if (!val) return '7 dni';
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) return trimmed + ' dni';
    return trimmed;
}
