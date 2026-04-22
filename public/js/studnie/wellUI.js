/* ===== WELL UI RENDERING ===== */
/* Extracted from wellManager.js - Phase 2 refactoring */

/* ===== BLOKADA OFERTY - BANER ===== */
const OFFER_LOCKED_MSG =
    '<i data-lucide="lock"></i> Ta studnia jest zablokowana — jest częścią zamówienia. Edytuj ją przez zamówienie.';
const WELL_LOCKED_MSG = '<i data-lucide="lock"></i> Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';

function renderOfferLockBanner() {
    // Usuń baner trybu zamówienia, jeśli jest obecny (nie jesteśmy w trybie zamówienia)
    const orderBanner = document.getElementById('order-mode-banner');
    if (orderBanner) orderBanner.style.display = 'none';

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        centerCol.insertBefore(lockBanner, centerCol.firstChild);
    }

    // Oblicz stan zamówień częściowych
    const well = getCurrentWell();
    const wellLocked = well && typeof isWellOrdered === 'function' && isWellOrdered(well);
    const hasAnyOrders = editingOfferIdStudnie &&
        typeof getOrdersForOffer === 'function' &&
        getOrdersForOffer(editingOfferIdStudnie).length > 0;

    if (!hasAnyOrders && !wellLocked) {
        lockBanner.style.display = 'none';
        return;
    }

    // Pokaż info o zamówieniach częściowych
    const orders = typeof getOrdersForOffer === 'function'
        ? getOrdersForOffer(editingOfferIdStudnie)
        : [];
    const progress = typeof getOfferOrderProgress === 'function'
        ? getOfferOrderProgress(editingOfferIdStudnie, wells)
        : { ordered: 0, total: wells.length, percent: 0 };

    if (wellLocked) {
        // Znajdź zamówienie, do którego należy bieżąca studnia
        const wellOrder = orders.find((ord) =>
            (ord.wells || []).some((w) => w.id === well.id)
        );

        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.7rem 1rem; margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
            border: 2px solid rgba(239,68,68,0.3);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-size:1.3rem;"><i data-lucide="lock"></i></span>
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                        STUDNIA ZABLOKOWANA
                    </div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">
                        „${well.name}" jest częścią zamówienia${wellOrder ? ' ' + (wellOrder.orderNumber || '') : ''}.
                        Edytuj ją przez zamówienie lub wybierz inną studnię.
                        <span style="color:#34d399; font-weight:700;">${progress.ordered}/${progress.total} studni zamówionych</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center;">
                ${wellOrder
                    ? `<button class="btn btn-sm" onclick="window.location.href='/studnie?order=${wellOrder.id}'" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                        <i data-lucide="package"></i> Edytuj zamówienie
                    </button>`
                    : ''
                }
            </div>
        `;
    } else {
        // Oferta ma zamówienia, ale bieżąca studnia jest wolna
        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.5rem 1rem; margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05));
            border: 1px solid rgba(16,185,129,0.25);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="font-size:1rem;"><i data-lucide="info"></i></span>
                <div style="font-size:0.7rem; color:var(--text-muted);">
                    Oferta ma <strong style="color:#34d399;">${orders.length}</strong> zamówień
                    (<strong style="color:#34d399;">${progress.ordered}/${progress.total}</strong> studni zamówionych).
                    Ta studnia jest <strong style="color:#6ee7b7;">dostępna do edycji</strong>.
                </div>
            </div>
        `;
    }
}

