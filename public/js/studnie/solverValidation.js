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
    well.configErrors = [...new Set(liveErrors)];
    well.configStatus =
        well.configErrors.length > 0 ? 'ERROR' : well.configSource ? 'OK' : well.configStatus || '';
}
