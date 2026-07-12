/* ===== POMOCNIK LOGIKI DIAGRAMU SVG (drag & drop) ===== */

window.decDiagramWellQty = function (idx) {
    const well = getCurrentWell();
    if (well && well.config[idx]) {
        updateWellQuantity(idx, well.config[idx].quantity - 1);
    }
};

window.svgDragStartIndex = -1;

window.svgPointerDown = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;
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
    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

window.svgTouchStart = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;
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
            if (trash && (trash === ev.target || trash.contains(ev.target))) {
                shouldRemove = true;
            }
            const diagramZone = document.getElementById('drop-zone-diagram');
            if (diagramZone && !diagramZone.contains(ev.target)) {
                shouldRemove = true;
            }
            const well = getCurrentWell();
            if (well) {
                well.config.forEach((c) => (c.isPlaceholder = false));
                well.autoLocked = true;
                if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
                well.configSource = 'MANUAL';
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
    }
};

document.addEventListener('mousemove', _wellDragHandlers.mousemove);
document.addEventListener('touchmove', _wellDragHandlers.touchmove, { passive: false });
document.addEventListener('mouseup', _wellDragHandlers.mouseup);
document.addEventListener('touchend', _wellDragHandlers.touchend);

window.cleanupWellDragListeners = function cleanupWellDragListeners() {
    document.removeEventListener('mousemove', _wellDragHandlers.mousemove);
    document.removeEventListener('touchmove', _wellDragHandlers.touchmove);
    document.removeEventListener('mouseup', _wellDragHandlers.mouseup);
    document.removeEventListener('touchend', _wellDragHandlers.touchend);
};

const dragOverCount = 0;