/* ===== PARAMETRY OGÓLNE (KAFELKI) ===== */
function setupParamTiles() {
    document.querySelectorAll('.param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        group.querySelectorAll('.param-tile').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const val = btn.getAttribute('data-val');
                const well = getCurrentWell();

                // Zawsze przełączaj wizualny stan aktywności (dla kroku 2 kreatora bez studni)
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // Jeśli studnia istnieje, zastosuj parametr + odśwież renderowanie
                if (well) {
                    well[paramName] = val;
                    enforceLoadClassRules(well, paramName);
                    updateParamTilesUI();
                    updateAutoLockUI();
                    await autoSelectComponents(true);
                    refreshAll();
                } else {
                    // Wymuś zasady klas obciążenia nawet w kreatorze (brak studni)
                    enforceLoadClassRulesWizard(paramName, val);
                }

                // Śledzenie kreatora (zawsze)
                wizardConfirmedParams.add(paramName);
                validateWizardStep2();
            });
        });
    });
}

function updateParamTilesUI() {
    const well = getCurrentWell();
    if (well) {
        // Synchronizuj kafelki z obiektem studni, gdy studnia istnieje
        document.querySelectorAll('.param-group').forEach((group) => {
            const paramName = group.getAttribute('data-param');
            const currentVal = well[paramName] || 'brak';
            group.querySelectorAll('.param-tile').forEach((btn) => {
                if (btn.getAttribute('data-val') === currentVal) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });

        // Synchronizuj pola powłok ze studni
        const powlokaWInput = document.getElementById('powloka-name-w');
        if (powlokaWInput) powlokaWInput.value = well.powlokaNameW || '';
        const powlokaZInput = document.getElementById('powloka-name-z');
        if (powlokaZInput) powlokaZInput.value = well.powlokaNameZ || '';
    }
    // Uwaga: gdy nie ma studni, kafelki zachowują swój stan wizualny z obsługi kliknięć

    // Pokaż/ukryj pola nazw powłok w zależności od bieżącego stanu kafelków (działa ze studnią lub bez niej)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        if (well) well.powlokaNameW = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        if (well) well.powlokaNameZ = '';
    }
}

/* ===== RENDEROWANIE PARAMETRÓW DLA POSZCZEGÓLNYCH STUDNI ===== */
const WELL_PARAM_DEFS = [
    {
        key: 'nadbudowa',
        label: 'Nadbudowa',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'dennicaMaterial',
        label: 'Dennica',
        options: [
            ['betonowa', 'Beton'],
            ['zelbetowa', 'Żelbet']
        ]
    },
    {
        key: 'wkladka',
        label: 'Wkładka PEHD',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'klasaBetonu',
        label: 'Klasa betonu',
        options: [
            ['C40/50', 'C40/50'],
            ['C40/50(HSR)', 'C40/50 HSR'],
            ['C45/55', 'C45/55'],
            ['C45/55(HSR)', 'C45/55 HSR'],
            ['C70/85', 'C70/85'],
            ['C70/80(HSR)', 'C70/80 HSR']
        ]
    },
    {
        key: 'agresjaChemiczna',
        label: 'Agresja chem.',
        options: [
            ['XA1', 'XA1'],
            ['XA2', 'XA2'],
            ['XA3', 'XA3']
        ]
    },
    {
        key: 'agresjaMrozowa',
        label: 'Agresja mroz.',
        options: [
            ['XF1', 'XF1'],
            ['XF2', 'XF2'],
            ['XF3', 'XF3']
        ]
    },
    {
        key: 'klasaNosnosci_korpus',
        label: 'Klasa nośności Den.+Nadb.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'klasaNosnosci_zwienczenie',
        label: 'Klasa nośności Zwieńcz.',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'malowanieW',
        label: 'Malowanie wew.',
        options: [
            ['brak', 'Brak'],
            ['kineta', 'Kineta'],
            ['kineta_dennica', 'Kineta+denn.'],
            ['cale', 'Całość']
        ]
    },
    {
        key: 'malowanieZ',
        label: 'Malowanie zew.',
        options: [
            ['brak', 'Brak'],
            ['zewnatrz', 'Zewnątrz']
        ]
    },
    {
        key: 'kineta',
        label: 'Kineta',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'PrecoTop'],
            ['unolith', 'UnoLith']
        ]
    },
    {
        key: 'spocznik',
        label: 'Spocznik',
        options: [
            ['brak', 'Brak'],
            ['beton', 'Beton'],
            ['beton_gfk', 'Beton z GFK'],
            ['klinkier', 'Klinkier'],
            ['preco', 'Preco'],
            ['precotop', 'Preco Top'],
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'redukcjaKinety',
        label: 'Red. kinety',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
        ]
    },
    {
        key: 'stopnie',
        label: 'Stopnie',
        options: [
            ['brak', 'Brak'],
            ['drabinka', 'Drabinka'],
            ['nierdzewna', 'Nierdzewna']
        ]
    },
    {
        key: 'spocznikH',
        label: 'Spocznik wys.',
        options: [
            ['1/2', '1/2'],
            ['2/3', '2/3'],
            ['3/4', '3/4'],
            ['1/1', '1/1'],
            ['brak', 'Brak']
        ]
    },
    {
        key: 'usytuowanie',
        label: 'Usytuowanie',
        options: [
            ['linia_dolna', 'Linia dolna'],
            ['linia_gorna', 'Linia górna'],
            ['w_osi', 'W osi'],
            ['patrz_uwagi', 'Patrz uwagi']
        ]
    },
    {
        key: 'uszczelka',
        label: 'Uszczelka',
        options: [
            ['brak', 'Brak'],
            ['GSG', 'GSG'],
            ['SDV', 'SDV'],
            ['SDV PO', 'SDV PO'],
            ['NBR', 'NBR']
        ]
    },
    {
        key: 'magazyn',
        label: 'Magazyn',
        options: [
            ['Kluczbork', 'Kluczbork'],
            ['Włocławek', 'Włocławek']
        ]
    }
];

