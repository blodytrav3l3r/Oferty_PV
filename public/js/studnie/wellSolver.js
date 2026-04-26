/**
 * wellSolver.js — Rdzeń algorytmiczny doboru elementów studni
 *
 * Zawiera wyłącznie logikę solvera:
 * - selectRingVariants()      — wybór wariantów kręgów
 * - applyDrilledRings()       — zamiana kręgów na wiercone (OT)
 * - fetchConfigFromBackend()  — integracja z backendem OR-Tools
 * - autoSelectComponents()    — główny punkt wejścia auto-doboru
 * - runJsAutoSelection()      — lokalny solver fallback (JS)
 * - recalculateWellErrors()   — walidacja luzów przejść
 *
 * Zależności globalne: studnieProducts, wells, currentWellIndex,
 *   getCurrentWell(), getAvailableProducts(), filterByWellParams(),
 *   getLowestDennica(), getTopClosure(), getKregiList(),
 *   getReductionPlate(), optimizeRingsForDistance(),
 *   sortWellConfigByOrder(), syncGaskets(), calcWellStats(),
 *   renderWellConfig(), renderWellDiagram(), updateSummary(),
 *   updateHeightIndicator(), refreshAll(), showToast(), fmtInt()
 */


/* ===== KRĘGI WIERCONE (OT) ===== */

/**
 * Po zbudowaniu segmentów, sprawdza czy przejście (otwór) jest WEWNĄTRZ kręgu
 * i zamienia zwykły krag na krag_ot (wiercony) w odpowiednim segmencie.
 *
 * ZASADY:
 * 1. Otwór OT tylko gdy przejście faktycznie jest WEWNĄTRZ tego kręgu (cały otwór mieści się w segmencie)
 * 2. Zamiana na OT musi zachować tę samą wysokość kręgu (nie zmienia totalnej wysokości)
 * 3. Jeśli otwór wychodzi na łączenie dennicy i kręgu → zwraca flagę needsTallerDennica
 *
 * Zwraca { items: kregItems[], needsTallerDennica: boolean }
 */
function applyDrilledRings(kregItems, segments, well, availProducts) {
    const result = { items: kregItems, needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) return result;
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
    const newItems = JSON.parse(JSON.stringify(kregItems));
    const usedSegIndices = new Set();

    for (const pr of well.przejscia) {
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;

        // Przebuduj wysokość krawędzi dennic z uwzględnieniem redukcji dennic piętrowych
        let currentDennicaEnd = 0;
        let cy = 0;
        let lastWasD = !!well.psiaBuda;
        const configReversed = [...newItems].reverse();
        for (const item of configReversed) {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) continue;
            let h = p.height || 0;
            if (p.componentType === 'dennica' && lastWasD) h -= 100;
            if (p.componentType === 'dennica') currentDennicaEnd = cy + h;
            cy += h;
            lastWasD = p.componentType === 'dennica';
        }

        let prDN =
            typeof pprod.dn === 'string' && pprod.dn.includes('/')
                ? parseFloat(pprod.dn.split('/')[1]) || 160
                : parseFloat(pprod.dn) || 160;

        const holeCenter = mmFromBottom + prDN / 2;

        // Sprawdź, czy otwór przesuwa się przez połączenie dennicy i kręgu
        if (
            currentDennicaEnd > 0 &&
            mmFromBottom < currentDennicaEnd &&
            mmFromBottom + prDN > currentDennicaEnd
        ) {
            result.needsTallerDennica = true;
        }

        // Sprawdź, czy środek otworu znajduje się w całości wewnątrz dennicy — OT nie jest potrzebne
        if (currentDennicaEnd > 0 && holeCenter < currentDennicaEnd) continue;

        // Znajdź, który segment kręgu zawiera środek otworu
        for (let si = 1; si < segments.length; si++) {
            const seg = segments[si];
            if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
            if (holeCenter >= seg.start && holeCenter < seg.end && !usedSegIndices.has(si)) {
                usedSegIndices.add(si);

                let segCount = 0;
                for (let ki = 0; ki < newItems.length; ki++) {
                    const kp = studnieProducts.find((p) => p.id === newItems[ki].productId);
                    if (!kp || (kp.componentType !== 'krag' && kp.componentType !== 'krag_ot'))
                        continue;
                    for (let q = 0; q < newItems[ki].quantity; q++) {
                        segCount++;
                        if (segCount === si) {
                            const otProd = availProducts.find((p) => {
                                const isOt =
                                    p.componentType === 'krag_ot' ||
                                    (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
                                    (p.name && String(p.name).toLowerCase().includes('wiercony')) ||
                                    (p.name && String(p.name).toLowerCase().includes('z otworem'));
                                return (
                                    isOt &&
                                    p.dn === kp.dn &&
                                    p.height === kp.height &&
                                    (p.componentType === 'krag' || p.componentType === 'krag_ot')
                                );
                            });
                            if (otProd) {
                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = otProd.id;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: otProd.id,
                                        quantity: 1
                                    });
                                }
                            } else {
                                const dynamicOtId = kp.id + '_OT';
                                if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
                                    const dynamicProd = JSON.parse(JSON.stringify(kp));
                                    dynamicProd.id = dynamicOtId;
                                    dynamicProd.componentType = 'krag_ot';
                                    if (!dynamicProd.name.includes(' wiercony')) {
                                        dynamicProd.name = dynamicProd.name.replace(
                                            'Krąg',
                                            'Krąg wiercony'
                                        );
                                    }
                                    studnieProducts.push(dynamicProd);
                                }

                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = dynamicOtId;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, {
                                        productId: dynamicOtId,
                                        quantity: 1
                                    });
                                }
                            }
                            break;
                        }
                    }
                    if (segCount >= si) break;
                }
                break;
            }
        }
    }
    result.items = newItems;
    return result;
}

