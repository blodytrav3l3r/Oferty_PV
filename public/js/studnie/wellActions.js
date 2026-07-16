// @ts-check
/* ===== Extracted to actionsConfigRender.js, actionsTiles.js, actionsCrud.js, actionsDrag.js, actionsElevation.js ===== */

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

    // Wlacz tryb reczny poniewaz uzytkownik zmienia kolejnosc
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }
    well.configSource = 'MANUAL';

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    updateHeightIndicator(); // Odśwież błędy po przesunięciu
}

/* ===== ZAKOŃCZENIE (WYBÓR ZAMKNIĘCIA GÓRNEGO) ===== */

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.zakonczenie = productId;

    // Zapisz do per-DN mapy dla stycznych (zapamiętaj wybór na potem)
    if (well.dn === 'styczna') {
        const currentDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.zakonczenieByDn = well.zakonczenieByDn || {};
        well.zakonczenieByDn[currentDn] = productId;
    }

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

/* ===== REDUKCJA ===== */
async function toggleRedukcja() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (![1200, 1500, 2000, 2500].includes(well.dn) && well.dn !== 'styczna') {
        showToast('Redukcja dostępna tylko dla studni DN ≥ 1200', 'error');
        return;
    }

    // Dla DN1500+ i Stycznej pokazujemy wybór
    if ([1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna') {
        if (typeof openRedukcjaChoicePopup === 'function') {
            openRedukcjaChoicePopup();
            return;
        }
    }

    // Standardowa logika dla DN1200 (tylko DN1000)
    well.redukcjaDN1000 = !well.redukcjaDN1000;
    well.redukcjaTargetDN = 1000;
    offerDefaultRedukcja = well.redukcjaDN1000;
    updateRedukcjaButton();

    if (well.redukcjaDN1000) {
        showToast('Redukcja DN1000 — WŁĄCZONA', 'success');
    } else {
        showToast('Redukcja — WYŁĄCZONA', 'info');

        well.zakonczenie = null;
        offerDefaultZakonczenie = null;
        well.redukcjaZakonczenie = null;
        offerDefaultRedukcjaZak = null;
        updateZakonczenieButton();
        if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
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

/* ===== NADBUDOWA STYCZNA DN1200 ===== */
async function toggleStyczna1200() {
    const well = getCurrentWell();
    if (!well || well.dn !== 'styczna') return;

    const oldDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    well.stycznaNadbudowa1200 = !well.stycznaNadbudowa1200;
    updateStyczna1200Button();

    const newDn = well.stycznaNadbudowa1200 ? 1200 : 1000;

    // Zakończenie studni — zapamiętaj dla starego DN, przywróć dla nowego
    well.zakonczenieByDn = well.zakonczenieByDn || {};
    if (well.zakonczenie) well.zakonczenieByDn[oldDn] = well.zakonczenie;
    well.zakonczenie = well.zakonczenieByDn[newDn] || null;
    // Jeśli brak zapisanego dla nowego DN, znajdź ten sam typ co w starym
    if (!well.zakonczenie && well.zakonczenieByDn[oldDn]) {
        well.zakonczenie = findClosureForDn(well.zakonczenieByDn[oldDn], newDn);
        if (well.zakonczenie) well.zakonczenieByDn[newDn] = well.zakonczenie;
    }
    if (typeof updateZakonczenieButton === 'function') updateZakonczenieButton();

    // Redukcja
    if (well.redukcjaDN1000) {
        well.redukcjaTargetDN = newDn;
        well.redukcjaZakonczenieByDn = well.redukcjaZakonczenieByDn || {};
        if (well.redukcjaZakonczenie)
            well.redukcjaZakonczenieByDn[oldDn] = well.redukcjaZakonczenie;
        well.redukcjaZakonczenie = well.redukcjaZakonczenieByDn[newDn] || null;
        if (!well.redukcjaZakonczenie && well.redukcjaZakonczenieByDn[oldDn]) {
            well.redukcjaZakonczenie = findClosureForDn(well.redukcjaZakonczenieByDn[oldDn], newDn);
            if (well.redukcjaZakonczenie)
                well.redukcjaZakonczenieByDn[newDn] = well.redukcjaZakonczenie;
        }
        if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    }

    if (well.stycznaNadbudowa1200) {
        showToast('Nadbudowa dla studni stycznej: DN1200', 'success');
    } else {
        showToast('Nadbudowa dla studni stycznej: DN1000', 'info');
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

function updateStyczna1200Button() {
    const well = getCurrentWell();
    const btn = document.getElementById('btn-styczna-1200');
    if (!btn) return;

    if (well && well.dn === 'styczna') {
        btn.style.display = 'inline-block';
        if (well.stycznaNadbudowa1200) {
            btn.innerHTML = 'Nadbudowa DN1200';
            btn.classList.add('bg-accent-subtle', 'border-accent-subtle', 'color-accent');
        } else {
            btn.innerHTML = 'Nadbudowa DN1200';
            btn.classList.remove('bg-accent-subtle', 'border-accent-subtle', 'color-accent');
            btn.style.borderColor = 'var(--border-glass)';
        }
    } else {
        btn.style.display = 'none';
        if (well) well.stycznaNadbudowa1200 = false;
    }
}

async function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.redukcjaZakonczenie = productId;
    offerDefaultRedukcjaZak = productId;

    // Zapisz do per-DN mapy dla stycznych
    if (well.dn === 'styczna') {
        const currentDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.redukcjaZakonczenieByDn = well.redukcjaZakonczenieByDn || {};
        well.redukcjaZakonczenieByDn[currentDn] = productId;
    }

    closeModal();

    if (typeof updateRedukcjaZakButton === 'function') {
        updateRedukcjaZakButton();
    }

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        const isRelief =
            p &&
            ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(
                p.componentType
            );

        if (isRelief) {
            showToast(`Zakończenie redukcji: Dodano komplet odciążający (${p.name})`, 'success');
        } else {
            showToast(`Zakończenie redukcji: ${p ? p.name : productId}`, 'success');
        }
    } else {
        showToast('Zakończenie redukcji: Auto', 'success');
    }

    // Wymuś parowanie elementów odciążających w konfiguracji
    if (typeof ensureReliefRingPair === 'function') {
        ensureReliefRingPair(well);
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

/* ===== PRZECIAGNIJ I UPUSC DLA KONFIGURACJI BETONOWEJ ===== */
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
