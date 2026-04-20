/* ===== Extracted to wellActions.js ===== */

function updateElevations() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');

    well.rzednaWlazu = wlazInput.value !== '' ? parseFloat(wlazInput.value) : null;
    well.rzednaDna = dnaInput.value !== '' ? parseFloat(dnaInput.value) : 0; // domyślnie 0

    updateHeightIndicator();
    renderWellsList();
    autoSelectComponents(true);
}

function syncElevationInputs() {
    const well = getCurrentWell();
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');
    const numerInput = document.getElementById('input-well-numer');
    const doplataInput = document.getElementById('input-doplata');
    if (!well) {
        if (wlazInput) wlazInput.value = '';
        if (dnaInput) dnaInput.value = '';
        if (doplataInput) doplataInput.value = '';
        if (numerInput) {
            numerInput.value = '';
            checkWellNumerDuplicate('', numerInput);
        }
        updateHeightIndicator();
        return;
    }
    if (wlazInput) wlazInput.value = well.rzednaWlazu != null ? well.rzednaWlazu : '';
    if (dnaInput) dnaInput.value = well.rzednaDna != null ? well.rzednaDna : '';
    if (doplataInput) {
        const dVal = well.doplata != null ? well.doplata : 0;
        doplataInput.value = dVal;

        // Positive -> Green, Negative -> Red, Zero -> Default
        if (dVal > 0) {
            doplataInput.style.color = '#10b981';
            doplataInput.style.fontWeight = '700';
        } else if (dVal < 0) {
            doplataInput.style.color = '#ef4444';
            doplataInput.style.fontWeight = '700';
        } else {
            doplataInput.style.color = '#a78bfa';
            doplataInput.style.fontWeight = 'normal';
        }
    }
    if (numerInput) {
        numerInput.value = well.numer || '';
        checkWellNumerDuplicate(numerInput.value.trim(), numerInput);
    }
    updateHeightIndicator();
}

function updateHeightIndicator() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    const reqEl = document.getElementById('well-required-height');
    const confEl = document.getElementById('well-configured-height');
    const diffEl = document.getElementById('height-diff-indicator');
    const errContainer = document.getElementById('well-config-errors-container');

    if (!reqEl || !confEl || !diffEl) return;
    if (!well) {
        confEl.innerHTML = '0 m';
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
        if (errContainer) errContainer.style.display = 'none';
        return;
    }

    recalculateWellErrors(well);
    let liveErrors = well.configErrors || [];

    if (errContainer) {
        if (liveErrors.length > 0) {
            errContainer.innerHTML =
                '<i data-lucide="alert-triangle"></i> Błędy w konfiguracji studni:<br>' +
                liveErrors.map((e) => `• ${e}`).join('<br>');
            errContainer.style.display = 'block';
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } else {
            errContainer.style.display = 'none';
        }
    }

    const prevErrors = well.configErrors ? well.configErrors.length : 0;
    if (prevErrors !== liveErrors.length) renderWellsList();

    const stats = calcWellStats(well);
    const confM = (stats.height / 1000).toFixed(3).replace('.', ',');
    confEl.textContent = confM + ' m';

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu != null && well.rzednaWlazu > rzDna) {
        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        const reqM = (requiredMm / 1000).toFixed(3).replace('.', ',');
        reqEl.textContent = reqM + ' m';

        const diff = stats.height - requiredMm;
        if (Math.abs(diff) <= 50) {
            diffEl.innerHTML =
                '<span style="color:#10b981;"><i data-lucide="check-circle-2"></i> Wysokość OK</span>';
        } else if (diff > 0) {
            const diffM = (diff / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f59e0b;"><i data-lucide="alert-triangle"></i> +${diffM} m za dużo</span>`;
        } else {
            const diffM = (Math.abs(diff) / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f87171;"><i data-lucide="alert-triangle"></i> Brakuje ${diffM} m</span>`;
        }
    } else {
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
    }
}

function updateWellNumer() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    const numerInput = document.getElementById('input-well-numer');
    if (!numerInput) return;

    const newNumer = numerInput.value.trim();
    checkWellNumerDuplicate(newNumer, numerInput);

    well.numer = newNumer;
    well.name = well.numer || 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')';
    renderWellsList();
    updateSummary();
}

