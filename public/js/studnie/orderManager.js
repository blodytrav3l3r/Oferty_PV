// @ts-check

void window.escapeHtml; // transitive dep: setupParamTiles/updateParamTilesUI (wellUI.js) use escapeHtml

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});
