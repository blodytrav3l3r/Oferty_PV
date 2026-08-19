// @ts-check
/* ===== SELEKCJA POZYCJI/STUDNI DO ZAMÓWIENIA (WSPÓLNY WZORZEC) =====
   TASK-046 (PHASE-11): toggleAll + updateOrderSelectionCount z
   rury/offerOrderSelection.js i studnie/offerOrderSelection.js.
   Różnice domenowe konfigurowane przez config. */

function createOrderSelectionController(config) {
    const scopeSelector = config.scopeSelector || null;
    const checkboxSelector = config.checkboxSelector;
    const selectAllId = config.selectAllId;

    function getScope() {
        if (!scopeSelector) return document;
        return document.querySelector(scopeSelector) || null;
    }

    function toggleAll(checked) {
        const scope = getScope();
        if (!scope) return;
        scope.querySelectorAll(checkboxSelector).forEach((cb) => {
            if (!cb.disabled) cb.checked = checked;
        });
        updateCount();
    }

    function updateCount() {
        const scope = getScope();
        if (!scope) return;
        const checkboxes = scope.querySelectorAll(checkboxSelector);
        const total = checkboxes.length;
        const checked = scope.querySelectorAll(checkboxSelector + ':checked').length;
        const selectAll = document.getElementById(selectAllId);
        if (selectAll) {
            selectAll.checked = total > 0 && checked === total;
            selectAll.indeterminate = checked > 0 && checked < total;
        }
    }

    return { toggleAll, updateCount };
}

window.createOrderSelectionController = createOrderSelectionController;
