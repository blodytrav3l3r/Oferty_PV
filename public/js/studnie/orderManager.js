// @ts-check

void window.escapeHtml; // transitive dep: setupParamTiles/updateParamTilesUI (wellUI.js) use escapeHtml

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        if (typeof pzGuard.initPzStableIdFlag === 'function') {
            pzGuard.initPzStableIdFlag();
        }
        // loadProductionOrders() woła appStudnie.js (loadDataInBackground, oba tryby) —
        // tu duplikowało audyt pzAudit zanim wells[] zdążyły się wczytać (fałszywe mismatch).
    }, 500);
});
