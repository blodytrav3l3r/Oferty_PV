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
        showToast('Nie można dodać nowej studni, dopóki nie rozwiążesz konfliktu Konus+PEHD w poprzedniej.', 'error');
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
        showToast('Nie można skopiować studni, dopóki nie rozwiążesz konfliktu Konus+PEHD.', 'error');
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

/* ===== PRECO — pomocniki wyceny ===== */

/**
 * Oblicza pełną wycenę PRECO dla studni.
 * Deleguje do czystej funkcji w precoCalcCore.js (testowalnej).
 */
function calcPrecoPricing(well) {
    return calcPrecoPricingPure(well, {
        precoPricing: precoPricing,
        studnieProducts: studnieProducts,
        FLOW_TYPES: FLOW_TYPES,
        showToast: (typeof showToast === 'function') ? showToast : undefined
    });
}

/** Sprawdza, czy studnia jest osadnikiem (wszystkie przejścia są wyżej niż dno) */
function isSettlingWell(well) {
    if (!well || !well.przejscia || well.przejscia.length === 0) return false;
    const rzDna = parseFloat(well.rzednaDna) || 0;
    // Sprawdź czy którekolwiek przejście jest "przy dnie" (tolerancja 1mm)
    for (const p of well.przejscia) {
        const rzWl = parseFloat(p.rzednaWlaczenia) || rzDna;
        const diff = (rzWl - rzDna) * 1000;
        if (diff <= 1) return false; // przejście jest przy dnie
    }
    return true;
}



function syncKineta(well) {
    if (!well || !well.config) return;

    // Jeżeli wybrana jest jakaś kineta (inna niż brak) i spocznik = brak → domyślnie spocznik beton
    if (well.kineta && well.kineta !== 'brak') {
        if (!well.spocznik || well.spocznik === 'brak') {
            well.spocznik = 'beton';
            if (typeof showToast === 'function') showToast('Domyślny spocznik (Beton) został wybrany automatycznie.', 'info');
        }
    } else {
        // Jeżeli kineta = brak → spocznik MUSI być brak
        if (well.spocznik && well.spocznik !== 'brak') {
            well.spocznik = 'brak';
            well.spocznikH = 'brak';
            if (typeof showToast === 'function') showToast('Spocznik wyczyszczony. Wybierz najpierw Kinetę.', 'warning');
        }
    }

    // Studnia osadnikowa z wkładką PRECO → kineta i spocznik = brak
    if (well.wkladkaOsadnikPreco === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
        // Usuń istniejące kinety z konfiguracji
        well.config = well.config.filter((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            return !(p && p.componentType === 'kineta');
        });
        
        if (!well.wkladkaOsadnikH) {
            let dennicaHeight = 0;
            if (well.config) {
                well.config.forEach(item => {
                    const p = studnieProducts.find(pr => pr.id === item.productId);
                    if (p && (p.componentType === 'dennica' || p.componentType === 'styczna')) {
                        dennicaHeight += (p.height || 0) * (item.quantity || 1);
                    }
                });
            }
            well.wkladkaOsadnikH = dennicaHeight || 1000;
        }

        // Czyszczenie starego kosztu
        if (well.config) {
            well.config.forEach(item => {
                delete item._osadnikCost;
            });
        }
        return;
    }
    
    // Wyczyść koszt osadnika jeśli wyłączono
    if (well.config) {
        well.config.forEach(item => {
            delete item._osadnikCost;
        });
    }

    // PRECO / PrecoTop → wymuszenie spocznikH = '1/1'
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        well.spocznikH = '1/1';
    }

    // Wyfiltruj istniejącą kinetę
    const newConfig = well.config.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'kineta');
    });

    const hasDennica = (well.config || []).some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'dennica';
    });


    if (hasDennica && well.spocznikH && well.spocznikH !== 'brak') {
        const kinetaProd = studnieProducts.find(
            (p) =>
                p.componentType === 'kineta' &&
                parseInt(p.dn) === parseInt(well.dn) &&
                p.spocznikH === well.spocznikH
        );
        if (kinetaProd) {
            newConfig.push({
                productId: kinetaProd.id,
                quantity: 1,
                autoAdded: true
            });
        }
    }

    well.config = newConfig;
}

function enforceGlobalKonusPehdRule() {
    if (typeof wells === 'undefined' || !wells || wells.length === 0) return false;
    
    // Zapobieganie wielokrotnemu otwieraniu modala
    if (window.konusResolverOpen) return false;

    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak') {
            let hasKonus = false;
            
            // 1. Sprawdź obecną konfigurację
            if (w.config && w.config.length > 0) {
                const found = w.config.some(c => {
                    const p = studnieProducts.find(pr => pr.id === c.productId);
                    return p && p.componentType === 'konus';
                });
                if (found) hasKonus = true;
            }

            // 2. Sprawdź wymuszone domyślne zakończenia
            if (w.zakonczenie) {
                const p = studnieProducts.find(pr => pr.id === w.zakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }
            if (w.redukcjaZakonczenie) {
                const p = studnieProducts.find(pr => pr.id === w.redukcjaZakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }

            if (hasKonus) {
                if (typeof window.showKonusPehdResolverModal === 'function') {
                    showToast('Wykryto niedozwoloną konfigurację (Konus + PEHD) w studni #' + (i + 1) + '. Wymagana zmiana.', 'error');
                    window.showKonusPehdResolverModal(i);
                    return true; // Zwracamy true, co oznacza że zablokowaliśmy akcję i pokazaliśmy modal
                }
            }
        }
    }
    return false;
}

