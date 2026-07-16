// @ts-check
/* ===== Extracted to actionsConfigDrag.js, actionsConfigRender.js, actionsTiles.js, actionsCrud.js, actionsDrag.js, actionsElevation.js ===== */

/* ===== Resztówka — odświeżanie modala zleceń ===== */

/* ===== ODŚWIEŻANIE MODALA ZLECEŃ ===== */
window.refreshZleceniaModalIfActive = function () {
    const zlModal = document.getElementById('zlecenia-modal');
    if (
        zlModal &&
        zlModal.classList.contains('active') &&
        typeof zleceniaElementsList !== 'undefined'
    ) {
        let oldWellIdx = -1;
        let oldElIdx = -1;

        if (typeof zleceniaSelectedIdx !== 'undefined' && zleceniaSelectedIdx >= 0) {
            const oldEl = zleceniaElementsList[zleceniaSelectedIdx];
            if (oldEl) {
                oldWellIdx = oldEl.wellIndex;
                oldElIdx = oldEl.elementIndex;
            }
        }

        // Zawsze zbuduj od nowa listę elementów
        if (typeof buildZleceniaWellList === 'function') {
            buildZleceniaWellList();

            // Znajdź na nowo index
            if (oldWellIdx !== -1) {
                let fallbackIdx = -1;
                let foundExact = -1;
                for (let i = 0; i < zleceniaElementsList.length; i++) {
                    const el = zleceniaElementsList[i];
                    if (el.wellIndex === oldWellIdx) {
                        fallbackIdx = i;
                        if (el.elementIndex === oldElIdx) {
                            foundExact = i;
                            break;
                        }
                    }
                }
                zleceniaSelectedIdx = foundExact !== -1 ? foundExact : fallbackIdx;
            }
        }

        if (
            typeof populateZleceniaForm === 'function' &&
            typeof zleceniaSelectedIdx !== 'undefined' &&
            zleceniaSelectedIdx >= 0
        ) {
            const el = zleceniaElementsList[zleceniaSelectedIdx];
            if (el) {
                populateZleceniaForm(el);
            }
        }
    }
};
