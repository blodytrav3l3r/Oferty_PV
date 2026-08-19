// @ts-check
/* ===== Extracted to wellPopups.js ===== */

function openZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    const dn = well.dn;
    const effectiveDn = dn === 'styczna' ? (well.stycznaNadbudowa1200 ? 1200 : 1000) : dn;
    const topClosureTypes = [
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ];

    const candidates = getAvailableProducts(well).filter(
        (p) =>
            topClosureTypes.includes(p.componentType) &&
            (parseInt(p.dn) === parseInt(effectiveDn) || p.dn === null) &&
            filterByWellParams(p, well)
    );

    const typeIcons = {
        konus: 'diamond',
        plyta_din: 'chevron-down',
        plyta_najazdowa: 'chevron-down',
        plyta_zamykajaca: 'chevron-down',
        pierscien_odciazajacy: 'settings'
    };

    const typeLabels = {
        konus: 'Konus',
        plyta_din: 'Płyta DIN',
        plyta_najazdowa: 'Płyta Odciążająca',
        plyta_zamykajaca: 'Płyta Odciążająca',
        pierscien_odciazajacy: 'Pierścień Odciążający'
    };

    const currentZak = well.zakonczenie;
    const dnLabel = dn === 'styczna' ? 'styczna (1000)' : dn;

    const zakClosureColor = (componentType) => {
        if (typeof SVG_COLORS !== 'undefined' && SVG_COLORS[componentType]) {
            return SVG_COLORS[componentType];
        }
        return typeof SVG_COLORS !== 'undefined' && SVG_COLORS.fallback
            ? SVG_COLORS.fallback
            : 'var(--slate-700)';
    };

    const renderTile = (p) => {
        const isActive = currentZak === p.id;
        const isKonus = p.componentType === 'konus';
        const wkladkaPEHDZwienczenieActive =
            well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const accent = zakClosureColor(p.componentType);
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = typeLabels[p.componentType] || p.componentType;
        const classList = ['recalc-tile', 'zak-tile'];
        if (isActive) classList.push('active');
        if (isDisabled) classList.push('zak-tile-blocked');

        if (isDisabled) {
            return `
            <button type="button" class="${classList.join(' ')}" style="--tile-accent:${accent};" aria-disabled="true" data-action="showKonusPehdResolverModal">
                <span class="zak-tile-type"><i data-lucide="${icon}" aria-hidden="true"></i> ${escapeHtml(typeLabel)}</span>
                <span class="zak-tile-name">${escapeHtml(p.name)}</span>
                <span class="zak-tile-note"><i data-lucide="alert-triangle" aria-hidden="true"></i> BLOKADA &middot; Brak możliwości wykonania wkładki PEHD</span>
            </button>`;
        }

        return `
        <button type="button" class="${classList.join(' ')}" style="--tile-accent:${accent};" aria-pressed="${isActive}" data-action="selectZakonczenie" data-id="${escapeHtml(p.id)}">
            <span class="zak-tile-type"><i data-lucide="${icon}" aria-hidden="true"></i> ${escapeHtml(typeLabel)}</span>
            <span class="zak-tile-name">${escapeHtml(p.name)}</span>
            <span class="zak-tile-meta">
                <span class="zak-tile-height">${p.height ? 'H: ' + escapeHtml(p.height) + ' mm' : ''}</span>
                <span class="zak-tile-price">${fmtInt(p.price)} PLN</span>
            </span>
            <span class="recalc-tile-check" aria-hidden="true"><i data-lucide="check"></i></span>
        </button>`;
    };

    let tilesHtml = '';
    if (candidates.length === 0) {
        tilesHtml = `<div class="recalc-empty">Brak elementów zakończenia dla DN ${escapeHtml(dnLabel)}</div>`;
    } else {
        const isAutoActive = !currentZak;

        tilesHtml += `
        <button type="button" class="recalc-tile recalc-tile-auto zak-tile${isAutoActive ? ' active' : ''}" class="tile-accent-css" aria-pressed="${isAutoActive}" data-action="selectZakonczenie" data-id="">
            <span class="zak-tile-type"><i data-lucide="refresh-cw" aria-hidden="true"></i> Auto (Zakończenie DN${escapeHtml(effectiveDn)})</span>
            <span class="zak-tile-name">Automatyczny dobór zakończenia dla średnicy DN${escapeHtml(effectiveDn)}</span>
            <span class="recalc-tile-check" aria-hidden="true"><i data-lucide="check"></i></span>
        </button>`;

        const konuses = candidates.filter((p) => p.componentType === 'konus');
        const dinPlates = candidates.filter((p) => p.componentType === 'plyta_din');
        const odcParts = candidates.filter((p) =>
            ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(
                p.componentType
            )
        );

        if (konuses.length) {
            tilesHtml += '<div class="recalc-section-label">Konus</div>';
            konuses.forEach((p) => {
                tilesHtml += renderTile(p);
            });
        }
        if (dinPlates.length) {
            tilesHtml += '<div class="recalc-section-label">Płyta DIN</div>';
            dinPlates.forEach((p) => {
                tilesHtml += renderTile(p);
            });
        }
        if (odcParts.length) {
            tilesHtml += '<div class="recalc-section-label">Płyta / Pierścień Odciążający</div>';
            odcParts.forEach((p) => {
                tilesHtml += renderTile(p);
            });
        }
    }

    showModal({
        id: 'zakonczenie-modal',
        titleId: 'zakonczenie-title',
        html: `
    <div class="modal recalc-modal zak-modal">
      <div class="modal-header">
        <h3 id="zakonczenie-title"><i data-lucide="chevron-down" aria-hidden="true"></i> Zakończenie studni <span class="zak-modal-badge">DN${escapeHtml(dnLabel)}</span></h3>
        <button type="button" class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="recalc-modal-body">
        <p class="recalc-modal-desc">Wybierz domyślny element zakończenia górnego dla tej studni. Wybrany element będzie używany przez Auto-dobór.</p>
        <div class="recalc-tile-grid">${tilesHtml}</div>
      </div>
      <div class="recalc-modal-footer">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Zamknij</button>
      </div>
    </div>`
    });

    const root = document.getElementById('zakonczenie-modal');
    if (root && window.lucide) window.lucide.createIcons({ root });
}