let __refreshAllDepth = 0;
const __MAX_REFRESH_DEPTH = 5;
function refreshAll(skipSummary = false) {
    __refreshAllDepth++;
    if (__refreshAllDepth > __MAX_REFRESH_DEPTH) {
        logger.error('wellManager', '========================================');
        logger.error('wellManager', 'DETEKCJA NIESKOŃCZONEJ PĘTLI refreshAll!');
        logger.error('wellManager', 'Głębokość:', __refreshAllDepth);
        logger.error('wellManager', 'Stack trace:', new Error().stack);
        logger.error('wellManager', '========================================');
        __refreshAllDepth = 0;
        return;
    }
    enforceGlobalKonusPehdRule();

    const well = getCurrentWell();
    if (well) {
        recalcGaskets(well);
        syncKineta(well);
    }

    renderWellsList();
    renderTiles();
    renderWellConfig();
    renderWellPrzejscia();
    renderWellDiagram();
    updateSummary();
    updateDNButtons();
    syncElevationInputs();
    updateAutoLockUI();
    updateZakonczenieButton();
    updateRedukcjaButton();
    if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    if (typeof updatePsiaBudaButton === 'function') updatePsiaBudaButton();
    if (typeof updateStyczna1200Button === 'function') updateStyczna1200Button();
    updateParamTilesUI();
    renderWellParams();
    
    if (!skipSummary) {
        renderOfferSummary();
    }
    
    if (orderEditMode) renderOrderModeBanner();

    // Wymuszenie przetworzenia ikon tylko w zaktualizowanych kontenerach
    // globalny skan, ale szybki, bo omija te, które już stały się <svg>
    if (window.lucide) window.lucide.createIcons();
    __refreshAllDepth--;
}

/* ===== PARAMETRY OGÓLNE (KAFELKI) — przeniesione do wellUI.js ===== */

async function updateWellParam(paramKey, value) {
    if (isWellLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    const oldParamVal = well[paramKey];
    well[paramKey] = value;
    
    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(w => {
            w[paramKey] = value;
        });
        showToast('Zaktualizowano cenę malowania we wszystkich studniach', 'info');
    }

    // Studnia osadnikowa z wkładką PRECO → wymusz kineta=brak, spocznik=brak
    if (paramKey === 'wkladkaOsadnikPreco' && value === 'tak') {
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.precoFullHeight = 'tak';
    }

    // Domyślne "nie" dla wkładki na całą wysokość przy wyborze kinety PRECO
    if (paramKey === 'kineta' && (value === 'preco' || value === 'precotop')) {
        // Automatically default precoFullHeight to 'nie' when preco is selected for this well
        if (oldParamVal !== 'preco' && oldParamVal !== 'precotop') {
            well.precoFullHeight = 'nie';
        }
        // Wkładka PRECO → kineta zawsze 1/1
        well.spocznikH = '1/1';
    }

    // Automatyczne dopasowanie spocznika do kinety (jeśli ma ten sam materiał)
    if (paramKey === 'kineta') {
        const syncValues = ['beton', 'beton_gfk', 'klinkier', 'preco', 'precotop', 'unolith', 'predl', 'kamionka', 'brak'];
        if (syncValues.includes(value)) {
            well.spocznik = value;
        }
        if (typeof autoUpdateWellName === 'function') {
            const idx = wells.indexOf(well);
            autoUpdateWellName(well, idx);
            // Wywołaj renderWellsList by zaktualizować na liście po lewej stronie
            renderWellsList();
        }
    }

    // PRECO / PrecoTop → nie pozwalaj na zmianę spocznikH (wymuszenie 1/1)
    if (paramKey === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) {
        well.spocznikH = '1/1';
        showToast('Przy wkładce PRECO kineta musi być 1/1', 'warning');
    }

    // Sprawdzenie konusa dla wkładki na zwieńczenie
    if (paramKey === 'wkladkaZwienczenie' && value !== 'brak') {
        const hasKonus = well.config && well.config.some(c => {
            const p = studnieProducts.find(pr => pr.id === c.productId);
            return p && p.componentType === 'konus';
        });
        if (hasKonus && typeof window.showKonusPehdResolverModal === 'function') {
            window.showKonusPehdResolverModal(currentWellIndex);
        }
    }

    enforceLoadClassRules(well, paramKey);
    renderWellParams();
    updateParamTilesUI();
    updateAutoLockUI();

    if (typeof updateConfigToMatchParams === 'function') {
        updateConfigToMatchParams(well);
    }
    // Po zamianie elementów zawsze uruchom ponowny auto-dobór (jeśli studnia nie jest zablokowana)
    if (!well.autoLocked) {
        await autoSelectComponents(true);
    }

    refreshAll();
    /* Odśwież tabelę excela jeśli modal otwarty — tylko przy zmianie z zewnątrz */
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
}

