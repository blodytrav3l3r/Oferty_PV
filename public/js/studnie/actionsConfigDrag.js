// @ts-check
/* ===== actionsConfigDrag.js — przeciąganie i sortowanie konfiguracji ===== */

function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    const zlReorder =
        typeof canReorderInZleceniaModal === 'function' && canReorderInZleceniaModal(well);
    if (!zlReorder && isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (!zlReorder && isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    if (!zlReorder && window.pzGuard && window.pzGuard.hasPzForWell(well.id)) {
        showToast(
            '<i data-lucide="x-circle"></i> Nie można przesuwać elementów studni — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
            'error'
        );
        return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.config.length) return;

    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;
    if (typeof window.invalidateFrozenPricesForWell === 'function') {
        window.invalidateFrozenPricesForWell(well);
    }

    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    updateHeightIndicator();
    // W modalu zleceń przebuduj listę elementów (świeże elementIndex), wybór po _elemId.
    if (zlReorder && typeof window.refreshZleceniaModalIfActive === 'function') {
        window.refreshZleceniaModalIfActive();
    }
}
// Alias dla modalu Zlecenia Produkcyjne (data-zl-idx) — ta sama logika, odświeża też listę zleceń
window.moveZleceniaComponent = moveWellComponent;

let draggedCfgIndex = null;
let draggedCfgChanged = false;

function setConfigDropTarget(list, target, after) {
    list.querySelectorAll('.config-tile.is-drop-target, .zl-config-tile.is-drop-target').forEach(
        (tile) => {
            if (tile !== target) {
                tile.classList.remove('is-drop-target', 'is-drop-target--after');
            }
        }
    );
    target.classList.toggle('is-drop-target--after', after);
    target.classList.add('is-drop-target');
}

function isConfigDropAfter(event, tile) {
    const rect = tile.getBoundingClientRect();
    return event.clientY >= rect.top + rect.height / 2;
}

window.handleCfgDragStart = function (e) {
    const well = getCurrentWell();
    const zlReorder =
        well && typeof canReorderInZleceniaModal === 'function' && canReorderInZleceniaModal(well);
    if (!zlReorder && well && window.pzGuard && window.pzGuard.hasPzForWell(well.id)) {
        showToast(
            '<i data-lucide="x-circle"></i> Nie można przesuwać elementów studni — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
            'error'
        );
        return;
    }
    const attr =
        e.currentTarget.getAttribute('data-cfg-idx') || e.currentTarget.getAttribute('data-zl-idx');
    draggedCfgIndex = parseInt(attr);
    draggedCfgChanged = false;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('is-dragging');

    if (well && well.config[draggedCfgIndex]) {
        well.config[draggedCfgIndex].isPlaceholder = true;
        window.requestAnimationFrame(() => renderWellDiagram());
    }
};
window.handleZlCfgDragStart = window.handleCfgDragStart;

window.handleCfgDragOver = function (e) {
    if (draggedCfgIndex === null && !window.currentDraggedPlaceholderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('.config-tile, .zl-config-tile');

    if (draggedCfgIndex !== null) {
        if (tile) {
            const dropIndex = parseInt(
                tile.getAttribute('data-cfg-idx') || tile.getAttribute('data-zl-idx')
            );
            if (!isNaN(dropIndex) && draggedCfgIndex !== dropIndex) {
                setConfigDropTarget(tile.parentElement, tile, isConfigDropAfter(e, tile));
            } else {
                tile.parentElement
                    .querySelectorAll('.config-tile.is-drop-target, .zl-config-tile.is-drop-target')
                    .forEach((target) =>
                        target.classList.remove('is-drop-target', 'is-drop-target--after')
                    );
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

window.handleCfgDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    const curWell = getCurrentWell();
    const zlReorder =
        curWell &&
        typeof canReorderInZleceniaModal === 'function' &&
        canReorderInZleceniaModal(curWell);
    if (!zlReorder && isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (!zlReorder && isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    if (!zlReorder && curWell && window.pzGuard && window.pzGuard.hasPzForWell(curWell.id)) {
        showToast(
            '<i data-lucide="x-circle"></i> Nie można przesuwać elementów studni — ma przypisane zlecenia produkcyjne. Usuń najpierw zlecenia w zakładce „Zlecenia produkcyjne”.',
            'error'
        );
        return;
    }
    const tile = e.target.closest('.config-tile, .zl-config-tile');

    if (tile) {
        const well = getCurrentWell();
        if (!well) return;

        if (draggedCfgIndex !== null) {
            const sourceIndex = draggedCfgIndex;
            const targetIndex = parseInt(
                tile.getAttribute('data-cfg-idx') || tile.getAttribute('data-zl-idx')
            );
            if (!isNaN(targetIndex) && sourceIndex !== targetIndex) {
                const after = isConfigDropAfter(e, tile);
                const rawInsertIndex = targetIndex + (after ? 1 : 0);
                const insertIndex = rawInsertIndex - (sourceIndex < rawInsertIndex ? 1 : 0);
                if (insertIndex !== sourceIndex) {
                    const nextConfig = [...well.config];
                    const [draggedItem] = nextConfig.splice(sourceIndex, 1);
                    nextConfig.splice(insertIndex, 0, draggedItem);
                    well.config = nextConfig;
                    draggedCfgChanged = true;
                }
            }
            well.config = well.config.map((item) =>
                item.isPlaceholder ? { ...item, isPlaceholder: false } : item
            );
            if (draggedCfgChanged && typeof window.invalidateFrozenPricesForWell === 'function') {
                window.invalidateFrozenPricesForWell(well);
            }
            draggedCfgChanged = false;

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
            updateHeightIndicator();
            if (zlReorder && typeof window.refreshZleceniaModalIfActive === 'function') {
                window.refreshZleceniaModalIfActive();
            }
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

                if (typeof window.invalidateFrozenPricesForWell === 'function') {
                    window.invalidateFrozenPricesForWell(well);
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
        } else if (well) {
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
    e.currentTarget.classList.remove('is-dragging');
    document
        .querySelectorAll(
            '.config-tile.is-drop-target, .zl-config-tile.is-drop-target, .config-tile.is-dragging, .zl-config-tile.is-dragging'
        )
        .forEach((t) =>
            t.classList.remove('is-drop-target', 'is-drop-target--after', 'is-dragging')
        );
    const well = getCurrentWell();
    if (well) {
        well.config.forEach((c) => (c.isPlaceholder = false));
        if (draggedCfgChanged) {
            if (typeof window.invalidateFrozenPricesForWell === 'function') {
                window.invalidateFrozenPricesForWell(well);
            }
            updateSummary();
        }
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
            updateHeightIndicator();
        });
        // Live-reorder w dragover mógł przestawić config bez dropa —
        // w modalu zawsze odśwież listę (wybór po _elemId).
        if (
            typeof canReorderInZleceniaModal === 'function' &&
            canReorderInZleceniaModal(well) &&
            typeof window.refreshZleceniaModalIfActive === 'function'
        ) {
            window.refreshZleceniaModalIfActive();
        }
    }
    draggedCfgIndex = null;
    draggedCfgChanged = false;
};

window.handleZlCfgDragOver = window.handleCfgDragOver;
window.handleZlCfgDrop = window.handleCfgDrop;
window.handleZlCfgDragEnd = window.handleCfgDragEnd;

/* ===== Rejestracja globali ===== */
window.moveWellComponent = moveWellComponent;
