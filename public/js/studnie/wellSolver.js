// @ts-check
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
 *   sortWellConfigByOrder(), recalcGaskets(), calcWellStats(),
 *   renderWellConfig(), renderWellDiagram(), updateSummary(),
 *   updateHeightIndicator(), refreshAll(), showToast(), fmtInt()
 */


/* ===== KRĘGI WIERCONE (OT) ===== */

/**
 * Buduje tablicę segmentów z konfiguracji (odwróconej).
 */
function buildConfigSegments(configItems, psiaBuda) {
    let y = 0;
    let lastWasD = !!psiaBuda;
    return configItems.map((item) => {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        let h = prod ? parseFloat(prod.height) || 0 : 0;
        if (prod && prod.componentType === 'dennica' && lastWasD) {
            h -= 100;
        }
        const seg = {
            itemBase: item,
            start: y,
            end: y + h,
            type: prod ? prod.componentType : ''
        };
        y += h;
        lastWasD = prod && prod.componentType === 'dennica';
        return seg;
    });
}

/**
 * Po zbudowaniu segmentów, sprawdza czy przejście (otwór) jest WEWNĄTRZ kręgu
 * i zamienia zwykły krag na krag_ot (wiercony) w odpowiednim segmencie.
 *
 * ZASADY:
 * 1. Otwór OT tylko gdy przejście faktycznie jest WEWNĄTRZ tego kręgu (środek otworu)
 * 2. Zamiana na OT musi zachować tę samą wysokość kręgu (nie zmienia totalnej wysokości)
 * 3. Jeśli otwór wychodzi na łączenie dennicy i kręgu → zwraca flagę needsTallerDennica
 *
 * Zwraca { items: kregItems[], needsTallerDennica: boolean }
 */