function resetWellParamsToDefaults() {
    const well = getCurrentWell();
    if (!well) return;
    const gp = getWizardGlobalParams();
    WELL_PARAM_DEFS.forEach((def) => {
        if (gp[def.key] !== undefined) well[def.key] = gp[def.key];
    });
    // Zresetuj również nazwy powłok
    well.powlokaNameW = gp.powlokaNameW || '';
    well.powlokaNameZ = gp.powlokaNameZ || '';
    renderWellParams();
    updateParamTilesUI();
    showToast('Parametry studni zresetowane do domyślnych z Kroku 2', 'success');
}

window.updateWellParam = updateWellParam;
window.resetWellParamsToDefaults = resetWellParamsToDefaults;

/* ===== ZASTOSUJ PARAMETRY GLOBALNE DO WSZYSTKICH STUDNI ===== */
async function applyGlobalParamsToAllWells() {
    const gp = getWizardGlobalParams();
    if (wells.length === 0) {
        showToast('Brak studni w ofercie. Dodaj studnię przed zastosowaniem parametrów.', 'info');
        return;
    }
    // Podziel studnie na edytowalne i zablokowane
    const editable = [];
    const locked = [];
    wells.forEach((w, i) => {
        if (isWellLocked(i)) {
            locked.push(w);
        } else {
            editable.push({ well: w, index: i });
        }
    });
    if (editable.length === 0) {
        showToast('Wszystkie studnie są zablokowane. Nie można zastosować parametrów.', 'error');
        return;
    }
    let msg = `Zastosować parametry ogólne do ${editable.length} studni?`;
    if (locked.length > 0) {
        msg += `\n${locked.length} studni zostanie pominiętych (zablokowane).`;
    }
    if (!confirm(msg)) return;
    const prevWellIndex = currentWellIndex;
    for (const { well, index } of editable) {
        for (const key of Object.keys(gp)) {
            well[key] = gp[key];
        }
        // Kineta → spocznik i reguły PRECO
        const kinetaVal = gp.kineta;
        if (kinetaVal) {
            const syncValues = ['beton', 'beton_gfk', 'klinkier', 'preco', 'precotop', 'unolith', 'predl', 'kamionka', 'brak'];
            if (syncValues.includes(kinetaVal)) {
                well.spocznik = kinetaVal;
            }
            if (kinetaVal === 'preco' || kinetaVal === 'precotop') {
                well.spocznikH = '1/1';
                well.precoFullHeight = gp.precoFullHeight || 'nie';
            }
        }
        enforceLoadClassRules(well, 'klasaNosnosci_korpus');
        enforceLoadClassRules(well, 'nadbudowa');
        enforceLoadClassRules(well, 'dennicaMaterial');
        // Konus + PEHD — wyzeruj wkładkę zwieńczenia
        if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
            const hasKonus = well.config && well.config.some(c => {
                const p = studnieProducts.find(pr => pr.id === c.productId);
                return p && p.componentType === 'konus';
            });
            if (hasKonus) well.wkladkaZwienczenie = 'brak';
        }
        if (typeof updateConfigToMatchParams === 'function') {
            updateConfigToMatchParams(well);
        }
        currentWellIndex = index;
        if (!well.autoLocked && well.rzednaWlazu != null && well.rzednaDna != null && well.rzednaWlazu > well.rzednaDna) {
            await autoSelectComponents(true);
        }
    }
    currentWellIndex = prevWellIndex;
    refreshAll();
    updateParamTilesUI();
    updateAutoLockUI();
    showToast(`Zastosowano parametry ogólne do ${editable.length} studni`, 'success');
}
window.applyGlobalParamsToAllWells = applyGlobalParamsToAllWells;

/**
 * Wymuś zasady klas obciążenia na obiekcie studni:
 * - E600 lub F900 dla korpusu (Dennica + Nadbudowa) → dennica musi być żelbetowa
 */
function enforceLoadClassRules(well, changedParam) {
    if (!well) return;
    if (changedParam === 'klasaNosnosci_korpus') {
        const korpus = well.klasaNosnosci_korpus;
        if (korpus === 'E600' || korpus === 'F900') {
            let changed = false;
            if (well.dennicaMaterial !== 'zelbetowa') {
                well.dennicaMaterial = 'zelbetowa';
                changed = true;
            }
            if (well.nadbudowa !== 'zelbetowa') {
                well.nadbudowa = 'zelbetowa';
                changed = true;
            }
            if (changed) {
                showToast(`Klasa ${korpus}: Dennica i Nadbudowa ustawione na Żelbet`, 'info');
            }
        }
    }
    // Gdy użytkownik próbuje zmienić dennicę lub nadbudowę na beton przy aktywnej ciężkiej klasie obciążenia
    if (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') {
        const korpus = well.klasaNosnosci_korpus;
        if ((korpus === 'E600' || korpus === 'F900') && well[changedParam] !== 'zelbetowa') {
            well[changedParam] = 'zelbetowa';
            const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
            showToast(`Klasa ${korpus}: ${name} musi być Żelbet!`, 'error');
        }
    }
}

