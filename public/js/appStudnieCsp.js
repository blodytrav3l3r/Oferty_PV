// @ts-check
/* ===== STUDNIE — CSP Action Registration ===== */

function registerCspActions() {
    if (typeof registerCspAction !== 'function') return;
    registerCspAction('logout', appLogout);
    registerCspAction('show-section', {
        handler: function (p) {
            showSection(p.section);
        },
        params: ['section']
    });
    registerCspAction('wizard-nav', {
        handler: function (p) {
            wizardNavStep(Number(p.step));
        },
        params: ['step']
    });
    registerCspAction('wizard-next', wizardNext);
    registerCspAction('wizard-prev', wizardPrev);
    registerCspAction('goto-wizard-step', {
        handler: function (p) {
            goToWizardStep(Number(p.step));
        },
        params: ['step']
    });
    registerCspAction('select-dn', {
        handler: function (p) {
            selectDN(p.dn);
        },
        params: ['dn']
    });
    registerCspAction('input-select', function (t) {
        _cspInputSelect(t);
    });
    registerCspAction('toggle-auto-lock', toggleAutoLock);
    registerCspAction('toggle-redukcja', toggleRedukcja);
    registerCspAction('toggle-psia-buda', togglePsiaBuda);
    registerCspAction('toggle-styczna-1200', toggleStyczna1200);
    registerCspAction('toggle-card', {
        handler: function (p) {
            toggleCard(p.contentId, p.iconId);
        },
        params: ['contentId', 'iconId']
    });
    registerCspAction('switch-builder-tab', {
        handler: function (p) {
            switchBuilderTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('cennik-tab', {
        handler: function (p) {
            selectCennikTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('auto-select-components', function () {
        autoSelectComponents(true);
    });
    registerCspAction('clear-well-config', function () {
        clearWellConfig();
    });
    registerCspAction('copy-karta-budowy', function () {
        copyKartaBudowyFromOrder();
    });
    registerCspAction('remove-well', function () {
        removeCurrentWell();
    });
    registerCspAction('add-custom-przejscie', function () {
        addCustomPrzejscieRow();
    });
    registerCspAction('show-add-studnie-product-modal', function () {
        showAddStudnieProductModal();
    });
    registerCspAction('save-studnie-price-list', function () {
        saveStudniePriceList();
    });
    registerCspAction('export-studnie-excel', function () {
        exportStudnieToExcel();
    });
    registerCspAction('import-studnie-excel', function () {
        document.getElementById('import-studnie-excel').click();
    });
    registerCspAction('apply-global-params', function () {
        applyGlobalParamsToAllWells();
    });
    registerCspAction('save-offer-studnie', function () {
        saveOfferStudnie();
    });
    registerCspAction('save-current-order', function () {
        saveCurrentOrder();
    });
    registerCspAction('handle-print-click', function () {
        handlePrintClick();
    });
    registerCspAction('create-order-from-offer', function () {
        createOrderFromOffer();
    });
    registerCspAction('open-zlecenia-produkcyjne', function () {
        openZleceniaProdukcyjne();
    });
    registerCspAction('add-new-well', {
        handler: function (p) {
            addNewWell(p.dn === 'styczna' ? 'styczna' : Number(p.dn));
        },
        params: ['dn']
    });
    registerCspAction('switch-sidebar-tab', {
        handler: function (p) {
            switchSidebarTab(p.tab);
        },
        params: ['tab']
    });
    registerCspAction('generate-offer-notes', function () {
        generateOfferNotes();
    });
    registerCspAction('open-transport-popup', function () {
        openTransportPopup();
    });
    registerCspAction('open-offer-discounts-popup', function () {
        openOfferDiscountsPopup();
    });
    registerCspAction('show-offer-export-choice', function () {
        showOfferExportChoice();
    });
    registerCspAction('reset-studnie-price-list', function () {
        resetStudniePriceList();
    });
    registerCspAction('close-offer-discounts-popup', function () {
        closeOfferDiscountsPopup();
    });
    registerCspAction('handle-offer-discounts-cancel', function () {
        handleOfferDiscountsCancel();
    });
    registerCspAction('handle-offer-discounts-save', function () {
        handleOfferDiscountsSave();
    });
    registerCspAction('handle-offer-transport-cancel', function () {
        handleOfferTransportCancel();
    });
    registerCspAction('handle-offer-transport-save', function () {
        handleOfferTransportSave();
    });
    registerCspAction('toggle-transport-mode', function () {
        toggleTransportMode();
    });
    registerCspAction('open-bulk-order-sequence-popup', function () {
        openBulkOrderSequencePopup();
    });
    registerCspAction('accept-production-order', function () {
        acceptProductionOrder();
    });
    registerCspAction('revoke-production-order', function () {
        revokeProductionOrder();
    });
    registerCspAction('delete-selected-production-order', function () {
        deleteSelectedProductionOrder();
    });
    registerCspAction('save-production-order', function () {
        saveProductionOrder();
    });
    registerCspAction('print-zlecenie', function () {
        printZlecenie();
    });
    registerCspAction('print-etykieta', function () {
        printEtykieta();
    });
    registerCspAction('close-zlecenia-modal', function () {
        closeZleceniaModal();
    });
    registerCspAction('set-zlecenia-filter', {
        handler: function (p) {
            setZleceniaFilter(p.filter);
        },
        params: ['filter']
    });
    registerCspAction('open-excel-table-modal', function () {
        openExcelTableModal();
    });
    registerCspAction('open-global-recalc-modal', function () {
        openGlobalRecalcModal();
    });
    registerCspAction('open-transition-manager-modal', function () {
        openTransitionManagerModal();
    });
    registerCspAction('sanitize-numeric', function (t) {
        t.value = t.value.replace(/[^0-9]/g, '');
    });
    registerCspAction('validate-wizard-step2', function () {
        validateWizardStep2();
    });
    registerCspAction('update-param-input', function (t) {
        var param = t.dataset.param;
        if (param) updateParamInput(param, t.value);
    });
    registerCspAction('handle-przejscia-zamowione-change', function (t) {
        handlePrzejsciaZamowioneChange(t);
    });
    registerCspAction('import-studnie-from-excel', function (t) {
        importStudnieFromExcel(t);
    });
    registerCspAction('render-wells-list', function () {
        renderWellsList();
    });
    registerCspAction('toggle-inne-display', function (t) {
        var id = t.dataset.inneId || t.closest('[data-inne-id]')?.dataset.inneId;
        if (id) toggleInneDisplay(id);
    });
    registerCspAction('sync-transport-from-modal', function () {
        if (typeof syncTransportFromModal === 'function') syncTransportFromModal();
    });
    registerCspAction('filter-zlecenia-list', function () {
        filterZleceniaList();
    });
    registerCspAction('redukcja-min-change', function (t) {
        onRedukcjaMinChange(t.value);
    });
    registerCspAction('drag-drop-well', function (t, p, ev) {
        if (ev.type === 'dragover') {
            ev.preventDefault();
            allowDropWellComponent(ev);
        } else if (ev.type === 'dragleave') dragLeaveWellComponent(ev);
        else if (ev.type === 'drop') {
            ev.preventDefault();
            dropWellComponent(ev);
        }
    });
    registerCspAction('show-clients-db', function () {
        showClientsDb();
    });
    registerCspAction('save-client-to-db', function () {
        saveClientToDb();
    });
    registerCspAction('change-offer-user', function () {
        changeOfferUser();
    });
}
