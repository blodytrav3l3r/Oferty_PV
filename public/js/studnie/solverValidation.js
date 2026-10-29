// @ts-check
/**
 * solverValidation.js — Walidacja luzów przejść w konfiguracji studni
 *
 * Wyodrębnione z wellSolver.js:
 * - recalculateWellErrors() — sprawdza zapasy górne/dolne dla przejść rurowych
 *
 * Zależności globalne: studnieProducts, FLOW_TYPES
 */

/* ===== ZAPASY / DN PRZEJŚCIA — SSoT w transitionZones.js ===== */
/**
 * Zapasy przejścia (mm). Fallback tylko gdy transitionZones.js się nie załadował;
 * domyślne 300/150 mm żyją w stałych TRANSITION_* (jedno źródło prawdy).
 */
function _transitionReserves(pprod) {
    if (typeof getTransitionReserves === 'function') return getTransitionReserves(pprod);
    const std = typeof TRANSITION_RESERVE_STD_MM === 'number' ? TRANSITION_RESERVE_STD_MM : 300;
    const min = typeof TRANSITION_RESERVE_MIN_MM === 'number' ? TRANSITION_RESERVE_MIN_MM : 150;
    const pick = (val, fallback) => {
        if (val === undefined || val === null || val === '') return fallback;
        const n = parseFloat(val);
        return isNaN(n) ? fallback : n;
    };
    if (!pprod) return { dolStd: 0, goraStd: 0, dolMin: 0, goraMin: 0 };
    return {
        dolStd: pick(pprod.zapasDol, std),
        goraStd: pick(pprod.zapasGora, std),
        dolMin: pick(pprod.zapasDolMin, min),
        goraMin: pick(pprod.zapasGoraMin, min)
    };
}

/** DN przejścia (mm) — ten sam format cennika '160' / '110/160'. */
function _fallbackTransitionDn(pprod) {
    const legacy = typeof TRANSITION_LEGACY_DN_MM === 'number' ? TRANSITION_LEGACY_DN_MM : 160;
    if (!pprod || pprod.dn == null || pprod.dn === '') return legacy;
    if (typeof pprod.dn === 'string' && pprod.dn.indexOf('/') !== -1) {
        return parseFloat(pprod.dn.split('/')[1]) || legacy;
    }
    return parseFloat(pprod.dn) || legacy;
}

/**
 * Notka o wierceniu — parytet z wyceną (findDrillingProductForDn).
 * - brak jakiegokolwiek produktu Wiercenie → WARNING o cenie 0,
 * - brak dokładnego rozmiaru → notka o użytym najbliższym (cena z cennika).
 * null = dokładne trafienie, nie ma czego zgłaszać.
 */
function _drillingWarning(hostType, pprod, pr) {
    if (hostType !== 'krag' && hostType !== 'krag_ot') return null;
    if (pprod && pprod.name && String(pprod.name).toUpperCase().includes('INSITU')) return null;
    if (typeof findDrillingProductForDn !== 'function') return null;
    const trDn = parseInt(pr.dn) || parseInt(pprod && pprod.dn) || 0;
    if (!(trDn > 0)) return null;
    const picked = findDrillingProductForDn(trDn);
    if (!picked) {
        return `Brak produktu "Wiercenie" w cenniku — koszt wiercenia policzony jako 0 (przejście DN${trDn})`;
    }
    if (picked.exact) return null;
    return `Wiercenie DN${picked.dn} (najbliższy rozmiar) dla przejścia DN${trDn} — brak pozycji o DN ≥ ${trDn}`;
}

/**
 * Ostrzeżenia o cichej cenie 0 za wiercenie — parytet z wyceną.
 * Host ustalany tak samo jak w actionsWellPricing (buildConfigMap +
 * findAssignedElement po dolnej krawędzi otworu), więc ostrzeżenie pojawia się
 * dokładnie wtedy, gdy wycena dolicza 0. Nie zależy od rzędnej dna ani od
 * tego, czy otwór wpada w segment luzów.
 */