/**
 * Wymuś zasady klas obciążenia w trybie kreatora (brak studni, tylko kafelki DOM).
 */
function enforceLoadClassRulesWizard(changedParam, value) {
    if (changedParam === 'klasaNosnosci_korpus') {
        if (value === 'E600' || value === 'F900') {
            let changed = false;
            const setZelbet = (param) => {
                const group = document.querySelector(`.param-group[data-param="${param}"]`);
                if (group) {
                    const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                    if (zelbetBtn && !zelbetBtn.classList.contains('active')) {
                        group
                            .querySelectorAll('.param-tile')
                            .forEach((b) => b.classList.remove('active'));
                        zelbetBtn.classList.add('active');
                        wizardConfirmedParams.add(param);
                        changed = true;
                    }
                }
            };
            setZelbet('dennicaMaterial');
            setZelbet('nadbudowa');
            if (changed) {
                showToast(
                    `Klasa ${value}: Dennica i Nadbudowa ustawione na Żelbet (wymagane)`,
                    'info'
                );
            }
        }
    }
    if (
        (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') &&
        value !== 'zelbetowa'
    ) {
        const korpusVal = getActiveTileValue('klasaNosnosci_korpus');
        if (korpusVal === 'E600' || korpusVal === 'F900') {
            const group = document.querySelector(`.param-group[data-param="${changedParam}"]`);
            if (group) {
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                if (zelbetBtn) zelbetBtn.classList.add('active');
                const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
                showToast(`Klasa ${korpusVal}: ${name} musi być Żelbet!`, 'error');
            }
        }
    }
}

async function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;
    
    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramName === 'malowanieWewCena' || paramName === 'malowanieZewCena') {
        wells.forEach(w => {
            w[paramName] = value;
        });
    }

    updateAutoLockUI();
    await autoSelectComponents(true);
    refreshAll();
}

/* ===== AUTO-BLOKADA (TRYB RĘCZNY) ===== */
function toggleAutoLock() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    well.autoLocked = !well.autoLocked;
    updateAutoLockUI();
}

// updateAutoLockUI() przeniesiona do wellUI.js

/* ===== PANEL RABATÓW ===== */
let appConfirmCallback = null;

function handleAppConfirm(result) {
    const overlay = document.getElementById('app-confirm-overlay');
    if (overlay) overlay.style.display = 'none';
    if (result && appConfirmCallback) {
        appConfirmCallback();
    }
    appConfirmCallback = null;
}

async function confirmApp(message, callback, cancelCallback) {
    const result = await appConfirm(message, { title: 'Potwierdzenie', type: 'warning' });
    if (result) {
        if (callback) callback();
    } else {
        if (cancelCallback) cancelCallback();
    }
}

function updateDiscount(dn, type, value) {

    const newValue = parseFloat(value) || 0;
    const oldDisc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    const oldValue = oldDisc[type] || 0;

    // Sprawdź, czy potrzebny jest popup (tylko dla bazy stycznej i jeśli wartość faktycznie zmieniła się na > 0)
    if ((dn === 'styczna' || dn === 'styczne') && type === 'dennica' && newValue > 0 && newValue !== oldValue) {
        confirmApp(
            'Uwaga rabat na studnie styczną',
            () => {
                applyDiscount(dn, type, newValue);
            },
            () => {
                // Anuluj - zresetuj UI
                renderDiscountPanel();
            }
        );
        return;
    }

    applyDiscount(dn, type, newValue);
}

function applyDiscount(dn, type, value) {
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    wellDiscounts[dn][type] = value;

    // W trybie zamówienia: zamrożone ceny blokują przeliczanie rabatu,
    // więc musimy je przeliczyć z nowym rabatem
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    renderWellConfig();
}

/**
 * Aktualizuje cenę malowania globalnie we wszystkich studniach.
 * Wywoływane z panelu rabatów (sekcja "Koszt malowania").
 *
 * @param {string} field - 'malowanieWewCena' lub 'malowanieZewCena'
 * @param {string} value - nowa cena za m²
 */
function updateGlobalPaintingCost(field, value) {
    const numVal = parseFloat(value) || 0;
    wells.forEach(w => {
        w[field] = numVal;

        // Jeśli zmieniamy wewnętrzną, a zewnętrzna nie była ręcznie modyfikowana, zaktualizuj też zewnętrzną
        if (field === 'malowanieWewCena' && !w.malowanieZewManual) {
            w.malowanieZewCena = numVal;
        }

        // Jeśli użytkownik zmienia zewnętrzną ręcznie, oznacz to by przestać automatycznie przepisywać
        if (field === 'malowanieZewCena') {
            w.malowanieZewManual = true;
        }
    });

    // Brak toasta podczas szybkiego wpisywania w modalu by nie spamować (chyba że zmiana z konfiguratora bocznego)
    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.style.display === 'flex';
    
    if (!isOfferModalOpen) {
        showToast(`Zaktualizowano cenę malowania (${numVal} PLN/m²) we wszystkich studniach`, 'info');
    }

    // W trybie zamówienia: zamrożone ceny blokują przeliczanie wyceny,
    // musimy zaktualizować "zamrożone" ceny o nowe koszty malowania
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    if (typeof renderWellParams === 'function') renderWellParams();

    // Odśwież też w "Zarządzanie Rabatami Oferty" jeśli okno jest otwarte (bez utraty focusa!)
    if (isOfferModalOpen) {
        if (typeof updateOfferDiscountsPopupPrices === 'function') {
            updateOfferDiscountsPopupPrices();
        }
        
        // Na żywo zaktualizuj też wizualnie pole zewnętrzne jeśli przypisywano automatycznie
        if (field === 'malowanieWewCena' && document.getElementById('offer-mal-zew-cena')) {
            const zewInput = document.getElementById('offer-mal-zew-cena');
            const refW = wells[0];
            if (refW && !refW.malowanieZewManual) {
                zewInput.value = String(numVal);
            }
        }
    }
}

