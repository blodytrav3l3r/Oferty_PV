// @ts-check
/* ===== WYBÓR STUDNI DO ZAMÓWIENIA ===== */

// Wspólny wzorzec toggle+count w shared/orderSelectionController.js (TASK-046)
const _wellSelectionController = createOrderSelectionController({
    checkboxSelector: '.well-order-checkbox',
    selectAllId: 'select-all-wells-for-order'
});

function toggleAllWellsForOrder(checked) {
    _wellSelectionController.toggleAll(checked);
}

function updateOrderSelectionCount() {
    _wellSelectionController.updateCount();
}

window.toggleAllWellsForOrder = toggleAllWellsForOrder;
window.updateOrderSelectionCount = updateOrderSelectionCount;