function applyDrilledRings(kregItems, segments, well, availProducts) {
    const result = { items: kregItems, needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) {
        // Zwróć KLON aby caller mógł bezpiecznie zrobić splice na oryginalnej tablicy
        result.items = structuredClone(kregItems);
        return result;
    }
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
    const newItems = structuredClone(kregItems);
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
                                    const dynamicProd = structuredClone(kp);
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

/* ===== ZAPYTANIE DO BACKENDU (AI-FIRST) ===== */
async function fetchConfigFromBackend(well, requiredMm, availProducts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const effDn = well.dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : well.dn;
        const payload = {
            dn: effDn,
            target_height_mm: requiredMm,
            use_reduction: well.redukcjaDN1000 || false,
            target_dn: well.redukcjaDN1000 ? (well.redukcjaTargetDN || 1000) : null,
            redukcja_min_h_mm: well.redukcjaMinH || 0,
            warehouse: well.magazyn === 'Włocławek' ? 'WL' : 'KLB',
            psia_buda: well.psiaBuda || false,
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
            wkladkaZwienczenie: well.wkladkaZwienczenie || 'brak',
            available_products: (() => {
                const availIds = new Set(availProducts.map(p => p.id));
                const extraKonus = studnieProducts.filter(
                    p => p.componentType === 'konus' &&
                         parseInt(p.dn) === parseInt(effDn) &&
                         !availIds.has(p.id)
                );
                const allProducts = extraKonus.length > 0 ? [...availProducts, ...extraKonus] : availProducts;
                return allProducts.map((p) => ({
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
                }));
        })()
        };
        const apiUrl = `http://${window.location.hostname}:8000/api/v1/configure`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        return data; // zwraca WSZYSTKIE warianty
    } catch (err) {
        logger.warn('wellSolver', 'Backend ML nie odpowiada — używam solvera JS:', err);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function buildConfigFromBackendResult(backendResult) {
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
                const dynamicProd = structuredClone(product);
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
    return newConfig;
}

function findDennicaInConfig(config) {
    // Konfiguracja jest top-to-bottom: wlaz, avr, top closure, kregi, dennica
    // Szukamy ostatniego elementu z componentType === 'dennica' lub 'styczna'
    for (let i = config.length - 1; i >= 0; i--) {
        const p = studnieProducts.find(pr => pr.id === config[i].productId);
        if (p && (p.componentType === 'dennica' || p.componentType === 'styczna')) {
            return p;
        }
    }
    return null;
}

/* ===== GŁÓWNY PUNKT WEJŚCIA AUTO-DOBORU ===== */
let isAutoSelectRunning = false;
window.__autoSelectCallCount = 0;
const __MAX_AUTO_SELECT_CALLS = 10;
window.autoSelectComponents = async function autoSelectComponents(autoTriggered = false) {
    window.__autoSelectCallCount++;
    if (window.__autoSelectCallCount > __MAX_AUTO_SELECT_CALLS) {
        logger.error('wellSolver', '========================================');
        logger.error('wellSolver', 'DETEKCJA NIESKOŃCZONEJ PĘTLI autoSelectComponents!');
        logger.error('wellSolver', 'Licznik wywołań:', window.__autoSelectCallCount);
        logger.error('wellSolver', 'Stack trace:', new Error().stack);
        logger.error('wellSolver', '========================================');
        window.__autoSelectCallCount = 0;
        return;
    }
    if (isAutoSelectRunning) {
        logger.warn('wellSolver', '[AutoSelect] Pomijam — już trwa auto-dobór');
        return;
    }
    isAutoSelectRunning = true;
    try {
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
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
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

    if (!studnieProducts || studnieProducts.length === 0) {
        if (!autoTriggered) showToast('Dane produktów jeszcze się ładują...', 'info');
        return;
    }

    // --- Pokaż loading w UI ---
    well.configStatus = 'LOADING';
    if (typeof refreshAll === 'function') refreshAll();

    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

    // === KROK 0: Pobierz preferencje z bazy wiedzy (Phase 3) ===
    /** @type {Object|null} */
    let preferenceWeights = null;
    try {
        const prefsResp = await fetch(
            `/api/learning/preferences?dn=${parseInt(effectiveDn)}&warehouse=${encodeURIComponent(well.magazyn || '')}`,
            { credentials: 'same-origin' }
        );
        if (prefsResp.ok) {
            const prefs = await prefsResp.json();
            if (prefs && prefs.confidence > 0.1) {
                preferenceWeights = prefs;
                logger.info('wellSolver', '[AutoSelect] Preferencje załadowane (confidence=' + prefs.confidence + ')');
            } else {
                logger.info('wellSolver', '[AutoSelect] Preferencje puste (confidence=' + (prefs ? prefs.confidence : 0) + ') — brak danych');
            }
        }
    } catch (e) {
        logger.warn('wellSolver', '[AutoSelect] Błąd pobierania preferencji:', e);
    }

    // === KROK 1: Backend AI (OR-Tools, 10s timeout) ===
    logger.info('wellSolver', '[AutoSelect] Wywołanie backendu OR-Tools...');
    const backendData = await fetchConfigFromBackend(well, requiredMm, availProducts);

    if (Array.isArray(backendData) && backendData.length > 0) {
        // Zapisz WSZYSTKIE warianty na well (do alternatyw UI)
        well._backendVariants = backendData;

        const backendResult = backendData[0]; // najlepszy (posortowany przez ranker)

        if (backendResult && backendResult.is_valid && backendResult.items.length > 0) {
            const newConfig = buildConfigFromBackendResult(backendResult);

            // === WERYFIKACJA DENNICY ===
            const dnProducts = availProducts.filter((p) => filterByWellParams(p, well));
            const correctDennica = getLowestDennicaHybrid(dnProducts, dn, well.magazyn || 'Kluczbork', well.przejscia, well.rzednaDna, well.stycznaDn).dennica;
            const configDennica = findDennicaInConfig(newConfig);
            const dennicaWrong = correctDennica && configDennica && configDennica.id !== correctDennica.id;
            if (dennicaWrong) {
                logger.warn('wellSolver', `[AutoSelect] AI wybrało złą dennicę ${configDennica.id} (h=${configDennica.height}). Wymagana: ${correctDennica.id} (h=${correctDennica.height}). Fallback do JS.`);
            }

            // Walidacja redukcji
            const redukcjaOk = !well.redukcjaDN1000 || (() => {
                const targetDn = well.redukcjaTargetDN || 1000;
                return !newConfig.some(item => {
                    const p = studnieProducts.find(pr => pr.id === item.productId);
                    if (p && (p.componentType === 'konus' || p.componentType === 'plyta_din' || p.componentType === 'krag' || p.componentType === 'krag_ot')) {
                        if (parseInt(p.dn) !== targetDn && parseInt(p.dn) !== parseInt(well.dn)) {
                            return true;
                        }
                    }
                    return false;
                });
            })();

            // Sprawdź czy backend uwzględnił wymuszone zakończenie
            const forcedClosureId = well.redukcjaDN1000
                ? well.redukcjaZakonczenie
                : well.zakonczenie;
            const forcedClosureOk = !forcedClosureId || newConfig.some(item => item.productId === forcedClosureId);
            if (!forcedClosureOk) {
                logger.warn('wellSolver', '[AutoSelect] Backend pominął wymuszone zakończenie. Fallback do JS.');
            }

            // Sprawdź czy istnieje jakiekolwiek zakończenie górne w configu
            const topClosureTypes = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];
            const hasTopClosure = newConfig.some(item => {
                const prod = studnieProducts.find(p => p.id === item.productId);
                return prod && topClosureTypes.includes(prod.componentType);
            });
            if (!hasTopClosure) {
                logger.warn('wellSolver', '[AutoSelect] Backend nie zawiera zakończenia górnego. Fallback do JS.');
            }

            // Sprawdź czy backend wybrał konus gdy dostępny (bez PEHD)
            const isPEHD = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
            const konusAvailable = !isPEHD && studnieProducts.some(
                p => p.componentType === 'konus' && parseInt(p.dn) === parseInt(effectiveDn)
            );
            const hasKonus = newConfig.some(item => {
                const prod = studnieProducts.find(p => p.id === item.productId);
                return prod && prod.componentType === 'konus';
            });
            const konusOk = !konusAvailable || hasKonus || !!forcedClosureId;
            if (!konusOk) {
                logger.warn('wellSolver', '[AutoSelect] Backend pominął konus mimo dostępności. Fallback do JS.');
            }

            if (!dennicaWrong && redukcjaOk && forcedClosureOk && hasTopClosure && konusOk) {
                applyBackendConfig(well, newConfig, backendResult, autoTriggered);
                // Po zastosowaniu najlepszego wariantu, pokaż alternatywy
                if (backendData.length > 1) {
                    var wellIdx = (typeof currentWellIndex !== 'undefined') ? currentWellIndex : -1;
                    _showAlternatives(well, backendData, wellIdx);
                }
                return;
            }
        }
    }

    // === KROK 2: Fallback do JS solvera ===
    logger.warn('wellSolver', '[AutoSelect] Backend niedostępny lub odrzucił. Fallback do JS solvera.');
    const jsMsStart = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    const jsResult = runJsAutoSelection(well, requiredMm, availProducts, preferenceWeights);
    if (jsResult.error) {
        showToast(jsResult.error, 'error');
        well.configStatus = 'ERROR';
        well.configErrors = [jsResult.error];
        refreshAll();
        return;
    }
    logger.info('wellSolver', '[AutoSelect] JS solver OK. config.length=', jsResult.config?.length, 'totalHeight=', jsResult.totalHeight, 'diff=', jsResult.diff, 'topLabel=', jsResult.topLabel, 'fallback=', jsResult.fallback);
    if (jsResult.config) logger.info('wellSolver', '[AutoSelect] config[0]=', JSON.stringify(jsResult.config[0]));

    well.config = jsResult.config;
    const errors = [...(jsResult.errors || [])];
    if (jsResult.fallback)
        errors.push(
            jsResult.fallbackReason
                ? `Zastosowana rozszerzona tolerancja - ${jsResult.fallbackReason}`
                : 'Zastosowana rozszerzona tolerancja'
        );
    if (errors.length > 0 && jsResult.isMinimal) {
        well.configStatus = 'WARNING';
    } else if (errors.length > 0) {
        well.configStatus = 'WARNING';
    } else {
        well.configStatus = 'OK';
    }
    well.configErrors = errors;
    well.configSource = 'AUTO_JS';

    try {
        sortWellConfigByOrder();
        if (typeof recalcGaskets === 'function') recalcGaskets(well);
        if (typeof syncKineta === 'function') syncKineta(well);
        logger.info('wellSolver', '[AutoSelect] Przed render. config.length=', well.config?.length);
        renderWellConfig();
        renderWellDiagram();
        updateSummary();
        refreshAll();
        logger.info('wellSolver', '[AutoSelect] Render OK.');
    } catch (renderErr) {
        logger.error('wellSolver', '[AutoSelect] Błąd renderowania:', renderErr);
        logger.error('wellSolver', '[AutoSelect] Stack:', renderErr.stack);
    }

    // ─── Pasywny hook telemetry AI (NIE zmienia logiki solvera) ───
    // Wysyła pełny snapshot wygenerowanej konfiguracji do /api/telemetry/ai/config.
    // Solver JS pozostaje jedynym źródłem prawdy — telemetry jedynie obserwuje.
    try {
        if (typeof window.telemetryRecordConfig === 'function') {
            const jsMsEnd = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
            window.telemetryRecordConfig({
                well: well,
                configItems: well.config || [],
                solverSource: 'AUTO_JS',
                computationMs: Math.round(jsMsEnd - jsMsStart),
                iterationCount: 1,
                checkedVariants: (availProducts || []).length,
                rankingScore: typeof jsResult.diff === 'number' ? Math.max(0, 10 - jsResult.diff / 50) : undefined,
                selectionReason: jsResult.fallback
                    ? `fallback: ${jsResult.fallbackReason || 'extended tolerance'}`
                    : 'js_solver_standard'
            });
        }
    } catch (e) {
        // Pasywny hook — nie wpływa na wynik solvera
    }

    const diffStr = jsResult.diff >= 0 ? `+${jsResult.diff}mm` : `${jsResult.diff}mm`;
    const redLabel = jsResult.reductionUsed ? ` + Redukcja DN${jsResult.targetDn || 1000}` : '';
    const fallbackLabel = jsResult.fallback
        ? ' <i data-lucide="alert-triangle"></i> (rozszerzona tolerancja)'
        : '';
    let statusIcon = '<i data-lucide="check-circle-2"></i>';
    if (well.configStatus === 'WARNING') statusIcon = '<i data-lucide="alert-triangle"></i>';
    if (well.configStatus === 'ERROR') statusIcon = '<i data-lucide="alert-circle"></i>';
    if (!autoTriggered) {
        showToast(
            `${statusIcon} Auto-dobór (JS): ${fmtInt(jsResult.totalHeight)} mm (${diffStr}) | ${jsResult.topLabel}${redLabel}${fallbackLabel}`,
            well.configStatus === 'OK' ? 'success' : 'warning'
        );
    }
} finally {
    isAutoSelectRunning = false;
    if (window.__autoSelectCallCount > 0) window.__autoSelectCallCount--;
}
};

function applyBackendConfig(well, newConfig, backendResult, autoTriggered) {
    well.config = newConfig;
    well.originalAutoConfig = structuredClone(newConfig);
    well.overrideReason = null;

    // Upewnij się, że studnia ma właz
    const hasWlaz = newConfig.some(
        item => studnieProducts.find(p => p.id === item.productId)?.componentType === 'wlaz'
    );
    if (!hasWlaz) {
        const defaultWlaz = studnieProducts.find(p => p.id === 'WLAZ-150');
        if (defaultWlaz) well.config.unshift({ productId: defaultWlaz.id, quantity: 1 });
    }

    if (backendResult.errors && backendResult.errors.length > 0) {
        backendResult.errors.forEach(e => showToast(e, 'error'));
        well.configStatus = 'WARNING';
    } else {
        well.configStatus = 'OK';
        if (!autoTriggered) showToast('Zoptymalizowano matematycznie (serwer OR-Tools) pomyślnie!', 'success');
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

    // Rozwiazywanie PEHD
    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
        const forcedZak = well.redukcjaDN1000 ? well.redukcjaZakonczenie : well.zakonczenie;
        if (!forcedZak) {
            const hasDinPlate = newConfig.some(item => {
                const p = studnieProducts.find(pr => pr.id === item.productId);
                return p && p.componentType === 'plyta_din';
            });
            if (hasDinPlate && typeof window.showKonusPehdResolverModal === 'function') {
                setTimeout(() => window.showKonusPehdResolverModal(currentWellIndex), 100);
            }
        }
    }

    if (typeof refreshAll === 'function') refreshAll();
}

/* ===== LOKALNY SOLVER JS (FALLBACK) ===== */
function runJsAutoSelection(well, requiredMm, availProducts, preferenceWeights) {
    const dn = well.dn;
    const targetDn = well.redukcjaTargetDN || 1000;
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
    const mag = well.magazyn || 'Kluczbork';
    const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';

    const dnProducts = availProducts.filter((p) => parseInt(p.dn) === parseInt(effectiveDn));
    const allProducts = availProducts;

    // KROK 1: Dennica
    const dnResult = getLowestDennicaHybrid(
        availProducts.filter((p) => filterByWellParams(p, well)),
        dn, mag, well.przejscia, well.rzednaDna, well.stycznaDn
    );
    const dennica = dnResult.dennica;
    if (!dennica) return { error: 'Brak dennic w magazynie.' };

    // KROK 2: Zakończenie
    const forcedZak = well.zakonczenie || null;
    const isWkladkaZwienczenie = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
    let topProd = getTopClosure(
        availProducts.filter((p) => filterByWellParams(p, well)),
        effectiveDn, forcedZak, isWkladkaZwienczenie, mag
    );

    // Jeśli getTopClosure zwrócił coś innego niż konus (np. Płyta DIN),
    // a konus jest dostępny w katalogu i nie ma PEHD → nadpisz konusem
    // Nie nadpisuj gdy użytkownik ręcznie wybrał zakończenie (forcedZak)
    if (!forcedZak && topProd && topProd.componentType !== 'konus' && !isWkladkaZwienczenie) {
        const konusFromCatalog = studnieProducts.find(
            p => p.componentType === 'konus' &&
                 (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
        if (konusFromCatalog) {
            logger.info('wellSolver', '[AutoSelect] Nadpisanie ' + topProd.id + ' konusem ' + konusFromCatalog.id);
            topProd = konusFromCatalog;
        }
    }

    if (!topProd && forcedZak) {
        topProd = studnieProducts.find(
            (p) => p.id === forcedZak && (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
    }
    if (!topProd) {
        topProd = studnieProducts.find(
            (p) => p.componentType === 'konus' && (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null)
        );
    }
    if (!topProd) return { error: 'Nie znaleziono domyślnego zakończenia studni.' };

    // --- Budowa konfiguracji zakończenia górnego ---
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
            effectiveDn, null, true, mag
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

        const parseHoleClearance = (val, fallback = 300) => {
            if (val === undefined || val === null || val === '') return fallback;
            const p = parseFloat(val);
            return isNaN(p) ? fallback : p;
        };

        return {
            z: center - prDN / 2,
            ruraDz: prDN,
            zdD: prod ? parseHoleClearance(prod.zapasDol, 300) : 0,
            zdDM: prod ? parseHoleClearance(prod.zapasDolMin, 150) : 0,
            zdG: prod ? parseHoleClearance(prod.zapasGora, 300) : 0,
            zdGM: prod ? parseHoleClearance(prod.zapasGoraMin, 150) : 0
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

    if (requiredMm < maxReqHMin) {
        const fn = typeof fmtInt === 'function' ? fmtInt : (v) => v;
        return { error: `Wymagana wysokość studni (${fn(requiredMm)}mm) jest za mała. Minimum dla przejść: ${fn(maxReqHMin)}mm, zalecane: ${fn(maxReqH)}mm. Zwiększ rzędną włazu o co najmniej ${fn(maxReqHMin - requiredMm)}mm.` };
    }

    // KROK 4: Listy kręgów i redukcja
    let dennicy = availProducts
        .filter((p) => {
            if (dn === 'styczna') {
                const isStyczna = (p.componentType === 'styczna' || p.category === 'Studnie styczne') &&
                    filterByWellParams(p, well);
                if (!isStyczna) return false;
                if (well.stycznaDn) return parseInt(p.dn) === parseInt(well.stycznaDn);
                return true;
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

    // Phase 5: Użyj pre-selected dennica jako minimum — solver nie próbuje niższych
    const minDenH = dennica ? (parseFloat(dennica.height) || 0) : 0;
    if (minDenH > 0) {
        dennicy = dennicy.filter(d => parseFloat(d.height || 0) >= minDenH);
        if (dennicy.length === 0) {
            return { error: 'Brak dennic spełniających wymagania wysokości.' };
        }
    }

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
        effectiveDn, mag
    );
    const kregi =
        kregiFromEngine.length > 0
            ? kregiFromEngine
            : availProducts
                  .filter(
                      (p) =>
                          p.componentType === 'krag' && parseInt(p.dn) === parseInt(effectiveDn) && !isDrilledRing(p)
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
    // Przygotuj przejścia w formacie backend (height_from_bottom_mm) do walidacji kolizji
    const transitionsForDP = (well.przejscia || []).map(p => {
        const pel = parseFloat(p.rzednaWlaczenia);
        return {
            id: p.productId,
            productId: p.productId,
            height_from_bottom_mm: isNaN(pel) ? 0 : Math.round((pel - (well.rzednaDna || 0)) * 1000)
        };
    }).filter(t => t.height_from_bottom_mm > 0);

    function fillKregiDP(target, kList, tolBelow, tolAbove, fixedBelowHeight = 0) {
        if (target <= 0) return { kItems: [], filled: 0 };

        logger.info('wellSolver', '[fillKregiDP] target=', target, 'kList.length=', kList.length, 'dn=', dn, 'mag=', mag);
        if (kList.length === 0) {
            logger.warn('wellSolver', '[fillKregiDP] Pusta lista kręgów! dn=', dn);
            return fillKregiGreedy(target, kList);
        }

        const dpResult = optimizeRingsForDistance(
            target, kList, tolBelow, tolAbove,
            transitionsForDP, availProducts, fixedBelowHeight
        );
        logger.info('wellSolver', '[fillKregiDP] dpResult.success=', dpResult.success, 'selectedRings=', dpResult.selectedRings?.length);
        
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
                const h = parseFloat(k.height);
                if (!h || h <= 0) continue;
                const qty = Math.floor(left / h);
                for (let i = 0; i < qty; i++) {
                    kItems.push({ productId: k.id, quantity: 1, _h: h });
                    filled += h;
                    left -= h;
                }
            }
        }
        return { kItems, filled };
    }

    /**
     * Szuka optymalnej kombinacji pierścieni AVR (backtracking).
     * Wydzialone z solve() — DRY (używane w 2 miejscach).
     * @returns {{ avrItems: Array, avrH: number }}
     */
    function findBestAvrFill(deficit, maxAvr) {
        let bestAvrCombo = [];
        let bestAvrDiff = deficit;
        let bestAvrH = 0;

        function backtrack(combo, sum, idx) {
            const d = Math.abs(deficit - sum);
            if (d < bestAvrDiff) {
                bestAvrDiff = d;
                bestAvrCombo = [...combo];
                bestAvrH = sum;
            } else if (d === bestAvrDiff && combo.length < bestAvrCombo.length) {
                bestAvrCombo = [...combo];
                bestAvrH = sum;
            }
            for (let i = idx; i < avrRings.length; i++) {
                if (sum + avrRings[i].height <= maxAvr) {
                    combo.push(avrRings[i]);
                    backtrack(combo, sum + avrRings[i].height, i);
                    combo.pop();
                }
            }
        }

        if (deficit >= 30) backtrack([], 0, 0); // min 30mm — spójne z generator.py:1043

        const cMap = {};
        for (const a of bestAvrCombo) cMap[a.id] = (cMap[a.id] || 0) + 1;
        const avrItems = [];
        for (const id in cMap) avrItems.push({ productId: id, quantity: cMap[id] });

        return { avrItems, avrH: bestAvrH };
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

            const SAFETY_MARGIN = 15; // mm — spójne z validator.py:85
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                const nextSeg = segs[i + 1];
                const jointInBody = hBot < s.end && s.end <= hTop;
                const hasOTAbove = nextSeg && nextSeg.type === 'krag_ot';

                // Joint na dole krag_ot + rura przechodzi przez to połączenie → OK (ring wiercony)
                if (hasOTAbove && jointInBody) {
                    // Pomijamy walidację — rura przechodzi przez krag_ot
                } else {
                    if (s.end >= (resBot - SAFETY_MARGIN) && s.end <= (resTop + SAFETY_MARGIN)) strictValid = false;
                    if (s.end >= (resBotMin - SAFETY_MARGIN) && s.end <= (resTopMin + SAFETY_MARGIN)) minValid = false;
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
                    // Środek rury powyżej spodu płyty = kolizja (spójne z validator.py:98)
                    const holeCenter = hBot + h.ruraDz / 2;
                    if (holeCenter >= s.start) {
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
                let denIsMin = dennicaItem.height < maxReqH;

                let effDenH = dennicaItem.height;
                if (well.psiaBuda) effDenH -= 100;

                const targetBody = requiredMm - topCfg.height - effDenH;
                if (targetBody < 0) continue;

                const { kItems, filled } = fillKregiDP(targetBody, kregi, tolBelow, tolAbove, dennicaItem.height);

                // Phase 3: Osadź OT warianty w layoutach zamiast późnej łatki
                const otLayout = buildCandidateLayouts(dennicaItem, kItems, well, availProducts);
                const otKItems = otLayout.rings;

                const deficit = requiredMm - (dennicaItem.height + topCfg.height + filled);
                if (deficit > maxAvr || deficit < -tolAbove) continue;

                const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr);
                const diff = effDenH + topCfg.height + filled + avrH - requiredMm;
                const isOutOfBounds = diff < -90 || diff > 20;

                const conf = checkConflicts(otKItems, dennicaItem.height, 0, topCfg.items);
                if (!conf.valid && !skipHolesValid) continue;

                const otCount = otKItems.filter(ki =>
                    ki.productId && String(ki.productId).endsWith('_OT')
                ).length;
                const scoreResult = scoreLayout({
                    ringCount: otKItems.length,
                    diff,
                    isOutOfBounds,
                    isMinimal: conf.isMinimal || denIsMin,
                    isFallbackClosure: topCfg.label.includes('zamiennik'),
                    isKonus: topCfg.prod && topCfg.prod.componentType === 'konus',
                    reductionForced: !!well.redukcjaDN1000,
                    hasReduction: false,
                    otCount,
                    preferenceWeights
                });
                let score = scoreResult.score;
                score += (parseFloat(dennicaItem.height) - minDenH) * 2000;

                if (score < bestScore) {
                    bestScore = score;
                    let runErrors = [...conf.errors];
                    if (isOutOfBounds)
                        runErrors.push(
                            `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                        );
                    best = {
                        topItems: [...topCfg.items],
                        kregItems: otKItems.map((ki) => ({
                            productId: ki.productId,
                            quantity: ki.quantity
                        })),
                        dennica: { productId: dennicaItem.id, quantity: 1 },
                        avrItems: avrItems,
                        totalHeight: effDenH + topCfg.height + filled + avrH,
                        diff: diff,
                        topLabel: topCfg.label,
                        errors: runErrors,
                        isMinimal: conf.isMinimal || denIsMin,
                        _scoreBreakdown: scoreResult.breakdown,
                        _scoreReason: scoreResult.reason
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
                : null;
            // Fallback: jeśli wymuszone nie znalezione lub auto — użyj getTopClosure
            const rZakFinal = rZak || getTopClosure(
                redTargetProducts.filter((p) => filterByWellParams(p, well)),
                targetDn, null, isWkladkaZwienczenie, mag
            );
            if (rZakFinal) {
                topRedItems.push({ productId: rZakFinal.id, quantity: 1 });
                topRedH += rZakFinal.height;

                // AUTOMATYCZNE PAROWANIE (Płyta + Pierścień)
                const isPlate = ['plyta_najazdowa', 'plyta_zamykajaca'].includes(rZakFinal.componentType);
                const isRing = rZakFinal.componentType === 'pierscien_odciazajacy';

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

            // --- Dodanie włazu do konfiguracji z redukcją ---
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
                    topRedItems.unshift(wlazItem);
                    topRedH += wlazProd.height * wlazItem.quantity;
                }
            }
            // ------------------------------------------------

            let maxHoleTop = 0;
            if (well.przejscia && well.przejscia.length > 0) {
                const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
                for (const pr of well.przejscia) {
                    let pel = parseFloat(pr.rzednaWlaczenia);
                    if (!isNaN(pel)) {
                        const holeBottom = (pel - rzDna) * 1000; // rzednaWlaczenia = dolna krawędź rury
                        const pprod = studnieProducts.find((x) => x.id === pr.productId);
                        if (pprod) {
                            let prDN =
                                typeof pprod.dn === 'string' && pprod.dn.includes('/')
                                    ? parseFloat(pprod.dn.split('/')[1]) || 160
                                    : parseFloat(pprod.dn) || 160;
                            // Wartości z cennika, domyślnie 300
                            const zapasGora = parseFloat(pprod.zapasGora || 0) ||
                                parseFloat(pprod.zapasGoraMin || 0) || 300;
                            const holeTop = holeBottom + prDN + zapasGora;
                            if (holeTop > maxHoleTop) maxHoleTop = holeTop;
                        }
                    }
                }
            }

            let minLowerTotal = Math.max(well.redukcjaMinH || 0, maxHoleTop);
            let dynamicMinBottom = minLowerTotal;
            let lift = 0;
            while (lift < 40) { // Zwiększono z 15 do 40, aby obsłużyć studnie do 12m+
                for (const dennicaItem of dennicy) {
                    let bottomNeed = Math.max(dynamicMinBottom - dennicaItem.height, 0);

                    // Wymuszamy tolBelow=0 dla dolnej części, aby zachować twardy limit minLowerTotal (redukcjaMinH)
                    const bKregi = fillKregiDP(bottomNeed, kregi, 0, tolAbove + 60, dennicaItem.height);
                    const bSec = dennicaItem.height + bKregi.filled;

                    const targetBodyNeed = requiredMm - bSec - reductionPlate.height - topRedH;
                    if (targetBodyNeed < 0) continue;

                    // Górna sekcja: fixedBelowHeight = dennica + kręgi dolne + płyta redukcyjna
                    const tTarget = fillKregiDP(targetBodyNeed, targetDnKregi, tolBelow, tolAbove, bSec + reductionPlate.height);
                    const currentTotal = bSec + reductionPlate.height + topRedH + tTarget.filled;

                    const deficit = requiredMm - currentTotal;
                    if (deficit > maxAvr || deficit < -tolAbove) continue;
                    const { avrItems, avrH } = findBestAvrFill(deficit, maxAvr);

                    const diff = currentTotal + avrH - requiredMm;
                    const isOutOfBounds = diff < -90 || diff > 20;

                    let redKItems = [];
                    bKregi.kItems.forEach((k) => redKItems.push(k));
                    redKItems.push({
                        productId: reductionPlate.id,
                        quantity: 1,
                        _h: reductionPlate.height
                    });
                    tTarget.kItems.forEach((k) => redKItems.push(k));

                    // Phase 3: Osadź OT warianty
                    const redOt = buildCandidateLayouts(dennicaItem, redKItems, well, availProducts);
                    const redOtItems = redOt.rings;

                    const conf = checkConflicts(redOtItems, dennicaItem.height, bSec, topRedItems);

                    if (!conf.valid && !skipHolesValid) {
                        if (conf.errors.some((e) => e.includes('redukcyjnej') || e.includes('konus'))) {
                            break;
                        }
                        continue;
                    }

                    const redOtCount = redOtItems.filter(ki =>
                        ki.productId && String(ki.productId).endsWith('_OT')
                    ).length;
                    const scoreResult = scoreLayout({
                        ringCount: bKregi.kItems.length + tTarget.kItems.length,
                        diff,
                        isOutOfBounds,
                        isMinimal: conf.isMinimal,
                        isFallbackClosure: false,
                        reductionForced: false,
                        hasReduction: true,
                        bottomSectionH: bSec,
                        minBottomTotal: minLowerTotal,
                        dn: parseInt(dn) || 1200,
                        otCount: redOtCount,
                        preferenceWeights
                    });
                    let score = scoreResult.score;
                    score += (parseFloat(dennicaItem.height) - minDenH) * 2000;

                    if (score < bestScore) {
                        bestScore = score;
                        let runErrors = [...conf.errors];
                        if (isOutOfBounds)
                            runErrors.push(
                                `Uwaga: Wymuszono tolerancję wysokości (odchyłka ${diff > 0 ? '+' : ''}${diff}mm)`
                            );
                        // Phase 3: Użyj OT-embedded ring items zamiast oryginalnych
                        const otStack = [...redOtItems].map(ki => ({
                            productId: ki.productId, quantity: ki.quantity
                        }));
                        // Rozdziel na top/bottom (płyta redukcyjna jest markerem)
                        const plateIdx = otStack.findIndex(ki => ki.productId === reductionPlate.id);
                        const otTop = plateIdx >= 0 ? otStack.slice(0, plateIdx).reverse() : [];
                        const otBottom = plateIdx >= 0 ? otStack.slice(plateIdx + 1).reverse() : [];
                        const otPlate = plateIdx >= 0 ? [otStack[plateIdx]] : [];

                        best = {
                            reductionUsed: true,
                            topItems: [...topRedItems],
                            kregItems: [...otTop, ...otPlate, ...otBottom],
                            dennica: { productId: dennicaItem.id, quantity: 1 },
                            avrItems: avrItems,
                            totalHeight: currentTotal + avrH,
                            diff: diff,
                            topLabel: `Redukcja DN${targetDn}`,
                            targetDn: targetDn,
                            errors: runErrors,
                            isMinimal: conf.isMinimal || dennicaItem.height < maxReqH,
                            _scoreBreakdown: scoreResult.breakdown,
                            _scoreReason: scoreResult.reason
                        };
                    }
                }
                dynamicMinBottom += 250;
                lift++;
            }
        }

        return best;
    }

    const STAGES = [
        { tolBelow: 60,  tolAbove: 20, maxAvr: 260, skip: false, name: 'Standard' },
        { tolBelow: 200, tolAbove: 20, maxAvr: 260, skip: false, name: 'Optymalny' },
        { tolBelow: 260, tolAbove: 20, maxAvr: 260, skip: false, name: 'Ratunkowy' },
        { tolBelow: 260, tolAbove: 500, maxAvr: 260, skip: false, name: 'Poszerzony (+500mm)' },
        { tolBelow: 260, tolAbove: 1000, maxAvr: 260, skip: false, name: 'Ekstremalny (+1000mm)' },
    ];

    let solution = null;
    let fallback = false;
    let fallbackReason = '';

    for (const stage of STAGES) {
        solution = solve(stage.tolBelow, stage.tolAbove, stage.maxAvr, stage.skip);
        if (solution) {
            logger.info('wellSolver', '[AutoSelect] Rozwiązanie znalezione w stage:', stage.name, 'items:', solution.kregItems?.length, 'dennica:', solution.dennica?.productId);
            if (stage.name !== 'Standard') {
                fallback = true;
                fallbackReason = `tryb ${stage.name}`;
            }
            if (stage.skip) {
                fallbackReason = 'kolizje przejść ominięte awaryjnie';
            }
            break;
        }
    }

    if (!solution) {
        return {
            error: `Nie znaleziono pasującej kombinacji elementów dla tej wysokości (max. ± dozwolona odchyłka, max ${well.magazyn || 'Kluczbork'} avr 26cm).`
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

    if (solution.errors && solution.errors.length > 0) {
        logger.warn('wellSolver', '[AutoSelect] Uwagi:', solution.errors.join('; '));
    }
    logger.info('wellSolver', '[AutoSelect] runJsAutoSelection zwraca config.length=', newConfig.length, 'pierwszy=', newConfig[0]?.productId);

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

                const parseClearance = (val, defVal) => {
                    if (val === undefined || val === null || val === '') return defVal;
                    const p = parseFloat(val);
                    return isNaN(p) ? defVal : p;
                };
                const zg_req = parseClearance(pprod.zapasGora, 300);
                const zd_req = parseClearance(pprod.zapasDol, 300);
                const zd_req_min = parseClearance(pprod.zapasDolMin, 150);
                const zg_req_min = parseClearance(pprod.zapasGoraMin, 150);
                const hc_invert = (pel - rzDna) * 1000;  // hole bottom
                const hole_center = hc_invert + dn_val / 2;  // Python: hole_center
                const hole_top = hc_invert + dn_val;  // Python: hole_top

                const typStr = pr.flowType === FLOW_TYPES.WYLOT ? FLOW_TYPES.WYLOT : FLOW_TYPES.DOLOT;
                const displayType = `nr ${porzadekIdx + 1} (${typStr} DN${dn_val}, rodzaj: ${pprod.name})`;

                // Python: używa hole_center do znalezienia segmentu, nie hole_bottom
                for (let segIdx = 0; segIdx < segments.length; segIdx++) {
                    const seg = segments[segIdx];
                    if (hole_center >= seg.start && hole_center < seg.end) {
                        const bottomClearance = hc_invert - seg.start;  // Python: bottom_clearance
                        const topClearance = seg.end - hole_top;  // Python: top_clearance

                        // Python: is_bottom_most = (idx == 0)
                        const isBottomMost = segIdx === 0;
                        // Python: is_pipe_near_bottom = is_bottom_most and bottom_clearance < z_dol
                        const isNearBottom = isBottomMost && bottomClearance < zd_req;
                        // Python: eff_z_dol = -9999.0 if is_pipe_near_bottom else z_dol
                        const effZdReq = isNearBottom ? -9999 : zd_req;
                        const effZdReqMin = isNearBottom ? -9999 : zd_req_min;

                        // Python: if bottom_clearance >= eff_z_dol and top_clearance >= z_gora → OK
                        const standardOk = bottomClearance >= effZdReq && topClearance >= zg_req;
                        // Python: elif bottom_clearance >= eff_z_dol_min and top_clearance >= z_gora_min → minimal
                        const minimalOk = !standardOk && bottomClearance >= effZdReqMin && topClearance >= zg_req_min;

                        if (!standardOk && !minimalOk) {
                            // Python: errors.append — ZA MAŁY ZAPAS
                            const errStr = `Błąd zapasu w "${seg.name}" dla przejścia ${displayType} (wymagane: dół≥${effZdReq}mm góra≥${zg_req}mm, aktualne: dół=${Math.round(bottomClearance)}mm góra=${Math.round(topClearance)}mm)`;
                            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                        } else if (minimalOk) {
                            // Python: used_minimal → append "zastosowano luzy minimalne"
                            const noteStr = `Przejście ${displayType} w "${seg.name}": zastosowano luzy minimalne (dół=${Math.round(bottomClearance)}mm, góra=${Math.round(topClearance)}mm)`;
                            if (!liveErrors.includes(noteStr)) liveErrors.push(noteStr);
                        }
                        break;
                    }
                }
            });
        }
    }
    well.configErrors = [...new Set(liveErrors)];
    well.configStatus =
        well.configErrors.length > 0 ? 'ERROR' : well.configSource ? 'OK' : well.configStatus || '';
}

/* ===== ALTERNATYWNE KONFIGURACJE (F2: multi-wariant) ===== */

/**
 * Pokazuje panel alternatywnych konfiguracji po auto-doborze.
 * @param {Object} well - obiekt studni
 * @param {Array} variants - lista wariantów z backendu
 * @param {number} wellIdx - indeks studni w tablicy wells
 */
function _showAlternatives(well, variants, wellIdx) {
    if (wellIdx === undefined || wellIdx < 0) {
        wellIdx = (typeof wells !== 'undefined' && Array.isArray(wells)) ? wells.indexOf(well) : -1;
    }
    if (!Array.isArray(variants) || variants.length <= 1) return;
    var container = document.getElementById('alternatives-panel');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alternatives-panel';
        container.className = 'alternatives-panel';
        var btnArea = document.querySelector('.auto-select-area, #btn-auto-select, [data-auto-select]');
        if (btnArea) {
            btnArea.parentNode.insertBefore(container, btnArea.nextSibling);
        } else {
            var cfgPanel = document.getElementById('well-config-panel') || document.getElementById('wizard-step-4') || document.querySelector('.well-config-section');
            if (cfgPanel) cfgPanel.appendChild(container);
            else document.body.appendChild(container);
        }
    }

    var html = '<div class="alternatives-header">';
    html += '<span class="alternatives-title"><i data-lucide="layers" aria-hidden="true"></i> Alternatywne konfiguracje</span>';
    html += '<span class="alternatives-count">' + variants.length + ' wariantów</span>';
    html += '<button class="alternatives-close" onclick="this.parentElement.parentElement.classList.remove(\'alternatives-open\')" title="Zwiń">&times;</button>';
    html += '</div>';
    html += '<div class="alternatives-list">';

    for (var i = 0; i < variants.length; i++) {
        var v = variants[i];
        if (!v || !v.items) continue;
        var score = v.score !== undefined && v.score !== null ? v.score.toFixed(1) : '?';
        var stage = v.stage || '?';
        var totalH = v.total_height_mm || 0;
        var itemCount = (v.items || []).length;
        var reasons = Array.isArray(v.score_reasons) ? v.score_reasons : [];
        var firstReason = reasons.length > 0 ? reasons[0] : '';

        var isActive = i === 0;
        html += '<div class="alternatives-item' + (isActive ? ' active' : '') + '" onclick="applyWellAlternative(' + wellIdx + ',' + i + ')" title="Kliknij aby zastosować">';
        html += '<span class="alt-index">#' + (i + 1) + '</span>';
        html += '<span class="alt-score">' + score + '</span>';
        html += '<span class="alt-info">' + stage + ' | ' + totalH + 'mm | ' + itemCount + ' el.</span>';
        if (firstReason) {
            html += '<span class="alt-reason" title="' + escapeHtml(firstReason) + '">' + escapeHtml(firstReason) + '</span>';
        }
        if (isActive) {
            html += '<span class="alt-badge">AKTYWNY</span>';
        }
        html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    container.classList.add('alternatives-open');

    if (window.lucide) window.lucide.createIcons({ root: container });
}

/**
 * Stosuje alternatywną konfigurację dla studni.
 * @param {number} wellIndex - indeks studni w tablicy wells
 * @param {number} variantIndex - indeks wariantu w well._backendVariants
 */
window.applyWellAlternative = function applyWellAlternative(wellIndex, variantIndex) {
    var well = typeof wells !== 'undefined' && Array.isArray(wells) ? wells[wellIndex] : null;
    if (!well || !well._backendVariants) return;

    var variant = well._backendVariants[variantIndex];
    if (!variant || !variant.items) return;

    var newConfig = buildConfigFromBackendResult(variant);
    if (!newConfig || newConfig.length === 0) return;

    well.config = newConfig;
    well.configSource = 'AUTO_AI';
    well.configStatus = 'OK';
    well.configErrors = variant.errors || [];

    try {
        sortWellConfigByOrder();
        if (typeof recalcGaskets === 'function') recalcGaskets(well);
        if (typeof syncKineta === 'function') syncKineta(well);
        renderWellConfig();
        renderWellDiagram();
        updateSummary();
        if (typeof refreshAll === 'function') refreshAll();
    } catch (e) {
        logger.error('wellSolver', 'Błąd przy zmianie wariantu:', e);
    }

    // Odśwież panel alternatyw — zaznacz aktywny
    _refreshAlternativesActive(well);
};

function _refreshAlternativesActive(well) {
    var items = document.querySelectorAll('#alternatives-panel .alternatives-item');
    if (!items.length) return;
    for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
        var badge = items[i].querySelector('.alt-badge');
        if (badge) badge.remove();
    }
    if (items[0]) items[0].classList.add('active');
    var firstBadge = items[0] ? items[0].querySelector('.alt-badge') : null;
    if (!firstBadge && items[0]) {
        var b = document.createElement('span');
        b.className = 'alt-badge';
        b.textContent = 'AKTYWNY';
        items[0].appendChild(b);
    }
}
