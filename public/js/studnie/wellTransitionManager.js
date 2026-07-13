// @ts-check
/* ===== wellTransitionManager.js — menedżer przejść (barrel) ===== */
/* Submoduły: wellTransitionManagerRender.js, wellTransitionManagerModal.js */

let tmSelectedTransitions = new Set();
let tmCurrentFilters = { sourceMaterial: [], dn: [], search: '' };
let tmWellData = [];

window.tmRefreshWellData = function () {
    tmWellData = [];
    for (let i = 0; i < wells.length; i++) {
        const well = wells[i];

        let trList = [];
        if (well.przejscia && well.przejscia.length > 0) {
            trList = well.przejscia.map((tr, trIdx) => {
                const p = studnieProducts.find((prod) => prod.id === tr.productId);
                return {
                    trIndex: trIdx,
                    angle: tr.angle || 0,
                    rzedna:
                        tr.rzednaWlaczenia !== undefined && tr.rzednaWlaczenia !== null
                            ? tr.rzednaWlaczenia
                            : well.rzednaDna,
                    productId: tr.productId,
                    material: p ? p.category : 'Nieznany',
                    dnRaw: p ? p.dn : '?',
                    flowType: tr.flowType || FLOW_TYPES.WLOT
                };
            });
        }

        let wellPrice = 0;
        if (typeof calcWellStats === 'function') {
            const stats = calcWellStats(well);
            let transportCost = 0;
            if (typeof calculateOfferTotals === 'function') {
                const totals = calculateOfferTotals();
                if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
                    transportCost =
                        totals.totalTransportCost * (stats.weight / totals.globalWeight);
                }
            }
            wellPrice = stats.price + transportCost;
        }

        tmWellData.push({
            wellIndex: i,
            uid: `well_${i}`,
            wellName: well.nazwaWlasna || well.name || `Studnia ${i + 1}`,
            wellDn: well.dn,
            rzednaDna: well.rzednaDna || '0.000',
            price: wellPrice,
            transitions: trList
        });
    }
};

const tmSortState = { column: null, asc: true };
let tmTargetCat = '';

window.tmSortBy = function (column) {
    if (tmSortState.column === column) {
        tmSortState.asc = !tmSortState.asc;
    } else {
        tmSortState.column = column;
        tmSortState.asc = true;
    }
    tmRenderTable();
};

window.tmApplyFilters = function () {
    tmCurrentFilters.search = (
        document.getElementById('tm-filter-search')?.value || ''
    ).toLowerCase();
    tmRenderTable();
};

window.tmSelectFilterMaterial = function (val) {
    if (val === '') {
        tmCurrentFilters.sourceMaterial = [];
    } else {
        const idx = tmCurrentFilters.sourceMaterial.indexOf(val);
        if (idx >= 0) tmCurrentFilters.sourceMaterial.splice(idx, 1);
        else tmCurrentFilters.sourceMaterial.push(val);
    }
    tmHighlightTilesMulti('tm-filter-material-tiles', tmCurrentFilters.sourceMaterial);
    tmApplyFilters();
};

window.tmSelectFilterDn = function (val) {
    if (val === '') {
        tmCurrentFilters.dn = [];
    } else {
        const idx = tmCurrentFilters.dn.indexOf(val);
        if (idx >= 0) tmCurrentFilters.dn.splice(idx, 1);
        else tmCurrentFilters.dn.push(val);
    }
    tmHighlightTilesMulti('tm-filter-dn-tiles', tmCurrentFilters.dn);
    tmApplyFilters();
};

window.tmSelectTargetCat = function (val) {
    tmTargetCat = val;
    tmHighlightTiles('tm-target-cat-tiles', val);
    tmUpdatePreview();
};

window.tmToggleWell = function (wellIdx, isChecked) {
    if (isWellLocked(wellIdx)) return;
    const wData = tmWellData.find((w) => w.wellIndex === wellIdx);
    if (!wData) return;
    wData.transitions.forEach((tr) => {
        const key = `${wellIdx}:${tr.trIndex}`;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });
    tmRenderTable();
};