/* ===== ZAPYTANIE DO BACKENDU (OFFLINE-FIRST) ===== */
async function fetchConfigFromBackend(well, requiredMm, availProducts) {
    try {
        const payload = {
            dn: well.dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : well.dn,
            target_height_mm: requiredMm,
            use_reduction: well.redukcjaDN1000 || false,
            target_dn: well.redukcjaDN1000 ? (well.redukcjaTargetDN || 1000) : null,
            redukcja_min_h_mm: well.redukcjaMinH || 0,
            warehouse: well.magazyn === 'Włocławek' ? 'WL' : 'KLB',
            transitions: (well.przejscia || []).map((p, idx) => {
                let prDN = 160;
                let prod = availProducts.find((x) => x.id === p.productId);
                if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
                    prDN = parseFloat(prod.dn.split('/')[1]) || 160;
                else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;
                let bottomEdge = Math.round(
                    (parseFloat(p.rzednaWlaczenia) - (well.rzednaDna || 0)) * 1000
                );
                return {
                    id: p.productId || `T${idx + 1}`,
                    height_from_bottom_mm: isNaN(bottomEdge) ? 0 : bottomEdge
                };
            }),
            forced_top_closure_id: well.redukcjaDN1000
                ? well.redukcjaZakonczenie || null
                : well.zakonczenie || null,
            available_products: availProducts.map((p) => ({
                id: p.id || '',
                name: p.name || '',
                componentType: p.componentType || '',
                dn:
                    typeof p.dn === 'string' && p.dn.includes('/')
                        ? parseFloat(p.dn.split('/')[0]) || p.dn
                        : parseFloat(p.dn) || null,
                height: parseFloat(p.height) || 0,
                formaStandardowaKLB: parseInt(p.formaStandardowaKLB) || 0,
                formaStandardowaWL:
                    parseInt(p.formaStandardowa) || parseInt(p.formaStandardowaWL) || 0,
                zapasDol: parseFloat(p.zapasDol) || 0,
                zapasGora: parseFloat(p.zapasGora) || 0,
                zapasDolMin: parseFloat(p.zapasDolMin) || 0,
                zapasGoraMin: parseFloat(p.zapasGoraMin) || 0
            }))
        };
        const apiUrl = `http://${window.location.hostname}:8000/api/v1/configure`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch {
        return null; // Fallback do lokalnego kodu gdy serwer nie działa
    }
}

/* ===== GŁÓWNY PUNKT WEJŚCIA AUTO-DOBORU ===== */
window.autoSelectComponents = async function autoSelectComponents(autoTriggered = false) {
    const well = getCurrentWell();
    if (!well) {
        if (!autoTriggered) showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.autoLocked) {
        if (!autoTriggered) showToast('Auto-dobór jest zablokowany w Trybie Ręcznym.', 'error');
        return;
    }

    const dn = well.dn;
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu == null || well.rzednaWlazu <= rzDna) {
        if (!autoTriggered)
            showToast(
                'Ustaw rzędną włazu, aby auto-dobrać elementy (Rzędna Dna przyjęta jako 0)',
                'error'
            );
        return;
    }

    const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
    if (requiredMm < 500) {
        if (!autoTriggered) showToast('Wymagana wysokość za mała (min. 500mm)', 'error');
        return;
    }

    // --- Filtruj produkty wg dostępności w magazynie i parametrów studni ---
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

    // --- INTEGRACJA Z NOWYM BACKENDEM ---
    console.log('Próba integracji z backendem OR-Tools...');
    const backendResult = await fetchConfigFromBackend(well, requiredMm, availProducts);
    if (backendResult && backendResult.is_valid && backendResult.items.length > 0) {
        console.log('Otrzymano pomyślny model z API:', backendResult);
        const newConfig = [];
        const reversedItems = [...backendResult.items].reverse();

        for (const bItem of reversedItems) {
            let product = studnieProducts.find((p) => p.id === bItem.product_id);
            if (!product) {
                if (bItem.product_id.endsWith('_OT')) {
                    const baseId = bItem.product_id.replace('_OT', '');
                    product = studnieProducts.find((p) => p.id === baseId);
                }
                if (!product) {
                    product = {
                        id: bItem.product_id,
                        name: bItem.name || 'Produkt z AI',
                        componentType: bItem.component_type || 'krag',
                        height: 0, weight: 0, area: 0
                    };
                    studnieProducts.push(product);
                } else {
                    const dynamicProd = JSON.parse(JSON.stringify(product));
                    dynamicProd.id = bItem.product_id;
                    dynamicProd.name = bItem.name;
                    dynamicProd.componentType = bItem.component_type || product.componentType;
                    studnieProducts.push(dynamicProd);
                    product = dynamicProd;
                }
            }

            const qty = bItem.quantity || 1;
            for (let i = 0; i < qty; i++) {
                newConfig.push({ productId: bItem.product_id, quantity: 1 });
            }
        }

        // --- DODATKOWA WALIDACJA: Średnica redukcji ---
        if (well.redukcjaDN1000) {
            const targetDn = well.redukcjaTargetDN || 1000;
            const hasWrongDn = newConfig.some(item => {
                const p = studnieProducts.find(pr => pr.id === item.productId);
                // Sprawdzamy czy elementy "górne" (zakończenia, kręgi powyżej płyty) mają dobre DN
                if (p && (p.componentType === 'konus' || p.componentType === 'plyta_din' || p.componentType === 'krag' || p.componentType === 'krag_ot')) {
                    // Ignorujemy elementy bazy (one mają DN studni)
                    if (parseInt(p.dn) !== targetDn && parseInt(p.dn) !== parseInt(well.dn)) {
                        return true;
                    }
                }
                return false;
            });
            
            if (hasWrongDn) {
                console.warn(`Backend zwrócił elementy o złym DN (oczekiwano redukcji na DN${targetDn}). Spadek do lokalnego solvera.`);
                // Pozwalamy na spadek do runJsAutoSelection poniżej
            } else {
                // Konfiguracja jest OK
                well.config = newConfig;
                well.originalAutoConfig = JSON.parse(JSON.stringify(newConfig));
                well.overrideReason = null;
                // ... reszta logiki sukcesu (wlaz, toast, etc.)
                finalizeSuccess(well, backendResult, autoTriggered);
                return;
            }
        } else {
            // Brak redukcji, używamy wyniku z backendu
            well.config = newConfig;
            well.originalAutoConfig = JSON.parse(JSON.stringify(newConfig));
            well.overrideReason = null;
            finalizeSuccess(well, backendResult, autoTriggered);
            return;
        }
    }

    // Funkcja pomocnicza do finalizacji sukcesu
    function finalizeSuccess(well, backendResult, autoTriggered) {
        const newConfig = well.config;
        // Upewnij się, że studnia ma właz
        const hasWlaz = newConfig.some(
            (item) => studnieProducts.find((p) => p.id === item.productId)?.componentType === 'wlaz'
        );
        if (!hasWlaz) {
            const defaultWlaz = studnieProducts.find((p) => p.id === 'WLAZ-150');
            if (defaultWlaz) newConfig.unshift({ productId: defaultWlaz.id, quantity: 1 });
        }

        well.config = newConfig;
        well.originalAutoConfig = JSON.parse(JSON.stringify(newConfig));
        well.overrideReason = null;

        if (backendResult.errors && backendResult.errors.length > 0) {
            backendResult.errors.forEach((e) => showToast(e, 'error'));
        } else if (!autoTriggered) {
            showToast('Zoptymalizowano matematycznie (serwer OR-Tools) pomyślnie!', 'success');
        }

        well.configSource = 'AUTO_AI';

        if (backendResult.has_minimal_clearance) {
            showToast('Zastosowano minimalne zapasy przejść rur.', 'warning');
        }

        sortWellConfigByOrder();
        if (typeof recalcGaskets === 'function') recalcGaskets(well);
        if (typeof syncKineta === 'function') syncKineta(well);
        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    }

    // Jeżeli API uznało że budowa jest NIEMOŻLIWA:
    if (backendResult && !backendResult.is_valid) {
        console.warn('Backend OR-Tools odrzucił układ:', backendResult.errors);

        const apiErrors =
            backendResult.errors && backendResult.errors.length > 0
                ? backendResult.errors
                : ['Algorytm AI nie odnalazł ułożenia spełniającego wymogi rygorów wysokości lub kolizji.'];

        if (!autoTriggered) {
            apiErrors.forEach((e) => showToast(e, 'error'));
        }

        well.configSource = 'AUTO_AI';
        well.configStatus = 'ERROR';
        well.configErrors = apiErrors;
        well.config = [];

        refreshAll();
        return;
    }

    // FALLBACK — brak łączności z backendem
    console.warn('Backend niedostępny. Spadek do lokalnego kodu awaryjnego JS.');
    const result = runJsAutoSelection(well, requiredMm, availProducts);
    if (result.error) {
        if (!autoTriggered) showToast(result.error, 'error');
        well.configStatus = 'ERROR';
        well.configErrors = [result.error];
        refreshAll();
        return;
    }
    well.config = result.config;

    const errors = result.errors || [];
    if (result.fallback)
        errors.push(
            result.fallbackReason
                ? `Zastosowana rozszerzona tolerancja - ${result.fallbackReason}`
                : 'Zastosowana rozszerzona tolerancja'
        );
    if (errors.length > 0 && result.isMinimal) {
        well.configStatus = 'WARNING';
    } else if (errors.length > 0) {
        well.configStatus = 'WARNING';
    } else {
        well.configStatus = 'OK';
    }
    well.configErrors = errors;
    well.configSource = 'AUTO_JS';

    refreshAll();
    const diffStr = result.diff >= 0 ? `+${result.diff}mm` : `${result.diff}mm`;
    const redLabel = result.reductionUsed ? ` + Redukcja DN${result.targetDn || 1000}` : '';
    const fallbackLabel = result.fallback
        ? ' <i data-lucide="alert-triangle"></i> (rozszerzona tolerancja)'
        : '';
    let statusIcon = '<i data-lucide="check-circle-2"></i>';
    if (well.configStatus === 'WARNING') statusIcon = '<i data-lucide="alert-triangle"></i>';
    if (well.configStatus === 'ERROR') statusIcon = '<i data-lucide="alert-circle"></i>';
    if (!autoTriggered) {
        showToast(
            `${statusIcon} Auto-dobór: ${fmtInt(result.totalHeight)} mm (${diffStr}) | ${result.topLabel}${redLabel}${fallbackLabel}`,
            well.configStatus === 'OK' ? 'success' : 'warning'
        );
    }
}

