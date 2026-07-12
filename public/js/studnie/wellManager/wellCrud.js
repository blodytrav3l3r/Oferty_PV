// @ts-check
/* ===== ZARZĄDZANIE STUDNIAMI ===== */

/** Odczytuje parametry globalne z kroku 2 kreatora z kafelków UI */
function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladkaDennica: 'brak',
        wkladkaNadbudowa: 'brak',
        wkladkaZwienczenie: 'brak',
        klasaBetonu: 'C40/50',
        agresjaChemiczna: 'XA1',
        agresjaMrozowa: 'XF1',
        klasaNosnosci_korpus: 'D400',
        klasaNosnosci_zwienczenie: 'D400',
        malowanieW: 'brak',
        malowanieZ: 'brak',
        powlokaNameW: '',
        powlokaNameZ: '',
        kineta: 'brak',
        spocznik: 'brak',
        redukcjaKinety: 'nie',
        stopnie: 'brak',
        spocznikH: '1/2',
        uszczelka: 'GSG',
        magazyn: 'Kluczbork',
        precoFullHeight: 'nie'
    };
    // Odczytaj potwierdzone wybory z kafelków parametrów kreatora
    document.querySelectorAll('#wizard-step-2 .param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        if (!paramName) return;
        const activeBtn = group.querySelector('.param-tile.active');
        if (activeBtn) {
            params[paramName] = activeBtn.getAttribute('data-val');
        }
    });

    // Obsługa wkładki PEHD z sub-opcjami
    const wkladkaGlobal = params.wkladka || 'brak';
    if (wkladkaGlobal !== 'brak') {
        const cbDennica = document.getElementById('pehd-dennica');
        const cbNadbudowa = document.getElementById('pehd-nadbudowa');
        const cbZwienczenie = document.getElementById('pehd-zwienczenie');
        params.wkladkaDennica = cbDennica && cbDennica.checked ? wkladkaGlobal : 'brak';
        params.wkladkaNadbudowa = cbNadbudowa && cbNadbudowa.checked ? wkladkaGlobal : 'brak';
        params.wkladkaZwienczenie = cbZwienczenie && cbZwienczenie.checked ? wkladkaGlobal : 'brak';
    } else {
        params.wkladkaDennica = 'brak';
        params.wkladkaNadbudowa = 'brak';
        params.wkladkaZwienczenie = 'brak';
    }

    // Odczytaj pola tekstowe
    const pwW = document.getElementById('powloka-name-w');
    if (pwW) params.powlokaNameW = pwW.value || '';
    const pwZ = document.getElementById('powloka-name-z');
    if (pwZ) params.powlokaNameZ = pwZ.value || '';
    const mccW = document.getElementById('malowanie-wew-cena');
    if (mccW) params.malowanieWewCena = parseFloat(mccW.value) || 0;
    const mccZ = document.getElementById('malowanie-zew-cena');
    if (mccZ) params.malowanieZewCena = parseFloat(mccZ.value) || 0;
    return params;
}

/**
 * @param {string|null} name
 * @param {string|number} [dn=1000]
 */
