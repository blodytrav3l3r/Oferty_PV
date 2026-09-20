// @ts-check
/* ===== CRUD dla przejść ===== */

function movePrzejscie(index, direction) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.przejscia.length) return;
    const temp = well.przejscia[index];
    well.przejscia[index] = well.przejscia[newIndex];
    well.przejscia[newIndex] = temp;
    renderWellPrzejscia();
    updateSummary();
    window.refreshZleceniaModalIfActive();
}

function removePrzejscieFromWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    if (well.przejscia) {
        well.przejscia.splice(index, 1);
        if (typeof refreshActiveWell === 'function') refreshActiveWell();
        else refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
    }
}

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p =
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(item.productId)
            : studnieProducts.find((pr) => pr.id === item.productId);

    editPrzejscieIdx = index;
    try {
        editPrzejscieId = item.id || null;
    } catch (_e) {
        editPrzejscieId = null;
    }
    editPrzejscieState = {
        type: p ? p.category : null,
        dnId: item.productId,
        rzedna: item.rzednaWlaczenia,
        angle: item.angle,

        spadekKineta: item.spadekKineta || '',
        spadekMufa: item.spadekMufa || ''
    };
    renderWellPrzejscia();
}

function savePrzejscieEdit(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    syncEditState(); // zapisz wartości z DOM do stanu na wszelki wypadek

    if (!editPrzejscieState.dnId) {
        showToast('Wybierz typ i średnicę przejścia', 'error');
        return;
    }

    const newProductId = editPrzejscieState.dnId;
    const rzedna = editPrzejscieState.rzedna;
    const angle = editPrzejscieState.angle || 0;

    const spadekKineta = editPrzejscieState.spadekKineta;
    const spadekMufa = editPrzejscieState.spadekMufa;

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    // Clamp rzędnej do zakresu dno–właz (jak inlineFinish/saveQuickEdit).
    let rzednaVal = null;
    if (rzedna !== null && rzedna !== undefined && rzedna !== '') {
        const parsed = parseCalcExpression(rzedna);
        if (parsed !== null && !isNaN(parsed)) {
            rzednaVal = parsed;
            if (
                typeof clampRzednaWlaczenia === 'function' &&
                typeof announceRzednaClamp === 'function'
            ) {
                const _c = clampRzednaWlaczenia(parsed, well);
                announceRzednaClamp(_c);
                rzednaVal = _c.value;
            } else if (typeof clampRzednaWlaczenia === 'function') {
                const _c = clampRzednaWlaczenia(parsed, well);
                if (_c.clampedLow) showToast('Rzędna nie może być niższa niż rzędna dna!', 'error');
                if (_c.clampedHigh)
                    showToast('Rzędna nie może być wyższa niż rzędna włazu!', 'error');
                rzednaVal = _c.value;
            }
            rzednaVal = rzednaVal.toFixed(3);
        }
    }

    well.przejscia[index] = {
        id: well.przejscia[index].id,
        productId: newProductId,
        rzednaWlaczenia: rzednaVal,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,
        flowType: well.przejscia[index].flowType,
        flowTypeManual: well.przejscia[index].flowTypeManual,

        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    };
    if (!well.przejscia[index].id && typeof ensurePrzejsciaIds === 'function') {
        ensurePrzejsciaIds(well.przejscia);
    }

    editPrzejscieIdx = -1;
    try {
        editPrzejscieId = null;
    } catch (_e) {}
    if (typeof refreshActiveWell === 'function') refreshActiveWell();
    else refreshAll();
    autoSelectComponents(true);
    showToast('Zapisano zmiany przejścia', 'success');
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function cancelPrzejscieEdit() {
    editPrzejscieIdx = -1;
    try {
        editPrzejscieId = null;
    } catch (_e) {}
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

window.editPrzejscie = editPrzejscie;
window.savePrzejscieEdit = savePrzejscieEdit;
window.cancelPrzejscieEdit = cancelPrzejscieEdit;

/* ===== Rejestracja globali ===== */
window.movePrzejscie = movePrzejscie;
window.removePrzejscieFromWell = removePrzejscieFromWell;
