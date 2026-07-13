// @ts-check
/* ===== OFFER PRINT MANAGER — Modal wyboru wydruku ===== */

window.handlePrintClick = function () {
    window.showUniversalPrintModal();
};

window.showOfferExportChoice = function () {
    window.showUniversalPrintModal();
};

window.showUniversalPrintModal = function (offerId, orderId, relatedOrders) {
    let finalOfferId = offerId;
    let finalOrderId = orderId;

    if (!finalOfferId && !finalOrderId) {
        if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.orderId) {
            finalOrderId = orderEditMode.orderId;
            finalOfferId =
                (orderEditMode.order && orderEditMode.order.offerId) ||
                orderEditMode.offerId ||
                (typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : '');
        } else if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
            finalOfferId = editingOfferIdStudnie;
            if (typeof getOrdersForOffer === 'function') {
                const orders = getOrdersForOffer(finalOfferId);
                if (orders && orders.length > 0) {
                    finalOrderId = orders[0].id;
                }
            }
        }
    }

    if (!finalOfferId && !finalOrderId) {
        if (typeof showToast === 'function')
            showToast('Brak aktywnego dokumentu do wydruku', 'error');
        return;
    }

    let orders = [];
    if (Array.isArray(relatedOrders) && relatedOrders.length > 0) {
        orders = relatedOrders;
    } else {
        if (finalOfferId && typeof getOrdersForOffer === 'function') {
            orders = getOrdersForOffer(finalOfferId);
        }
        if (finalOrderId && orders.length === 0) {
            if (typeof ordersStudnie !== 'undefined') {
                const currentOrder = ordersStudnie.find((o) => o.id === finalOrderId);
                if (currentOrder) orders = [currentOrder];
            }
        }
    }

    const config = {
        modalTitle: 'Wydruk Dokumentów',
        offerSection: finalOfferId
            ? {
                  id: finalOfferId,
                  actionPdf: 'exportOfferDirect_action',
                  actionDocx: 'exportOfferDirect_action',
                  title: 'Wydruk Oferty',
                  description: 'Wybierz format eksportu kalkulacji ofertowej:'
              }
            : null,
        ordersSection:
            orders.length > 0
                ? {
                      orders: orders,
                      actionPdf: 'exportOrderDirect_action',
                      actionDocx: 'exportOrderDirect_action',
                      title: 'Wydruk Zamówienia',
                      description: 'Wybierz zamówienie i format eksportu:'
                  }
                : null,
        kartaSection:
            orders.length > 0
                ? {
                      orders: orders,
                      actionPdf: 'exportKartaDirect_action',
                      actionDocx: 'exportKartaDirect_action',
                      title: 'Wydruk Karty Budowy',
                      description: 'Wybierz zamówienie i format Karty Budowy:'
                  }
                : null
    };

    if (typeof window.__upmHelperShow === 'function') {
        window.__upmHelperShow(config);
    } else if (typeof showToast === 'function') {
        showToast('Helper printModal.js nie załadowany', 'error');
    }
};
