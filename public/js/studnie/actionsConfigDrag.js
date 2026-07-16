// @ts-check
/* ===== actionsConfigDrag.js — przeciąganie i sortowanie konfiguracji ===== */

function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.config.length) return;

    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;

    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    updateHeightIndicator();
}

let draggedCfgIndex = null;

window.handleCfgDragStart = function (e) {
    draggedCfgIndex = parseInt(e.currentTarget.getAttribute('data-cfg-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';

    const well = getCurrentWell();
    if (well && well.config[draggedCfgIndex]) {
        well.config[draggedCfgIndex].isPlaceholder = true;
        window.requestAnimationFrame(() => renderWellDiagram());
    }
};

window.handleCfgDragOver = function (e) {
    if (draggedCfgIndex === null && !window.currentDraggedPlaceholderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('.config-tile');

    if (draggedCfgIndex !== null) {
        if (tile) {
            tile.style.borderTop = '2px solid #6366f1';
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well && draggedCfgIndex !== dropIndex) {
                const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
                well.config.splice(dropIndex, 0, draggedItem);
                draggedCfgIndex = dropIndex;
                window.requestAnimationFrame(() => renderWellDiagram());
            }
        }
    } else if (window.currentDraggedPlaceholderId) {
        if (tile) {
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well) {
                const plIdx = well.config.findIndex((c) => c.isPlaceholder);

                if (plIdx !== dropIndex) {
                    const p = studnieProducts.find(
                        (x) => x.id === window.currentDraggedPlaceholderId
                    );
                    if (p) {
                        if (plIdx > -1) well.config.splice(plIdx, 1);

                        let targetIdx = dropIndex;
                        if (plIdx > -1 && plIdx < dropIndex) targetIdx -= 1;

                        well.config.splice(targetIdx, 0, {
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
            }
        }
    }
};

window.handleCfgDragLeave = function (e) {
    const tile = e.target.closest('.config-tile');
    if (tile && draggedCfgIndex !== null) {
        tile.style.borderTop = '';
    }
};

window.handleCfgDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const tile = e.target.closest('.config-tile');

    if (tile) {
        const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
        const well = getCurrentWell();
        if (!well) return;

        if (draggedCfgIndex !== null) {
            tile.style.borderTop = '';

            well.config.forEach((c) => (c.isPlaceholder = false));

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            updateHeightIndicator();
        } else if (well && window.currentDraggedPlaceholderId) {
            try {
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

                well.autoLocked = true;
                updateAutoLockUI();
                well.configSource = 'MANUAL';

                sortWellConfigByOrder();
                recalcGaskets(well);

                renderWellConfig();
                renderWellDiagram();
                updateSummary();
            } catch (e) {
                logger.error('wellActions', 'Błąd w dropWellComponent:', e);
                showToast('Wystąpił błąd podczas upuszczania elementu', 'error');
            } finally {
                window.currentDraggedPlaceholderId = null;
                well.config = well.config.filter((c) => !c.isPlaceholder);
            }
        } else if (well && draggedCfgIndex !== null) {
            well.config = well.config.filter((c) => !c.isPlaceholder);
            well.config.forEach((c) => (c.isPlaceholder = false));
            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            recalcGaskets(well);

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            updateHeightIndicator();
        }
    }
};

window.handleCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.config-tile').forEach((t) => (t.style.borderTop = ''));
    draggedCfgIndex = null;

    const well = getCurrentWell();
    if (well) {
        well.config.forEach((c) => (c.isPlaceholder = false));
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
            updateHeightIndicator();
        });
    }
};
