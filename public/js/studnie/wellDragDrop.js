// @ts-check
/* ===== wellDragDrop.js — drag/drop, CSP handlers, IIFE boot ===== */

/* ===== DRAG FUNCTIONS FOR WELL COMPONENT (from tile list to diagram) ===== */

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

    for (const g of grps) {
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
        // Unikaj migotania, nie renderując, jeśli zmapowana pozycja jest praktycznie taka sama
        const currentEffIdx = plIdx;
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

        // Zamiast kasować na bezczelnego, szukamy gdzie jest nasz placeholder
        const plIdx = well.config.findIndex((c) => c.isPlaceholder);
        let actualIndex = -1;
        if (plIdx > -1) {
            well.config[plIdx].isPlaceholder = false;
            actualIndex = plIdx;
        } else {
            // Bezpiecznik: jeśli go nie było, dodaj na koniec
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

        // Włączamy ręczny reżim
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        sortWellConfigByOrder();
        recalcGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    } else if (well && draggedCfgIndex !== null) {
        // Zostało puszczone na puste pole SVG, resetujemy flagi i zapisujemy
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

/* ===== PRZECIAGNIJ I UPUSC DLA KONFIGURACJI BETONOWEJ ===== */
let draggedCfgIndex = null;

window.handleCfgDragStart = function (e) {
    const tile = e.target.closest('[data-action="cfg-tile"]');
    if (!tile) return;
    draggedCfgIndex = parseInt(tile.getAttribute('data-cfg-idx'));
    e.dataTransfer.effectAllowed = 'move';
    tile.style.opacity = '0.4';

    // Robimy z niego ducha na czas ciągnięcia
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
                // Znajdz istniejacy indeks placeholdera
                const plIdx = well.config.findIndex((c) => c.isPlaceholder);

                if (plIdx !== dropIndex) {
                    const p = studnieProducts.find(
                        (x) => x.id === window.currentDraggedPlaceholderId
                    );
                    if (p) {
                        // Usun stary placeholder
                        if (plIdx > -1) well.config.splice(plIdx, 1);

                        // Poniewaz wycinanie moze przesunac indeksy, znajdz nowy efektywny indeks upuszczenia
                        let targetIdx = dropIndex;
                        if (plIdx > -1 && plIdx < dropIndex) targetIdx -= 1; // It shifted down

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

                // Zamiast kasować na bezczelnego, szukamy gdzie jest nasz placeholder
                const plIdx = well.config.findIndex((c) => c.isPlaceholder);
                let actualIndex = -1;
                if (plIdx > -1) {
                    well.config[plIdx].isPlaceholder = false;
                    actualIndex = plIdx;
                } else {
                    // Bezpiecznik: jeśli go nie było, dodaj na koniec
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

                // Włączamy ręczny reżim
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
                // Usuwamy wszelkie pozostałe placeholdery dla bezpieczeństwa
                well.config = well.config.filter((c) => !c.isPlaceholder);
            }
        } else if (well && draggedCfgIndex !== null) {
            // Zostało puszczone na puste pole SVG, resetujemy flagi i zapisujemy
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
    const tile = e.target.closest('[data-action="cfg-tile"]');
    if (tile) tile.style.opacity = '1';
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

/* CSP Actions registrations */
if (typeof registerCspAction === 'function') {
    registerCspAction('selectZakonczenie', {
        handler: function ({ productId }) {
            selectZakonczenie(productId);
        },
        params: ['productId']
    });
    registerCspAction('selectRedukcjaZakonczenie', {
        handler: function ({ productId }) {
            selectRedukcjaZakonczenie(productId);
        },
        params: ['productId']
    });
    registerCspAction('move-well-up', {
        handler: function ({ cfgIdx }) {
            moveWellComponent(parseInt(cfgIdx), -1);
        },
        params: ['cfgIdx']
    });
    registerCspAction('move-well-down', {
        handler: function ({ cfgIdx }) {
            moveWellComponent(parseInt(cfgIdx), 1);
        },
        params: ['cfgIdx']
    });
    registerCspAction('toggle-liner-preco', {
        handler: function ({ cfgIdx }) {
            window.toggleLinerDisabled(parseInt(cfgIdx), 'preco');
        },
        params: ['cfgIdx']
    });
    registerCspAction('toggle-liner-pehd', {
        handler: function ({ cfgIdx }) {
            window.toggleLinerDisabled(parseInt(cfgIdx), 'pehd');
        },
        params: ['cfgIdx']
    });
    registerCspAction('remove-well-component', {
        handler: function ({ cfgIdx }) {
            removeWellComponent(parseInt(cfgIdx));
        },
        params: ['cfgIdx']
    });
    registerCspAction('add-well-component', {
        handler: function ({ productId }) {
            addWellComponent(productId);
        },
        params: ['productId']
    });
}

/* Custom event delegation for drag & hover on config tiles and tiles */
(function () {
    const cfgTileSel = '[data-action="cfg-tile"]';
    const wellTileSel = '[data-action="add-well-component"]';
    const rmBtnSel = '[data-action="remove-well-component"]';

    ['dragstart', 'dragover', 'drop', 'dragend'].forEach(function (evType) {
        document.addEventListener(evType, function (e) {
            const tile = e.target.closest(cfgTileSel);
            if (!tile) return;
            if (evType === 'dragstart') window.handleCfgDragStart(e);
            else if (evType === 'dragover') window.handleCfgDragOver(e);
            else if (evType === 'drop') window.handleCfgDrop(e);
            else if (evType === 'dragend') window.handleCfgDragEnd(e);
        });
    });

    document.addEventListener('dragstart', function (e) {
        const tile = e.target.closest(wellTileSel);
        if (!tile) return;
        window.dragWellComponent(e, tile.getAttribute('data-product-id'));
    });

    document.addEventListener('dragend', function (e) {
        const tile = e.target.closest(wellTileSel);
        if (!tile) return;
        window.dragEndWellComponent(e);
    });

    function handleTileHover(e, entering) {
        const tile = e.target.closest(cfgTileSel);
        if (!tile) return;
        const related = e.relatedTarget;
        if (related && tile.contains(related)) return;
        const idx = parseInt(tile.getAttribute('data-cfg-idx'));
        const isPl = tile.getAttribute('data-is-placeholder') === 'true';
        if (isPl) return;
        if (entering) {
            tile.style.filter = 'brightness(1.5)';
            tile.style.borderColor = 'rgba(255,255,255,0.3)';
            tile.style.boxShadow = '0 0 12px rgba(99,102,241,0.4)';
            if (typeof window.highlightSvg === 'function') window.highlightSvg('cfg', idx);
        } else {
            tile.style.filter = 'brightness(1)';
            tile.style.borderColor = 'rgba(255,255,255,0.05)';
            tile.style.boxShadow = 'none';
            if (typeof window.unhighlightSvg === 'function') window.unhighlightSvg('cfg', idx);
        }
    }

    function handleBtnHover(e, entering) {
        const btn = e.target.closest(rmBtnSel);
        if (!btn) return;
        const related = e.relatedTarget;
        if (related && btn.contains(related)) return;
        btn.style.background = entering ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.06)';
        btn.style.borderColor = entering ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)';
    }

    document.addEventListener('mouseover', function (e) {
        handleTileHover(e, true);
        handleBtnHover(e, true);
    });

    document.addEventListener('mouseout', function (e) {
        handleTileHover(e, false);
        handleBtnHover(e, false);
    });
})();