function checkWellNumerDuplicate(newNumer, inputEl) {
    if (!inputEl) return false;
    if (newNumer !== '') {
        const isDuplicate = wells.some(
            (w, idx) =>
                idx !== currentWellIndex &&
                w.numer &&
                w.numer.toLowerCase() === newNumer.toLowerCase()
        );
        if (isDuplicate) {
            inputEl.style.borderColor = '#ef4444';
            inputEl.style.color = '#ef4444';
            inputEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
            showToast(
                `<i data-lucide="alert-triangle"></i> Numer studni "${newNumer}" już istnieje! Zmień numer, aby uniknąć duplikatów.`,
                'error'
            );
            return true; // is duplicate
        }
    }
    // reset styling
    inputEl.style.borderColor = 'var(--border-glass)';
    inputEl.style.color = '#a78bfa';
    inputEl.style.boxShadow = 'none';
    return false;
}

function updateDoplata() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const domEl = document.getElementById('input-doplata');
    const dVal = domEl.value !== '' ? parseFloat(domEl.value) : 0;
    well.doplata = dVal;

    // Apply color immediately
    if (dVal > 0) {
        domEl.style.color = '#10b981';
        domEl.style.fontWeight = '700';
    } else if (dVal < 0) {
        domEl.style.color = '#ef4444';
        domEl.style.fontWeight = '700';
    } else {
        domEl.style.color = '#a78bfa';
        domEl.style.fontWeight = 'normal';
    }

    renderWellsList();
    updateSummary();
    renderOfferSummary();
}

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
        // Unikaj migotania, nie renderując, jeśli zmapowana pozycja jest praktycznie taka sama
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
        syncGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    } else if (well && draggedCfgIndex !== null) {
        // Zostało puszczone na puste pole SVG, resetujemy flagi i zapisujemy
        well.config.forEach((c) => (c.isPlaceholder = false));
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        syncGaskets(well);

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    }
}

