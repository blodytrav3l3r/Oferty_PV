// @ts-check
/* ===== Extracted to actionsConfigDrag.js, actionsConfigRender.js, actionsTiles.js, actionsCrud.js, actionsDrag.js, actionsElevation.js ===== */

/* ===== Resztówka — odświeżanie modala zleceń ===== */

/* ===== ODŚWIEŻANIE MODALA ZLECEŃ ===== */
// Współdzielony lot: równoległe refreshe (blur-save + quick-edit switch)
// czekałyby na siebie i każdy przebudowywał formularz — ostatni wygrywa
// i niszczy świeży input. Jeden lot = jeden rebuild.
window.refreshZleceniaModalIfActive = function () {
    if (window.__zlRefreshInFlight) return window.__zlRefreshInFlight;
    window.__zlRefreshInFlight = (async () => {
        try {
            await refreshZleceniaModalInner();
        } finally {
            window.__zlRefreshInFlight = null;
        }
    })();
    return window.__zlRefreshInFlight;
};

async function refreshZleceniaModalInner() {
    const zlModal = document.getElementById('zlecenia-modal');
    if (
        zlModal &&
        zlModal.classList.contains('active') &&
        typeof zleceniaElementsList !== 'undefined'
    ) {
        let oldWellIdx = -1;
        let oldElIdx = -1;
        let oldWellId = null;
        let oldElemKey = null;

        if (typeof zleceniaSelectedIdx !== 'undefined' && zleceniaSelectedIdx >= 0) {
            const oldEl = zleceniaElementsList[zleceniaSelectedIdx];
            if (oldEl) {
                oldWellIdx = oldEl.wellIndex;
                oldElIdx = oldEl.elementIndex;
                oldWellId = oldEl.well ? oldEl.well.id : null;
                try {
                    oldElemKey =
                        (oldEl.configItem && oldEl.configItem._elemId) ||
                        (oldEl.well &&
                            oldEl.well.config &&
                            oldEl.well.config[oldEl.elementIndex] &&
                            oldEl.well.config[oldEl.elementIndex]._elemId) ||
                        null;
                } catch (_e) {
                    oldElemKey = null;
                }
            }
        }

        // Zawsze zbuduj od nowa listę elementów
        if (typeof buildZleceniaWellList === 'function') {
            buildZleceniaWellList();

            // Znajdź na nowo index — najpierw po stabilnym _elemId (solver może
            // przebudować config i przesunąć elementIndex; numer PZ musi zostać).
            if (oldWellIdx !== -1 || oldElemKey) {
                let fallbackIdx = -1;
                let foundExact = -1;
                let foundByKey = -1;
                for (let i = 0; i < zleceniaElementsList.length; i++) {
                    const el = zleceniaElementsList[i];
                    if (el.wellIndex === oldWellIdx) {
                        fallbackIdx = i;
                        if (el.elementIndex === oldElIdx) {
                            foundExact = i;
                            break;
                        }
                    }
                    if (
                        foundByKey === -1 &&
                        oldElemKey &&
                        el.configItem &&
                        el.configItem._elemId === oldElemKey &&
                        (oldWellId == null || (el.well && String(el.well.id) === String(oldWellId)))
                    ) {
                        foundByKey = i;
                    }
                }
                zleceniaSelectedIdx =
                    foundByKey !== -1 ? foundByKey : foundExact !== -1 ? foundExact : fallbackIdx;
            }
        }

        if (
            typeof populateZleceniaForm === 'function' &&
            typeof zleceniaSelectedIdx !== 'undefined' &&
            zleceniaSelectedIdx >= 0
        ) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el) {
                if (typeof ensurePzDetailForElement === 'function')
                    await ensurePzDetailForElement(el);
                populateZleceniaForm(el);
            }
        }
    }
}