/* ===== LOKALNY SOLVER JS (FALLBACK) ===== */
function runJsAutoSelection(well, requiredMm, availProducts) {
    const dn = well.dn;
    const targetDn = well.redukcjaTargetDN || 1000;
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
    const mag = well.magazyn || 'Kluczbork';
    const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';

    const dnProducts = availProducts.filter((p) => parseInt(p.dn) === parseInt(effectiveDn));
    const allProducts = availProducts;

    // KROK 1: Dennica
    const dennica = getLowestDennica(
        availProducts.filter((p) => filterByWellParams(p, well)),
        dn, mag
    );
    if (!dennica) return { error: 'Brak dennic w magazynie.' };

    // KROK 2: Zakończenie
    const forcedZak = well.zakonczenie || null;
    let topProd = getTopClosure(
        availProducts.filter((p) => filterByWellParams(p, well)),
        effectiveDn, forcedZak, false, mag
    );

    if (!topProd && forcedZak) {
        topProd = studnieProducts.find(
            (p) => p.id === forcedZak && (parseInt(p.dn) === dn || p.dn === null)
        );
    }
    if (!topProd) return { error: 'Nie znaleziono domyślnego zakończenia studni.' };

    // --- Build top closure configs ---
    const topConfigs = [];
    const buildTopConfig = (topP) => {
        let items = [];
        let h = 0;
        let lbl = '';
        if (
            ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
                topP.componentType
            )
        ) {
            const sameDn = studnieProducts.filter((p) => parseInt(p.dn) === parseInt(topP.dn));
            const ring = sameDn.find((p) => p.componentType === 'pierscien_odciazajacy');
            const plate =
                topP.componentType === 'pierscien_odciazajacy'
                    ? sameDn.find(
                          (p) =>
                              p.componentType === 'plyta_zamykajaca' ||
                              p.componentType === 'plyta_najazdowa'
                      )
                    : topP;
            if (ring && plate) {
                items.push(
                    { productId: plate.id, quantity: 1 },
                    { productId: ring.id, quantity: 1 }
                );
                h += plate.height + ring.height;
                lbl = plate.name + ' + Pierścień';
            } else {
                items.push({ productId: topP.id, quantity: 1 });
                h += topP.height;
                lbl = topP.name;
            }
        } else {
            items.push({ productId: topP.id, quantity: 1 });
            h += topP.height;
            lbl = topP.name;
        }

        // Wlaz
        let wlazItem = well.config.find(
            (c) => studnieProducts.find((p) => p.id === c.productId)?.componentType === 'wlaz'
        );
        if (!wlazItem) {
            const wlaz150 = studnieProducts.find((p) => p.id === 'WLAZ-150');
            if (wlaz150) wlazItem = { productId: wlaz150.id, quantity: 1 };
        }
        if (wlazItem) {
            const wlazProd = studnieProducts.find((p) => p.id === wlazItem.productId);
            if (wlazProd) {
                items.unshift(wlazItem);
                h += wlazProd.height * wlazItem.quantity;
                lbl = wlazProd.name + ' + ' + lbl;
            }
        }
        return { items, height: h, label: lbl, prod: topP };
    };

    topConfigs.push(buildTopConfig(topProd));

    // Fallback DIN
    const isRelief = ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(
        topProd.componentType
    );
    if (isRelief || topProd.componentType === 'konus') {
        const dinProd = getTopClosure(
            availProducts.filter((p) => filterByWellParams(p, well)),
            dn, null, true, mag
        );
        if (dinProd && dinProd.id !== topProd.id) {
            const fbCfg = buildTopConfig(dinProd);
            fbCfg.label += ' (zamiennik)';
            topConfigs.push(fbCfg);
        }
    }

    // KROK 3: Przejścia — oblicz minimalne wymagania
    let holes = (well.przejscia || []).map((p) => {
        let pel = parseFloat(p.rzednaWlaczenia);
        let prDN = 160;
        let prod = availProducts.find((x) => x.id === p.productId);
        if (prod && typeof prod.dn === 'string' && prod.dn.includes('/'))
            prDN = parseFloat(prod.dn.split('/')[1]) || 160;
        else if (prod && prod.dn != null) prDN = parseFloat(prod.dn) || 160;

        let bottomEdge = isNaN(pel) ? 0 : Math.round((pel - (well.rzednaDna || 0)) * 1000);
        let center = bottomEdge + prDN / 2;

        const parseHoleClearance = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const p = parseFloat(val);
            return isNaN(p) ? 0 : p;
        };

        return {
            z: center - prDN / 2,
            ruraDz: prDN,
            zdD: prod ? parseHoleClearance(prod.zapasDol) : 0,
            zdDM: prod ? parseHoleClearance(prod.zapasDolMin) : 0,
            zdG: prod ? parseHoleClearance(prod.zapasGora) : 0,
            zdGM: prod ? parseHoleClearance(prod.zapasGoraMin) : 0
        };
    });

    let maxReqH = 0;
    let maxReqHMin = 0;
    holes.forEach((h) => {
        const reqH = h.z + h.ruraDz + h.zdG;
        if (reqH > maxReqH) maxReqH = reqH;
        const reqHMin = h.z + h.ruraDz + h.zdGM;
        if (reqHMin > maxReqHMin) maxReqHMin = reqHMin;
    });

    // KROK 4: Listy kręgów i redukcja
    const dennicy = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                return (
                    (p.componentType === 'styczna' || p.category === 'Studnie styczne') &&
                    filterByWellParams(p, well)
                );
            }
            return (
                p.componentType === 'dennica' &&
                parseInt(p.dn) === dn &&
                filterByWellParams(p, well)
            );
        })
        .sort((a, b) => {
            const aForm = a[ff] === 1 ? 1 : 0;
            const bForm = b[ff] === 1 ? 1 : 0;
            if (aForm !== bForm) return bForm - aForm;
            return a.height - b.height;
        });
    if (dennicy.length === 0) return { error: 'Brak dennic w magazynie.' };

    const avrRings = allProducts
        .filter((p) => p.componentType === 'avr')
        .sort((a, b) => b.height - a.height);

    const isDrilledRing = (p) =>
        p.componentType === 'krag_ot' ||
        (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
        (p.name && String(p.name).toLowerCase().includes('z otworem'));

    const kregiFromEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        dn, mag
    );
    const kregi =
        kregiFromEngine.length > 0
            ? kregiFromEngine
            : availProducts
                  .filter(
                      (p) =>
                          p.componentType === 'krag' && parseInt(p.dn) === dn && !isDrilledRing(p)
                  )
                  .sort((a, b) => b.height - a.height);

    const targetDnKregiEngine = getKregiList(
        availProducts.filter(
            (p) => filterByWellParams(p, well) && p.componentType === 'krag' && !isDrilledRing(p)
        ),
        targetDn, mag
    );
    const targetDnKregi =
        targetDnKregiEngine.length > 0
            ? targetDnKregiEngine
            : availProducts
                  .filter((p) => p.componentType === 'krag' && parseInt(p.dn) === targetDn && !isDrilledRing(p))
                  .sort((a, b) => b.height - a.height);

    let reductionPlate = getReductionPlate(availProducts, dn, well.redukcjaDN1000, targetDn);
    if (!reductionPlate) {
        reductionPlate = studnieProducts.find(
            (p) =>
                p.componentType === 'plyta_redukcyjna' &&
                parseInt(p.dn) === dn &&
                (p.name.includes('/' + targetDn) || p.name.includes(' DN' + targetDn))
        );
    }
    let canReduce = well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    // Jeżeli mamy redukcję, zmień effectiveDn dla górnej części studni (nad płytą)
    const upperDn = canReduce ? targetDn : effectiveDn;

    // KROK 5: DP Ring Optimizer
    function fillKregiDP(target, kList, tolBelow, tolAbove) {
        if (target <= 0) return { kItems: [], filled: 0 };

        console.log('[fillKregiDP] target=', target, 'kList.length=', kList.length, 'dn=', dn, 'mag=', mag);
        if (kList.length === 0) {
            console.warn('[fillKregiDP] Pusta lista kręgów! dn=', dn);
            return fillKregiGreedy(target, kList);
        }

        const dpResult = optimizeRingsForDistance(target, kList, tolBelow, tolAbove);
        console.log('[fillKregiDP] dpResult.success=', dpResult.success, 'selectedRings=', dpResult.selectedRings?.length);
        
        if (dpResult.success && dpResult.selectedRings.length > 0) {
            const kItems = dpResult.selectedRings.map((ring) => ({
                productId: ring.id,
                quantity: 1,
                _h: parseFloat(ring.height)
            }));
            const filled = kItems.reduce((sum, k) => sum + k._h, 0);
            return { kItems, filled };
        }

        return fillKregiGreedy(target, kList);
    }

    function fillKregiGreedy(target, kList) {
        let kItems = [];
        let filled = 0;
        if (target > 0) {
            let left = target;
            for (const k of kList) {
                if (left <= 0) break;
                const qty = Math.floor(left / k.height);
                for (let i = 0; i < qty; i++) {
                    kItems.push({ productId: k.id, quantity: 1, _h: k.height });
                    filled += k.height;
                    left -= k.height;
                }
            }
        }
        return { kItems, filled };
    }

    // KROK 6: Walidacja przejść
    function checkConflicts(kItems, denH, reduceH, topItems) {
        let segs = [];
        let y = 0;
        segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
        y += denH;

        let lastWasDennica = !!well.psiaBuda;

        for (let k of kItems) {
            let actualH = k._h;
            const kp = studnieProducts.find((p) => p.id === k.productId);
            if (kp && kp.componentType === 'dennica' && lastWasDennica) {
                actualH -= 100;
            }

            if (k.productId === reductionPlate?.id) {
                segs.push({ type: 'plyta_redukcyjna', h: actualH, start: y, end: y + actualH });
            } else {
                segs.push({ type: 'krag', h: actualH, start: y, end: y + actualH });
            }
            y += actualH;
            if (kp && kp.componentType !== 'uszczelka') {
                lastWasDennica = kp.componentType === 'dennica';
            }
        }
        for (let t of [...topItems].reverse()) {
            const tp = studnieProducts.find((p) => p.id === t.productId);
            if (tp) {
                let actualH = tp.height;
                if (tp.componentType === 'dennica' && lastWasDennica) actualH -= 100;

                segs.push({ type: tp.componentType, h: actualH, start: y, end: y + actualH });
                y += actualH;
                if (tp.componentType !== 'uszczelka') {
                    lastWasDennica = tp.componentType === 'dennica';
                }
            }
        }

        let isMinimal = false;
        let valid = true;
        let errors = [];

        holes.forEach((h) => {
            const hTop = h.z + h.ruraDz;
            const hBot = h.z;
            const effZdD = h.z === 0 ? 0 : h.zdD;
            const resTop = hTop + h.zdG;
            const resBot = hBot - effZdD;
            const resTopMin = hTop + h.zdGM;
            const effZdDM = h.z === 0 ? 0 : h.zdDM;
            const resBotMin = hBot - effZdDM;

            let strictValid = true;
            let minValid = true;

            for (let s of segs) {
                if (s.type !== 'dennica' || true) {
                    if (s.end >= resBot && s.end <= resTop) strictValid = false;
                    if (s.end >= resBotMin && s.end <= resTopMin) minValid = false;
                }

                const isForbidden = [
                    'konus', 'plyta_din', 'plyta_redukcyjna', 'pierscien_odciazajacy'
                ].includes(s.type);
                if (isForbidden) {
                    if (hTop > s.start && hBot < s.end) {
                        strictValid = false;
                        minValid = false;
                        errors.push(`Kolizja otworu z elementem ${s.type}`);
                    }
                }
                if (s.type === 'plyta_redukcyjna') {
                    if (hBot >= s.start) {
                        strictValid = false;
                        minValid = false;
                        errors.push(`Przejście nie może być powyżej płyty redukcyjnej`);
                    }
                }
            }

            if (!strictValid) {
                if (minValid) {
                    isMinimal = true;
                } else {
                    valid = false;
                    errors.push(`Kolizja otworu Z=${h.z} ze złączami`);
                }
            }
        });

        return { valid, isMinimal, errors };
    }

    // KROK 7: Solver — szuka najlepszej kombinacji
    function solve(tolBelow, tolAbove, maxAvr, skipHolesValid) {
        let best = null;
        let bestScore = Infinity;

        for (const topCfg of topConfigs) {
            for (const dennicaItem of dennicy) {
                if (dennicaItem.height < maxReqHMin) continue;
                let denIsMin = dennicaItem.height < maxReqH;

                let effDenH = dennicaItem.height;
                if (well.psiaBuda) effDenH -= 100;

                const targetBody = requiredMm - topCfg.height - effDenH;
                if (targetBody < 0) continue;

                const { kItems, filled } = fillKregiDP(targetBody, kregi, tolBelow, tolAbove);

                const deficit = requiredMm - (dennicaItem.height + topCfg.height + filled);
                if (deficit > maxAvr || deficit < -tolAbove) continue;

                let avrItems = [];
                let avrH = 0;

                let bestAvrCombo = [];
                let bestAvrDiff = deficit;
                function bcktrAvr(combo, sum, idx) {
                    let d = Math.abs(deficit - sum);
                    if (d < bestAvrDiff) {
                        bestAvrDiff = d;
                        bestAvrCombo = [...combo];
                        avrH = sum;
                    } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
                        bestAvrCombo = [...combo];
                        avrH = sum;
                    }
                    for (let i = idx; i < avrRings.length; i++) {
                        if (sum + avrRings[i].height <= maxAvr) {
                            combo.push(avrRings[i]);
                            bcktrAvr(combo, sum + avrRings[i].height, i);
                            combo.pop();
                        }
                    }
                }
                if (deficit > 0) bcktrAvr([], 0, 0);

                let cMap = {};
                for (let a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
                for (let id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });
                const diff = dennicaItem.height + topCfg.height + filled + avrH - requiredMm;
                const isOutOfBounds = diff < -50 || diff > 20;

                const conf = checkConflicts(kItems, dennicaItem.height, 0, topCfg.items);
                if (!conf.valid && !skipHolesValid) continue;

                let score = dennicaItem.height * 1000 + kItems.length * 10;
                if (diff !== 0) score += Math.abs(diff) * 5;
                if (isOutOfBounds) score += 20000;
                if (conf.isMinimal || denIsMin) score += 50000;
                if (topCfg.label.includes('zamiennik')) score += 100000;

                if (score < bestScore) {
                    bestScore = score;
                    let runErrors = [...conf.errors];
                    if (isOutOfBounds)
                        runErrors.push(
                            `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                        );
                    best = {
                        topItems: [...topCfg.items],
                        kregItems: kItems.map((ki) => ({
                            productId: ki.productId,
                            quantity: ki.quantity
                        })),
                        dennica: { productId: dennicaItem.id, quantity: 1 },
                        avrItems: avrItems,
                        totalHeight: dennicaItem.height + topCfg.height + filled + avrH,
                        diff: diff,
                        topLabel: topCfg.label,
                        errors: runErrors,
                        isMinimal: conf.isMinimal || denIsMin
                    };
                }
            }
        }

        // --- Redukcja DN1000 / DN1200 ---
        if (canReduce) {
            let topRedItems = [];
            let topRedH = 0;
            const redTargetProducts = availProducts.filter((p) => parseInt(p.dn) === targetDn);
            const redTopProducts = redTargetProducts.filter((p) =>
                ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType)
            );

            const rZak = well.redukcjaZakonczenie
                ? redTopProducts.find((p) => p.id === well.redukcjaZakonczenie)
                : getTopClosure(
                      redTargetProducts.filter((p) => filterByWellParams(p, well)),
                      targetDn, null, false, mag
                  );
            if (rZak) {
                topRedItems.push({ productId: rZak.id, quantity: 1 });
                topRedH += rZak.height;

                // AUTOMATYCZNE PAROWANIE (Płyta + Pierścień)
                const isPlate = ['plyta_najazdowa', 'plyta_zamykajaca'].includes(rZak.componentType);
                const isRing = rZak.componentType === 'pierscien_odciazajacy';

                if (isPlate || isRing) {
                    const partnerType = isPlate ? ['pierscien_odciazajacy'] : ['plyta_najazdowa', 'plyta_zamykajaca'];
                    const partner = redTargetProducts.find(p => 
                        partnerType.includes(p.componentType) && 
                        filterByWellParams(p, well)
                    );
                    if (partner) {
                        topRedItems.push({ productId: partner.id, quantity: 1 });
                        topRedH += partner.height;
                    }
                }
            }

            let maxHoleTop = 0;
            if (well.przejscia && well.przejscia.length > 0) {
                const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
                for (const pr of well.przejscia) {
                    let pel = parseFloat(pr.rzednaWlaczenia);
                    if (!isNaN(pel)) {
                        const holeCenter = (pel - rzDna) * 1000;
                        const pprod = studnieProducts.find((x) => x.id === pr.productId);
                        if (pprod) {
                            let prDN =
                                typeof pprod.dn === 'string' && pprod.dn.includes('/')
                                    ? parseFloat(pprod.dn.split('/')[1]) || 160
                                    : parseFloat(pprod.dn) || 160;
                            const zapasGora = parseFloat(
                                pprod.zapasGora !== undefined
                                    ? pprod.zapasGora
                                    : pprod.zapasGoraMin || 0
                            );
                            const holeTop = holeCenter + prDN / 2 + zapasGora;
                            if (holeTop > maxHoleTop) maxHoleTop = holeTop;
                        }
                    }
                }
            }

            let minLowerTotal = Math.max(well.redukcjaMinH || 0, maxHoleTop);
            let dynamicMinBottom = minLowerTotal;
            let lift = 0;
            while (lift < 15) {
                for (const dennicaItem of dennicy) {
                    if (dennicaItem.height < maxReqHMin) continue;
                    let bottomNeed = Math.max(dynamicMinBottom - dennicaItem.height, 0);

                    const bKregi = fillKregiDP(bottomNeed, kregi, tolBelow, tolAbove);
                    const bSec = dennicaItem.height + bKregi.filled;

                    const targetBodyNeed = requiredMm - bSec - reductionPlate.height - topRedH;
                    if (targetBodyNeed < 0) continue;

                    const tTarget = fillKregiDP(targetBodyNeed, targetDnKregi, tolBelow, tolAbove);
                    const currentTotal = bSec + reductionPlate.height + topRedH + tTarget.filled;

                    const deficit = requiredMm - currentTotal;
                    if (deficit > maxAvr || deficit < -tolAbove) continue;
                    let avrItems = [];
                    let avrH = 0;

                    let bestAvrCombo = [];
                    let bestAvrDiff = deficit;
                    function bcktrAvr(combo, sum, idx) {
                        let d = Math.abs(deficit - sum);
                        if (d < bestAvrDiff) {
                            bestAvrDiff = d;
                            bestAvrCombo = [...combo];
                            avrH = sum;
                        } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
                            bestAvrCombo = [...combo];
                            avrH = sum;
                        }
                        for (let i = idx; i < avrRings.length; i++) {
                            if (sum + avrRings[i].height <= maxAvr) {
                                combo.push(avrRings[i]);
                                bcktrAvr(combo, sum + avrRings[i].height, i);
                                combo.pop();
                            }
                        }
                    }
                    if (deficit > 0) bcktrAvr([], 0, 0);

                    let cMap = {};
                    for (let a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
                    for (let id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });

                    const diff = currentTotal + avrH - requiredMm;
                    const isOutOfBounds = diff < -50 || diff > 20;

                    let redKItems = [];
                    bKregi.kItems.forEach((k) => redKItems.push(k));
                    redKItems.push({
                        productId: reductionPlate.id,
                        quantity: 1,
                        _h: reductionPlate.height
                    });
                    tTarget.kItems.forEach((k) => redKItems.push(k));

                    const conf = checkConflicts(redKItems, dennicaItem.height, bSec, topRedItems);

                    if (!conf.valid && !skipHolesValid) {
                        if (conf.errors.some((e) => e.includes('redukcyjnej') || e.includes('konus'))) {
                            break;
                        }
                        continue;
                    }

                    let score =
                        dennicaItem.height * 1000 +
                        (bKregi.kItems.length + tTarget.kItems.length) * 10;
                    const dnFactor = (parseInt(dn) || 1200) / 400;
                    score += bSec * dnFactor;
                    const oversizedBottom = bSec - minLowerTotal;
                    if (oversizedBottom > 0) {
                        score += oversizedBottom * 50;
                    }
                    if (diff !== 0) score += Math.abs(diff) * 15;
                    if (isOutOfBounds) score += 50000;
                    if (conf.isMinimal) score += 50000;

                    if (score < bestScore) {
                        bestScore = score;
                        let runErrors = [...conf.errors];
                        if (isOutOfBounds)
                            runErrors.push(
                                `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                            );
                        best = {
                            reductionUsed: true,
                            topItems: [...topRedItems],
                            kregItems: [
                                ...tTarget.kItems
                                    .map((ki) => ({ productId: ki.productId, quantity: ki.quantity }))
                                    .reverse(),
                                { productId: reductionPlate.id, quantity: 1 },
                                ...bKregi.kItems
                                    .map((ki) => ({ productId: ki.productId, quantity: ki.quantity }))
                                    .reverse()
                            ],
                            dennica: { productId: dennicaItem.id, quantity: 1 },
                            avrItems: avrItems,
                            totalHeight: currentTotal + avrH,
                            diff: diff,
                            topLabel: `Redukcja DN${targetDn}`,
                            targetDn: targetDn,
                            errors: runErrors,
                            isMinimal: conf.isMinimal || dennicaItem.height < maxReqH
                        };
                    }
                }
                dynamicMinBottom += 250;
                lift++;
            }
        }

        return best;
    }

    let solution = solve(280, 20, 280, false);
    let fallback = false;
    let fallbackReason = '';
    if (!solution) {
        solution = solve(280, 20, 280, true);
        if (solution) {
            fallback = true;
            fallbackReason = 'kolizje przejść ominięte awaryjnie';
        }
    }

    if (!solution) {
        return {
            error: `Nie znaleziono pasującej kombinacji elementów dla tej wysokości (max. ± dozwolona odchyłka, max ${well.magazyn || 'Kluczbork'} avr 28cm).`
        };
    }

    const wlazItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'wlaz';
    });
    const otherTopItems = solution.topItems.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType !== 'wlaz';
    });

    const kregItemsOrdered = solution.reductionUsed
        ? solution.kregItems
        : [...solution.kregItems].reverse();

    let newConfig = [
        ...wlazItems,
        ...solution.avrItems,
        ...otherTopItems,
        ...kregItemsOrdered,
        solution.dennica
    ];

    for (let i = 0; i < newConfig.length - 1; i++) {
        const itemKonus = newConfig[i];
        const prodKonus = studnieProducts.find((p) => p.id === itemKonus.productId);

        if (prodKonus && prodKonus.componentType === 'konus' && !prodKonus.name.includes('+')) {
            let nextKragIdx = -1;
            for (let j = i + 1; j < newConfig.length; j++) {
                const pj = studnieProducts.find((p) => p.id === newConfig[j].productId);
                if (pj && (pj.componentType === 'krag' || pj.componentType === 'krag_ot')) {
                    nextKragIdx = j;
                    break;
                } else if (
                    pj &&
                    (pj.componentType === 'dennica' || pj.componentType === 'plyta_redukcyjna')
                ) {
                    break;
                }
            }

            if (nextKragIdx >= 0) {
                const itemKrag = newConfig[nextKragIdx];
                const prodKrag = studnieProducts.find((p) => p.id === itemKrag.productId);

                if (prodKrag && prodKrag.height === 250 && prodKrag.componentType === 'krag') {
                    const konusPlus = availProducts.find(
                        (p) =>
                            p.componentType === 'konus' &&
                            p.dn === prodKonus.dn &&
                            p.name.includes('Konus+')
                    );
                    if (konusPlus) {
                        itemKonus.productId = konusPlus.id;
                        if (itemKrag.quantity > 1) {
                            itemKrag.quantity--;
                        } else {
                            newConfig.splice(nextKragIdx, 1);
                        }
                    }
                }
            }
            break;
        }
    }

    // --- KRĘGI Z OTWOREM (DRILLED RINGS) ---
    let revY = 0;
    let lastWasD = !!well.psiaBuda;
    const segmentsReverse = [...newConfig].reverse().map((item) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: revY,
            end: revY + h,
            type: prod ? prod.componentType : ''
        };
        revY += h;
        lastWasD = prod && prod.componentType === 'dennica';
        return seg;
    });

    for (const pr of well.przejscia || []) {
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const holeCenter = (pel - (well.rzednaDna || 0)) * 1000;
        const pprod = studnieProducts.find((x) => x.id === pr.productId);
        if (!pprod) continue;
        let prDN =
            typeof pprod.dn === 'string' && pprod.dn.includes('/')
                ? parseFloat(pprod.dn.split('/')[1]) || 160
                : parseFloat(pprod.dn) || 160;
        const zapasGora = parseFloat(
            pprod.zapasGora !== undefined ? pprod.zapasGora : pprod.zapasGoraMin || 0
        );
        const zapasDol = parseFloat(
            pprod.zapasDol !== undefined ? pprod.zapasDol : pprod.zapasDolMin || 0
        );
        const holeBottom = holeCenter - prDN / 2 - zapasDol;
        const holeTop = holeCenter + prDN / 2 + zapasGora;

        for (const seg of segmentsReverse) {
            if (
                (seg.type === 'krag' || seg.type === 'krag_ot') &&
                Math.max(seg.start, holeBottom) < Math.min(seg.end, holeTop)
            ) {
                const itemProd = studnieProducts.find((p) => p.id === seg.itemBase.productId);
                if (itemProd && itemProd.componentType !== 'krag_ot') {
                    const isDrilledRingObj = (p) =>
                        p.componentType === 'krag_ot' ||
                        (p.id && String(p.id).toLowerCase().endsWith('ot')) ||
                        (p.name && String(p.name).toLowerCase().includes('z otworem'));
                    const otProd = availProducts.find(
                        (p) =>
                            isDrilledRingObj(p) &&
                            p.dn === itemProd.dn &&
                            p.height === itemProd.height
                    );
                    if (otProd) {
                        seg.itemBase.productId = otProd.id;
                        seg.type = 'krag_ot';
                    } else {
                        const dynamicOtId = itemProd.id + '_OT';
                        if (!studnieProducts.find((p) => p.id === dynamicOtId)) {
                            const dynamicProd = JSON.parse(JSON.stringify(itemProd));
                            dynamicProd.id = dynamicOtId;
                            dynamicProd.componentType = 'krag_ot';
                            if (!dynamicProd.name.endsWith(' z otworem'))
                                dynamicProd.name += ' z otworem';
                            studnieProducts.push(dynamicProd);
                        }
                        seg.itemBase.productId = dynamicOtId;
                        seg.type = 'krag_ot';
                    }
                }
            }
        }
    }

    return {
        config: newConfig,
        totalHeight: solution.totalHeight,
        diff: solution.diff,
        isMinimal: solution.isMinimal,
        errors: solution.errors,
        topLabel: solution.topLabel,
        fallback,
        fallbackReason
    };
}