function validateDrillingPricesLive(well) {
    if (!well || !Array.isArray(well.config) || well.config.length === 0) return [];
    if (!Array.isArray(well.przejscia) || well.przejscia.length === 0) return [];
    if (typeof buildConfigMap !== 'function' || typeof findAssignedElement !== 'function')
        return [];
    const finder = (id) =>
        typeof getStudnieProductById === 'function'
            ? getStudnieProductById(id)
            : typeof studnieProducts !== 'undefined'
              ? studnieProducts.find((pr) => pr.id === id)
              : null;
    const configMap = buildConfigMap(well, finder, true);
    if (!configMap || configMap.length === 0) return [];
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const out = [];
    for (const pr of well.przejscia) {
        const p =
            typeof resolveStudnieProduct === 'function'
                ? resolveStudnieProduct(pr.productId)
                : null;
        if (!p) continue;
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const assigned = findAssignedElement((pel - rzDna) * 1000, configMap);
        const hostType = assigned && assigned.entry ? assigned.entry.componentType : null;
        const warn = _drillingWarning(hostType, p, pr);
        if (warn && !out.includes(warn)) out.push(warn);
    }
    return out;
}

/**
 * Komunikaty miękkie (notki): nie eskalują statusu do ERROR.
 * Jedno miejsce — status, czyszczenie notek i drop starych ostrzeżeń
 * muszą używać tej samej listy.
 */
const SOFT_WARNING_MARKERS = [
    'Zastosowana rozszerzona tolerancja',
    'Wymuszono tolerancję wysokości',
    'luzy minimalne',
    'brak dopłaty PEHD',
    'Brak produktu "Wiercenie"',
    'najbliższy rozmiar'
];

/* ===== LIVE WALIDACJA KOLIZJI GEOMETRYCZNYCH ===== */
// Read-only mirror geometrycznej części checkConflicts() z solverAutoSelect.js:
// ręczna edycja zmienia geometrię bez uruchamiania solvera, więc stare
// "Kolizja otworu..." musi być re-walidowane na aktualnych segmentach.
// Świadoma duplikacja (nie refaktor checkConflicts — closure solvera);
// oba mechanizmy korzystają ze wspólnego SSoT transitionZones.js
// (getTransitionDn/getTransitionBody/getTransitionZone/jointInZone).
// Nie mutuje config ani configSource. Brak kręgu wierconego (asortyment,
// diagramOtRings) celowo poza zakresem.
function validateCollisionsLive(well, segments) {
    if (!well || !segments || !well.przejscia || well.przejscia.length === 0) return [];
    const rzDnaRaw = well.rzednaDna != null ? well.rzednaDna : 0;
    const rzDna = parseFloat(rzDnaRaw);
    if (isNaN(rzDna)) return [];
    const out = [];
    const hasZoneFn = typeof getTransitionZone === 'function' && typeof jointInZone === 'function';
    for (const pr of well.przejscia) {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const pprod =
            typeof resolveStudnieProduct === 'function'
                ? resolveStudnieProduct(pr.productId)
                : null;
        let dnVal;
        let body;
        if (typeof getTransitionDn === 'function' && typeof getTransitionBody === 'function') {
            dnVal = getTransitionDn(pprod || null);
            body = getTransitionBody(pr.rzednaWlaczenia, well.rzednaDna, dnVal);
        } else {
            dnVal = _fallbackTransitionDn(pprod);
            const bottomMm = Math.round((pel - rzDna) * 1000);
            body = { bottomMm: bottomMm, topMm: bottomMm + dnVal };
        }
        if (!body) continue;
        const hBot = body.bottomMm;
        const hTop = body.topMm;
        // Jak w solverze: brak produktu → zapasy 0 (tylko margines strefy).
        const res = _transitionReserves(pprod);
        const zdD = res.dolStd;
        const zdDM = res.dolMin;
        const zdG = res.goraStd;
        const zdGM = res.goraMin;
        let zone;
        if (hasZoneFn) {
            zone = getTransitionZone(
                { bottomMm: hBot, topMm: hTop },
                {
                    dolStd: hBot === 0 ? 0 : zdD,
                    goraStd: zdG,
                    dolMin: hBot === 0 ? 0 : zdDM,
                    goraMin: zdGM
                }
            );
        } else {
            const m = 15;
            zone = {
                std: { bottomMm: hBot - (hBot === 0 ? 0 : zdD) - m, topMm: hTop + zdG + m },
                min: { bottomMm: hBot - (hBot === 0 ? 0 : zdDM) - m, topMm: hTop + zdGM + m }
            };
        }
        const inZone = (jointMm, z) =>
            hasZoneFn ? jointInZone(jointMm, z) : jointMm >= z.bottomMm && jointMm <= z.topMm;
        let strictValid = true;
        let minValid = true;
        for (const s of segments) {
            if (!s) continue;
            if (inZone(s.end, zone.std)) strictValid = false;
            if (inZone(s.end, zone.min)) minValid = false;
            const isForbidden =
                s.type === 'konus' ||
                s.type === 'plyta_din' ||
                s.type === 'plyta_redukcyjna' ||
                s.type === 'pierscien_odciazajacy';
            if (isForbidden && hTop > s.start && hBot < s.end) {
                strictValid = false;
                minValid = false;
                const errStr = `Kolizja otworu z elementem ${s.type}`;
                if (!out.includes(errStr)) out.push(errStr);
            }
            if (s.type === 'plyta_redukcyjna') {
                const holeCenter = hBot + dnVal / 2;
                if (holeCenter >= s.start) {
                    strictValid = false;
                    minValid = false;
                    const errStr = 'Przejście nie może być powyżej płyty redukcyjnej';
                    if (!out.includes(errStr)) out.push(errStr);
                }
            }
        }
        if (!strictValid && !minValid) {
            const errStr = `Kolizja otworu Z=${hBot} ze złączami (strefa minimalna)`;
            if (!out.includes(errStr)) out.push(errStr);
        }
    }
    return out;
}