/**
 * Aktualizuje globalny rabat na wkładkę PEHD we wszystkich studniach.
 * Wywoływane z panelu rabatów (sekcja "Wkładka PEHD").
 *
 * @param {string} value - nowa wartość procentowa rabatu
 */
function updateGlobalPehdDiscount(value) {
    const numVal = parseFloat(value) || 0;
    wells.forEach(w => {
        w.pehdDiscount = numVal;
    });

    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.style.display === 'flex';
    
    if (!isOfferModalOpen) {
        showToast(`Zaktualizowano rabat PEHD (${numVal}%) we wszystkich studniach`, 'info');
    }

    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    if (typeof renderWellParams === 'function') renderWellParams();

    if (isOfferModalOpen) {
        if (typeof updateOfferDiscountsPopupPrices === 'function') {
            updateOfferDiscountsPopupPrices();
        }
        
        // Zaktualizuj pole z ceną po rabacie, jeśli istnieje
        const priceAfterDiscountSpan = document.getElementById('offer-pehd-price-after-discount');
        if (priceAfterDiscountSpan) {
            let currentPehdPrice = 0;
            for (const p of studnieProducts) {
                if (p.area > 0 && p.doplataPEHD > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta') {
                    currentPehdPrice = Math.round(p.doplataPEHD / p.area);
                    break;
                }
            }
            const priceAfterDiscount = currentPehdPrice * (1 - numVal / 100);
            priceAfterDiscountSpan.innerText = priceAfterDiscount.toFixed(2);
        }
    }
}

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

// renderDiscountPanel() przeniesiona do wellUI.js

/* ===== OBLICZANIE POWIERZCHNI MALOWANIA KINETY ===== */

/**
 * Zbiera geometrię rur z przejść studni.
 * @param {Object} well - obiekt studni
 * @returns {Array<{dnMm: number, angle: number}>}
 */
function collectPipeGeometry(well) {
    if (!well.przejscia || well.przejscia.length === 0) return [];

    return well.przejscia.map(pr => {
        const prod = studnieProducts.find(p => p.id === pr.productId);
        let dnMm = parseInt(pr.dn) || 0;
        if (!dnMm && prod) dnMm = parseInt(prod.dn) || 0;
        if (dnMm <= 0) return null;

        return {
            dnMm,
            angle: parseFloat(pr.angle) || 0
        };
    }).filter(Boolean);
}

/**
 * Konwertuje string spocznikH ('1/2', '2/3', '3/4', '1/1') na ułamek.
 * @param {string} spocznikH
 * @returns {number}
 */
function parseSpocznikFraction(spocznikH) {
    const fractions = { '1/2': 0.5, '2/3': 0.667, '3/4': 0.75, '1/1': 1.0 };
    return fractions[spocznikH] || 0.5;
}

/**
 * Identyfikuje kinetę główną (wylot + przelot) i dopływy.
 * Reużywa algorytm z calcPrecoPricing:
 * - Główna = max DN, potem najbliżej kąta 0°
 * - Przelot = max DN z reszty, potem najbliżej 180°
 * - Pozostałe = dopływy
 *
 * @param {Array} pipes - wynik collectPipeGeometry()
 * @returns {{ mainPair: Array, tributaries: Array }}
 */
function identifyMainChannelAndTributaries(pipes) {
    if (pipes.length === 0) return { mainPair: [], tributaries: [] };
    if (pipes.length === 1) return { mainPair: [pipes[0]], tributaries: [] };

    const candidates = [...pipes];

    // GŁÓWNA (WYLOT): max DN, potem najbliżej kąta 0°
    const getZeroScore = (kat) => Math.min(Math.abs(kat), Math.abs(kat - 360));
    candidates.sort((a, b) => {
        if (b.dnMm !== a.dnMm) return b.dnMm - a.dnMm;
        return getZeroScore(a.angle) - getZeroScore(b.angle);
    });
    const glowne = candidates.shift();

    // PRZELOT: max DN z reszty, potem najbliżej 180°
    const get180Score = (kat) => Math.abs(kat - 180);
    candidates.sort((a, b) => {
        if (b.dnMm !== a.dnMm) return b.dnMm - a.dnMm;
        return get180Score(a.angle) - get180Score(b.angle);
    });
    const przelot = candidates.shift();

    return {
        mainPair: [glowne, przelot],
        tributaries: candidates
    };
}

