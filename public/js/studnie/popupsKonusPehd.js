// @ts-check

/* ===== KONUS PEHD RESOLVER ===== */

/* Check Konus 1:1 z enforceGlobalKonusPehdRule (actionsWellSync.js):
   config + zakonczenie + redukcjaZakonczenie. Lokalnie, żeby nie ruszać SSoT. */
function _konusResolverWellHasKonus(well) {
    if (!well) return false;
    if (well.config && well.config.length > 0) {
        const found = well.config.some((c) => {
            const p =
                typeof getStudnieProductById === 'function'
                    ? getStudnieProductById(c.productId)
                    : (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(
                          (pr) => pr.id === c.productId
                      );
            return p && p.componentType === 'konus';
        });
        if (found) return true;
    }
    for (const field of ['zakonczenie', 'redukcjaZakonczenie']) {
        if (!well[field]) continue;
        const p =
            typeof getStudnieProductById === 'function'
                ? getStudnieProductById(well[field])
                : (typeof studnieProducts !== 'undefined' ? studnieProducts : []).find(
                      (pr) => pr.id === well[field]
                  );
        if (p && p.componentType === 'konus') return true;
    }
    return false;
}

function closeKonusResolver() {
    window.konusResolverOpen = false;
    const cb = window.konusResolverCallback;
    window.konusResolverCallback = null;
    const el = document.getElementById('pehd-konus-resolver');
    if (el) el.remove();
    /* Anuluj/X bez wyboru płyty: Konus zostaje → wkładka Zwieńcz. wraca na 'brak'.
       Po resolve flaga _konusResolved stoi (Konus znika) — nic nie cofamy. */
    try {
        const wIdx = window._konusResolverWellIndex;
        const resolved = window._konusResolved;
        window._konusResolverWellIndex = -1;
        window._konusResolved = false;
        if (!resolved && typeof wIdx === 'number' && wIdx >= 0) {
            const well = typeof wells !== 'undefined' && Array.isArray(wells) ? wells[wIdx] : null;
            if (
                well &&
                well.wkladkaZwienczenie &&
                well.wkladkaZwienczenie !== 'brak' &&
                _konusResolverWellHasKonus(well)
            ) {
                well.wkladkaZwienczenie = 'brak';
                if (typeof renderWellParams === 'function') renderWellParams();
                if (typeof updateParamTilesUI === 'function') updateParamTilesUI();
                if (typeof updateSummary === 'function') updateSummary();
                if (typeof window.refreshExcelFromConfig === 'function')
                    window.refreshExcelFromConfig();
                // Otwarty popup "Parametry tej studni" (Excel) trzymałby stary
                // aktywny kafelek — przemaluj go na cofnięty model.
                if (
                    typeof document !== 'undefined' &&
                    document.getElementById('excel-params-popup') &&
                    typeof closeExcelParamsPopup === 'function' &&
                    typeof excelOpenWellParams === 'function'
                ) {
                    closeExcelParamsPopup();
                    excelOpenWellParams(wIdx);
                }
            }
        }
    } catch (_eRevert) {}
    if (cb) cb();
}

window.konusResolverCancel = closeKonusResolver;

window.showKonusPehdResolverModal = function (wellIndex, callback) {
    const well = wells[wellIndex];
    if (!well) return;

    window.konusResolverOpen = true;
    window.konusResolverCallback = callback || null;
    window._konusResolverWellIndex = wellIndex;
    window._konusResolved = false;

    const html = `
    <div class="modal" style="max-width:620px;border-color:rgba(var(--danger-rgb),0.35);">
        <div class="modal-header">
            <h3 id="pehd-konus-title" style="color:var(--danger-hover);display:flex;align-items:center;gap:0.6rem;margin:0;">
                <i data-lucide="alert-circle" class="icon-lg" aria-hidden="true"></i> Niezgodność technologiczna: Konus + PEHD
            </h3>
            <button type="button" data-csp="konusResolverCancel" data-csp-args="[]" class="btn-icon btn-icon-danger btn-icon-sm" aria-label="Zamknij"><i data-lucide="x" class="icon-xs" aria-hidden="true"></i></button>
        </div>
        <p style="color:var(--text-secondary);font-size:var(--fs-md);line-height:1.6;margin:0 0 1.2rem;">
            <b>Konus</b> nie może być zakończeniem studni, jeśli zastosowano w nim wkładkę <b>PEHD</b>.<br>
            Wybierz alternatywne zakończenie dla studni <strong style="color:var(--accent-text)">${escapeHtml(well.name || 'Bieżąca studnia')}</strong>:
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
            <button type="button" data-csp="resolveKonusPehd" data-csp-args="${escapeHtmlAttr(JSON.stringify([wellIndex, 'plyta_din']))}" class="pehd-card">
                <span class="pehd-card-title">Płyta DIN</span>
                <span class="pehd-card-desc">Standardowa płyta nastudzienna.</span>
            </button>

            <button type="button" data-csp="resolveKonusPehd" data-csp-args="${escapeHtmlAttr(JSON.stringify([wellIndex, 'pierscien_odciazajacy']))}" class="pehd-card">
                <span class="pehd-card-title">Płyta + Pierścień</span>
                <span class="pehd-card-desc">Płyta zamykająca i pierścień odciążający.</span>
            </button>
        </div>

        <div class="modal-footer">
            <button type="button" data-csp="konusResolverCancel" data-csp-args="[]" class="btn btn-secondary">Anuluj</button>
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

    // Konus to zawsze nadbudowa (deterministyczne) — filtr przez SSoT gdy dostępny.
    const konusMag =
        typeof resolveWellMagazyn === 'function'
            ? resolveWellMagazyn(well, 'nadbudowa')
            : well.magazynNadbudowa || well.magazyn || 'Kluczbork';
    const magField =
        typeof magFieldFor === 'function'
            ? magFieldFor(konusMag)
            : konusMag === 'Włocławek'
              ? 'magazynWL'
              : 'magazynKLB';
    const avail = studnieProducts.filter(
        (p) =>
            p.dn === dn &&
            p.componentType === type &&
            (p[magField] === 1 || p[magField] === undefined)
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

        window._konusResolved = true;
        closeKonusResolver();

        if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
        if (typeof window._excelSyncAutoManualUI === 'function') window._excelSyncAutoManualUI();

        // Z Excela (overlay otwarty): re-solve w kontekście Excela —
        // tabela + preview + kafelek Ceny od razu, nie przy najbliższej edycji.
        if (
            typeof document !== 'undefined' &&
            document.getElementById('excel-table-overlay') &&
            typeof _excelAutoSelectForWell === 'function'
        ) {
            await _excelAutoSelectForWell(wellIndex);
        } else if (currentWizardStep === 3) {
            await autoSelectComponents(true);
            refreshAll();
        }
    } else {
        showToast('Brak elementu dla wybranego typu w cenniku (DN' + dn + ').', 'error');
    }
};
