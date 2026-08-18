// @ts-check

/* ===== REDUKCJA CHOICE ===== */

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
    <div class="modal" style="max-width:400px; width:90%; border-radius: var(--radius); padding:1.5rem; background: var(--bg-secondary); border: 1px solid var(--border);">
      <h3 id="redukcja-choice-title" style="margin-top:0; margin-bottom:1rem; font-size: var(--fs-3xl); color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="chevrons-down" style="color:var(--accent);" aria-hidden="true"></i> Wybierz rodzaj redukcji
      </h3>
      <div style="display:flex; flex-direction:column; gap:0.6rem;">
        <button onclick="selectRedukcjaChoice(1000)" style="
            padding:0.8rem; border-radius: var(--radius-sm); cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1000 ? 'rgba(var(--accent-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.1)'};
            background:${isActive && currentTarget === 1000 ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(var(--white-rgb), 0.05)'};
            color:${isActive && currentTarget === 1000 ? 'var(--accent-text)' : 'var(--text-primary)'};
        ">
            <div style="font-weight: var(--fw-extrabold); font-size: var(--fs-xl);">Redukcja na DN1000</div>
            <div style="font-size: var(--fs-sm); opacity:0.7; margin-top:0.2rem;">Standardowa redukcja na kręgi DN1000.</div>
        </button>
        
        ${
            can1200
                ? `
        <button onclick="selectRedukcjaChoice(1200)" style="
            padding:0.8rem; border-radius: var(--radius-sm); cursor:pointer; text-align:left; transition:all 0.2s;
            border:2px solid ${isActive && currentTarget === 1200 ? 'rgba(var(--accent-rgb), 0.8)' : 'rgba(var(--white-rgb), 0.1)'};
            background:${isActive && currentTarget === 1200 ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(var(--white-rgb), 0.05)'};
            color:${isActive && currentTarget === 1200 ? 'var(--accent-text)' : 'var(--text-primary)'};
        ">
            <div style="font-weight: var(--fw-extrabold); font-size: var(--fs-xl);">Redukcja na DN1200</div>
            <div style="font-size: var(--fs-sm); opacity:0.7; margin-top:0.2rem;">Większa redukcja na kręgi DN1200.</div>
        </button>
        `
                : ''
        }

        <button onclick="selectRedukcjaChoice(null)" style="
            padding:0.6rem; border-radius: var(--radius-sm); cursor:pointer; text-align:center; transition:all 0.2s;
            border:1px solid rgba(var(--danger-rgb), 0.3); background:rgba(var(--danger-rgb), 0.05); color:var(--danger); margin-top:0.4rem;
        ">
            Wyłącz redukcję
        </button>
      </div>
      <div style="margin-top:1.2rem; text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Anuluj</button>
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

/* ===== Rejestracja globali ===== */
window.openRedukcjaChoicePopup = openRedukcjaChoicePopup;

/* ===== Rejestracja globali ===== */
window.selectRedukcjaChoice = selectRedukcjaChoice;
