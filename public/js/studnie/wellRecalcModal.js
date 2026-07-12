// @ts-check
/* ===== wellRecalcModal.js — konus PEHD resolver + global recalc modal + redukcja choice ===== */

/* ===== KONUS PEHD RESOLVER ===== */
window.showKonusPehdResolverModal = function (wellIndex, callback) {
    const well = wells[wellIndex];
    if (!well) return;

    const oldOverlay = document.getElementById('pehd-konus-resolver');
    if (oldOverlay) oldOverlay.remove();

    const html = `
    <div style="background:var(--bg-secondary, #1e293b); padding:2.2rem; border-radius:16px; max-width:600px; width:100%; border:1px solid rgba(248,113,113,0.25); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <h3 id="pehd-konus-title" style="margin-top:0; color:#f87171; display:flex; align-items:center; gap:0.6rem; font-family:Inter,sans-serif; font-size:1.25rem; font-weight:700;">
            <i data-lucide="alert-circle" style="width:24px;height:24px;" aria-hidden="true"></i> Niezgodność technologiczna: Konus + PEHD
        </h3>
        <p style="color:#94a3b8; font-size:0.95rem; margin-bottom:1.8rem; line-height:1.6; font-family:Inter,sans-serif;">
            <b>Konus</b> nie może być zakończeniem studni, jeśli zastosowano w nim wkładkę <b>PEHD</b>.<br>
            Wybierz alternatywne zakończenie dla studni <strong class="text-primary">${well.name || 'Bieżąca studnia'}</strong>:
        </p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
            <div data-action="resolveKonusPehd" data-well-index="${wellIndex}" data-type="plyta_din" class="pehd-card" style="padding:1.5rem; text-align:center; font-family:Inter,sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:120px;">
                <div style="font-weight:700; color:#e2e8f0; margin-bottom:0.4rem; font-size:1.15rem;">Płyta DIN</div>
                <div style="font-size:0.8rem; color:#64748b; line-height:1.4;">Standardowa płyta nastudzienna.</div>
            </div>
            
            <div data-action="resolveKonusPehd" data-well-index="${wellIndex}" data-type="pierscien_odciazajacy" class="pehd-card" style="padding:1.5rem; text-align:center; font-family:Inter,sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:120px;">
                <div style="font-weight:700; color:#e2e8f0; margin-bottom:0.4rem; font-size:1.15rem;">Płyta + Pierścień</div>
                <div style="font-size:0.8rem; color:#64748b; line-height:1.4;">Płyta zamykająca i pierścień odciążający.</div>
            </div>
        </div>
        
        <div style="margin-top:1.8rem; text-align:right;">
            <button data-action="resolveKonusPehdCancel" class="pehd-btn-cancel" style="font-family:Inter,sans-serif; font-size:0.9rem;">Zostaw domyślne (Płyta DIN)</button>
        </div>
    </div>
    `;
    const overlay = showModal({
        id: 'pehd-konus-resolver',
        titleId: 'pehd-konus-title',
        html: html
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });
    window.konusResolverCallback = callback;
};

window.resolveKonusPehd = async function (wellIndex, type) {
    const well = wells[wellIndex];
    if (!well) return;

    let dn = well.dn === 'styczna' ? 1000 : well.dn;
    if (well.redukcjaDN1000) dn = well.redukcjaTargetDN || 1000;

    const mag = well.magazyn === 'Włocławek' ? 'WL' : 'KLB';
    const avail = studnieProducts.filter(
        (p) =>
            p.dn === dn &&
            p.componentType === type &&
            ((mag === 'WL' && p.magazynWL === 1) || (mag !== 'WL' && p.magazynKLB === 1))
    );

    if (avail.length > 0) {
        if (well.redukcjaDN1000) {
            well.redukcjaZakonczenie = avail[0].id;
        } else {
            well.zakonczenie = avail[0].id;
        }

        document.getElementById('pehd-konus-resolver').remove();

        if (currentWizardStep === 3) {
            await autoSelectComponents(true);
            refreshAll();
        }

        if (window.konusResolverCallback) window.konusResolverCallback();
    } else {
        showToast('Brak elementu dla wybranego typu w cenniku (DN' + dn + ').', 'error');
    }
};

