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
        refreshAll();
        autoSelectComponents(true);
        window.refreshZleceniaModalIfActive();
    }
}

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p = studnieProducts.find((pr) => pr.id === item.productId);

    editPrzejscieIdx = index;
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

    well.przejscia[index] = {
        productId: newProductId,
        rzednaWlaczenia:
            rzedna !== null && rzedna !== undefined && rzedna !== ''
                ? parseCalcExpression(rzedna) !== null
                    ? parseCalcExpression(rzedna).toFixed(3)
                    : null
                : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    };

    editPrzejscieIdx = -1;
    refreshAll();
    autoSelectComponents(true);
    showToast('Zapisano zmiany przejścia', 'success');
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

function cancelPrzejscieEdit() {
    editPrzejscieIdx = -1;
    renderWellPrzejscia();
    window.refreshZleceniaModalIfActive();
}

window.editPrzejscie = editPrzejscie;
window.savePrzejscieEdit = savePrzejscieEdit;
window.cancelPrzejscieEdit = cancelPrzejscieEdit;