// updateZakonczenieButton, updateRedukcjaButton, onRedukcjaMinChange,
// updateRedukcjaZakButton, updatePsiaBudaButton przeniesione do popupsButtonUpdaters.js

function openRedukcjaZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    const availProducts = getAvailableProducts(well);
    const topClosureTypes = [
        'konus',
        'plyta_din',
        'plyta_najazdowa',
        'plyta_zamykajaca',
        'pierscien_odciazajacy'
    ];
    const targetDn = well.redukcjaTargetDN || 1000;
    const candidates = availProducts
        .filter(
            (p) =>
                topClosureTypes.includes(p.componentType) && parseInt(p.dn) === parseInt(targetDn)
        )
        .filter((p) => filterByWellParams(p, well));

    const typeIcons = {
        konus: 'diamond',
        plyta_din: 'chevron-down',
        plyta_najazdowa: 'chevron-down',
        plyta_zamykajaca: 'chevron-down',
        pierscien_odciazajacy: 'settings'
    };
    const typeLabels = {
        konus: 'Konus',
        plyta_din: 'Płyta DIN',
        plyta_najazdowa: 'Płyta Odciążająca',
        plyta_zamykajaca: 'Płyta Odciążająca',
        pierscien_odciazajacy: 'Pierścień Odciążający'
    };

    const currentZak = well.redukcjaZakonczenie;
    const wkladkaPEHDZwienczenieActive =
        well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';

    const zakClosureColor = (componentType) => {
        if (typeof SVG_COLORS !== 'undefined' && SVG_COLORS[componentType]) {
            return SVG_COLORS[componentType];
        }
        return typeof SVG_COLORS !== 'undefined' && SVG_COLORS.fallback
            ? SVG_COLORS.fallback
            : 'var(--slate-700)';
    };

    const renderTile = (p, overrideLabel = null) => {
        if (!p) return '';
        const isKonus = p.componentType === 'konus';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const isActive = currentZak === p.id;
        const accent = zakClosureColor(p.componentType);
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = overrideLabel || typeLabels[p.componentType] || p.componentType;
        const classList = ['recalc-tile', 'zak-tile'];
        if (isActive) classList.push('active');
        if (isDisabled) classList.push('zak-tile-blocked');

        if (isDisabled) {
            return `
            <button type="button" class="${classList.join(' ')}" style="--tile-accent:${accent};" aria-disabled="true" data-action="showKonusPehdResolverModal">
                <span class="zak-tile-type"><i data-lucide="${icon}" aria-hidden="true"></i> ${escapeHtml(typeLabel)}</span>
                <span class="zak-tile-name">${escapeHtml(p.name)}</span>
                <span class="zak-tile-note"><i data-lucide="alert-triangle" aria-hidden="true"></i> BLOKADA &middot; Brak możliwości wkładki PEHD</span>
            </button>`;
        }

        return `
        <button type="button" class="${classList.join(' ')}" style="--tile-accent:${accent};" aria-pressed="${isActive}" data-action="selectRedukcjaZakonczenie" data-id="${escapeHtml(p.id)}">
            <span class="zak-tile-type"><i data-lucide="${icon}" aria-hidden="true"></i> ${escapeHtml(typeLabel)}</span>
            <span class="zak-tile-name">${escapeHtml(p.name)}</span>
            <span class="zak-tile-meta">
                <span class="zak-tile-height">${p.height ? 'H: ' + escapeHtml(p.height) + ' mm' : ''}</span>
                <span class="zak-tile-price">${fmtInt(p.price)} PLN</span>
            </span>
            <span class="recalc-tile-check" aria-hidden="true"><i data-lucide="check"></i></span>
        </button>`;
    };

    let tilesHtml = '';
    const isAutoActive = !currentZak;
    tilesHtml += `
    <button type="button" class="recalc-tile recalc-tile-auto zak-tile${isAutoActive ? ' active' : ''}" class="tile-accent-css" aria-pressed="${isAutoActive}" data-action="selectRedukcjaZakonczenie" data-id="">
        <span class="zak-tile-type"><i data-lucide="refresh-cw" aria-hidden="true"></i> Auto (Zakończenie DN${escapeHtml(targetDn)})</span>
        <span class="zak-tile-name">Automatyczny dobór zakończenia dla średnicy DN${escapeHtml(targetDn)}</span>
        <span class="recalc-tile-check" aria-hidden="true"><i data-lucide="check"></i></span>
    </button>`;

    const konuses = candidates.filter((p) => p.componentType === 'konus');
    const dinPlates = candidates.filter((p) => p.componentType === 'plyta_din');
    const odcParts = candidates.filter((p) =>
        ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType)
    );

    if (konuses.length) {
        tilesHtml += '<div class="recalc-section-label">Konus</div>';
        konuses.forEach((p) => {
            tilesHtml += renderTile(p);
        });
    }
    if (dinPlates.length) {
        tilesHtml += '<div class="recalc-section-label">Płyta DIN</div>';
        dinPlates.forEach((p) => {
            tilesHtml += renderTile(p);
        });
    }
    if (odcParts.length) {
        tilesHtml += '<div class="recalc-section-label">Płyta / Pierścień Odciążający</div>';
        odcParts.forEach((p) => {
            tilesHtml += renderTile(p);
        });
    }

    showModal({
        id: 'redukcja-zak-modal',
        titleId: 'redukcja-zak-title',
        html: `
    <div class="modal recalc-modal zak-modal">
      <div class="modal-header">
        <h3 id="redukcja-zak-title"><i data-lucide="chevron-down" aria-hidden="true"></i> Zakończenie redukcji DN${escapeHtml(targetDn)}</h3>
        <button type="button" class="btn-icon" aria-label="Zamknij" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="recalc-modal-body">
        <p class="recalc-modal-desc">Wybierz zakończenie górne dla sekcji redukcji DN${escapeHtml(targetDn)}. Wybór elementu odciążającego automatycznie doda pierścień.</p>
        <div class="recalc-tile-grid">${tilesHtml}</div>
      </div>
      <div class="recalc-modal-footer">
        <button type="button" class="btn btn-secondary" data-action="closeModal">Zamknij</button>
      </div>
    </div>`
    });

    const root = document.getElementById('redukcja-zak-modal');
    if (root && window.lucide) window.lucide.createIcons({ root });
}

