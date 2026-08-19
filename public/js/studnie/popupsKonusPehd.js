// @ts-check

/* ===== KONUS PEHD RESOLVER ===== */

window.showKonusPehdResolverModal = function (wellIndex, callback) {
    const well = wells[wellIndex];
    if (!well) return;

    const oldOverlay = document.getElementById('pehd-konus-resolver');
    if (oldOverlay) oldOverlay.remove();

    const html = `
    <div style="background:var(--bg-secondary, var(--slate-800)); padding:2.2rem; border-radius: var(--radius-md); max-width:600px; width:100%; border:1px solid rgba(var(--danger-rgb), 0.3); box-shadow:0 25px 50px -12px rgba(var(--black-rgb), 0.5);">
        <h3 id="pehd-konus-title" style="margin-top:0; color:var(--danger-hover); display:flex; align-items:center; gap:0.6rem; font-family:Inter,sans-serif; font-size: var(--fs-4xl); font-weight: var(--fw-bold);">
            <i data-lucide="alert-circle" style="width:24px;height:24px;" aria-hidden="true"></i> Niezgodność technologiczna: Konus + PEHD
        </h3>
        <p style="color:var(--slate-400); font-size: var(--fs-xl); margin-bottom:1.8rem; line-height:1.6; font-family:Inter,sans-serif;">
            <b>Konus</b> nie może być zakończeniem studni, jeśli zastosowano w nim wkładkę <b>PEHD</b>.<br>
            Wybierz alternatywne zakończenie dla studni <strong class="text-primary">${escapeHtml(well.name || 'Bieżąca studnia')}</strong>:
        </p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem;">
            <div onclick="window.resolveKonusPehd(${wellIndex}, 'plyta_din')" class="pehd-card" class="empty-pad-15">
                <div class="fs-3xl-slate200-mb4">Płyta DIN</div>
                <div class="fs-md-slate500-lh">Standardowa płyta nastudzienna.</div>
            </div>
            
            <div onclick="window.resolveKonusPehd(${wellIndex}, 'pierscien_odciazajacy')" class="pehd-card" class="empty-pad-15">
                <div class="fs-3xl-slate200-mb4">Płyta + Pierścień</div>
                <div class="fs-md-slate500-lh">Płyta zamykająca i pierścień odciążający.</div>
            </div>
        </div>
        
        <div style="margin-top:1.8rem; text-align:right;">
            <button onclick="document.getElementById('pehd-konus-resolver').remove(); if(window.konusResolverCallback) window.konusResolverCallback();" class="pehd-btn-cancel" style="font-family:Inter,sans-serif; font-size: var(--fs-xl);">Zostaw domyślne (Płyta DIN)</button>
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
