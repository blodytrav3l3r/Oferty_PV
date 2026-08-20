// @ts-check

/* ===== KONUS PEHD RESOLVER ===== */

function closeKonusResolver() {
    window.konusResolverOpen = false;
    const cb = window.konusResolverCallback;
    window.konusResolverCallback = null;
    const el = document.getElementById('pehd-konus-resolver');
    if (el) el.remove();
    if (cb) cb();
}

window.konusResolverCancel = closeKonusResolver;

window.showKonusPehdResolverModal = function (wellIndex, callback) {
    const well = wells[wellIndex];
    if (!well) return;

    window.konusResolverOpen = true;
    window.konusResolverCallback = callback || null;

    const html = `
    <div class="modal" style="max-width:620px;border-color:rgba(var(--danger-rgb),0.35);">
        <div class="modal-header">
            <h3 id="pehd-konus-title" style="color:var(--danger-hover);display:flex;align-items:center;gap:0.6rem;margin:0;">
                <i data-lucide="alert-circle" style="width:22px;height:22px;" aria-hidden="true"></i> Niezgodność technologiczna: Konus + PEHD
            </h3>
            <button type="button" onclick="window.konusResolverCancel()" class="btn-icon btn-icon-danger btn-icon-sm" aria-label="Zamknij">✕</button>
        </div>
        <p style="color:var(--text-secondary);font-size:var(--fs-md);line-height:1.6;margin:0 0 1.2rem;">
            <b>Konus</b> nie może być zakończeniem studni, jeśli zastosowano w nim wkładkę <b>PEHD</b>.<br>
            Wybierz alternatywne zakończenie dla studni <strong style="color:var(--accent-text)">${escapeHtml(well.name || 'Bieżąca studnia')}</strong>:
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <button type="button" onclick="window.resolveKonusPehd(${wellIndex}, 'plyta_din')" class="pehd-card">
                <span class="pehd-card-title">Płyta DIN</span>
                <span class="pehd-card-desc">Standardowa płyta nastudzienna.</span>
            </button>

            <button type="button" onclick="window.resolveKonusPehd(${wellIndex}, 'pierscien_odciazajacy')" class="pehd-card">
                <span class="pehd-card-title">Płyta + Pierścień</span>
                <span class="pehd-card-desc">Płyta zamykająca i pierścień odciążający.</span>
            </button>
        </div>

        <div class="modal-footer">
            <button type="button" onclick="window.konusResolverCancel()" class="btn btn-secondary">Anuluj</button>
        </div>
    </div>
    `;

    const overlay = showModal({
        id: 'pehd-konus-resolver',
        titleId: 'pehd-konus-title',
        html: html,
        onClose: closeKonusResolver
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });
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

        // Przejście z trybu ręcznego na automatyczny — solver przebuduje config
        well.autoLocked = false;
        well.configSource = 'AUTO';
        well.autoSelect = true;
        well.config = [];

        closeKonusResolver();

        if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
        if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();

        if (currentWizardStep === 3) {
            await autoSelectComponents(true);
            refreshAll();
        }
    } else {
        showToast('Brak elementu dla wybranego typu w cenniku (DN' + dn + ').', 'error');
    }
};