/**
 * Oblicza powierzchnię malowania standardowej kinety [m²].
 * Składniki: korytka kanałów + spocznik płaski + ścianka pionowa spocznika.
 *
 * @param {Object} well - obiekt studni
 * @param {number} R - promień studni [m]
 * @returns {number} powierzchnia [m²]
 */
function calcStandardKinetaPaintingArea(well, R) {
    const pipes = collectPipeGeometry(well);

    // Brak przejść → dno + ścianki dennicy (cylinder)
    if (pipes.length === 0) {
        let dennicaH = 0;
        if (well.config) {
            well.config.forEach(item => {
                const pr = studnieProducts.find(x => x.id === item.productId);
                if (pr && (pr.componentType === 'dennica' || pr.componentType === 'styczna')) {
                    dennicaH = Math.max(dennicaH, pr.height || 0);
                }
            });
        }
        const H = dennicaH / 1000; // [m]
        const floorArea = Math.PI * R * R;
        const wallArea = 2 * Math.PI * R * H;
        return floorArea + wallArea;
    }

    const spocznikFrac = parseSpocznikFraction(well.spocznikH);
    const { mainPair, tributaries } = identifyMainChannelAndTributaries(pipes);

    // Największa rura wyznacza głębokość koryta
    const maxPipeDn = Math.max(...pipes.map(p => p.dnMm));
    const channelDepth = (maxPipeDn / 2) / 1000; // [m]
    const spocznikHeight = channelDepth * spocznikFrac; // wys. ścianki nad kanałem [m]

    let channelArea = 0;
    let channelFootprint = 0;

    // Kanał główny — przebiega przez całą studnię (2R)
    const mainR = (mainPair[0] ? mainPair[0].dnMm : 0) / 2000;
    if (mainPair.length >= 2 && mainPair[1]) {
        // Para: kanał ciągły, użyj większego promienia
        const przelotR = mainPair[1].dnMm / 2000;
        const bigR = Math.max(mainR, przelotR);
        const channelLen = 2 * R;
        channelArea += Math.PI * bigR * channelLen;
        channelFootprint += 2 * bigR * channelLen;
    } else if (mainPair[0]) {
        // Pojedyncza rura — kanał od ściany do osi
        const channelLen = R;
        channelArea += Math.PI * mainR * channelLen;
        channelFootprint += 2 * mainR * channelLen;
    }

    // Dopływy — od ściany do kanału głównego (≈ R)
    tributaries.forEach(trib => {
        const r = trib.dnMm / 2000;
        const channelLen = R;
        channelArea += Math.PI * r * channelLen;
        channelFootprint += 2 * r * channelLen;
    });

    // Spocznik płaski (dno koła minus rzuty korytek)
    const totalFloor = Math.PI * R * R;
    const spocznikFlat = Math.max(0, totalFloor - channelFootprint);

    // Ścianka pionowa spocznika
    const totalPipeWidth = pipes.reduce((sum, p) => sum + p.dnMm / 1000, 0);
    const wallPerimeter = Math.max(0, 2 * Math.PI * R - totalPipeWidth);
    const wallArea = wallPerimeter * spocznikHeight;

    return channelArea + spocznikFlat + wallArea;
}

/**
 * Oblicza powierzchnię malowania osadnika [m²].
 * Składniki: dno płaskie + ścianki cylindryczne - otwory rur.
 *
 * @param {Object} well - obiekt studni
 * @param {number} R - promień studni [m]
 * @returns {number} powierzchnia [m²]
 */
function calcOsadnikPaintingArea(well, R) {
    const heightMm = parseFloat(well.wkladkaOsadnikH) || 0;
    if (heightMm <= 0) return Math.PI * R * R;

    const H = heightMm / 1000; // [m]
    const floorArea = Math.PI * R * R;
    const wallArea = 2 * Math.PI * R * H;

    // Odjęcie otworów rur (pół-elipsy w ściance)
    const pipes = collectPipeGeometry(well);
    let holeArea = 0;
    pipes.forEach(pipe => {
        const r = pipe.dnMm / 2000;
        holeArea += (Math.PI * r * r) / 2;
    });

    return floorArea + Math.max(0, wallArea - holeArea);
}

/**
 * Oblicza rzeczywistą powierzchnię wewnętrzną kinety do malowania [m²].
 * Uwzględnia: DN studni, przejścia (DN, kąty), wysokość spocznika, typ osadnikowy.
 *
 * @param {Object} well - obiekt studni
 * @returns {number} powierzchnia [m²]
 */
function calcKinetaPaintingArea(well) {
    const dnStudni = parseInt(well.dn);
    if (!dnStudni || isNaN(dnStudni)) return 0;

    const R = dnStudni / 2000; // promień studni [m]

    if (well.wkladkaOsadnikPreco === 'tak') {
        return calcOsadnikPaintingArea(well, R);
    }

    return calcStandardKinetaPaintingArea(well, R);
}

