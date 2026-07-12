// @ts-check
/**
 * Logic for Kartoteka Zleceń Produkcyjnych — BARREL
 * Kod przeniesiony do podmodułów:
 *   zleceniaCore.js        — state, helpers, UI, CRUD
 *   zleceniaPrint.js       — print template builders
 *   zleceniaPrintActions.js — print action functions
 */

window.AppZlecenia = {
    init() {
        setupSearch();
        return loadOrders();
    },
    loadOrders,
    stopAutoRefresh,
    editOrder,
    deleteOrder,
    setFilter,
    toggleSelect,
    toggleSelectAll,
    printSingleZlecenie,
    printSingleEtykieta,
    printBatchZlecenia,
    printBatchEtykiety
};

if (typeof registerCspAction === 'function') {
    registerCspAction('zleceniaSetFilter', {
        handler: function (p) {
            AppZlecenia.setFilter(p.filter);
        },
        params: ['filter']
    });
    registerCspAction('zleceniaLoadOrders', function () {
        AppZlecenia.loadOrders();
    });
    registerCspAction('zleceniaPrintBatchZlecenia', function () {
        AppZlecenia.printBatchZlecenia();
    });
    registerCspAction('zleceniaPrintBatchEtykiety', function () {
        AppZlecenia.printBatchEtykiety();
    });
    registerCspAction('zleceniaToggleSelectAll', function (t) {
        AppZlecenia.toggleSelectAll(t);
    });
    registerCspAction('printSingleZlecenie', {
        handler: function ({ safeId }) {
            AppZlecenia.printSingleZlecenie(safeId);
        },
        params: ['safeId']
    });
    registerCspAction('printSingleEtykieta', {
        handler: function ({ safeId }) {
            AppZlecenia.printSingleEtykieta(safeId);
        },
        params: ['safeId']
    });
    registerCspAction('deleteOrder', {
        handler: function ({ safeId }) {
            AppZlecenia.deleteOrder(safeId);
        },
        params: ['safeId']
    });
    registerCspAction('editProductionOrder', {
        handler: function ({ offerId, wellId, elementIdx, salesOrderId }) {
            AppZlecenia.editOrder(offerId, wellId, elementIdx, salesOrderId);
        },
        params: ['offerId', 'wellId', 'elementIdx', 'salesOrderId']
    });
    registerCspAction('toggleSelectZlecenie', function (t) {
        AppZlecenia.toggleSelect(t.dataset.id, t);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    AppZlecenia.init();
});
