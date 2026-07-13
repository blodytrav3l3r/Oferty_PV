// @ts-check
/* ===== POPUPY WYBORU ZAKOŃCZENIA I REDUKCJI ===== */

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

    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.zakonczenie;
    const dnLabel = dn === 'styczna' ? 'styczna (1000)' : dn;

    const renderTile = (p) => {
        const isActive = currentZak === p.id;
        const isKonus = p.componentType === 'konus';
        const wkladkaPEHDZwienczenieActive =
            well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = typeLabels[p.componentType] || p.componentType;

        if (isDisabled) {
            return `<div data-action="showKonusPehdResolver" style="
                padding:0.7rem 0.9rem; border-radius:10px; cursor:not-allowed; opacity:0.5;
                border:2px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02);
            ">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                    <i data-lucide="${icon}" style="width:16px; height:16px; color:var(--text-muted);"></i>
                    <span style="font-weight:700; font-size:0.82rem; color:var(--text-muted);">${typeLabel}</span>
                    <span style="margin-left:auto; font-size:0.55rem; color:var(--warning); font-weight:700;"><i data-lucide="alert-triangle" aria-hidden="true"></i> ZABLOKOWANE</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${p.name}</div>
                <div style="font-size:0.6rem; color:var(--warning); margin-top:0.2rem;">Brak możliwości wykonania wkładki PEHD</div>
            </div>`;
        }

        return `<div data-action="selectZakonczenie" data-product-id="${p.id}" data-wp-active="${isActive}" style="
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        ">
            <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;">
                <i data-lucide="${icon}" style="width:16px; height:16px; color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</span>
                ${isActive ? '<span style="margin-left:auto; font-size:0.55rem; color:#a78bfa; font-weight:700;"><i data-lucide="check" aria-hidden="true"></i> AKTYWNE</span>' : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    if (candidates.length === 0) {
        tilesHtml =
            '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Brak elementów zakończenia dla DN ' +
            dnLabel +
            '</div>';
    } else {
        const isAutoActive = !currentZak;
        const sectionStyle =
            'grid-column:1/ -1; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; padding:0.6rem 0 0.1rem; border-top:1px solid rgba(255,255,255,0.06);';

        tilesHtml += `<div data-action="selectZakonczenie" data-wp-auto="${isAutoActive}" style="
            grid-column:1/ -1;
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        ">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <i data-lucide="refresh-cw" style="width:16px; height:16px; color:${isAutoActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">Auto (Zakończenie DN${effectiveDn})</span>
            </div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem; margin-left:1.4rem;">Automatyczny dobór zakończenia dla średnicy DN${effectiveDn}</div>
        </div>`;

        const konuses = candidates.filter((p) => p.componentType === 'konus');
        const dinPlates = candidates.filter((p) => p.componentType === 'plyta_din');
        const odcParts = candidates.filter((p) =>
            ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(
                p.componentType
            )
        );

        if (konuses.length) {
            tilesHtml += `<div style="${sectionStyle}">Konus</div>`;
            konuses.forEach((p) => {
                tilesHtml += renderTile(p);
            });
            if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';
        }
        if (dinPlates.length) {
            tilesHtml += `<div style="${sectionStyle}">Płyta DIN</div>`;
            dinPlates.forEach((p) => {
                tilesHtml += renderTile(p);
            });
            if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';
        }
        if (odcParts.length) {
            tilesHtml += `<div style="${sectionStyle}">Płyta / Pierścień Odciążający</div>`;
            odcParts.forEach((p) => {
                tilesHtml += renderTile(p);
            });
        }
    }

    showModal({
        id: 'zakonczenie-modal',
        titleId: 'zakonczenie-title',
        html: `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; display:flex; align-items:flex-start; gap:0.8rem;">
        <div class="flex-1">
          <h3 id="zakonczenie-title" style="font-size:1.05rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="chevron-down" style="width:18px; height:18px;"></i> Zakończenie studni
            <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">DN${dnLabel}</span>
          </h3>
          <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz domyślny element zakończenia górnego dla tej studni. Wybrany element będzie używany przez Auto-dobór.</p>
        </div>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem; text-align:right;">
        <button class="btn btn-secondary" data-action="closeModal">Zamknij</button>
      </div>
    </div>`
    });
}

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
    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.redukcjaZakonczenie;
    const wkladkaPEHDZwienczenieActive =
        well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';

    const renderTile = (p, overrideLabel = null) => {
        if (!p) return '';
        const isKonus = p.componentType === 'konus';
        const isDisabled = isKonus && wkladkaPEHDZwienczenieActive;
        const isActive = currentZak === p.id;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const icon = typeIcons[p.componentType] || 'circle';
        const typeLabel = overrideLabel || typeLabels[p.componentType] || p.componentType;

        if (isDisabled) {
            return `<div data-action="showKonusPehdResolver" style="
                padding:0.7rem 0.9rem; border-radius:10px; cursor:not-allowed; opacity:0.5;
                border:2px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02);
            ">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.3rem;">
                    <i data-lucide="${icon}" style="width:16px; height:16px; color:var(--text-muted);"></i>
                    <span style="font-weight:700; font-size:0.82rem; color:var(--text-muted);">${typeLabel}</span>
                    <span style="margin-left:auto; font-size:0.55rem; color:var(--warning); font-weight:700;"><i data-lucide="alert-triangle" aria-hidden="true"></i> BLOKADA</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${p.name}</div>
                <div style="font-size:0.6rem; color:var(--warning); margin-top:0.2rem;">Brak możliwości wkładki PEHD</div>
            </div>`;
        }

        return `<div data-action="selectRedukcjaZakonczenie" data-product-id="${p.id}" data-wp-active="${isActive}" style="
            padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        ">
            <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.25rem;">
                <i data-lucide="${icon}" style="width:16px; height:16px; color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
                <span style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</span>
                ${isActive ? '<span style="margin-left:auto; font-size:0.55rem; color:#a78bfa; font-weight:700;"><i data-lucide="check" aria-hidden="true"></i> AKTYWNE</span>' : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-secondary); font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    const isAutoActive = !currentZak;
    tilesHtml += `<div data-action="selectRedukcjaZakonczenie" data-wp-auto="${isAutoActive}" style="
        grid-column:1/ -1;
        padding:0.7rem 0.9rem; border-radius:10px; cursor:pointer; transition:all 0.15s;
        border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
        background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
        ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
    ">
        <div style="display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="refresh-cw" style="width:16px; height:16px; color:${isAutoActive ? '#a78bfa' : 'var(--text-secondary)'};"></i>
            <span style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">Auto (Zakończenie DN${targetDn})</span>
        </div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem; margin-left:1.4rem;">Automatyczny dobór zakończenia dla średnicy DN${targetDn}</div>
    </div>`;

    const sectionStyle =
        'grid-column:1/ -1; font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; padding:0.6rem 0 0.1rem; border-top:1px solid rgba(255,255,255,0.06);';

    const konuses = candidates.filter((p) => p.componentType === 'konus');
    const dinPlates = candidates.filter((p) => p.componentType === 'plyta_din');
    const odcParts = candidates.filter((p) =>
        ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType)
    );

    if (konuses.length) {
        tilesHtml += `<div style="${sectionStyle}">Konus</div>`;
        konuses.forEach((p) => {
            tilesHtml += renderTile(p);
        });
        if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';
    }
    if (dinPlates.length) {
        tilesHtml += `<div style="${sectionStyle}">Płyta DIN</div>`;
        dinPlates.forEach((p) => {
            tilesHtml += renderTile(p);
        });
        if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';
    }
    if (odcParts.length) {
        tilesHtml += `<div style="${sectionStyle}">Płyta / Pierścień Odciążający</div>`;
        odcParts.forEach((p) => {
            tilesHtml += renderTile(p);
        });
    }

    showModal({
        id: 'redukcja-zak-modal',
        titleId: 'redukcja-zak-title',
        html: `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; display:flex; align-items:flex-start; gap:0.8rem;">
        <div class="flex-1">
          <h3 id="redukcja-zak-title" style="font-size:1.05rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="chevron-down" style="width:18px; height:18px;"></i> Zakończenie redukcji DN${targetDn}
          </h3>
          <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz zakończenie górne dla sekcji redukcji DN${targetDn}. Wybór elementu odciążającego automatycznie doda pierścień.</p>
        </div>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem; text-align:right;">
        <button class="btn btn-secondary" data-action="closeModal">Zamknij</button>
      </div>
    </div>`
    });
}