window.tmToggleTransition = function (key, isChecked) {
    if (isChecked) tmSelectedTransitions.add(key);
    else tmSelectedTransitions.delete(key);
    tmRenderTable();
};

window.tmToggleSelectAll = function () {
    const isChecked = document.getElementById('tm-select-all').checked;
    const visibleCbs = document.querySelectorAll('.tm-row-cb');

    visibleCbs.forEach((cb) => {
        const key = cb.value;
        const wellIdx = parseInt(key.split(':')[0], 10);
        if (isChecked && isWellLocked(wellIdx)) return;
        if (isChecked) tmSelectedTransitions.add(key);
        else tmSelectedTransitions.delete(key);
    });

    tmRenderTable();
};

window.activatePreviewPanel = function () {
    setTimeout(tmUpdatePreview, 100);
};

window.tmApplyChanges = async function () {
    if (tmSelectedTransitions.size === 0) {
        showToast('Zaznacz co najmniej jedno przejście', 'warning');
        return;
    }

    const targetCat = tmTargetCat;

    if (!targetCat) {
        showToast('Wybierz docelową kategorię przejść', 'error');
        return;
    }

    let replacedCount = 0;
    const skippedDetails = [];
    const skippedLocked = new Set();
    const modifiedWellsIndices = new Set();

    tmSelectedTransitions.forEach((key) => {
        const [wellIdxStr, trIdxStr] = key.split(':');
        const wellIdx = parseInt(wellIdxStr, 10);
        const trIdx = parseInt(trIdxStr, 10);
        const well = wells[wellIdx];

        if (isWellLocked(wellIdx)) {
            skippedLocked.add(wellIdx);
            return;
        }

        if (!well || !well.przejscia || !well.przejscia[trIdx]) return;

        const tr = well.przejscia[trIdx];
        const p = studnieProducts.find((prod) => prod.id === tr.productId);
        if (!p) return;
        if (p.category === targetCat) return;

        const replacement = studnieProducts.find(
            (pr) =>
                pr.componentType === 'przejscie' &&
                pr.category === targetCat &&
                pr.active !== 0 &&
                pr.dn === p.dn
        );

        if (replacement) {
            well.przejscia[trIdx].productId = replacement.id;
            replacedCount++;
            modifiedWellsIndices.add(wellIdx);
        } else {
            skippedDetails.push({
                wellName: well.nazwaWlasna || well.name || `Studnia ${wellIdx + 1}`,
                material: p.category,
                dn: p.dn,
                targetCat: targetCat
            });
        }
    });

    if (skippedLocked.size > 0) {
        showToast(
            `Pominięto ${skippedLocked.size} zablokowaną studnię/studnie (zamówienie/zlecenie).`,
            'warning'
        );
    }

    if (replacedCount === 0) {
        if (skippedLocked.size > 0) {
        } else if (skippedDetails.length > 0) {
            showSkippedPopup(skippedDetails, targetCat);
        } else {
            showToast('Nie znaleziono pasujących przejść do zamiany.', 'info');
        }
        return;
    }

    showToast(`Trwa przeliczanie zmodyfikowanych studni (${modifiedWellsIndices.size})...`, 'info');

    for (const wellIdx of modifiedWellsIndices) {
        const originalIndex = currentWellIndex;
        currentWellIndex = wellIdx;
        await autoSelectComponents(true);
        currentWellIndex = originalIndex;
    }

    refreshAll();

    if (skippedDetails.length > 0) {
        showSkippedPopup(skippedDetails, targetCat);
    }

    const msg = `Zakończono. Zamieniono ${replacedCount} przejść w ${modifiedWellsIndices.size} studniach.`;
    showToast(msg, 'success');

    tmSelectedTransitions.clear();
    tmRefreshWellData();

    tmRenderTable();
};
