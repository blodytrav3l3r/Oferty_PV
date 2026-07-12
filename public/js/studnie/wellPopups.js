// @ts-check
/* ===== wellPopups.js — barrel: style boot + CSP action registrations ===== */
/* Moduły: wellZakonczenieRedukcja, wellStycznaPopup, wellRecalcModal, wellTransitionManager */

/* IIFE — wstrzyknięcie stylów dla popupów */
(function () {
    const s = document.createElement('style');
    s.textContent =
        '.wp-hover-btn{transition:all 0.12s}.wp-hover-btn:hover{background:var(--hb)!important;border-color:var(--hbc)!important;color:var(--hc)!important;transform:var(--ht,none)!important;box-shadow:var(--hs,none)!important}.wp-hover-border{transition:border-color 0.12s}.wp-hover-border:hover{border-color:var(--hbc)!important}.wp-hover-bg{transition:background 0.12s}.wp-hover-bg:hover{background:var(--hb)!important}[data-wp-active=\"false\"]:hover{border-color:rgba(99,102,241,0.3)!important}[data-wp-auto=\"false\"]:hover{border-color:rgba(99,102,241,0.3)!important}[data-wp-locked=\"false\"]:hover{border-color:rgba(16,185,129,0.35)!important;transform:translateY(-2px)!important;box-shadow:0 6px 20px rgba(0,0,0,0.3)!important}#tm-filter-search:focus{border-color:rgba(16,185,129,0.4)!important}';
    document.head.appendChild(s);
})();

/* CSP Actions registrations */
if (typeof registerCspAction === 'function') {
    registerCspAction('selectRedukcjaChoice', {
        handler: function ({ dn }) {
            selectRedukcjaChoice(dn ? parseInt(dn, 10) : null);
        },
        params: ['dn']
    });
    registerCspAction('tmSortBy', {
        handler: function ({ column }) {
            window.tmSortBy(column);
        },
        params: ['column']
    });
    registerCspAction('tmSelectFilterMaterial', {
        handler: function ({ filterVal }) {
            window.tmSelectFilterMaterial(filterVal);
        },
        params: ['filterVal']
    });
    registerCspAction('tmSelectFilterDn', {
        handler: function ({ filterVal }) {
            window.tmSelectFilterDn(filterVal);
        },
        params: ['filterVal']
    });
    registerCspAction('tmSelectTargetCat', {
        handler: function ({ category }) {
            window.tmSelectTargetCat(category);
        },
        params: ['category']
    });
    registerCspAction('recalcToggleRed', function (t) {
        window.recalcToggleRed(parseInt(t.dataset.dn, 10));
    });
    registerCspAction('tmApplyFilters', tmApplyFilters);
    registerCspAction('tmToggleSelectAll', tmToggleSelectAll);
    registerCspAction('tmToggleWell', function (t) {
        tmToggleWell(parseInt(t.dataset.wellIndex, 10), t.checked);
    });
    registerCspAction('showKonusPehdResolver', function () {
        window.showKonusPehdResolverModal(currentWellIndex);
    });
    registerCspAction('handleStycznaProductChoice', {
        handler: function ({ productId, mode }) {
            handleStycznaProductChoice(productId, mode);
        },
        params: ['productId', 'mode']
    });
    registerCspAction('resolveKonusPehd', {
        handler: function ({ wellIndex, type }) {
            window.resolveKonusPehd(parseInt(wellIndex, 10), type);
        },
        params: ['wellIndex', 'type']
    });
    registerCspAction('resolveKonusPehdCancel', function () {
        const el = document.getElementById('pehd-konus-resolver');
        if (el) el.remove();
        if (window.konusResolverCallback) window.konusResolverCallback();
    });
    registerCspAction('recalcSelectTop', {
        handler: function ({ dn, id }) {
            window.recalcSelectTop(parseInt(dn, 10), id);
        },
        params: ['dn', 'id']
    });
    registerCspAction('recalcSelectRedTop', {
        handler: function ({ dn, id }) {
            window.recalcSelectRedTop(parseInt(dn, 10), id);
        },
        params: ['dn', 'id']
    });
    registerCspAction('closeGlobalRecalcModal', function () {
        window.closeGlobalRecalcModal();
    });
    registerCspAction('applyGlobalRecalc', function () {
        window.applyGlobalRecalc();
    });
    registerCspAction('closeTransitionManagerModal', function () {
        window.closeTransitionManagerModal();
    });
    registerCspAction('tmApplyChanges', function () {
        window.tmApplyChanges();
    });
    registerCspAction('tmOpenEditTransitionPopup', function (el) {
        window.tmOpenEditTransitionPopup(
            parseInt(el.dataset.wellIdx, 10),
            parseInt(el.dataset.trIdx, 10),
            el
        );
    });
    registerCspAction('tmToggleTransition', {
        handler: function ({ key }, el) {
            window.tmToggleTransition(key, el.checked);
        },
        params: ['key']
    });
    registerCspAction('closeEditPopup', function (el) {
        const popup = el.closest('#tm-edit-popup');
        if (popup) popup.remove();
    });
    registerCspAction('tmEditSelectType', function (el) {
        tmEditSelectType(el, parseInt(el.dataset.wellIdx, 10), parseInt(el.dataset.trIdx, 10));
    });
    registerCspAction('tmEditSelectDN', function (el) {
        tmEditSelectDN(el, parseInt(el.dataset.wellIdx, 10), parseInt(el.dataset.trIdx, 10));
    });
    registerCspAction('tmEditApply', {
        handler: function ({ wellIdx, trIdx }) {
            tmEditApply(parseInt(wellIdx, 10), parseInt(trIdx, 10));
        },
        params: ['wellIdx', 'trIdx']
    });
    registerCspAction('closeModalActivatePreview', function () {
        closeModal();
        if (window.activatePreviewPanel) window.activatePreviewPanel();
    });
}