/* ===== WALIDACJA LUZÓW PRZEJŚĆ ===== */
function recalculateWellErrors(well) {
    if (!well) return;

    // Wyczyść błędy dotyczące luzów z poprzedniego wywołania
    let liveErrors = well.configErrors
        ? well.configErrors.filter(
              (e) => !e.includes('Błąd zapasu') && !e.includes('nie spełnia zapasów')
          )
        : [];

    // --- WALIDACJA LUZÓW NA ŻYWO ---
    if (well.przejscia && well.przejscia.length > 0 && well.config && well.config.length > 0) {
        const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
        if (rzDna !== null && !isNaN(rzDna)) {
            const segments = [];
            let cy = 0;
            let lastWasDennica = !!well.psiaBuda;
            const configReversed = [...well.config].reverse();
            for (const item of configReversed) {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (!p || !p.height) continue;
                const qty = item.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    let actualHeight = p.height || 0;
                    if (p.componentType === 'dennica' && lastWasDennica) {
                        actualHeight -= 100;
                    }

                    segments.push({
                        type: p.componentType,
                        start: cy,
                        end: cy + actualHeight,
                        product: p,
                        name: p.name
                    });
                    cy += actualHeight;
                    if (p.componentType !== 'uszczelka') {
                        lastWasDennica = p.componentType === 'dennica';
                    }
                }
            }

            // Domyślna logika luzów
            const getDefaultC = (dn) => {
                const table = [
                    { max: 200, z: [100, 100, 50, 50] },
                    { max: 400, z: [150, 150, 100, 100] },
                    { max: 600, z: [200, 150, 150, 100] },
                    { max: 800, z: [200, 200, 150, 100] },
                    { max: 1000, z: [250, 250, 200, 150] },
                    { max: 9999, z: [300, 300, 250, 200] }
                ];
                for (let r of table) if (dn <= r.max) return r.z;
                return [300, 300, 250, 200];
            };

            const przZegarowe = well.przejscia
                .map((pr, idx) => ({ pr, origIdx: idx }))
                .sort((a, b) => {
                    return (parseFloat(a.pr.angle) || 0) - (parseFloat(b.pr.angle) || 0);
                });

            przZegarowe.forEach(({ pr }, porzadekIdx) => {
                const pel = parseFloat(pr.rzednaWlaczenia);
                if (isNaN(pel)) return;

                const pprod = studnieProducts.find((x) => x.id === pr.productId);
                if (!pprod) return;

                let dn_val = 160;
                if (pprod.dn && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                    dn_val = parseFloat(pprod.dn.split('/')[1]) || 160;
                } else if (pprod.dn) {
                    dn_val = parseFloat(pprod.dn) || 160;
                }

                const defs = getDefaultC(dn_val);
                const parseClearance = (val, defVal) => {
                    if (val === undefined || val === null || val === '') return defVal;
                    const p = parseFloat(val);
                    return isNaN(p) ? defVal : p;
                };
                const zg_req = parseClearance(pprod.zapasGora, defs[1]);
                const zd_req = parseClearance(pprod.zapasDol, defs[0]);
                const hc_invert = (pel - rzDna) * 1000;
                const top_pos = hc_invert + dn_val;

                const typStr = pr.flowType === 'wylot' ? 'wylot' : 'dolot';
                const displayType = `nr ${porzadekIdx + 1} (${typStr} DN${dn_val}, rodzaj: ${pprod.name})`;

                for (const seg of segments) {
                    if (hc_invert >= seg.start && hc_invert < seg.end) {
                        const distToBottom = hc_invert - seg.start;
                        const distToTop = seg.end - top_pos;

                        const isBottomMostDennica =
                            seg.start === 0 && (seg.type === 'dennica' || seg.type === 'styczna');
                        const isDdd = seg.product.id.toLowerCase().includes('ddd');
                        const applyingZdReq = isBottomMostDennica && isDdd ? 0 : zd_req;

                        if (distToBottom < applyingZdReq && distToBottom >= 0) {
                            const errStr = `Błąd zapasu dolnego w "${seg.name}" dla przejścia ${displayType} (jest ${Math.round(distToBottom)}mm, wymagane ${applyingZdReq}mm z cennika)`;
                            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                        }
                        if (distToTop < zg_req) {
                            const errStr = `Błąd zapasu górnego w "${seg.name}" dla przejścia ${displayType} (zostało ${Math.round(distToTop)}mm, wymagane ${zg_req}mm z cennika)`;
                            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                        }
                    }
                }
            });
        }
    }
    well.configErrors = [...new Set(liveErrors)];
    well.configStatus =
        well.configErrors.length > 0 ? 'ERROR' : well.configSource ? 'OK' : well.configStatus || '';
}