function renderWellParams() {
    const container = document.getElementById('well-params-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML =
            '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Dodaj studnię aby edytować parametry</div>';
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:0.55rem;">`;

    WELL_PARAM_DEFS.forEach((def) => {
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.2rem;">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:125px; text-align:left;">${def.label}</span>`;
        html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:0.35rem; flex:1;">`;
        def.options.forEach(([val, lbl]) => {
            const isActive = val === currentVal;
            html += `<button onclick="updateWellParam('${def.key}','${val}')" style="
                height: 34px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:${isActive ? '800' : '600'};
                border:1px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
                background:${isActive ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'};
                color:${isActive ? '#a5b4fc' : 'var(--text-secondary)'};
                transition:all 0.15s ease;
                display:flex; align-items:center; justify-content:center;
                ${isActive ? 'box-shadow:0 0 10px rgba(99,102,241,0.2);' : ''}
            " onmouseenter="if(!${isActive}){this.style.borderColor='rgba(99,102,241,0.3)';this.style.background='rgba(255,255,255,0.08)'}"
               onmouseleave="if(!${isActive}){this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'}"
            >${lbl}</button>`;
        });
        html += `</div></div>`;
    });

    if (well.malowanieW && well.malowanieW !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:125px; text-align:left;">Nazwa p. wew.</span>`;
        html += `<input type="text" value="${well.powlokaNameW || ''}" onchange="updateWellParam('powlokaNameW', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:125px; text-align:left;">Koszt p. wew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onchange="updateWellParam('malowanieWewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
        html += `</div>`;
    }

    if (well.malowanieZ && well.malowanieZ !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:125px; text-align:left;">Nazwa p. zew.</span>`;
        html += `<input type="text" value="${well.powlokaNameZ || ''}" onchange="updateWellParam('powlokaNameZ', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:125px; text-align:left;">Koszt p. zew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onchange="updateWellParam('malowanieZewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
        html += `</div>`;
    }

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:1rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;"><i data-lucide="refresh-cw"></i> Przywróć domyślne (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

/* ===== AUTO-BLOKADA UI ===== */
function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '<i data-lucide="lock"></i> Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '<i data-lucide="unlock"></i> Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}

/* ===== PANEL RABATÓW ===== */
function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];
    const activeDNs = dktCap.filter((dn) => wells.some((w) => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML = '';
        return;
    }

    let grandDennica = 0,
        grandNadbudowa = 0,
        grandTotal = 0,
        grandDiscounted = 0;

    let html = `<div style="padding:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;"><i data-lucide="banknote"></i> Rabaty i podsumowanie</div>`;

    activeDNs.forEach((dn) => {
        const groupWells = wells.filter((w) => w.dn === dn);
        let dennicaBaseSum = 0,
            nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0,
            nadbudowaAfterSum = 0;
        groupWells.forEach((w) => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        grandDennica += dennicaBaseSum;
        grandNadbudowa += nadbudowaBaseSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : `DN${dn}`;

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.82rem; font-weight:700; color:#a78bfa;">${dnLabel}</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">
            <span class="ui-text-mute" style="text-align:left;">Dennica / Baza</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                id="disc-${dn}-dennica"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onfocus="this.select()"
                onchange="updateDiscount('${dn}','dennica',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute" style="text-align:left;">Nadbudowa</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                id="disc-${dn}-nadbudowa"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onfocus="this.select()"
                onchange="updateDiscount('${dn}','nadbudowa',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.4rem; padding-top:0.35rem; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.78rem; color:var(--text-muted); text-align:left;">Po rabacie:</span>
            <span style="font-size:0.82rem; font-weight:700; color:${totalAfter < totalDN ? '#34d399' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
          </div>
        </div>`;
    });

    // Suma całkowita
    const hasDiscount = grandDiscounted < grandTotal;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.2rem 0.1rem; border-top:1px solid rgba(255,255,255,0.1); margin-top:0.4rem;">
      <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">Suma całkowita</span>
      <div style="text-align:right;">
        ${hasDiscount ? `<div style="font-size:0.65rem; color:var(--text-muted); text-decoration:line-through;">${fmtInt(grandTotal)} PLN</div>` : ''}
        <div style="font-size:1rem; font-weight:700; color:#6366f1;">${fmtInt(grandDiscounted)} PLN</div>
      </div>
    </div>`;

    html += `</div>`;
    panel.innerHTML = html;
}

/** Przełącznik zakładek paska bocznego (Lista vs Rabaty) */
function switchSidebarTab(tabName) {
    const listContent = document.getElementById('sidebar-list-content');
    const discContent = document.getElementById('sidebar-discounts-content');
    const tabList = document.getElementById('stab-list');
    const tabDisc = document.getElementById('stab-discounts');

    if (!listContent || !discContent || !tabList || !tabDisc) return;

    if (tabName === 'list') {
        listContent.style.display = 'flex';
        discContent.style.display = 'none';
        tabList.classList.add('active');
        tabDisc.classList.remove('active');
    } else {
        listContent.style.display = 'none';
        discContent.style.display = 'flex';
        tabList.classList.remove('active');
        tabDisc.classList.add('active');
    }
}


function switchBuilderTab(tab) {
    const btabConcrete = document.getElementById('btab-concrete');
    const btabTransitions = document.getElementById('btab-transitions');
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    const bcontentTransitions = document.getElementById('bcontent-transitions');

    if (btabConcrete) btabConcrete.classList.toggle('active', tab === 'concrete');
    if (btabTransitions) btabTransitions.classList.toggle('active', tab === 'transitions');
    if (bcontentConcrete) bcontentConcrete.style.display = tab === 'concrete' ? 'block' : 'none';
    if (bcontentTransitions) bcontentTransitions.style.display = tab === 'transitions' ? 'block' : 'none';

    if (tab === 'transitions') {
        if (typeof renderInlinePrzejsciaApp === 'function') renderInlinePrzejsciaApp();
        if (typeof renderWellPrzejscia === 'function') renderWellPrzejscia();
    }
}

window.switchSidebarTab = switchSidebarTab;
window.switchBuilderTab = switchBuilderTab;

/* ===== RENDEROWANIE LISTY STUDNI ===== */
window.renderWellsList = function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    // Przelicz bezwzględnie wszystkie studnie z tła, aby uzyskać aktualne błędy grubości rur / luzów
    wells.forEach((w) => recalculateWellErrors(w));

    // Funkcja szybkoskanująca uchybienia studni (luzy, braki wysokości), aktualizując obiekt przed wyrysowaniem
    const validateAutomatedErrors = (well) => {
        if (!well) return false;
        let isError = false;

        // 1. Sprawdzamy wysokość
        if (well.rzednaWlazu != null && well.rzednaDna != null) {
            const req = Math.round((well.rzednaWlazu - well.rzednaDna) * 1000);
            const stats = calcWellStats(well);
            if (Math.abs(stats.height - req) > 50) isError = true;
        }

        // 2. Status 'ERROR' nakazany przez główną funkcję updateHeightIndicator lub backend OR-TOOLS
        if (
            well.configStatus === 'ERROR' ||
            (well.configErrors && well.configErrors.length > 0 && well.configStatus !== 'OK')
        ) {
            isError = true;
        }

        return isError;
    };

    const searchTerm = (document.getElementById('wells-search-input')?.value || '')
        .toLowerCase()
        .trim();

    let html = '';
    const dktCap = [1000, 1200, 1500, 2000, 2500, 'styczna'];

    // Sprawdź zmiany w zamówieniu, jeśli w trybie edycji
    let orderChanges = {};
    if (orderEditMode) {
        orderChanges = getOrderChanges({ ...orderEditMode.order, wells: wells });
    }

    dktCap.forEach((dnGroup) => {
        const groupWells = wells
            .map((w, i) => ({ w, i }))
            .filter((item) => {
                const matchesDN = item.w.dn === dnGroup;
                const matchesSearch = !searchTerm || item.w.name.toLowerCase().includes(searchTerm);
                return matchesDN && matchesSearch;
            });
        if (groupWells.length === 0) return;

        const groupTitle = dnGroup === 'styczna' ? 'Studnie Styczne' : `Studnie DN${dnGroup}`;
        html += `<div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; margin: 0.8rem 0 0.35rem 0.3rem; letter-spacing:0.8px; font-weight:800; opacity:0.7;">${groupTitle}</div>`;

        groupWells.forEach(({ w, i }) => {
            const isActive = i === currentWellIndex;
            const stats = calcWellStats(w);
            const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
            const requiredH = hasElevations
                ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000)
                : null;

            let changeStyling = '';
            let changeBadge = '';
            if (orderEditMode && orderChanges[i]) {
                const changeType = orderChanges[i].type;
                if (changeType === 'added') {
                    changeStyling =
                        'border-left: 3px solid #10b981; background: rgba(16,185,129,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#10b981; font-weight:700; margin-left:0.3rem;">[NOWA]</span>';
                } else if (changeType === 'modified') {
                    changeStyling =
                        'border-left: 3px solid #ef4444; background: rgba(239,68,68,0.05);';
                    changeBadge =
                        '<span style="font-size:0.6rem; color:#ef4444; font-weight:700; margin-left:0.3rem;">[ZMIENIONA]</span>';
                }
            }

            const statusBadge =
                w.configStatus === 'ERROR'
                    ? '<span title="Błąd konfiguracji" style="margin-left:0.3rem;"><i data-lucide="x-circle"></i></span>'
                    : w.configStatus === 'WARNING'
                      ? '<span title="' +
                        (w.configErrors || []).join('; ') +
                        '" style="margin-left:0.3rem;"><i data-lucide="alert-triangle"></i></span>'
                      : w.configStatus === 'OK'
                        ? '<span style="margin-left:0.3rem;"><i data-lucide="check-circle-2"></i></span>'
                        : '';

            // Ikona źródła konfiguracji
            let sourceBadge = '';
            if (w.configSource === 'AUTO_AI') {
                sourceBadge =
                    '<span title="Dobór Automatyczny (Serwer AI / OR-Tools)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(190deg) saturate(500%);"><i data-lucide="brain"></i></span>';
            } else if (w.configSource === 'AUTO_JS') {
                sourceBadge =
                    '<span title="Dobór Automatyczny (Skrypt JS)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);"><i data-lucide="settings"></i></span>';
            } else {
                sourceBadge =
                    '<span title="Dobór Ręczny" style="font-size:0.75rem; margin-left:0.3rem; filter: grayscale(1);"><i data-lucide="hand"></i></span>';
            }

            let errorsHtml = '';
            if (w.configErrors && w.configErrors.length > 0) {
                const color = w.configStatus === 'ERROR' ? '#ef4444' : '#f59e0b';
                errorsHtml = `<div style="font-size:0.65rem; color:${color}; padding:0.2rem 0; line-height:1.2;">${w.configErrors.join('<br>')}</div>`;
            }

            let wellLockBadge = '';
            if (isWellLocked(i)) {
                // Sprawdź, czy blokada pochodzi z zamówienia (pokaż numer zamówienia)
                const wellOrder = typeof getOrderForWellId === 'function'
                    ? getOrderForWellId(w.id, editingOfferIdStudnie)
                    : null;
                if (wellOrder && wellOrder.orderNumber) {
                    wellLockBadge = `<span title="Studnia na zamówieniu ${wellOrder.orderNumber} — kliknij aby otworzyć"
                        onclick="event.stopPropagation(); window.location.href='/studnie?order=${wellOrder.id}'"
                        style="font-size:0.55rem; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.4); padding:1px 5px; border-radius:4px; font-weight:800; margin-left:0.3rem; cursor:pointer; display:inline-flex; align-items:center; gap:2px; vertical-align:middle;">
                        <i data-lucide="package" style="width:10px; height:10px;"></i>${wellOrder.orderNumber}
                    </span>`;
                } else {
                    wellLockBadge = '<span title="Studnia zablokowana — zaakceptowane zlecenie produkcyjne" style="font-size:0.75rem; margin-left:0.3rem;"><i data-lucide="lock"></i></span>';
                }
            }

            let doplataBadge = '';
            if (w.doplata && w.doplata !== 0) {
                const isNeg = w.doplata < 0;
                const badgeLabel = isNeg ? 'UPUST' : 'DOPŁATA';
                const colorHex = isNeg ? '#ef4444' : '#10b981';
                const bgRgba = isNeg ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
                const borderRgba = isNeg ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)';
                doplataBadge = `<span title="${badgeLabel}: ${fmtInt(w.doplata)} PLN" style="font-size:0.6rem; background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius:3px; font-weight:800; margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
            }

            // Automatyczne sprawdzenie w locie dla wszystkich kart
            const hasErrors = validateAutomatedErrors(w);

            const errorStyling = hasErrors
                ? ' border:2px solid #ef4444 !important; background:rgba(239,68,68,0.15) !important;'
                : '';
            const errorNameStyle = hasErrors
                ? 'color:#ef4444 !important; font-weight:700 !important;'
                : '';
            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}${errorStyling}" onclick="selectWell(${i})">
              <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem;">
                <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}">${w.name}</div>
                <div style="display:flex; align-items:center; gap:0.15rem; flex-shrink:0;">
                   ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
                </div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})"><i data-lucide="clipboard-list"></i></button>
                  <button class="well-list-action del" title="Usuń" onclick="event.stopPropagation(); removeWell(${i})"><i data-lucide="x"></i></button>
                </div>
              </div>
              <div class="well-list-meta">
                <div style="display:flex; gap:0.6rem;">
                  <span>Elementy: <strong>${(w.config || []).length}</strong></span>
                  <span>Przejścia: <strong>${w.przejscia ? w.przejscia.length : 0}</strong></span>
                </div>
                <span class="well-list-price">${fmtInt(stats.price)} PLN</span>
              </div>
              ${
                  hasElevations
                      ? `<div class="well-list-elevations">
                <span>↑ <strong>${w.rzednaWlazu.toFixed(3)}</strong></span>
                <span>↓ <strong>${w.rzednaDna.toFixed(3)}</strong></span>
                <span style="margin-left:auto;">H=<strong>${requiredH}</strong>mm</span>
              </div>`
                      : ''
              }
            </div>`;
        });
    });

    if (wells.length === 0) {
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;

    const counter = document.getElementById('wells-counter');
    if (counter) counter.textContent = `(${wells.length})`;

    renderDiscountPanel();
}

