// @ts-check
/* ===== WYBÓR STUDNI DO ZAMÓWIENIA ===== */

function toggleAllWellsForOrder(checked) {
    const checkboxes = document.querySelectorAll('.well-order-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = checked;
    });
    updateOrderSelectionCount();
}

function updateOrderSelectionCount() {
    const count = document.querySelectorAll('.well-order-checkbox:checked').length;
    const total = document.querySelectorAll('.well-order-checkbox').length;

    const headerCheckbox = document.getElementById('select-all-wells-for-order');
    if (headerCheckbox) {
        headerCheckbox.checked = count > 0 && count === total;
        headerCheckbox.indeterminate = count > 0 && count < total;
    }
}

window.toggleAllWellsForOrder = toggleAllWellsForOrder;
window.updateOrderSelectionCount = updateOrderSelectionCount;
