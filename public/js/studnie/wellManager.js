/* ===== ZARZĄDZANIE STUDNIAMI ===== */

/** Odczytuje parametry globalne z kroku 2 kreatora z kafelków UI */
function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladka: 'brak',
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
        usytuowanie: 'w_osi',
        uszczelka: 'GSG',
        magazyn: 'Kluczbork'
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

function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    const defaultName =
        dn === 'styczna'
            ? 'Studnia Styczna (#' + wellCounter + ')'
            : 'Studnia DN' + dn + ' (#' + wellCounter + ')';
    return {
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
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladka: gp.wkladka,
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
        magazyn: gp.magazyn
    };
}

/* ===== BLOKADA OFERTY (per-studnia po utworzeniu zamówienia) ===== */
// OFFER_LOCKED_MSG i WELL_LOCKED_MSG przeniesione do wellUI.js

/**
 * Oferta jako całość nie jest już blokowana.
 * Blokada działa per-studnia (isWellLocked).
 * Zwraca false aby zachować dotychczasowy interfejs API.
 */
function isOfferLocked() {
    if (orderEditMode) return false;
    return false;
}

function isWellLocked(wellIdx) {
    if (orderEditMode) return false; // W trybie edycji zamówienia studnie są edytowalne
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;

    // Sprawdź zaakceptowane zlecenia produkcyjne
    const hasAcceptedPO = (
        typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
    ).some((po) => po.wellId === well.id && po.status === 'accepted');
    if (hasAcceptedPO) return true;

    // Sprawdź, czy studnia jest częścią istniejącego zamówienia
    if (typeof isWellOrdered === 'function' && isWellOrdered(well)) return true;

    return false;
}

// renderOfferLockBanner() przeniesiona do wellUI.js


function addNewWell(dn = 1000) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
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
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = JSON.parse(JSON.stringify(src));
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
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.name = name.trim();
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

function syncKineta(well) {
    if (!well || !well.config) return;

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

function refreshAll(skipSummary = false) {
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
}

/* ===== PARAMETRY OGÓLNE (KAFELKI) — przeniesione do wellUI.js ===== */

async function updateWellParam(paramKey, value) {
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
    well[paramKey] = value;
    
    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(w => {
            w[paramKey] = value;
        });
        showToast('Zaktualizowano cenę malowania we wszystkich studniach', 'info');
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
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }

    const newValue = parseFloat(value) || 0;
    const oldDisc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
    const oldValue = oldDisc[type] || 0;

    // Sprawdź, czy potrzebny jest popup (tylko dla bazy stycznej i jeśli wartość faktycznie zmieniła się na > 0)
    if (dn === 'styczna' && type === 'dennica' && newValue > 0 && newValue !== oldValue) {
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
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0 };
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

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

// renderDiscountPanel() przeniesiona do wellUI.js

/* ===== STATYSTYKI STUDNI ===== */

function getItemAssessedPrice(well, p, applyDiscount = true) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountKey = well.dn === 'styczna' ? 'styczne' : well.dn;
        const disc = wellDiscounts[discountKey] || { dennica: 0, nadbudowa: 0 };
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
        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (well.malowanieW === 'kineta' || well.malowanieW === 'cale') {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
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
    if (well.wkladka && well.wkladka !== 'brak' && p.doplataPEHD) {
        itemPrice += parseFloat(p.doplataPEHD);
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        } else if (well.malowanieW === 'cale') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (well.malowanieW === 'cale' || p.componentType === 'dennica') {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy)
    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna
    if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
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
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Ceny bazowe (bez rabatu)
        let itemPriceDisc, itemPriceBaseVal;
        if (item.frozenPrice != null) {
            itemPriceDisc = item.frozenPrice;
            itemPriceBaseVal =
                item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
        } else {
            itemPriceDisc = getItemAssessedPrice(well, p, true);
            itemPriceBaseVal = getItemAssessedPrice(well, p, false);
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
        if (discountKey && wellDiscounts[discountKey]) {
            discNadbudowa = wellDiscounts[discountKey].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        well.przejscia.forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            // Użyj zamrożonej ceny, jeśli jest dostępna (tryb zamówienia)
            let bP, dP;
            if (item.frozenPrice != null) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = p.price || 0;
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

    // Dopłata wliczona do dennicy / studni stycznej — NIE podlega rabatowi
    // Nie dodajemy do priceBase/priceDennicaBase, aby nie zawyżać podstawy rabatu
    if (well.doplata) {
        price += well.doplata;
        priceDennica += well.doplata;
    }

    return {
        price,
        priceBase,
        priceDennica,
        priceDennicaBase,
        priceNadbudowa,
        priceNadbudowaBase,
        weight,
        height,
        areaInt,
        areaExt,
        malowanieZewTotal
    };
}

// switchSidebarTab() przeniesiona do wellUI.js