/* ===== PODSUMOWANIE ===== */
window.updateSummary = function updateSummary() {
    const well = getCurrentWell();
    if (!well) {
        document.getElementById('sum-price').textContent = '0 PLN';
        document.getElementById('sum-weight').textContent = '0 kg';
        document.getElementById('sum-height').textContent = '0 mm';
        document.getElementById('sum-area-int').textContent = '0,00 m²';
        document.getElementById('sum-area-ext').textContent = '0,00 m²';

        const wsHeight = document.getElementById('ws-height');
        const wsReq = document.getElementById('ws-req-height');
        const wsDiff = document.getElementById('ws-diff-height');
        const wsPrice = document.getElementById('ws-price');
        if (wsHeight) wsHeight.textContent = '0 mm';
        if (wsReq) wsReq.textContent = '—';
        if (wsDiff) {
            wsDiff.textContent = '—';
            wsDiff.style.color = 'var(--text-muted)';
        }
        if (wsPrice) wsPrice.textContent = '0';

        updateHeightIndicator();
        return;
    }
    const stats = calcWellStats(well);

    // Dolny pasek
    document.getElementById('sum-price').textContent = fmtInt(stats.price) + ' PLN';
    document.getElementById('sum-weight').textContent = fmtInt(stats.weight) + ' kg';
    document.getElementById('sum-height').textContent = fmtInt(stats.height) + ' mm';
    document.getElementById('sum-area-int').textContent = fmt(stats.areaInt) + ' m²';
    document.getElementById('sum-area-ext').textContent = fmt(stats.areaExt) + ' m²';

    let reqMmText = '—';
    let diffMmText = '—';
    let diffColor = 'var(--text-muted)';

    const rzWlazu = parseFloat(well.rzednaWlazu);
    const rzDna = isNaN(parseFloat(well.rzednaDna))
        ? isNaN(rzWlazu)
            ? NaN
            : 0
        : parseFloat(well.rzednaDna);

    if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzWlazu > rzDna) {
        const reqMm = Math.round((rzWlazu - rzDna) * 1000);
        reqMmText = fmtInt(reqMm) + ' mm';
        const diff = reqMm - stats.height;

        if (diff > 0) {
            diffMmText = '-' + fmtInt(diff) + ' mm';
            diffColor = '#f87171'; // czerwony
        } else if (diff < 0) {
            diffMmText = '+' + fmtInt(Math.abs(diff)) + ' mm';
            diffColor = '#facc15'; // żółty/pomarańczowy
        } else {
            diffMmText = 'OK';
            diffColor = '#4ade80'; // zielony
        }
    }

    const wsHeight = document.getElementById('ws-height');
    const wsReq = document.getElementById('ws-req-height');
    const wsDiff = document.getElementById('ws-diff-height');
    const wsPrice = document.getElementById('ws-price');

    if (wsHeight) wsHeight.textContent = fmtInt(stats.height) + ' mm';
    if (wsReq) wsReq.textContent = reqMmText;
    if (wsDiff) {
        wsDiff.textContent = diffMmText;
        wsDiff.style.color = diffColor;
    }
    if (wsPrice) wsPrice.textContent = fmtInt(stats.price);

    // Height indicator
    updateHeightIndicator();
}