/* ===== GLOBAL RECALCULATOR ===== */
window.openGlobalRecalcModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }
    const uniqueDns = [...new Set(wells.map((w) => w.dn))].sort((a, b) => a - b);
    const groupsHtml = uniqueDns
        .map((dn) => {
            const exampleMag = wells[0]?.magazyn || 'Kluczbork';
            const availForDn = studnieProducts.filter(
                (p) =>
                    p.dn === dn &&
                    ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                        (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
            );
            const topClosureTypes = [
                'konus',
                'plyta_din',
                'plyta_najazdowa',
                'plyta_zamykajaca',
                'pierscien_odciazajacy'
            ];
            const candidates = availForDn.filter((p) => topClosureTypes.includes(p.componentType));
            const canReduce = [1200, 1500, 2000, 2500].includes(dn);

            let topTiles = candidates
                .map(
                    (p) => `
            <div class="fs-dn-tile" id="recalc-top-${dn}-${p.id}" data-action="recalcSelectTop" data-dn="${dn}" data-id="${p.id}"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
            </div>`
                )
                .join('');

            topTiles =
                `
            <div class="fs-dn-tile active" id="recalc-top-${dn}-auto" data-action="recalcSelectTop" data-dn="${dn}" data-id="auto"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);">
                <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Domyślny)</div>
            </div>` + topTiles;

            let reductionHtml = '';
            if (canReduce) {
                const dn1000Cand = studnieProducts.filter(
                    (p) =>
                        p.dn === 1000 &&
                        topClosureTypes.includes(p.componentType) &&
                        ((exampleMag === 'Włocławek' && p.magazynWL === 1) ||
                            (exampleMag !== 'Włocławek' && p.magazynKLB === 1))
                );
                let redTiles = dn1000Cand
                    .map(
                        (p) => `
                <div class="fs-dn-tile fs-red-tile-${dn}" id="recalc-redtop-${dn}-${p.id}" data-action="recalcSelectRedTop" data-dn="${dn}" data-id="${p.id}"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);">
                    <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
                </div>`
                    )
                    .join('');

                redTiles =
                    `
                <div class="fs-dn-tile active fs-red-tile-${dn}" id="recalc-redtop-${dn}-auto" data-action="recalcSelectRedTop" data-dn="${dn}" data-id="auto"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);">
                    <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;"><i data-lucide="refresh-cw"></i> Auto (Konus)</div>
                </div>` + redTiles;

                reductionHtml = `
            <div style="margin-top:0.6rem;">
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; cursor:pointer;">
                    <input type="checkbox" id="recalc-use-red-${dn}" data-action="recalcToggleRed" data-dn="${dn}" />
                    Wykonaj redukcję na DN1000
                </label>
                <div id="recalc-red-box-${dn}" style="display:none; margin-top:0.5rem; padding-left:1rem; border-left:2px solid var(--border);">
                    <div style="display:grid; grid-template-columns:1fr; gap:0.4rem; margin-bottom:0.5rem;">
                        <label class="form-label" style="font-size:0.65rem;">Min. wys. komory roboczej (m)</label>
                        <input type="number" id="recalc-red-minh-${dn}" class="form-input" value="2.5" step="0.1" style="padding:0.3rem 0.5rem; width:120px;" />
                    </div>
                    <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie komina DN1000:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-red-tiles-${dn}">
                        ${redTiles}
                    </div>
                </div>
            </div>`;
            }

            return `
        <div style="background:rgba(30,41,59,0.4); border:1px solid var(--border); border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;" class="recalc-group" data-dn="${dn}">
            <h4 style="margin-top:0; margin-bottom:0.6rem; color:var(--accent); font-size:0.9rem;">Studnie DN ${dn} <span style="font-size:0.65rem; color:var(--text-muted); font-weight:normal;">(${wells.filter((w) => w.dn === dn).length} szt.)</span></h4>
            <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie główne:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-top-tiles-${dn}">
                ${topTiles}
            </div>
            ${reductionHtml}
            <input type="hidden" id="recalc-choice-top-${dn}" value="auto" />
            <input type="hidden" id="recalc-choice-redtop-${dn}" value="auto" />
        </div>`;
        })
        .join('');

    showModal({
        id: 'global-recalc-modal',
        titleId: 'global-recalc-title',
        html: `
    <div class="modal" style="width:700px; max-width:95vw; background:#111827;">
      <div class="modal-header"><h3 id="global-recalc-title"><i data-lucide="settings" aria-hidden="true"></i> Automatycznie przelicz ofertę</h3><button class="btn-icon" aria-label="Zamknij" data-action="closeGlobalRecalcModal"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div style="padding:1rem; max-height:65vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">Ustaw preferencje dla poszczególnych średnic. Program zaktualizuje ustawienia zakończeń i ponownie wygeneruje układ elementów dla <strong>wszystkich studni w ofercie</strong> według reguł automatycznych.</p>
        ${groupsHtml}
      </div>
      <div style="padding:1rem; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:0.5rem; background:rgba(0,0,0,0.2);">
        <button class="btn btn-secondary" data-action="closeGlobalRecalcModal">Anuluj</button>
        <button class="btn btn-primary" data-action="applyGlobalRecalc" style="background:var(--accent); color:#fff; font-weight:600;"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przelicz wszystkie</button>
      </div>
    </div>`
    });
};

