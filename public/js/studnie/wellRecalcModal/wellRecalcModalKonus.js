// @ts-check
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