/* ===== WALIDACJA LUZÓW PRZEJŚĆ ===== */
// Notki jednorazowe solvera (runJsAutoSelection): opisuja konkretny przebieg,
// nie biezacy stan. Po recznej edycji configu robia sie stale (np. stara
// odchyłka +27mm), wiec recalculate je odrzuca — ALE tylko gdy config rozni
// sie od zapieczetowanego przy solverze (well._solverErrorsGen). Bez pieczatki
// (stare dane/import) zachowanie legacy: preserve. Brak kregu wierconego to
// blad asortymentu wlasciciela — celowo poza lista, zawsze zachowywany.
function wellConfigFingerprint(config) {
    if (!Array.isArray(config)) return '';
    return config
        .map((it) => (it && it.productId ? it.productId : '?') + 'x' + (it.quantity || 1))
        .join('|');
}
const SOLVER_NOTE_MARKERS = [
    'Wymuszono tolerancję wysokości',
    'Zastosowana rozszerzona tolerancja',
    'Nie znaleziono pasującej kombinacji'
];
// Backfill pieczatki przy wczytaniu oferty (stare dane z bazy nie maja
// _solverErrorsGen — bez tego kazda edycja zachowywalaby notki w trybie
// preserve). Stempluje BIEZACY config: notka zyje do pierwszej recznej
// edycji, potem live-walidacja decyduje. Global classic-scope (bez window.*).
// Wywoluje offerManager/orderCrud (guard typeof) — stad warning unused.
// eslint-disable-next-line no-unused-vars
function backfillSolverStamps(wellsArr) {
    if (!Array.isArray(wellsArr)) return 0;
    let n = 0;
    for (const w of wellsArr) {
        if (!w || w._solverErrorsGen != null) continue;
        const errs = w.configErrors;
        if (
            !Array.isArray(errs) ||
            !errs.some((e) => SOLVER_NOTE_MARKERS.some((m) => String(e).includes(m)))
        )
            continue;
        try {
            w._solverErrorsGen = wellConfigFingerprint(w.config);
            n++;
        } catch (_e) {}
    }
    return n;
}
function recalculateWellErrors(well) {
    if (!well || well.configStatus === 'LOADING') return;

    // Wyczyść błędy dotyczące luzów i kolizji geometrycznych z poprzedniego
    // wywołania; przy pustym configu kasuj też pozostałe błędy solvera
    // (nieaktualne po clearWellConfig/doSelectDN).
    // Notki luzów ("zastosowano luzy minimalne") są regenerowane poniżej — stare
    // (np. po zamianie kręgu) nie mogą zostać w configErrors.
    // Błędy geometryczne ("Kolizja otworu", "powyżej płyty redukcyjnej") są
    // re-walidowane live przez validateCollisionsLive() — stare (np. po ręcznym
    // przesunięciu przejścia poza joint) nie mogą zostać w configErrors.
    // "Brak kręgu wierconego" to błąd asortymentu (diagramOtRings), nie geometrii —
    // celowo zachowywany, produkuje go właściciel.
    const liveErrors =
        well.config && well.config.length > 0 && well.configErrors
            ? well.configErrors.filter(
                  (e) =>
                      !e.includes('Błąd zapasu') &&
                      !e.includes('nie spełnia zapasów') &&
                      !e.includes('zastosowano luzy minimalne') &&
                      !e.includes('Rzędna włączenia przejścia') &&
                      !e.includes('Rzędna dna') &&
                      !e.includes('brak dopłaty PEHD') &&
                      !e.includes('Brak produktu "Wiercenie"') &&
                      !e.includes('najbliższy rozmiar') &&
                      !e.includes('Kolizja otworu') &&
                      !e.includes('powyżej płyty redukcyjnej')
              )
            : [];

    // --- WALIDACJA RZĘDNEJ DNA vs RZĘDNEJ WŁAZU ---
    // Rzędna dna nie może być większa lub równa rzędnej włazu (właz jest wyżej).
    if (well.rzednaWlazu != null && well.rzednaDna != null) {
        const rzWlazu = parseFloat(well.rzednaWlazu);
        const rzDna = parseFloat(well.rzednaDna);
        if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzDna >= rzWlazu) {
            const errStr = `Rzędna dna (${rzDna.toFixed(3)} m) nie może być większa lub równa rzędnej włazu (${rzWlazu.toFixed(3)} m)`;
            if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
        }
    }

    // --- WALIDACJA RZĘDNEJ WŁĄCZENIA PRZEJŚCIA ---
    // Rzędna włączenia przejścia nie może być niższa niż rzędna dna studni.
    if (well.przejscia && well.przejscia.length > 0) {
        const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
        if (rzDna !== null && !isNaN(rzDna)) {
            well.przejscia.forEach((pr, idx) => {
                const pel = parseFloat(pr.rzednaWlaczenia);
                if (isNaN(pel)) return;
                if (pel < rzDna) {
                    const errStr = `Rzędna włączenia przejścia nr ${idx + 1} (${pel.toFixed(
                        3
                    )} m) jest niższa niż rzędna dna studni (${rzDna.toFixed(3)} m)`;
                    if (!liveErrors.includes(errStr)) liveErrors.push(errStr);
                }
            });
        }
    }

    // --- WALIDACJA LUZÓW NA ŻYWO ---
    if (well.przejscia && well.przejscia.length > 0 && well.config && well.config.length > 0) {
        const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : null;
        if (rzDna !== null && !isNaN(rzDna)) {
            const segments = [];
            let cy = 0;
            let belowType = null;
            let psiaSeed = !!well.psiaBuda;
            const configReversed = [...well.config].reverse();
            for (const item of configReversed) {
                const p = resolveStudnieProduct(item.productId);
                if (!p || !p.height) continue;
                const qty = item.quantity || 1;
                const isDennicaLike = isDennicaLikeProduct(p);
                for (let i = 0; i < qty; i++) {
                    let actualHeight = p.height || 0;
                    if (isDennicaLike) {
                        actualHeight -= dennicaHeightPenalty(p, psiaSeed ? 'dennica' : belowType);
                        psiaSeed = false;
                        belowType = p.componentType;
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
                        belowType = p.componentType;
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

                const pprod = resolveStudnieProduct(pr.productId);
                if (!pprod) return;

                const dn_val =
                    typeof getTransitionDn === 'function'
                        ? getTransitionDn(pprod)
                        : _fallbackTransitionDn(pprod);

                const res = _transitionReserves(pprod);
                const zg_req = res.goraStd;
                const zd_req = res.dolStd;
                const zd_req_min = res.dolMin;
                const zg_req_min = res.goraMin;
                const hc_invert = (pel - rzDna) * 1000; // hole bottom
                const hole_center = hc_invert + dn_val / 2; // Python: hole_center
                const hole_top = hc_invert + dn_val; // Python: hole_top

                const typStr =
                    pr.flowType === FLOW_TYPES.WYLOT ? FLOW_TYPES.WYLOT : FLOW_TYPES.DOLOT;
                const displayType = `nr ${porzadekIdx + 1} (${typStr} DN${dn_val}, rodzaj: ${pprod.name})`;

                // Python: używa hole_center do znalezienia segmentu, nie hole_bottom
                for (let segIdx = 0; segIdx < segments.length; segIdx++) {
                    const seg = segments[segIdx];
                    if (hole_center >= seg.start && hole_center < seg.end) {
                        const bottomClearance = hc_invert - seg.start; // Python: bottom_clearance
                        const topClearance = seg.end - hole_top; // Python: top_clearance

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
                        const minimalOk =
                            !standardOk &&
                            bottomClearance >= effZdReqMin &&
                            topClearance >= zg_req_min;

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
            // --- LIVE KOLIZJE GEOMETRYCZNE (reuse segmentów, bez solvera) ---
            const liveCollisions = validateCollisionsLive(well, segments);
            for (const e of liveCollisions) if (!liveErrors.includes(e)) liveErrors.push(e);
        }
    }
    // --- WALIDACJA DOPŁATY PEHD (wkładka wybrana, ale brak dopłaty w cenniku) ---
    // Cichy brak dopłaty: jeśli parametr wkładki != 'brak', ale produkt nie ma dopłatyPEHD,
    // wycena nie dolicza nic — zgłoś ostrzeżenie WARNING (nie twardy błąd).
    // Drop starych notek solvera: config recznie zmieniony po solverze uniewaznia
    // jego jednorazowe komunikaty (stala odchyłka). Bez pieczatki: preserve.
    if (typeof getPehdTypeForComponent === 'function' && well.config && well.config.length > 0) {
        for (const item of well.config) {
            const p = resolveStudnieProduct(item.productId);
            if (!p) continue;
            const pehdType = getPehdTypeForComponent(well, p.componentType);
            const pehdVal = parseFloat(String(p.doplataPEHD || '').replace(',', '.'));
            if (
                pehdType &&
                pehdType !== 'brak' &&
                !item.disablePehd &&
                (Number.isNaN(pehdVal) || pehdVal <= 0)
            ) {
                const warnStr = `Wkładka PEHD (${pehdType}) wybrana dla "${p.name}", ale brak dopłaty PEHD w cenniku (doplataPEHD = 0)`;
                if (!liveErrors.includes(warnStr)) liveErrors.push(warnStr);
            }
        }
    }

    // --- OSTRZEŻENIA WIERCENIA (cicha cena 0) ---
    // Poza blokiem luzów: łapie też studnie bez rzędnej dna i przejścia poza
    // segmentami (host przez findAssignedElement, jak w wycenie).
    for (const e of validateDrillingPricesLive(well)) {
        if (!liveErrors.includes(e)) liveErrors.push(e);
    }

    well.configErrors = [...new Set(liveErrors)];
    // Drop starych notek solvera: config rozni sie od zapieczetowanego przy
    // solverze, wiec jednorazowe komunikaty (stala odchyłka) sa nieaktualne.
    // Nastepny przebieg solvera dopisze swieze. Bez pieczatki: preserve.
    if (
        well._solverErrorsGen != null &&
        wellConfigFingerprint(well.config) !== well._solverErrorsGen
    ) {
        well.configErrors = well.configErrors.filter(
            (e) => !SOLVER_NOTE_MARKERS.some((m) => e.includes(m))
        );
    }
    // Ustal status: twarde błędy → ERROR; same notki (tolerancja / luzy minimalne /
    // brak dopłaty PEHD / brak produktu Wiercenie) → WARNING.
    // SSoT listy: SOFT_WARNING_MARKERS (jedno miejsce dla statusu i czyszczenia).
    const hasHardError = well.configErrors.some(
        (e) => !SOFT_WARNING_MARKERS.some((m) => e.includes(m))
    );
    well.configStatus = hasHardError
        ? 'ERROR'
        : well.configSource
          ? well.configErrors.length > 0
              ? 'WARNING'
              : 'OK'
          : well.configStatus || '';
}

/* ===== CLAMP RZĘDNEJ WŁĄCZENIA DO ZAKRESU DNO–WŁAZ ===== */
// Czyste funkcje (bez toastów — komunikat pokazuje wołający, z guardem quiet-mode
// w Excelu). SSoT clampowania dla: saveQuickEdit, inlineFinish (konfigurator),
// excelOnPrzejscieChange (Excel). null/NaN/brak rzędnych przechodzą bez zmian.
function clampRzednaWlaczenia(numVal, well) {
    if (numVal === null || numVal === undefined || isNaN(numVal))
        return { value: numVal, clampedLow: false, clampedHigh: false };
    let value = numVal;
    let clampedLow = false;
    let clampedHigh = false;
    if (well) {
        const rzDna = parseFloat(well.rzednaDna);
        const rzWlazu = parseFloat(well.rzednaWlazu);
        if (!isNaN(rzDna) && value < rzDna) {
            value = rzDna;
            clampedLow = true;
        }
        if (!isNaN(rzWlazu) && value > rzWlazu) {
            value = rzWlazu;
            clampedHigh = true;
        }
    }
    return { value: value, clampedLow: clampedLow, clampedHigh: clampedHigh };
}

/* Format rzędnej do komunikatów: 1,200 (polski przecinek, jak heightIndicator). */
function formatRzednaShort(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    return n.toFixed(3).replace('.', ',');
}

/* Lista przejść poniżej dna: ['nr 2 (1,200 m < dno 1,500 m)'] lub [].
   Używają: excelOnRzednaChange, updateElevations — jeden toast ze wszystkimi. */
function listPrzejsciaBelowDna(well) {
    if (!well || !well.przejscia || well.przejscia.length === 0) return [];
    const rzDna = well.rzednaDna != null ? parseFloat(well.rzednaDna) : NaN;
    if (isNaN(rzDna)) return [];
    const out = [];
    well.przejscia.forEach((pr, idx) => {
        const pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel) || pel >= rzDna) return;
        out.push(
            'nr ' +
                (idx + 1) +
                ' (' +
                formatRzednaShort(pel) +
                ' m < dno ' +
                formatRzednaShort(rzDna) +
                ' m)'
        );
    });
    return out;
}
/* ===== CENTRALNY MODAL CLAMPA RZĘDNEJ ===== */
// Dodatkowy (obok toastu) komunikat na środku ekranu, gdy wpisana rzędna
// ląduje poza zakresem dno–właz i zostaje automatycznie poprawiona.
// Stałe id: szybkie clampy pod rząd podmieniają modal zamiast stosu okien.
// Auto-close po 2 s (guard generacji: starszy timer nie zamyka nowszego modala).
const RZEDNA_CLAMP_AUTOCLOSE_MS = 2000;
let _rzednaClampGen = 0;
function showRzednaClampPopup(msg, correctedVal) {
    const safeMsg = typeof escapeHtml === 'function' ? escapeHtml(String(msg)) : String(msg);
    const safeVal =
        typeof escapeHtml === 'function'
            ? escapeHtml(formatRzednaShort(correctedVal) + ' m')
            : formatRzednaShort(correctedVal) + ' m';
    if (typeof window === 'undefined' || typeof window.showModal !== 'function') {
        if (typeof showToast === 'function') showToast(String(msg), 'error');
        return;
    }
    const gen = ++_rzednaClampGen;
    const html = `<div class="modal" style="max-width:560px; width:92vw; max-height:85vh; overflow-y:auto;">
        <div class="modal-header"><h3 style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="alert-triangle" class="icon-sm" style="color:var(--warn);" aria-hidden="true"></i> Nieprawidłowa rzędna</h3><button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;rzedna-clamp-popup&quot;]"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button></div>
        <div style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:0.8rem;">${safeMsg}<br>Wartość poprawiono do <strong>${safeVal}</strong>.<br><span style="font-size:var(--fs-xs); color:var(--text-muted);">Okno zamknie się automatycznie.</span></div>
        <div class="modal-footer"><button class="btn btn-primary" data-csp="closeModal" data-csp-args="[&quot;rzedna-clamp-popup&quot;]">Rozumiem</button></div>
    </div>`;
    window.showModal({
        id: 'rzedna-clamp-popup',
        title: 'Nieprawidłowa rzędna',
        html: html
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons)
        lucide.createIcons({ root: document.getElementById('rzedna-clamp-popup') });
    setTimeout(() => {
        if (gen !== _rzednaClampGen) return;
        if (
            typeof document !== 'undefined' &&
            document.getElementById('rzedna-clamp-popup') &&
            typeof closeModal === 'function'
        )
            closeModal('rzedna-clamp-popup');
    }, RZEDNA_CLAMP_AUTOCLOSE_MS);
}

/* Podwójna notyfikacja clampu: toast + centralny modal (równocześnie).
   Wołają 3 miejsca clampujące (saveQuickEdit, inlineFinish, excelOnPrzejscieChange
   poza quiet). Zwraca msg lub null, gdy brak clampowania. */
function announceRzednaClamp(c) {
    if (!c || (!c.clampedLow && !c.clampedHigh)) return null;
    const msg = c.clampedLow
        ? 'Rzędna nie może być niższa niż rzędna dna!'
        : 'Rzędna nie może być wyższa niż rzędna włazu!';
    if (typeof showToast === 'function') showToast(msg, 'error');
    if (typeof showRzednaClampPopup === 'function') showRzednaClampPopup(msg, c.value);
    return msg;
}

/* ===== RENDER BANNERA BŁĘDÓW BIECĄCEJ STUDNI ===== */
function renderWellConfigErrors(well) {
    if (well) recalculateWellErrors(well);
    // Zlecenie Produkcyjne ma własny banner w populateZleceniaForm — odśwież go live
    // przed early return (errContainer może nie istnieć w niektórych widokach).
    // PZ 1-klik: przy fokusie w polu quick-edit pomiń refresh modala —
    // populateZleceniaForm (pełny innerHTML) zniszczyłby edytowany input
    // (E2E: focusout po deferred heavy-refresh). Banner PZ synchronizuje się
    // przy wyjściu z edycji pełnym refreshem.
    let _qeFocused = false;
    try {
        const _ae = typeof document !== 'undefined' ? document.activeElement : null;
        _qeFocused = !!(
            _ae &&
            _ae.tagName === 'INPUT' &&
            _ae.closest &&
            _ae.closest('[data-qe-id]')
        );
    } catch (_e) {}
    if (!_qeFocused && typeof window.refreshZleceniaModalIfActive === 'function')
        window.refreshZleceniaModalIfActive();
    const errContainer = document.getElementById('well-config-errors-container');
    if (!errContainer) return;
    const liveErrors = (well && well.configErrors) || [];
    if (liveErrors.length > 0) {
        errContainer.innerHTML =
            '<i data-lucide="alert-triangle"></i> Błędy w konfiguracji studni:<br>' +
            liveErrors.map((e) => `• ${escapeHtml(e)}`).join('<br>');
        errContainer.style.display = 'block';
        if (window.lucide) window.lucide.createIcons({ root: errContainer });
    } else {
        errContainer.style.display = 'none';
    }
}

/* ===== WALIDACJA PRZEJŚĆ DLA ZAPISU ===== */
function validatePrzejsciaForSave(wellsArr) {
    const list = Array.isArray(wellsArr) ? wellsArr : typeof wells !== 'undefined' ? wells : [];
    const errors = [];
    list.forEach((well) => {
        const wellName = well.name || well.numer || 'Studnia';
        if (!well.przejscia || well.przejscia.length === 0) return;
        well.przejscia.forEach((p, idx) => {
            const hasRzedna = p.rzednaWlaczenia != null && String(p.rzednaWlaczenia).trim() !== '';
            const hasAngle =
                p.angle != null && String(p.angle).trim() !== '' && parseFloat(p.angle) !== 0;
            const prod =
                p.productId && typeof studnieProducts !== 'undefined'
                    ? studnieProducts.find(function (x) {
                          return x.id === p.productId;
                      })
                    : null;
            const effCategory =
                p.tempCategory && String(p.tempCategory).trim() !== ''
                    ? String(p.tempCategory).trim()
                    : prod && prod.category
                      ? String(prod.category).trim()
                      : '';
            const hasCategory = effCategory !== '';
            const hasProduct = !!p.productId;
            const _isEmpty =
                typeof isEmptyPrzejscie === 'function'
                    ? isEmptyPrzejscie(p)
                    : !hasCategory && !hasProduct && !hasRzedna && !hasAngle;
            if (_isEmpty) return;
            // Twardy gate zapisu: rzędna poniżej dna blokuje zapis (dane legacy/import
            // wcześniej zapisywały się mimo ERROR z recalculateWellErrors).
            const _pel = parseFloat(p.rzednaWlaczenia);
            const _rzDna =
                well.rzednaDna != null && well.rzednaDna !== '' ? parseFloat(well.rzednaDna) : NaN;
            if (!isNaN(_pel) && !isNaN(_rzDna) && _pel < _rzDna) {
                errors.push(
                    `Studnia "${wellName}" przejście #${idx + 1}: rzędna włączenia (${formatRzednaShort(_pel)} m) poniżej rzędnej dna (${formatRzednaShort(_rzDna)} m) — popraw rzędną`
                );
            }
            if (hasCategory && !hasProduct) {
                errors.push(
                    `Studnia "${wellName}" przejście #${idx + 1}: wybrano rodzaj "${effCategory}" bez średnicy — uzupełnij średnicę (DN)`
                );
            } else if (!hasCategory && hasProduct) {
                errors.push(
                    `Studnia "${wellName}" przejście #${idx + 1}: wybrano średnicę bez rodzaju — uzupełnij rodzaj`
                );
            } else if (!hasCategory && !hasProduct && (hasRzedna || hasAngle)) {
                errors.push(
                    `Studnia "${wellName}" przejście #${idx + 1}: podano rzędną/kąt bez rodzaju i średnicy — uzupełnij rodzaj i średnicę`
                );
            }
        });
    });
    return { valid: errors.length === 0, errors };
}

/* ===== POPUP WALIDACJI PRZEJŚĆ ===== */
function showPrzejsciaValidationPopup(errors) {
    if (!errors || errors.length === 0) return;
    const listHtml = errors
        .map(
            (e) => `<li style="margin:0.35rem 0; color:var(--text-primary);">${escapeHtml(e)}</li>`
        )
        .join('');
    const html = `<div class="modal" style="max-width:560px; width:92vw; max-height:85vh; overflow-y:auto;">
        <div class="modal-header"><h3 style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="alert-triangle" class="icon-sm" style="color:var(--warn);" aria-hidden="true"></i> Brak danych przejścia</h3><button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;przejscia-validation-popup&quot;]"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button></div>
        <div style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:0.8rem;">Uzupełnij brakujące dane przed zapisem — fizycznie musi być wybrany rodzaj i średnica:</div>
        <ul style="margin:0 0 1rem 1.2rem; padding:0; font-size:var(--fs-sm);">${listHtml}</ul>
        <div class="modal-footer"><button class="btn btn-primary" data-csp="closeModal" data-csp-args="[&quot;przejscia-validation-popup&quot;]">Rozumiem</button></div>
    </div>`;
    if (typeof window.showModal === 'function') {
        window.showModal({
            id: 'przejscia-validation-popup',
            title: 'Brak danych przejścia',
            html: html
        });
        if (typeof lucide !== 'undefined' && lucide.createIcons)
            lucide.createIcons({ root: document.getElementById('przejscia-validation-popup') });
    } else if (typeof showToast === 'function') {
        showToast(errors[0], 'error');
    }
}

/* ===== ODŚWIEŻENIE BŁĘDÓW WSZYSTKICH STUDNI ===== */
function refreshAllWellErrors() {
    if (typeof wells === 'undefined' || !Array.isArray(wells)) return;
    wells.forEach((w) => recalculateWellErrors(w));
    // Jedyny wspólny punkt renderu bannera — każda ścieżka (lista, oferta, Excel,
    // tryb zamówienia) kończąca się na refreshAllWellErrors odświeża też banner.
    if (typeof getCurrentWell === 'function') renderWellConfigErrors(getCurrentWell());
}

/* ===== Rejestracja globali ===== */
if (typeof window !== 'undefined') {
    window.refreshAllWellErrors = refreshAllWellErrors;
    window.validatePrzejsciaForSave = validatePrzejsciaForSave;
    window.showPrzejsciaValidationPopup = showPrzejsciaValidationPopup;
    window.clampRzednaWlaczenia = clampRzednaWlaczenia;
    window.listPrzejsciaBelowDna = listPrzejsciaBelowDna;
    window.showRzednaClampPopup = showRzednaClampPopup;
    window.announceRzednaClamp = announceRzednaClamp;
}