window.closeGlobalRecalcModal = function () {
    const el = document.getElementById('global-recalc-modal');
    if (el) el.remove();
};

window.recalcSelectTop = function (dn, id) {
    document.getElementById(`recalc-choice-top-${dn}`).value = id;
    const tiles = document.querySelectorAll(`#recalc-top-tiles-${dn} .fs-dn-tile`);
    tiles.forEach((t) => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-top-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcSelectRedTop = function (dn, id) {
    document.getElementById(`recalc-choice-redtop-${dn}`).value = id;
    const tiles = document.querySelectorAll(`.fs-red-tile-${dn}`);
    tiles.forEach((t) => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-redtop-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcToggleRed = function (dn) {
    const cb = document.getElementById(`recalc-use-red-${dn}`);
    const box = document.getElementById(`recalc-red-box-${dn}`);
    if (cb && box) {
        box.style.display = cb.checked ? 'block' : 'none';
    }
};

window.applyGlobalRecalc = async function () {
    const btn = document.querySelector('#global-recalc-modal .btn-primary');
    if (btn) {
        btn.innerHTML = '<i data-lucide="refresh-cw"></i> Przeliczanie...';
        btn.disabled = true;
    }

    try {
        const uniqueDns = [...new Set(wells.map((w) => w.dn))];
        const prefs = {};

        uniqueDns.forEach((dn) => {
            const topId = document.getElementById(`recalc-choice-top-${dn}`)?.value || 'auto';
            const useRed = document.getElementById(`recalc-use-red-${dn}`)?.checked || false;
            let redTopId = 'auto';
            let redMinH = 2500;

            if (useRed) {
                redTopId = document.getElementById(`recalc-choice-redtop-${dn}`)?.value || 'auto';
                const redMinHMeters = parseFloat(
                    document.getElementById(`recalc-red-minh-${dn}`)?.value
                );
                redMinH = isNaN(redMinHMeters) ? 2500 : Math.round(redMinHMeters * 1000);
            }

            prefs[dn] = { topId, useRed, redTopId, redMinH };
        });

        const originalIndex = currentWellIndex;

        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            const p = prefs[w.dn];
            if (!p) continue;

            w.zakonczenie = p.topId === 'auto' ? null : p.topId;
            w.redukcjaDN1000 = p.useRed;
            if (p.useRed) {
                w.redukcjaMinH = p.redMinH;
                w.redukcjaZakonczenie = p.redTopId === 'auto' ? null : p.redTopId;
            } else {
                w.redukcjaZakonczenie = null;
            }
            w.config = [];
            w.autoLocked = false;

            currentWellIndex = i;
            await autoSelectComponents(true);
        }

        currentWellIndex = originalIndex;
        refreshAll();
        showToast('Wszystkie studnie przeliczone poprawnie', 'success');
        window.closeGlobalRecalcModal();
    } catch (e) {
        logger.error('wellPopups', e);
        showToast('Wystąpił błąd podczas przeliczania', 'error');
        if (btn) {
            btn.innerHTML = 'Spróbuj ponownie';
            btn.disabled = false;
        }
    }
};

/* ===== REDUKCJA CHOICE (popup wyboru rodzaju redukcji) ===== */
function openRedukcjaChoicePopup() {
    const well = getCurrentWell();
    if (!well) return;

    const can1200 = [1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna';
    const currentTarget = well.redukcjaTargetDN || 1000;
    const isActive = well.redukcjaDN1000;

    showModal({
        id: 'redukcja-choice-modal',
        titleId: 'redukcja-choice-title',
        html: `
    <div class="modal" style="max-width:400px; width:90%; border-radius:12px; padding:1.5rem; background: var(--bg-secondary); border: 1px solid var(--border);">
      <h3 id="redukcja-choice-title" style="margin-top:0; margin-bottom:1rem; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="chevrons-down" style="color:var(--accent);" aria-hidden="true"></i> Wybierz rodzaj redukcji
      </h3>
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        <button data-action="selectRedukcjaChoice" data-dn="1000" style="
            padding:0.8rem; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1000 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'};
            background:${isActive && currentTarget === 1000 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            color:${isActive && currentTarget === 1000 ? '#a5b4fc' : 'var(--text-primary)'};
        ">
            <div style="font-weight:800; font-size:0.9rem;">Redukcja na DN1000</div>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:0.2rem;">Standardowa redukcja na kręgi DN1000.</div>
        </button>
        
        ${
            can1200
                ? `
        <button data-action="selectRedukcjaChoice" data-dn="1200" style="
            padding:0.8rem; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1200 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'};
            background:${isActive && currentTarget === 1200 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            color:${isActive && currentTarget === 1200 ? '#a5b4fc' : 'var(--text-primary)'};
        ">
            <div style="font-weight:800; font-size:0.9rem;">Redukcja na DN1200</div>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:0.2rem;">Większa redukcja na kręgi DN1200.</div>
        </button>
        `
                : ''
        }

        <button data-action="selectRedukcjaChoice" data-dn="" style="
            padding:0.6rem; border-radius:8px; cursor:pointer; text-align:center; transition:all 0.2s;
            border:1px solid rgba(239, 68, 68, 0.3); background:rgba(239, 68, 68, 0.05); color:#ef4444; margin-top:0.4rem;
        ">
            Wyłącz redukcję
        </button>
      </div>
      <div style="margin-top:1.2rem; text-align:right;">
        <button class="btn btn-secondary btn-sm" data-action="closeModal">Anuluj</button>
      </div>
    </div>`
    });
    if (window.lucide) window.lucide.createIcons();
}

async function selectRedukcjaChoice(targetDn) {
    const well = getCurrentWell();
    if (!well) return;

    const oldTarget = well.redukcjaTargetDN || 1000;
    const wasActive = well.redukcjaDN1000;
    const newTarget = targetDn;

    if (targetDn === null) {
        well.redukcjaDN1000 = false;
        well.redukcjaTargetDN = 1000;
    } else {
        well.redukcjaDN1000 = true;
        well.redukcjaTargetDN = targetDn;

        if (well.dn === 'styczna') {
            well.stycznaNadbudowa1200 = targetDn === 1200;
        }
    }

    closeModal();
    updateRedukcjaButton();
    updateRedukcjaZakButton();

    if (!well.autoLocked) {
        let swapped = false;
        if (
            wasActive &&
            targetDn !== null &&
            oldTarget !== newTarget &&
            (well.config || []).length > 0
        ) {
            swapped = trySwapReductionComponents(well, oldTarget, newTarget);
        }

        if (!swapped) {
            well.configSource = 'AUTO';
            well.config = [];
            await autoSelectComponents(true);
        }
    }
    refreshAll();
    showToast(
        targetDn ? `Redukcja na DN${targetDn} — WŁĄCZONA` : 'Redukcja — WYŁĄCZONA',
        targetDn ? 'success' : 'info'
    );
}

/**
 * Próbuje podmienić elementy w konfiguracji przy zmianie średnicy redukcji.
 * Zwraca true jeśli udało się podmienić wszystko, false jeśli wymagany pełny re-dobór.
 */
function trySwapReductionComponents(well, oldTarget, newTarget) {
    if (!well.config || well.config.length === 0) return false;

    const newConfig = [];
    const availProducts = getAvailableProducts(well).filter((p) => filterByWellParams(p, well));

    for (const item of well.config) {
        const prod = studnieProducts.find((p) => p.id === item.productId);
        if (!prod) {
            newConfig.push(item);
            continue;
        }

        if (prod.componentType === 'plyta_redukcyjna') {
            const newPlate = getReductionPlate(availProducts, well.dn, true, newTarget);
            if (!newPlate) return false;
            newConfig.push({ productId: newPlate.id, quantity: item.quantity });
            continue;
        }

        if (parseInt(prod.dn) === oldTarget) {
            const match = availProducts.find(
                (p) =>
                    parseInt(p.dn) === newTarget &&
                    p.componentType === prod.componentType &&
                    p.height === prod.height
            );

            if (!match) return false;
            newConfig.push({ productId: match.id, quantity: item.quantity });
            continue;
        }

        newConfig.push(item);
    }

    well.config = newConfig;
    well.configSource = 'MANUAL_SWAP';

    if (typeof window.telemetryRecordEvent === 'function') {
        window.telemetryRecordEvent({
            eventType: 'reduction_swap',
            wellId: well.id || well.name,
            oldDn: oldTarget,
            newDn: newTarget,
            configSource: 'MANUAL_SWAP'
        });
    }

    return true;
}
