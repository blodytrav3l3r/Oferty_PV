// @ts-check
/* ===== actionsDrag.js — drag & drop z palety tiles (diagram) ===== */

function dragWellComponent(ev, productId) {
    ev.dataTransfer.setData('text/plain', productId);
    ev.dataTransfer.effectAllowed = 'copy';
    window.currentDraggedPlaceholderId = productId;
}

function dragEndWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (well && window.currentDraggedPlaceholderId) {
        well.config = well.config.filter((c) => !c.isPlaceholder);
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
        });
    }
    window.currentDraggedPlaceholderId = null;
}

function allowDropWellComponent(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = draggedCfgIndex !== null ? 'move' : 'copy';
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.add('drag-over');

    const well = getCurrentWell();
    if (!well) return;

    let targetIdx = well.config.length;
    let found = false;
    const grps = Array.from(dz.querySelectorAll('g.diag-comp-grp'));

    for (let g of grps) {
        const rect = g.getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) {
            targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
            found = true;
            break;
        }
    }
    if (!found && grps.length > 0) {
        targetIdx = well.config.length;
    }

    if (window.currentDraggedPlaceholderId) {
        const plIdx = well.config.findIndex((c) => c.isPlaceholder);
        let currentEffIdx = plIdx;
        let newEffIdx = targetIdx;
        if (plIdx > -1 && plIdx < targetIdx) newEffIdx -= 1;

        if (plIdx === -1 || plIdx !== newEffIdx) {
            const p = studnieProducts.find((x) => x.id === window.currentDraggedPlaceholderId);
            if (p) {
                if (plIdx > -1) well.config.splice(plIdx, 1);

                let insertIdx = targetIdx;
                if (plIdx > -1 && plIdx < targetIdx) insertIdx -= 1;
                insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

                well.config.splice(insertIdx, 0, {
                    productId: window.currentDraggedPlaceholderId,
                    quantity: 1,
                    height: p.height || 0,
                    isPlaceholder: true
                });

                window.requestAnimationFrame(() => {
                    renderWellConfig();
                    renderWellDiagram();
                });
            }
        }
    } else if (draggedCfgIndex !== null) {
        let insertIdx = targetIdx;
        if (draggedCfgIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (draggedCfgIndex !== insertIdx) {
            const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            draggedCfgIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

function dragLeaveWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');
}

window.injectPairIfReliefComponent = function (well, productId) {
    if (typeof window.ensureReliefRingPair === 'function') {
        window.ensureReliefRingPair(well);
    }
};

function dropWellComponent(ev) {
    ev.preventDefault();
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        window.currentDraggedPlaceholderId = null;
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        window.currentDraggedPlaceholderId = null;
        return;
    }
    if (well && window.currentDraggedPlaceholderId) {
        enforceSingularTopClosures(well, window.currentDraggedPlaceholderId);

        const plIdx = well.config.findIndex((c) => c.isPlaceholder);
        let actualIndex = -1;
        if (plIdx > -1) {
            well.config[plIdx].isPlaceholder = false;
            actualIndex = plIdx;
        } else {
            well.config.push({
                productId: window.currentDraggedPlaceholderId,
                quantity: 1
            });
            actualIndex = well.config.length - 1;
        }

        if (typeof window.injectPairIfReliefComponent === 'function') {
            window.injectPairIfReliefComponent(
                well,
                window.currentDraggedPlaceholderId,
                actualIndex
            );
        }

        window.currentDraggedPlaceholderId = null;

        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        sortWellConfigByOrder();
        recalcGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    } else if (well && draggedCfgIndex !== null) {
        well.config.forEach((c) => (c.isPlaceholder = false));
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        recalcGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    }
}
