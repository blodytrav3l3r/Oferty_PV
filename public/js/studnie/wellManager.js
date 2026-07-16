// @ts-check
/* ===== ZARZĄDZANIE STUDNIAMI ===== */

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

// calcPrecoPricing przeniesione do actionsWellPricing.js

function syncKineta(well) {
    if (!well || !well.config) return;

    // Jeżeli wybrana jest jakaś kineta (inna niż brak) i spocznik = brak → domyślnie spocznik beton
    if (well.kineta && well.kineta !== 'brak') {
        if (!well.spocznik || well.spocznik === 'brak') {
            well.spocznik = 'beton';
            if (typeof showToast === 'function')
                showToast('Domyślny spocznik (Beton) został wybrany automatycznie.', 'info');
        }
    } else {
        // Jeżeli kineta = brak → spocznik MUSI być brak
        if (well.spocznik && well.spocznik !== 'brak') {
            well.spocznik = 'brak';
            well.spocznikH = 'brak';
            if (typeof showToast === 'function')
                showToast('Spocznik wyczyszczony. Wybierz najpierw Kinetę.', 'warning');
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
                well.config.forEach((item) => {
                    const p = studnieProducts.find((pr) => pr.id === item.productId);
                    if (p && (p.componentType === 'dennica' || p.componentType === 'styczna')) {
                        dennicaHeight += (p.height || 0) * (item.quantity || 1);
                    }
                });
            }
            well.wkladkaOsadnikH = dennicaHeight || 1000;
        }

        // Czyszczenie starego kosztu
        if (well.config) {
            well.config.forEach((item) => {
                delete item._osadnikCost;
            });
        }
        return;
    }

    // Wyczyść koszt osadnika jeśli wyłączono
    if (well.config) {
        well.config.forEach((item) => {
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
        const SPOCZNIK_MAP = { 12: '1/2', 23: '2/3', 34: '3/4', 11: '1/1' };
        const kinetaProd = studnieProducts.find(
            (p) =>
                p.componentType === 'kineta' &&
                parseInt(p.dn) === parseInt(well.dn) &&
                (SPOCZNIK_MAP[p.id.split('-').pop()] || '') === well.spocznikH
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
                const found = w.config.some((c) => {
                    const p = studnieProducts.find((pr) => pr.id === c.productId);
                    return p && p.componentType === 'konus';
                });
                if (found) hasKonus = true;
            }

            // 2. Sprawdź wymuszone domyślne zakończenia
            if (w.zakonczenie) {
                const p = studnieProducts.find((pr) => pr.id === w.zakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }
            if (w.redukcjaZakonczenie) {
                const p = studnieProducts.find((pr) => pr.id === w.redukcjaZakonczenie);
                if (p && p.componentType === 'konus') {
                    hasKonus = true;
                }
            }

            if (hasKonus) {
                if (typeof window.showKonusPehdResolverModal === 'function') {
                    showToast(
                        'Wykryto niedozwoloną konfigurację (Konus + PEHD) w studni #' +
                            (i + 1) +
                            '. Wymagana zmiana.',
                        'error'
                    );
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
        wells.forEach((w) => {
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
        const syncValues = [
            'beton',
            'beton_gfk',
            'klinkier',
            'preco',
            'precotop',
            'unolith',
            'predl',
            'kamionka',
            'brak'
        ];
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
        const hasKonus =
            well.config &&
            well.config.some((c) => {
                const p = studnieProducts.find((pr) => pr.id === c.productId);
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
            const syncValues = [
                'beton',
                'beton_gfk',
                'klinkier',
                'preco',
                'precotop',
                'unolith',
                'predl',
                'kamionka',
                'brak'
            ];
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
            const hasKonus =
                well.config &&
                well.config.some((c) => {
                    const p = studnieProducts.find((pr) => pr.id === c.productId);
                    return p && p.componentType === 'konus';
                });
            if (hasKonus) well.wkladkaZwienczenie = 'brak';
        }
        if (typeof updateConfigToMatchParams === 'function') {
            updateConfigToMatchParams(well);
        }
        currentWellIndex = index;
        if (
            !well.autoLocked &&
            well.rzednaWlazu != null &&
            well.rzednaDna != null &&
            well.rzednaWlazu > well.rzednaDna
        ) {
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
        wells.forEach((w) => {
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
    /* Sync z Excelem - ustaw configSource na MANUAL gdy blokujemy */
    well.configSource = well.autoLocked ? 'MANUAL' : 'AUTO';
    well.autoSelect = !well.autoLocked;
    updateAutoLockUI();
    /* Odswiez Excel jesli otwarty */
    if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();
    if (typeof window.refreshExcelFromConfig === 'function') window.refreshExcelFromConfig();
}

// updateAutoLockUI() przeniesiona do wellUI.js

// handleAppConfirm, confirmApp, updateDiscount, applyDiscount,
// updateGlobalPaintingCost, updateGlobalPehdDiscount, getDiscountedTotal
// przeniesione do actionsWellDiscounts.js

// getWellActiveDiscounts, getItemAssessedPrice, getItemPriceBreakdown,
// calcWellStats, calcPrecoPricing przeniesione do actionsWellPricing.js