/* ===== STATYSTYKI STUDNI ===== */

function getWellActiveDiscounts(well) {
    let activeDiscounts = wellDiscounts;
    // Jeśli studnia jest w zamówieniu (Zablokowana), użyj rabatów z momentu utworzenia zamówienia (z migawki)
    if (typeof isWellOrdered === 'function' && isWellOrdered(well)) {
        const currentOfferId = typeof editingOfferIdStudnie !== 'undefined' ? editingOfferIdStudnie : null;
        if (currentOfferId && typeof getOrderForWellId === 'function') {
            const order = getOrderForWellId(well.id, currentOfferId);
            if (order && order.originalSnapshot && order.originalSnapshot.wellDiscounts) {
                activeDiscounts = order.originalSnapshot.wellDiscounts;
            }
        }
    }
    return activeDiscounts;
}

function getItemAssessedPrice(well, p, applyDiscount = true, item = null) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        
        const activeDiscounts = getWellActiveDiscounts(well);
        const disc = activeDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find((c) => {
            const pr = studnieProducts.find((x) => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight =
                studnieProducts.find((x) => x.id === dennicaItem.productId)?.height || 0;
        }

        const h1m = parseFloat(p.hMin1);
        const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2);
        const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3);
        const h3x = parseFloat(p.hMax3);

        let kinetaBase = itemPrice;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        itemPrice = kinetaBase * mult;

        // Dodaj malowanie do kinety przed wczesnym wyjściem
        // Dynamiczna powierzchnia — obliczona z geometrii rur, kątów i spocznika
        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (well.malowanieW === 'kineta' || well.malowanieW === 'kineta_dennica' || well.malowanieW === 'cale') {
                const kinetaArea = calcKinetaPaintingArea(well);
                itemPrice += kinetaArea * well.malowanieWewCena;
            }
        } else if (well.malowanieW && well.malowanieW !== 'brak' && !well.malowanieWewCena && p.malowanieWewnetrzne) {
            // Legacy malowanie wewnątrz (fixed-price) — kineta
            if (well.malowanieW === 'kineta' || well.malowanieW === 'kineta_dennica' || well.malowanieW === 'cale') {
                itemPrice += parseFloat(p.malowanieWewnetrzne);
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
        } else if (
            well.malowanieZ === 'zewnatrz' &&
            p.malowanieZewnetrzne &&
            !well.malowanieZewCena
        ) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        return itemPrice;
    }

    itemPrice = itemPrice * mult;

    // Wkładka PEHD
    let pehdType = null;
    if (['dennica', 'styczna'].includes(p.componentType)) {
        pehdType = well.wkladkaDennica;
    } else if (['plyta', 'plyta_redukcyjna', 'plyta_nastudzienna', 'stozek', 'zwienczenie', 'konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType)) {
        pehdType = well.wkladkaZwienczenie;
    } else if (['krag', 'krag_ot', 'rura'].includes(p.componentType)) {
        pehdType = well.wkladkaNadbudowa;
    }

    if (pehdType && pehdType !== 'brak' && p.doplataPEHD) {
        if (!item || !item.disablePehd) {
            let pehdSurcharge = parseFloat(p.doplataPEHD);
            if (applyDiscount && well.pehdDiscount) {
                pehdSurcharge *= (1 - well.pehdDiscount / 100);
            }
            itemPrice += pehdSurcharge;
        }
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            // Pominięte — calcKinetaPaintingArea() na kinecie już obejmuje
            // pełne wnętrze dennicy (dno + ścianki + korytka).
            // Dodanie p.area dennicy spowodowałoby podwójne liczenie.
        } else if (well.malowanieW === 'cale') {
            if (p.componentType === 'dennica' || p.componentType === 'styczna') {
                // Pominięte — j.w., kineta pokrywa wnętrze dennicy
            } else {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
            }
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (well.malowanieW === 'cale' && p.componentType !== 'dennica' && p.componentType !== 'styczna') {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
        // Pominięte: dennica przy kineta_dennica i cale — kineta już obejmuje wnętrze dennicy
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy) - dodawana do ceny gdy dennicaMaterial === 'zelbetowa'
    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna (dla kręgów z otworami i dennic)
    if (well.stopnie === 'nierdzewna' && (p.componentType === 'krag_ot' || p.componentType === 'dennica') && p.doplataDrabNierdzewna) {
        itemPrice += parseFloat(p.doplataDrabNierdzewna);
    }

    return itemPrice;
}

function calcWellStats(well) {
    let price = 0,
        weight = 0,
        height = 0,
        areaInt = 0,
        areaExt = 0;
    let priceDennica = 0,
        priceNadbudowa = 0;

    // Ceny bazowe (bez rabatu)
    let priceBase = 0,
        priceDennicaBase = 0,
        priceNadbudowaBase = 0;

    let lastWasDennica = !!well.psiaBuda;
    const configReversed = [...(well.config || [])].reverse();

    configReversed.forEach((item) => {
        // Rozwiąż poprawny wariant produktu wg parametrów studni (auto-korekta productId)
        const p = typeof resolveEffectiveProduct === 'function'
            ? resolveEffectiveProduct(well, item.productId, item)
            : studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Ceny bazowe (bez rabatu)
        let itemPriceDisc, itemPriceBaseVal;
        const useFrozenPrice = item.frozenPrice != null && window.isPreviewMode;
        if (useFrozenPrice) {
            itemPriceDisc = item.frozenPrice;
            itemPriceBaseVal =
                item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
        } else {
            itemPriceDisc = getItemAssessedPrice(well, p, true, item);
            itemPriceBaseVal = getItemAssessedPrice(well, p, false, item);
        }

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        // Podział na dennicę i nadbudowę
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        // Liczenie wysokości z uwzględnieniem dennic piętrowych (adjacency check)
        // Idziemy od dołu do góry, więc lastWasDennica oznacza dennicę PONIŻEJ
        for (let q = 0; q < item.quantity; q++) {
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasDennica) {
                h -= 100;
            }
            height += h;
            if (p.componentType !== 'uszczelka') {
                lastWasDennica = (p.componentType === 'dennica');
            }
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const activeDiscounts = getWellActiveDiscounts(well);
        if (discountKey && activeDiscounts[discountKey]) {
            discNadbudowa = activeDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        // Budowa configMap do sprawdzania, czy przejście jest w kręgu
        let configMap = [];
        if (typeof buildConfigMap === 'function') {
            configMap = buildConfigMap(well, (id) => studnieProducts.find((pr) => pr.id === id), true);
        }

        well.przejscia.forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            // Wyliczanie opłaty za wiercenie, jeśli przejście znajduje się w kręgu
            let drillingBasePrice = 0;
            const isInsitu = p.name && p.name.toUpperCase().includes('INSITU');

            if (!isInsitu && configMap.length > 0) {
                let rzDna = parseFloat(well.rzednaDna) || 0;
                let pel = parseFloat(item.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                let mmFromBottom = (pel - rzDna) * 1000;

                if (typeof findAssignedElement === 'function') {
                    const assigned = findAssignedElement(mmFromBottom, configMap);
                    if (assigned && assigned.entry && (assigned.entry.componentType === 'krag' || assigned.entry.componentType === 'krag_ot')) {
                        const trDn = parseInt(item.dn) || parseInt(p.dn) || 0;
                        if (trDn > 0) {
                            const drillingProducts = studnieProducts.filter(x => x.category === 'Wiercenie');
                            let bestDrill = null;
                            let bestDnDiff = Infinity;

                            drillingProducts.forEach(drill => {
                                let drillDn = parseInt(drill.dn);
                                if (isNaN(drillDn)) {
                                    const match = drill.id.match(/Wiercenie-(\d+)/i);
                                    if (match) drillDn = parseInt(match[1]);
                                }
                                if (!isNaN(drillDn) && drillDn >= trDn) {
                                    if (drillDn - trDn < bestDnDiff) {
                                        bestDnDiff = drillDn - trDn;
                                        bestDrill = drill;
                                    }
                                }
                            });

                            if (bestDrill) {
                                drillingBasePrice = /** @type {any} */ (bestDrill).price || 0;
                            }
                        }
                    }
                }
            }

            // Użyj zamrożonej ceny tylko w podglądzie; w edycji przelicz na nowo
            let bP, dP;
            if (item.frozenPrice != null && window.isPreviewMode) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = (p.price || 0) + drillingBasePrice;
                dP = bP * mult;
            }

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;
            
            if (item.doplata) {
                price += item.doplata;
                priceNadbudowa += item.doplata;
            }

            weight += p.weight || 0;
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    let hasError = false;
    let errorMessage = null;

    // Wycena PRECO — dodaj cenę kinety PRECO jeśli well.kineta === 'preco' lub 'precotop'
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        const precoResult = calcPrecoPricing(well);
        if (precoResult.error) {
            hasError = true;
            errorMessage = precoResult.error;
        } else {
            const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
            const activeDiscounts = getWellActiveDiscounts(well);
            const discPreco = (activeDiscounts[discountKey] || {}).preco || 0;
            const precoMult = 1 - discPreco / 100;
            const precoCost = precoResult.suma * precoMult;
            price += precoCost;
            priceDennica += precoCost;
            priceBase += precoResult.suma;
            priceDennicaBase += precoResult.suma;
        }
    }

    // Dopłata wliczona do dennicy / studni stycznej — NIE podlega rabatowi
    // Nie dodajemy do priceBase/priceDennicaBase, aby nie zawyżać podstawy rabatu
    if (well.doplata) {
        price += well.doplata;
        priceDennica += well.doplata;
    }

    return {
        price: hasError ? 0 : price,
        priceBase: hasError ? 0 : priceBase,
        priceDennica: hasError ? 0 : priceDennica,
        priceDennicaBase: hasError ? 0 : priceDennicaBase,
        priceNadbudowa: hasError ? 0 : priceNadbudowa,
        priceNadbudowaBase: hasError ? 0 : priceNadbudowaBase,
        weight,
        height,
        areaInt,
        areaExt,
        malowanieZewTotal,
        error: errorMessage
    };
}

// switchSidebarTab() przeniesiona do wellUI.js

