// @ts-check
/* ===== Inline helpers dla przejść ===== */

window.inlineSetType = (t, containerId = '') => {
    inlinePrzejsciaState.type = t;
    inlinePrzejsciaState.dnId = null;
    renderInlinePrzejsciaApp(containerId);
};

window.inlineSetDN = (id, containerId = '') => {
    inlinePrzejsciaState.dnId = id;
    renderInlinePrzejsciaApp(containerId);
};

window.editInlineSetType = function (type) {
    syncEditState();
    editPrzejscieState.type = type;
    const przejsciaProducts = studnieProducts.filter(
        (pr) => pr.componentType === 'przejscie' && pr.active !== 0
    );
    const dns = [...przejsciaProducts.filter((p) => p.category === type)].sort(
        (a, b) => a.dn - b.dn
    );
    if (dns.length > 0) editPrzejscieState.dnId = dns[0].id;
    else editPrzejscieState.dnId = null;
    renderWellPrzejscia();
};

window.editInlineSetDN = function (dnId) {
    syncEditState();
    editPrzejscieState.dnId = dnId;
    renderWellPrzejscia();
};

/* ===== INLINE HELPERS DLA PRZEJŚĆ ===== */

window.inlineUpdateAngles = (contextId = 'main') => {
    const el = document.getElementById(`inl-angle-${contextId}`);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const execEl = document.getElementById(`inl-exec-${contextId}`);
    const gonyEl = document.getElementById(`inl-gony-${contextId}`);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
};

window.inlineFinish = (contextId = 'main', containerId = '') => {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const id = inlinePrzejsciaState.dnId;
    if (!id) return;

    const rzednaEl = document.getElementById(`inl-rzedna-${contextId}`);
    const angleEl = document.getElementById(`inl-angle-${contextId}`);

    const spadekKinetaEl = document.getElementById(`inl-spadek-kineta-${contextId}`);
    const spadekMufaEl = document.getElementById(`inl-spadek-mufa-${contextId}`);

    const rzedna = rzednaEl ? rzednaEl.value : '';
    const angle = angleEl ? parseFloat(angleEl.value) || 0 : 0;

    const spadekKineta = spadekKinetaEl ? spadekKinetaEl.value.trim() : '';
    const spadekMufa = spadekMufaEl ? spadekMufaEl.value.trim() : '';

    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    if (!well.przejscia) well.przejscia = [];

    const isFirst = well.przejscia ? well.przejscia.length === 0 : true;
    const flowType = isFirst && angle === 0 ? FLOW_TYPES.WYLOT : FLOW_TYPES.WLOT;

    well.przejscia.push({
        id: 'prz-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        productId: id,
        rzednaWlaczenia:
            rzedna !== null && rzedna !== undefined && rzedna !== ''
                ? parseCalcExpression(rzedna) !== null
                    ? parseCalcExpression(rzedna).toFixed(3)
                    : null
                : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,

        flowType: flowType,
        spadekKineta: spadekKineta ? Math.round(parseFloat(spadekKineta)) : null,
        spadekMufa: spadekMufa ? Math.round(parseFloat(spadekMufa)) : null
    });

    refreshAll();
    autoSelectComponents(true);
    showToast('Dodano przejście szczelne', 'success');
    renderInlinePrzejsciaApp(containerId);
    window.refreshZleceniaModalIfActive();
};