function addWellComponent(productId) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const product = studnieProducts.find((p) => p.id === productId);
    if (!product) return;

    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    // Włączenie trybu ręcznego jeśli dodano jakikolwiek element z palety
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
        showToast('Włączono tryb ręczny.', 'info');
    }
    well.configSource = 'MANUAL';

    // ZASADA 1: Tylko jedno zakończenie studni
    const topClosureTypes = [
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'konus',
        'pierscien_odciazajacy'
    ];
    if (topClosureTypes.includes(product.componentType)) {
        // Usuń poprzednie elementy zakończenia
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }

    // Pomocnik do dodawania pojedynczego produktu do konfiguracji studni w odpowiedniej pozycji
    const addSingle = (prod) => {
        const topClosureTypes = [
            'plyta_din',
            'plyta_najazdowa',
            'plyta_zamykajaca',
            'konus',
            'pierscien_odciazajacy',
            'wlaz'
        ];
        const isTop = topClosureTypes.includes(prod.componentType);
        const isBottom = ['dennica', 'kineta', 'styczna'].includes(prod.componentType);

        if (isTop) {
            // Zakończenia zawsze na samą górę (indeks 0 lub za włazem, ale właz jest już filtrowany wyżej)
            well.config.unshift({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, prod.id, 0);
            }
            return;
        }

        if (isBottom) {
            // Dennice zawsze na sam dół (koniec tablicy)
            well.config.push({ productId: prod.id, quantity: 1, _addedAt: Date.now() });
            return;
        }

        // Dla rur (krag, krag_ot) szukamy odpowiedniego miejsca
        const plateIdx = well.config.findIndex((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

        if (plateIdx >= 0) {
            const plate = studnieProducts.find((p) => p.id === well.config[plateIdx].productId);
            // Wykrywamy czy krąg jest DN główny (np. 1500) czy redukcyjny (1000)
            const mainDn = well.dn;
            const isRedDn = prod.dn === 1000;

            if (isRedDn) {
                // Krąg DN1000 -> wstawiamy NAD płytą redukcyjną (przed płytą w tablicy)
                // Ale za włazem/konusem
                let insertIdx = 0;
                for (let i = 0; i < plateIdx; i++) {
                    const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                    if (!topClosureTypes.includes(p.componentType)) {
                        insertIdx = i;
                        break;
                    }
                    insertIdx = i + 1;
                }
                well.config.splice(insertIdx, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            } else {
                well.config.splice(plateIdx + 1, 0, {
                    productId: prod.id,
                    quantity: 1,
                    _addedAt: Date.now()
                });
            }
        } else {
            let insertIdx = 0;
            for (let i = 0; i < well.config.length; i++) {
                const p = studnieProducts.find((pr) => pr.id === well.config[i].productId);
                if (!topClosureTypes.includes(p.componentType)) {
                    insertIdx = i;
                    break;
                }
                insertIdx = i + 1;
            }
            well.config.splice(insertIdx, 0, {
                productId: prod.id,
                quantity: 1,
                _addedAt: Date.now()
            });
        }
    };

    addSingle(product);

    sortWellConfigByOrder();
    syncGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight
    updateHeightIndicator(); // Odśwież błędy

    if (topClosureTypes.includes(product.componentType) && well.rzednaWlazu != null) {
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
        if (well.rzednaWlazu > rzDna) {
            showToast(`Wybrano zakończenie: ${product.name}`, 'success');

            // Auto-dobór (gdy dodajemy płyte starym "klikiem",
            // ale teraz tryb ręczny blokuje autodobór, wiec nigdy to nie zajdzie, chyba ze go odblokujemy)
            if (!well.autoLocked) {
                autoSelectComponents(true);
                return;
            }
        } else {
            showToast(`Dodano: ${product.name}`, 'success');
        }
    } else {
        showToast(`Dodano: ${product.name}`, 'success');
    }
}

function removeWellComponent(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';

    const removedItem = well.config.splice(index, 1)[0];

    if (removedItem) {
        const p = studnieProducts.find((pr) => pr.id === removedItem.productId);
        if (p && p.componentType === 'redukcja') {
            well.redukcjaDN1000 = false;

            const redToggle = document.getElementById('well-redukcja-toggle');
            if (redToggle) redToggle.checked = false;

            if (typeof updateAutoLockUI === 'function') updateAutoLockUI();

            showToast('Usunięto redukcję ze studni.', 'info');
            // Pozwól kodowi kontynuować i ponownie wyrenderować bez automatycznego dobierania
        }
    }

    syncGaskets(well);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight
    updateHeightIndicator(); // Odśwież błędy
}

function updateWellQuantity(index, value) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const qty = parseInt(value);
    if (qty <= 0) {
        removeWellComponent(index);
        return;
    }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';
    // Nie pozwalamy na zmianę ilości na > 1 dla elementów betonowych, ale zachowujemy funkcję do usuwania
    well.config[index].quantity = 1;
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderTiles(); // highlight items
    updateHeightIndicator(); // Odśwież błędy
}

function clearWellConfig() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    well.configSource = 'MANUAL';
    well.config = [];
    refreshAll();
    showToast('Wyczyszczono konfigurację studni', 'info');
}

