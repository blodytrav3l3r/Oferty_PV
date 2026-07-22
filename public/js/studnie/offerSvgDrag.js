// @ts-check
/* --- Pomocnik Logiki Diagramu SVG --- */
window.decDiagramWellQty = function (idx) {
    const well = getCurrentWell();
    if (well && well.config[idx]) {
        updateWellQuantity(idx, well.config[idx].quantity - 1);
    }
};

window.svgDragStartIndex = -1;

window.svgPointerDown = function (ev, idx) {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) return;
    const well = getCurrentWell();
    if (!well) return;

    if (typeof isWellLocked === 'function' && isWellLocked()) {
        if (typeof showToast === 'function') {
            const well = getCurrentWell();
            const hasAcceptedPO =
                well &&
                (typeof productionOrders !== 'undefined' && productionOrders
                    ? productionOrders
                    : []
                ).some((po) => po.wellId === well.id && po.status === 'accepted');
            showToast(hasAcceptedPO ? WELL_LOCKED_MSG : OFFER_LOCKED_MSG, 'error');
        }
        return;
    }

    // Jeśli modal Zlecenia jest otwarty, zaznacz element zamiast przeciągania
    const zlModal = document.getElementById('zlecenia-modal');
    if (zlModal && zlModal.classList.contains('active')) {
        const targetIdx = zleceniaElementsList.findIndex(
            (el) => el.wellIndex === currentWellIndex && el.elementIndex === idx
        );
        if (targetIdx >= 0) {
            selectZleceniaElement(targetIdx);
        }
        return;
    }

    startWellDragListeners();
    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

window.svgPointerUp = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return;
    if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        ev.stopPropagation();
        const well = getCurrentWell();
        if (!well || !well.config[idx]) return;
        if (typeof isWellLocked === 'function' && isWellLocked()) {
            if (typeof showToast === 'function') {
                const well = getCurrentWell();
                const hasAcceptedPO =
                    well &&
                    (typeof productionOrders !== 'undefined' && productionOrders
                        ? productionOrders
                        : []
                    ).some((po) => po.wellId === well.id && po.status === 'accepted');
                showToast(hasAcceptedPO ? WELL_LOCKED_MSG : OFFER_LOCKED_MSG, 'error');
            }
            return;
        }
        if (typeof removeWellComponent === 'function') {
            removeWellComponent(idx);
        }
    }
};

window.svgTouchEnd = function () {};

window.svgTouchStart = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;
    if (typeof isWellLocked === 'function' && isWellLocked()) {
        if (typeof showToast === 'function') {
            const hasAcceptedPO = (
                typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
            ).some((po) => po.wellId === well.id && po.status === 'accepted');
            showToast(hasAcceptedPO ? WELL_LOCKED_MSG : OFFER_LOCKED_MSG, 'error');
        }
        return;
    }
    startWellDragListeners();
    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

function handleLiveSvgDrag(clientY) {
    if (window.svgDragStartIndex >= 0) {
        const well = getCurrentWell();
        if (!well) return;
        const dz = document.getElementById('drop-zone-diagram');
        if (!dz) return;

        let targetIdx = well.config.length;
        let found = false;
        const grps = Array.from(
            dz.querySelectorAll('g.diag-comp-grp:not([pointer-events="none"])')
        );

        for (const g of grps) {
            const rect = g.getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) {
                targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
                found = true;
                break;
            }
        }
        if (!found && grps.length > 0) {
            targetIdx = well.config.length;
        }

        let insertIdx = targetIdx;
        if (window.svgDragStartIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (window.svgDragStartIndex !== insertIdx) {
            const draggedItem = well.config.splice(window.svgDragStartIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            window.svgDragStartIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

/* ===== WELL DRAG EVENT LISTENERS (z możliwością cleanup) ===== */
const _wellDragHandlers = {
    mousemove: (ev) => {
        if (window.svgDragStartIndex >= 0) {
            handleLiveSvgDrag(ev.clientY);
        }
    },
    touchmove: (ev) => {
        if (window.svgDragStartIndex >= 0 && ev.touches.length > 0) {
            handleLiveSvgDrag(ev.touches[0].clientY);
        }
    },
    mouseup: (ev) => {
        if (window.svgDragStartIndex >= 0) {
            const sourceIdx = window.svgDragStartIndex;
            window.svgDragStartIndex = -1;

            let shouldRemove = false;

            const trash = document.getElementById('svg-trash');
            if (trash && (trash === ev.target || trash.contains(/** @type {Node} */ (ev.target)))) {
                shouldRemove = true;
            }

            const diagramZone = document.getElementById('drop-zone-diagram');
            if (diagramZone && !diagramZone.contains(/** @type {Node} */ (ev.target))) {
                shouldRemove = true;
            }

            const well = getCurrentWell();
            if (well) {
                well.config.forEach((c) => (c.isPlaceholder = false));
                if (!(typeof isWellLocked === 'function' && isWellLocked())) {
                    well.autoLocked = true;
                    well.configSource = 'MANUAL';
                }
                if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
            }

            if (shouldRemove) {
                window.decDiagramWellQty(sourceIdx);
            } else {
                renderWellConfig();
                renderWellDiagram();
                updateSummary();
            }

            if (trash) {
                trash.style.background = 'rgba(var(--danger-rgb),0.1)';
                trash.style.borderColor = 'rgba(var(--danger-rgb),0.4)';
            }
        }
        window.cleanupWellDragListeners();
    },
    touchend: (ev) => {
        if (window.svgDragStartIndex >= 0) {
            const mouseUpEvent = new MouseEvent('mouseup', {
                clientX: ev.changedTouches[0].clientX,
                clientY: ev.changedTouches[0].clientY,
                bubbles: true
            });
            document.dispatchEvent(mouseUpEvent);
        }
        window.cleanupWellDragListeners();
    }
};

let _wellDragActive = false;

function startWellDragListeners() {
    if (_wellDragActive) return;
    _wellDragActive = true;
    document.addEventListener('mousemove', _wellDragHandlers.mousemove);
    document.addEventListener('touchmove', _wellDragHandlers.touchmove, { passive: false });
    document.addEventListener('mouseup', _wellDragHandlers.mouseup);
    document.addEventListener('touchend', _wellDragHandlers.touchend);
}

window.cleanupWellDragListeners = function cleanupWellDragListeners() {
    if (!_wellDragActive) return;
    _wellDragActive = false;
    document.removeEventListener('mousemove', _wellDragHandlers.mousemove);
    document.removeEventListener('touchmove', _wellDragHandlers.touchmove);
    document.removeEventListener('mouseup', _wellDragHandlers.mouseup);
    document.removeEventListener('touchend', _wellDragHandlers.touchend);
};

const dragOverCount = 0; // dla wizualizacji drag & drop

// Nasłuchiwanie zmian statusu synchronizacji dla odświeżenia listy
const _onSyncStatusChanged = () => {
    const container = document.getElementById('saved-offers-list');
    if (container && container.offsetParent !== null) {
        renderSavedOffersStudnie();
    }
};
window.addEventListener('pv-sync-status-changed', _onSyncStatusChanged);
window._cleanupSvgDrag = () => {
    window.removeEventListener('pv-sync-status-changed', _onSyncStatusChanged);
};