function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    const defaultName =
        dn === 'styczna'
            ? 'Studnia Styczna (#' + wellCounter + ')'
            : 'Studnia DN' + dn + ' (#' + wellCounter + ')';
    const well = {
        id: 'well-' + Date.now() + '-' + wellCounter,
        name: name || defaultName,
        dn: dn,
        config: [],
        przejscia: [],
        doplata: 0,
        rzednaWlazu: null,
        rzednaDna: null,
        numer: '',
        autoLocked: false,
        autoSelect: true,
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladkaDennica: gp.wkladkaDennica || 'brak',
        wkladkaNadbudowa: gp.wkladkaNadbudowa || 'brak',
        wkladkaZwienczenie: gp.wkladkaZwienczenie || 'brak',
        klasaBetonu: gp.klasaBetonu,
        agresjaChemiczna: gp.agresjaChemiczna,
        agresjaMrozowa: gp.agresjaMrozowa,
        klasaNosnosci_korpus: gp.klasaNosnosci_korpus,
        klasaNosnosci_zwienczenie: gp.klasaNosnosci_zwienczenie,
        malowanieW: gp.malowanieW,
        malowanieZ: gp.malowanieZ,
        powlokaNameW: gp.powlokaNameW,
        powlokaNameZ: gp.powlokaNameZ,
        malowanieWewCena: gp.malowanieWewCena,
        malowanieZewCena: gp.malowanieZewCena,
        kineta: gp.kineta,
        spocznik: gp.spocznik,
        redukcjaKinety: gp.redukcjaKinety,
        stopnie: gp.stopnie,
        spocznikH: gp.spocznikH,
        usytuowanie: gp.usytuowanie,
        uszczelka: gp.uszczelka,
        magazyn: gp.magazyn,
        precoFullHeight: gp.precoFullHeight
    };

    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
        if (well.zakonczenie) {
            const p = studnieProducts.find((pr) => pr.id === well.zakonczenie);
            if (p && p.componentType === 'konus') {
                well.zakonczenie = null;
            }
        }
        if (well.redukcjaZakonczenie) {
            const p = studnieProducts.find((pr) => pr.id === well.redukcjaZakonczenie);
            if (p && p.componentType === 'konus') {
                well.redukcjaZakonczenie = null;
            }
        }
    }

    if (typeof autoUpdateWellName === 'function') {
        // wellCounter - 1, aby był 0-indeksowany dla argumentu index
        autoUpdateWellName(well, wellCounter - 1);
    }

    return well;
}

/* ===== BLOKADA OFERTY (per-studnia po utworzeniu zamówienia) ===== */
// OFFER_LOCKED_MSG i WELL_LOCKED_MSG przeniesione do wellUI.js

/**
 * Sprawdza czy aktualna studnia jest zablokowana.
 * Blokada działa per-studnia - studnie dodane do zamówienia
 * lub z zaakceptowanym zleceniem produkcyjnym są nieedytowalne.
 */
function isOfferLocked() {
    if (orderEditMode) return false;
    return isWellLocked();
}

function isWellLocked(wellIdx) {
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;

    // ZAWSZE blokuj jeśli jest zaakceptowane zlecenie produkcyjne (nawet w trybie edycji zamówienia)
    const hasAcceptedPO = (
        typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
    ).some((po) => po.wellId === well.id && po.status === 'accepted');
    if (hasAcceptedPO) return true;

    // W trybie edycji zamówienia reszta jest edytowalna
    if (orderEditMode) return false;

    // Sprawdź, czy studnia jest częścią istniejącego zamówienia
    if (typeof isWellOrdered === 'function' && isWellOrdered(well)) return true;

    return false;
}

// renderOfferLockBanner() przeniesiona do wellUI.js

function addNewWell(dn = /** @type {string|number} */ (1000)) {
    if (enforceGlobalKonusPehdRule()) {
        showToast(
            'Nie można dodać nowej studni, dopóki nie rozwiążesz konfliktu Konus+PEHD w poprzedniej.',
            'error'
        );
        return;
    }
    if (dn === 'styczna') {
        showStycznaPopup('add');
        return;
    }
    const well = createNewWell(null, dn);
    wells.push(well);
    currentWellIndex = wells.length - 1;
    // Automatycznie przełącz zakładkę kreatora
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
        switchBuilderTab('concrete');
    }
    refreshAll();
    showToast(`Dodano: ${well.name}`, 'success');
}

function duplicateWell(index) {
    if (enforceGlobalKonusPehdRule()) {
        showToast(
            'Nie można skopiować studni, dopóki nie rozwiążesz konfliktu Konus+PEHD.',
            'error'
        );
        return;
    }
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = structuredClone(src);
    copy.id = 'well-' + Date.now() + '-' + wellCounter;
    copy.name = src.name + ' (kopia)';
    wells.splice(index + 1, 0, copy);
    currentWellIndex = index + 1;
    refreshAll();
    showToast(`Skopiowano: ${copy.name}`, 'success');
}

async function removeWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked(index)) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    if (
        !(await appConfirm(`Usunąć "${wells[index].name}"?`, {
            title: 'Usuwanie studni',
            type: 'danger'
        }))
    )
        return;
    wells.splice(index, 1);
    if (currentWellIndex >= wells.length) currentWellIndex = Math.max(0, wells.length - 1);
    refreshAll();
    showToast('Studnia usunięta', 'info');
}