// showStycznaPopup, handleStycznaProductChoice przeniesione do popupsStyczna.js

// showKonusPehdResolverModal, resolveKonusPehd przeniesione do popupsKonusPehd.js

// openGlobalRecalcModal, closeGlobalRecalcModal, recalcSelectTop, recalcSelectRedTop,
// recalcToggleRed, applyGlobalRecalc przeniesione do popupsGlobalRecalc.js
// openRedukcjaChoicePopup, selectRedukcjaChoice, trySwapReductionComponents przeniesione do popupsRedukcjaChoice.js

// ===== TRANSITION MANAGER przeniesiony do popupsTransitionManager.js

/* ===== Delegacja kliknięć (data-action) — TASK-036 ===== */
if (typeof document !== 'undefined' && !window.__wpDelegated) {
    window.__wpDelegated = true;
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const action = el.getAttribute('data-action') || '';
        const id = el.getAttribute('data-id');
        if (action === 'closeModal') {
            window.closeModal();
        } else if (action === 'showKonusPehdResolverModal') {
            window.showKonusPehdResolverModal(currentWellIndex);
        } else if (action === 'selectZakonczenie') {
            window.selectZakonczenie(id || null);
        } else if (action === 'selectRedukcjaZakonczenie') {
            window.selectRedukcjaZakonczenie(id || null);
        }
    });
}

/* ===== Rejestracja globali ===== */
window.openZakonczeniePopup = openZakonczeniePopup;
window.openRedukcjaZakonczeniePopup = openRedukcjaZakonczeniePopup;
