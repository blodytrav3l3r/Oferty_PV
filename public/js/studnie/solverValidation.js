// @ts-check
/**
 * solverValidation.js — Walidacja luzów przejść w konfiguracji studni
 *
 * Wyodrębnione z wellSolver.js:
 * - recalculateWellErrors() — sprawdza zapasy górne/dolne dla przejść rurowych
 *
 * Zależności globalne: studnieProducts, FLOW_TYPES
 */

/* ===== WALIDACJA LUZÓW PRZEJŚĆ ===== */
function recalculateWellErrors(well) {
    if (!well || well.configStatus === 'LOADING') return;

    // Wyczyść błędy dotyczące luzów z poprzedniego wywołania; przy pustym configu
    // kasuj też pozostałe błędy solvera (nieaktualne po clearWellConfig/doSelectDN).
    // Notki luzów ("zastosowano luzy minimalne") są regenerowane poniżej — stare
    // (np. po zamianie kręgu) nie mogą zostać w configErrors.
    const liveErrors =
        well.config && well.config.length > 0 && well.configErrors
            ? well.configErrors.filter(
                  (e) =>
                      !e.includes('Błąd zapasu') &&
                      !e.includes('nie spełnia zapasów') &&
                      !e.includes('zastosowano luzy minimalne') &&
                      !e.includes('Rzędna włączenia przejścia') &&
                      !e.includes('Rzędna dna') &&
                      !e.includes('brak dopłaty PEHD')
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
            let lastWasDennica = !!well.psiaBuda;
            const configReversed = [...well.config].reverse();
            for (const item of configReversed) {
                const p = studnieProducts.find((pr) => pr.id === item.productId);
                if (!p || !p.height) continue;
                const qty = item.quantity || 1;
                const isDennicaLike =
                    p.componentType === 'dennica' || p.componentType === 'styczna';
                for (let i = 0; i < qty; i++) {
                    let actualHeight = p.height || 0;
                    if (isDennicaLike && lastWasDennica) {
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
                        lastWasDennica = isDennicaLike;
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
        }
    }
    // --- WALIDACJA DOPŁATY PEHD (wkładka wybrana, ale brak dopłaty w cenniku) ---
    // Cichy brak dopłaty: jeśli parametr wkładki != 'brak', ale produkt nie ma dopłatyPEHD,
    // wycena nie dolicza nic — zgłoś ostrzeżenie WARNING (nie twardy błąd).
    if (typeof getPehdTypeForComponent === 'function' && well.config && well.config.length > 0) {
        for (const item of well.config) {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
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

    well.configErrors = [...new Set(liveErrors)];
    // Ustal status: twarde błędy → ERROR; same notki (tolerancja / luzy minimalne /
    // brak dopłaty PEHD) → WARNING
    const hasHardError = well.configErrors.some(
        (e) =>
            !e.includes('Zastosowana rozszerzona tolerancja') &&
            !e.includes('luzy minimalne') &&
            !e.includes('brak dopłaty PEHD')
    );
    well.configStatus = hasHardError
        ? 'ERROR'
        : well.configSource
          ? well.configErrors.length > 0
              ? 'WARNING'
              : 'OK'
          : well.configStatus || '';
}

/* ===== RENDER BANNERA BŁĘDÓW BIECĄCEJ STUDNI ===== */
function renderWellConfigErrors(well) {
    if (well) recalculateWellErrors(well);
    // Zlecenie Produkcyjne ma własny banner w populateZleceniaForm — odśwież go live
    // przed early return (errContainer może nie istnieć w niektórych widokach)
    if (typeof window.refreshZleceniaModalIfActive === 'function')
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
            const hasCategory = !!p.tempCategory && String(p.tempCategory).trim() !== '';
            const hasProduct = !!p.productId;
            const allEmpty = !hasCategory && !hasProduct && !hasRzedna && !hasAngle;
            if (allEmpty) return;
            if (hasCategory && !hasProduct) {
                errors.push(
                    `Studnia "${wellName}" przejście #${idx + 1}: wybrano rodzaj "${p.tempCategory}" bez średnicy — uzupełnij średnicę (DN)`
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
        <div class="modal-header"><h3 style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="alert-triangle" style="color:var(--warn);"></i> Brak danych przejścia</h3><button class="btn-icon" aria-label="Zamknij" onclick="closeModal('przejscia-validation-popup')"><i data-lucide="x"></i></button></div>
        <div style="font-size:var(--fs-sm); color:var(--text-secondary); margin-bottom:0.8rem;">Uzupełnij brakujące dane przed zapisem — fizycznie musi być wybrany rodzaj i średnica:</div>
        <ul style="margin:0 0 1rem 1.2rem; padding:0; font-size:var(--fs-sm);">${listHtml}</ul>
        <div class="modal-footer"><button class="btn btn-primary" onclick="closeModal('przejscia-validation-popup')">Rozumiem</button></div>
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
}