function selectWell(index) {
    if (index < 0 || index >= wells.length) return;
    currentWellIndex = index;
    refreshAll(true); // skipSummary = true, aby nie odrysowywać ogromnego panelu po prawej
}

function renameWell(index) {
    if (isWellLocked(index)) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.numer = name.trim().replace(/ (PRE|UTH)$/, '');
        if (typeof autoUpdateWellName === 'function') {
            autoUpdateWellName(well, index);
        } else {
            well.name = name.trim();
        }
        renderWellsList();
        renderOfferSummary();
    }
}

function getCurrentWell() {
    if (wells.length === 0) return null;
    return wells[currentWellIndex] || wells[0];
}

function recalcGaskets(well) {
    if (!well) well = getCurrentWell();
    if (!well) return;

    // Zapisz zamrożone ceny istniejących uszczelek (aby zachować je w zamówieniach)
    const existingGasketPrices = new Map();
    well.config.forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (p && p.componentType === 'uszczelka' && item.frozenPrice != null) {
            existingGasketPrices.set(item.productId, {
                frozenPrice: item.frozenPrice,
                frozenPriceBase: item.frozenPriceBase
            });
        }
    });

    // Wyfiltruj istniejące uszczelki
    const newConfig = well.config.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'uszczelka');
    });

    if (well.uszczelka && well.uszczelka !== 'brak') {
        const uType = well.uszczelka;
        const requiredGaskets = {};

        // Znajdź indeks najniższej dennicy
        let bottomDennicaIndex = -1;
        for (let i = newConfig.length - 1; i >= 0; i--) {
            const p = studnieProducts.find((pr) => pr.id === newConfig[i].productId);
            if (p && p.componentType === 'dennica') {
                bottomDennicaIndex = i;
                break;
            }
        }

        // Znajdź elementy wymagające uszczelki
        newConfig.forEach((item, index) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (
                p &&
                ['krag', 'krag_ot', 'plyta_din', 'plyta_redukcyjna', 'konus'].includes(
                    p.componentType
                )
            ) {
                if (p.dn) {
                    requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                }
            } else if (p && p.componentType === 'dennica') {
                if (p.dn) {
                    if (index === bottomDennicaIndex) {
                        // Denica konstrukcyjne dno potrzebuje uszczelki tylko gdy ilość > 1
                        if (item.quantity > 1) {
                            requiredGaskets[p.dn] =
                                (requiredGaskets[p.dn] || 0) + (item.quantity - 1);
                        }
                    } else {
                        // Wszystkie pozostałe dennice potrzebują uszczelek dla siebie
                        requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                    }
                }
            }
        });

        // Dodaj odpowiednie uszczelki
        for (const dn in requiredGaskets) {
            const qty = requiredGaskets[dn];
            let gasketName = `Uszczelka GSG DN${dn}`;
            if (uType === 'GSG') gasketName = `Uszczelka GSG DN${dn}`;
            else if (uType === 'SDV') gasketName = `Uszczelka SDV DN${dn}`;
            else if (uType === 'SDV PO')
                gasketName = `Uszczelka SDV DN${dn} SDV z pierścieniem odciążającym`;
            else if (uType === 'NBR') gasketName = `Uszczelka GSG DN${dn} z NBR`;

            const gasketProd = studnieProducts.find(
                (p) => p.componentType === 'uszczelka' && p.name === gasketName
            );
            if (gasketProd) {
                const newItem = {
                    productId: gasketProd.id,
                    quantity: qty,
                    autoAdded: true
                };
                // Przywróć zamrożone ceny jeśli uszczelka już istniała (dla zamówień)
                const savedPrices = existingGasketPrices.get(gasketProd.id);
                if (savedPrices) {
                    newItem.frozenPrice = savedPrices.frozenPrice;
                    if (savedPrices.frozenPriceBase != null) {
                        newItem.frozenPriceBase = savedPrices.frozenPriceBase;
                    }
                }
                newConfig.push(newItem);
            }
        }
    }

    well.config = newConfig;
}
