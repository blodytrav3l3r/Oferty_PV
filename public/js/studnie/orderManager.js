// @ts-check

void window.escapeHtml; // transitive dep: setupParamTiles/updateParamTilesUI (wellUI.js) use escapeHtml

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        if (typeof pzGuard.initPzStableIdFlag === 'function') {
            pzGuard.initPzStableIdFlag();
        }
        loadProductionOrders();
    }, 500);
});