function renderTiles() {
    const container = document.getElementById('tiles-container');
    const well = getCurrentWell();
    if (!well) {
        if (container)
            container.innerHTML =
                '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Dodaj studnię aby wybrać elementy</div>';
        return;
    }
    const dn = well.dn;

    const groups = [
        { title: '<i data-lucide="circle-dot"></i> Włazy', icon: '', types: ['wlaz'] },
        { title: '<i data-lucide="settings"></i> AVR / Pierścienie', icon: '', types: ['avr'] },
        { title: '<i data-lucide="diamond"></i> Konus / Stożek', icon: '', types: ['konus'] },
        {
            title: '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Płyty nakrywające',
            icon: '',
            types: ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy']
        },
        { title: '⬛ Płyty redukcyjne', icon: '', types: ['plyta_redukcyjna'] },
        { title: '<i data-lucide="square"></i> Kręgi', icon: '', types: ['krag'] },
        {
            title: '<i data-lucide="square"></i> Kręgi z otworami (OT)',
            icon: '',
            types: ['krag_ot']
        },
        { title: '<i data-lucide="square"></i> Dennica', icon: '', types: ['dennica'] },
        { title: '🪣 Osadniki', icon: '', types: ['osadnik'] },
        // Studnie styczne widoczne tylko gdy wybrana typu studni Styczna
        ...(dn === 'styczna'
            ? (() => {
                  const variant = well.stycznaVariant || 'standard';
                  if (variant === 'korek') {
                      return [
                          {
                              title: '<i data-lucide="plug"></i> Studnie Styczne z korkiem',
                              icon: '',
                              types: ['styczna'],
                              filterFn: (p) => p.id.includes('KOREK')
                          }
                      ];
                  }
                  return [
                      {
                          title: '<i data-lucide="cylinder"></i> Studnie Styczne',
                          icon: '',
                          types: ['styczna'],
                          filterFn: (p) => !p.id.includes('KOREK')
                      }
                  ];
              })()
            : []),
        { title: '<i data-lucide="circle-check"></i> Uszczelki', icon: '', types: ['uszczelka'] }
    ];

    let html = '';

    const renderGroup = (group, prods) => {
        let items = prods.filter((p) => group.types.includes(p.componentType));
        if (group.filterFn) {
            items = items.filter(group.filterFn);
        }
        if (items.length === 0) return;

        // Niestandardowe sortowanie dla studni stycznych: sortuj wg DN
        if (group.types.includes('styczna')) {
            items.sort((a, b) => (a.dn || 0) - (b.dn || 0));
        }

        // Niestandardowe sortowanie dla dennicy: sortuj wg wysokości od najniższej do najwyższej
        if (group.types.includes('dennica')) {
            items.sort((a, b) => (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0));
        }

        html += `<div class="tiles-section">
      <div class="tiles-section-title">${group.title}</div>
      <div class="tiles-grid">`;

        items.forEach((p) => {
            const isTopClosure = [
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'konus',
                'pierscien_odciazajacy'
            ].includes(p.componentType);
            const isInConfig = (well.config || []).some((c) => c.productId === p.id);
            const activeClass = isTopClosure && isInConfig ? 'active-top-closure' : '';
            const isLocked = isWellLocked();
            const lockedStyle = isLocked
                ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                : '';

            // Oblicz cenę z dopłatą, jeśli wybrano drabinę nierdzewną
            let displayPrice = p.price || 0;
            if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
                displayPrice += parseFloat(p.doplataDrabNierdzewna);
            }

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
        <div class="tile-name">${p.name}</div>
        <div class="tile-meta">
          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
          <span class="tile-price">${fmtInt(displayPrice)} PLN</span>
        </div>
      </div>`;
        });
        html += `</div></div>`;
    };

    const availProducts = getAvailableProducts(well);
    const primaryProducts = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                // Dla studni stycznych użyj well.dn dla nadbudowy, ale pozwól na 'styczną' dla dennicy
                if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                    return p.dn === 'styczna' || p.componentType === 'styczna';
                }
                const effectiveDn = well.dn || 1000;
                return p.dn === effectiveDn || p.dn === null;
            }

            return p.dn === dn || p.dn === null;
        })
        .filter((p) => filterByWellParams(p, well));

    groups.forEach((g) => {
        // Specjalna logika dla studni stycznych, aby pokazać poprawny parametr uszczelki w kategorii uszczelek
        if (g.types.includes('uszczelka')) {
            let items = primaryProducts.filter((p) => g.types.includes(p.componentType));
            items = filterSealsByWellType(items, well);

            if (items.length > 0) {
                html += `<div class="tiles-section"><div class="tiles-section-title">${g.title}</div><div class="tiles-grid">`;
                items.forEach((p) => {
                    const isLocked = isWellLocked();
                    const lockedStyle = isLocked
                        ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                        : '';

                    html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
                        <div class="tile-name">${p.name}</div>
                        <div class="tile-meta">
                          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                          <span class="tile-price">${fmtInt(p.price)} PLN</span>
                        </div>
                      </div>`;
                });
                html += `</div></div>`;
            }
        } else {
            renderGroup(g, primaryProducts);
        }
    });

    const hasReduction =
        well.redukcjaDN1000 ||
        (well.config || []).some((c) => {
            const p = studnieProducts.find((pr) => pr.id === c.productId);
            return p && p.componentType === 'plyta_redukcyjna';
        });

    if ([1200, 1500, 2000, 2500].includes(dn) && hasReduction) {
        const redProducts = availProducts
            .filter(
                (p) =>
                    p.dn === 1000 &&
                    p.componentType !== 'plyta_redukcyjna' &&
                    p.componentType !== 'dennica'
            )
            .filter((p) => filterByWellParams(p, well));
        if (redProducts.length > 0) {
            html += `<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">`;
            html += `<h3 style="color:#f59e0b; margin-bottom:1rem; font-size:1.1rem;">⏬ Redukcja (DN1000)</h3>`;
            groups.forEach((g) => {
                if (g.types.includes('uszczelka')) {
                    // Zastosuj to samo filtrowanie typu uszczelki dla sekcji redukcji
                    let items = redProducts.filter((p) => g.types.includes(p.componentType));
                    items = filterSealsByWellType(items, well);
                    if (items.length > 0) {
                        html += `<div class="tiles-section"><div class="tiles-section-title">${g.title}</div><div class="tiles-grid">`;
                        items.forEach((p) => {
                            const isLocked = isWellLocked();
                            const lockedStyle = isLocked
                                ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;'
                                : '';
                            html += `<div class="tile" data-type="${p.componentType}" style="${lockedStyle}" onclick="addWellComponent('${p.id}')" draggable="${!isLocked}" ondragstart="${isLocked ? 'return false;' : `dragWellComponent(event, '${p.id}')`}" ondragend="dragEndWellComponent(event)">
                                <div class="tile-name">${p.name}</div>
                                <div class="tile-meta">
                                  <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
                                  <span class="tile-price">${fmtInt(p.price)} PLN</span>
                                </div>
                              </div>`;
                        });
                        html += `</div></div>`;
                    }
                } else {
                    renderGroup(g, redProducts);
                }
            });
            html += `</div>`;
        }
    }

    container.innerHTML = html;
}

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!well || !well.config || well.config.length === 0) {
        tbody.innerHTML =
            '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    // Mapowanie wizualnej kolejności typu komponentu (góra studni → dół)
    const typeOrderMap = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
    };

    // Odznaki kolorów typów
    const typeBadge = {
        wlaz: { bg: '#1e293b', label: 'Właz' },
        plyta_din: { bg: '#be185d', label: 'Płyta' },
        plyta_najazdowa: { bg: '#9d174d', label: 'Płyta' },
        plyta_zamykajaca: { bg: '#7c3aed', label: 'Płyta' },
        pierscien_odciazajacy: { bg: '#0891b2', label: 'Pierścień' },
        konus: { bg: '#d97706', label: 'Konus' },
        avr: { bg: '#475569', label: 'AVR' },
        plyta_redukcyjna: { bg: '#6d28d9', label: 'Redukcja' },
        krag: { bg: '#4338ca', label: 'Krąg' },
        krag_ot: { bg: '#4338ca', label: 'Krąg OT' },
        dennica: { bg: '#047857', label: 'Dennica' },
        kineta: { bg: '#9d174d', label: 'Kineta' },
        uszczelka: { bg: '#334155', label: 'Uszczelka' },
        styczna: { bg: '#059669', label: 'Styczna' },
        osadnik: { bg: '#a16207', label: 'Osadnik' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;
        const itemAssessedPrice = getItemAssessedPrice(well, p);
        let totalPrice = itemAssessedPrice * item.quantity;

        if (p.componentType === 'dennica' || p.componentType === 'styczna') {
            const kinetaItem = well.config.find((c) => {
                const pr = studnieProducts.find((x) => x.id === c.productId);
                return pr && pr.componentType === 'kineta';
            });
            if (kinetaItem) {
                const kinetaProd = studnieProducts.find((x) => x.id === kinetaItem.productId);
                if (kinetaProd) {
                    const rawKinetaPrice = getItemAssessedPrice(well, kinetaProd);
                    totalPrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                }
            }
            // Dopłata wliczona do dennicy / studni stycznej (nie podlega rabatowi)
            if (well.doplata) {
                totalPrice += well.doplata;
            }
        }
        const totalWeight = (p.weight || 0) * item.quantity;
        const totalAreaInt = (p.area || 0) * item.quantity;
        const totalAreaExt = (p.areaExt || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        const isPlaceholder = item.isPlaceholder;
        const plStyle = isPlaceholder
            ? 'opacity:0.7; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); pointer-events: none;'
            : '';

        html += `<div data-cfg-idx="${index}" class="config-tile" draggable="true" ondragstart="handleCfgDragStart(event)" ondragover="handleCfgDragOver(event)" ondrop="handleCfgDrop(event)" ondragend="handleCfgDragEnd(event)" style="background:linear-gradient(90deg, ${badge.bg} 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:4px solid ${badge.bg.substring(0, 7)}; border-radius:8px; padding:0.45rem 0.5rem; position:relative; transition:all 0.2s ease; margin-bottom:0.3rem; cursor:grab; ${plStyle}"
                      onmouseenter="if(!${isPlaceholder}){this.style.filter='brightness(1.5)'; this.style.borderColor='rgba(255,255,255,0.3)'; this.style.boxShadow='0 0 12px rgba(99,102,241,0.4)'; window.highlightSvg('cfg', ${index})}" onmouseleave="if(!${isPlaceholder}){this.style.filter='brightness(1)'; this.style.borderColor='rgba(255,255,255,0.05)'; this.style.boxShadow='none'; window.unhighlightSvg('cfg', ${index})}">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
            
            <div style="display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.25); padding:0.2rem 0.35rem; border-radius:6px; min-width:28px;">
                  <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} onclick="moveWellComponent(${index}, -1)" title="W górę" style="background:none; border:none; color:var(--text-muted); padding:0; cursor:${canMoveUp ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};"><i data-lucide="chevron-up" style="font-size: 0.75rem;"></i></button>
                  <span style="font-size:0.7rem; color:var(--text-primary); font-weight:800;">${index + 1}</span>
                  <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} onclick="moveWellComponent(${index}, 1)" title="W dół" style="background:none; border:none; color:var(--text-muted); padding:0; cursor:${canMoveDown ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};"><i data-lucide="chevron-down" style="font-size: 0.75rem;"></i></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.15rem; min-width:0;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="background:${badge.bg}; color:white; font-size:0.55rem; padding:2px 6px; border-radius:4px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; opacity:0.9;">${badge.label.split(' ')[1] || badge.label}</span>
                    <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}${p.componentType === 'uszczelka' && item.quantity > 1 ? ` (x${item.quantity} szt.)` : p.componentType === 'uszczelka' ? ` (1 szt.)` : ''}</div>
                  </div>
                  <div style="font-size:0.65rem; color:var(--text-muted); opacity:0.6; padding-left:2px;">${p.id}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
                </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.6rem; flex-shrink:0; min-width:340px;">
              <div style="display:grid; grid-template-columns:36px 65px 60px 48px 120px; gap:0 0.5rem; align-items:baseline;">
                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">WAGA:</span>
                <span style="color:rgba(255,255,255,0.95); font-weight:700; font-size:0.82rem; white-space:nowrap; text-align:right;">${p.weight || totalWeight > 0 ? fmtInt(totalWeight) + ' kg' : '—'}</span>
                
                <div style="width:60px;"></div>
                
                <span style="font-size:0.52rem; color:rgba(255,255,255,0.25); font-weight:800; letter-spacing:0.6px; text-align:left;">CENA:</span>
                <span style="font-size:1.0rem; font-weight:800; color:var(--success); white-space:nowrap; letter-spacing:0.3px; text-align:right; width:100%; display:block;">${p.componentType === 'kineta' ? 'wliczone (' + fmtInt(totalPrice) + ' PLN)' : fmtInt(totalPrice) + ' PLN'}</span>
              </div>
              <div style="width:32px; display:flex; justify-content:center;">
                <button onclick="removeWellComponent(${index})" title="Usuń" style="width:32px; height:32px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:8px; cursor:pointer; font-size:0.9rem; color:#ef4444; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)'; this.style.borderColor='rgba(239,68,68,0.4)';" onmouseleave="this.style.background='rgba(239,68,68,0.06)'; this.style.borderColor='rgba(239,68,68,0.2)';"><i data-lucide="x"></i></button>
              </div>
            </div>

          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

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

    // Swap elements
    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;

    // Enable manual mode since user is reordering
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    updateHeightIndicator(); // Odśwież błędy po przesunięciu
}

/* ===== ZAKOŃCZENIE (WYBÓR ZAMKNIĘCIA GÓRNEGO) ===== */

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.zakonczenie = productId;
    closeModal();

    // Zapisz jako domyślne na poziomie oferty dla nowych studni
    offerDefaultZakonczenie = productId;

    // Aktualizuj etykietę przycisku, aby pokazać bieżący wybór
    updateZakonczenieButton();

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        showToast(`Zakończenie: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie: Auto (Konus)', 'success');
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== REDUKCJA DN1000 ===== */
async function toggleRedukcja() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (![1200, 1500, 2000, 2500].includes(well.dn)) {
        showToast('Redukcja DN1000 dostępna tylko dla studni DN ≥ 1200', 'error');
        return;
    }

    well.redukcjaDN1000 = !well.redukcjaDN1000;
    offerDefaultRedukcja = well.redukcjaDN1000; // zapisz jako domyślne na poziomie oferty
    updateRedukcjaButton();

    if (well.redukcjaDN1000) {
        showToast('Redukcja DN1000 — WŁĄCZONA', 'success');
    } else {
        showToast('Redukcja DN1000 — WYŁĄCZONA', 'info');

        // Reset ewentualnego nadpisanego błędem "Zakoczenia" dla rury DN1000 i samej redukcji
        well.zakonczenie = null;
        offerDefaultZakonczenie = null;
        well.redukcjaZakonczenie = null;
        offerDefaultRedukcjaZak = null;
        updateZakonczenieButton();

        const btnZak = document.getElementById('btn-redukcja-zak');
        if (btnZak) {
            btnZak.innerHTML =
                '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zak. DN1000';
            btnZak.style.borderColor = 'var(--border-glass)';
            btnZak.style.color = '';
        }
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== PSIA BUDA ===== */
async function togglePsiaBuda() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    well.psiaBuda = !well.psiaBuda;
    updatePsiaBudaButton();

    if (well.psiaBuda) {
        showToast('Tryb Psia buda — WŁĄCZONY', 'success');

        // Backup parametrów
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };

        // Automatyczne ustawienie na "brak"
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        showToast('Tryb Psia buda — WYŁĄCZONY', 'info');

        // Przywracanie parametrów, jeśli backup istnieje
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }

    // Odśwież UI parametrów (wellManager.js)
    if (typeof renderWellParams === 'function') renderWellParams();

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

async function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.redukcjaZakonczenie = productId;
    offerDefaultRedukcjaZak = productId;
    closeModal();

    // Update button label
    const btn = document.getElementById('btn-redukcja-zak');
    if (btn) {
        if (productId) {
            const p = studnieProducts.find((pr) => pr.id === productId);
            btn.innerHTML =
                '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> ' +
                (p
                    ? p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)
                    : 'Zak. DN1000');
            btn.style.borderColor = 'rgba(99,102,241,0.5)';
            btn.style.color = '#a78bfa';
        } else {
            btn.innerHTML =
                '<span style="font-size:0.75rem;"><i data-lucide="chevron-down"></i></span> Zak. DN1000';
            btn.style.borderColor = 'var(--border-glass)';
            btn.style.color = '';
        }
    }

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        showToast(`Zakończenie redukcji: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie redukcji: Auto (Konus DN1000)', 'success');
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (!well.autoLocked && well.redukcjaDN1000) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== WYBÓR DN ===== */
function selectDN(dn) {
    if (dn === 'styczna') {
        const well = getCurrentWell();
        if (!well) {
            showToast('Najpierw dodaj studnię', 'error');
            return;
        }
        showStycznaPopup('select');
        return;
    }

    doSelectDN(dn);
}

/**
 * Wewnętrzna logika zmiany DN (wywoływana bezpośrednio dla DN numerycznych
 * lub po wyborze wariantu stycznej z popupu).
 */
function doSelectDN(dn) {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.dn !== dn) {
        well.dn = dn;
        // Aktualizuj nazwę, jeśli używa formatu domyślnego
        if (
            !well.numer ||
            well.name.startsWith('Studnia DN') ||
            well.name.startsWith('Studnia Styczna')
        ) {
            well.name =
                well.numer ||
                (dn === 'styczna'
                    ? 'Studnia Styczna (#' + (currentWellIndex + 1) + ')'
                    : 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')');
        }

        // Aktualizuj zakończenie, aby pasowało do nowego DN (jeśli jest standardowe)
        if (well.zakonczenie && dn !== 'styczna') {
            const oldProd = studnieProducts.find((p) => p.id === well.zakonczenie);
            if (oldProd) {
                const newProd = studnieProducts.find(
                    (p) => p.componentType === oldProd.componentType && p.dn === dn
                );
                well.zakonczenie = newProd ? newProd.id : null;
            } else {
                well.zakonczenie = null;
            }
        }

        // Wyczyść stare elementy, które nie pasują do nowego DN i uruchom ponownie auto-dobór
        well.config = [];
        autoSelectComponents(true);
        refreshAll();
    }

    updateDNButtons();
    renderTiles();
    renderWellsList();
}

function updateDNButtons() {
    const well = getCurrentWell();
    document.querySelectorAll('.dn-btn').forEach((b) => {
        if (!well) {
            b.classList.remove('active');
            return;
        }

        let btnText = b.textContent.trim().toLowerCase();
        let wellDnStr = String(well.dn).toLowerCase();

        if (btnText === wellDnStr) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

/* ===== DRAG & DROP FOR CONCRETE CONFIG ===== */
let draggedCfgIndex = null;

window.handleCfgDragStart = function (e) {
    draggedCfgIndex = parseInt(e.currentTarget.getAttribute('data-cfg-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';

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
                // Find existing placeholder index
                const plIdx = well.config.findIndex((c) => c.isPlaceholder);

                if (plIdx !== dropIndex) {
                    const p = studnieProducts.find(
                        (x) => x.id === window.currentDraggedPlaceholderId
                    );
                    if (p) {
                        // Remove old placeholder
                        if (plIdx > -1) well.config.splice(plIdx, 1);

                        // Because splicing might shift indices, find new effective drop index
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
        } else if (window.currentDraggedPlaceholderId) {
            tile.style.borderTop = '';

            enforceSingularTopClosures(well, window.currentDraggedPlaceholderId);

            well.config = well.config.filter((c) => !c.isPlaceholder);

            const addedProductId = window.currentDraggedPlaceholderId;
            well.config.splice(dropIndex, 0, { productId: addedProductId, quantity: 1 });

            if (typeof window.injectPairIfReliefComponent === 'function') {
                window.injectPairIfReliefComponent(well, addedProductId, dropIndex);
            }

            window.currentDraggedPlaceholderId = null;

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            sortWellConfigByOrder();
            syncGaskets(well);

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
