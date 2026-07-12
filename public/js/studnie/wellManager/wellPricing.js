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
        showToast: typeof showToast === 'function' ? showToast : undefined
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
