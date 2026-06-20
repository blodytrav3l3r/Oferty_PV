// @ts-check
/* ===== WELL UI RENDERING ===== */
/* Extracted from wellManager.js - Phase 2 refactoring */

/* ===== BLOKADA OFERTY - BANER ===== */
const OFFER_LOCKED_MSG =
    '<i data-lucide="lock" aria-hidden="true"></i> Ta studnia jest zablokowana — jest częścią zamówienia. Edytuj ją przez zamówienie.';
const WELL_LOCKED_MSG = '<i data-lucide="lock" aria-hidden="true"></i> Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';

function renderOfferLockBanner() {
    // Jeśli jesteśmy w trybie zamówienia, baner blokady z oferty nie powinien się wyświetlać
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        let lockBanner = document.getElementById('offer-lock-banner');
        if (lockBanner) lockBanner.style.display = 'none';
        return;
    }

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
            padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
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
                        „${escapeHtml(well.name)}" jest częścią zamówienia${wellOrder ? ' ' + escapeHtml(wellOrder.orderNumber || '') : ''}.
                        Edytuj ją przez zamówienie lub wybierz inną studnię.
                        <span style="color:#34d399; font-weight:700;">${progress.ordered}/${progress.total} studni zamówionych</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center;">
                ${wellOrder
                    ? `<button class="btn btn-sm" onclick="window.location.href='studnie.html?order=${wellOrder.id}'" style="height:48px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.75rem; font-weight:700; padding:0 1rem; display:flex; align-items:center; gap:0.4rem;">
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
            padding:0.5rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
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
    const wizardRoot = document.getElementById('wizard-step-2');
    if (!wizardRoot) return;

    wizardRoot.querySelectorAll('.param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        group.querySelectorAll('.param-tile').forEach((btn) => {
            if (btn.dataset.listenerBound === 'true') return;
            btn.dataset.listenerBound = 'true';
            btn.addEventListener('click', async () => {
                const val = btn.getAttribute('data-val');
                // Zawsze przełączaj wizualny stan aktywności (dla kroku 2 kreatora bez studni)
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // Domyślne "Nie" dla wkładki na całą wysokość przy wyborze PRECO
                if (paramName === 'kineta' && (val === 'preco' || val === 'precotop')) {
                    const precoHeightGroup = wizardRoot.querySelector('.param-group[data-param="precoFullHeight"]');
                    if (precoHeightGroup && !precoHeightGroup.querySelector('.param-tile.active')) {
                        const nieBtn = precoHeightGroup.querySelector('.param-tile[data-val="nie"]');
                        if (nieBtn) {
                            nieBtn.click();
                        }
                    }
                }

                // Automatyczne dopasowanie spocznika do kinety (jeśli ma ten sam materiał)
                if (paramName === 'kineta') {
                    const spocznikGroup = wizardRoot.querySelector('.param-group[data-param="spocznik"]');
                    if (spocznikGroup) {
                        const syncValues = ['beton', 'beton_gfk', 'klinkier', 'preco', 'precotop', 'unolith', 'predl', 'kamionka', 'brak'];
                        if (syncValues.includes(val)) {
                            const targetBtn = spocznikGroup.querySelector(`.param-tile[data-val="${val}"]`);
                            if (targetBtn && !targetBtn.classList.contains('active')) {
                                targetBtn.click();
                            }
                        }
                    }

                    // PRECO / PrecoTop → wymuszenie spocznikH = '1/1'
                    if (val === 'preco' || val === 'precotop') {
                        const spocznikHGroup = wizardRoot.querySelector('.param-group[data-param="spocznikH"]');
                        if (spocznikHGroup) {
                            const hBtn = spocznikHGroup.querySelector('.param-tile[data-val="1/1"]');
                            if (hBtn && !hBtn.classList.contains('active')) {
                                hBtn.click();
                            }
                        }
                    }
                }

                enforceLoadClassRulesWizard(paramName, val);
                updateParamTilesUI();

                // Śledzenie kreatora (zawsze)
                wizardConfirmedParams.add(paramName);
                validateWizardStep2();
            });
        });
    });
}

function updateParamTilesUI() {
    // Kafelki w kroku 2 zachowuja wlasny stan. Nie synchronizujemy ich z aktualnie
    // edytowana studnia, zeby zmiana jednej studni nie zmieniala parametrow ogolnych.

    // Pokaż/ukryj pola nazw powłok w zależności od bieżącego stanu kafelków (działa ze studnią lub bez niej)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');
    const kinetaVal = getActiveTileValue('kineta');

    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Pokaz/ukryj grupe parametrow precoFullHeight na podstawie kinety
    const precoGroupWizard = document.getElementById('preco-full-height-wizard-group');
    if (precoGroupWizard) {
        precoGroupWizard.style.display = (kinetaVal === 'preco' || kinetaVal === 'precotop') ? 'flex' : 'none';
    }
    document.querySelectorAll('.param-group[data-param="precoFullHeight"]').forEach(el => {
        const wrapper = el.closest('.wizard-param-group') || el.parentElement;
        if (wrapper && !wrapper.id) { // Not the wizard one, it's the individual well one
             wrapper.style.display = (kinetaVal === 'preco' || kinetaVal === 'precotop') ? 'block' : 'none';
        }
    });

    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
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
        key: 'wkladkaDennica',
        label: 'Wkładka PEHD (Dennica)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaNadbudowa',
        label: 'Wkładka PEHD (Nadb.)',
        options: [
            ['brak', 'Brak'],
            ['3mm', '3mm'],
            ['4mm', '4mm']
        ]
    },
    {
        key: 'wkladkaZwienczenie',
        label: 'Wkładka PEHD (Zwieńcz.)',
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
            ['unolith', 'UnoLith'],
            ['predl', 'Predl'],
            ['kamionka', 'Kamionka']
        ]
    },
    {
        key: 'precoFullHeight',
        label: 'Wkładka cała wys.',
        options: [
            ['tak', 'Tak'],
            ['nie', 'Nie']
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
    },
    {
        key: 'wkladkaOsadnikPreco',
        label: 'Wkładka PRECO osadnik',
        options: [
            ['brak', 'Brak'],
            ['tak', 'Tak']
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

    const isOsadnik = typeof isSettlingWell === 'function' && isSettlingWell(well);

    WELL_PARAM_DEFS.forEach((def) => {
        if (def.key === 'precoFullHeight') {
            if (well.kineta !== 'preco' && well.kineta !== 'precotop') {
                return;
            }
        }
        // Wkładka PRECO osadnik — wyszarzona jeśli to nie osadnik
        let isGreyedOut = false;
        if (def.key === 'wkladkaOsadnikPreco' && !isOsadnik) {
            isGreyedOut = true;
        }
        // Gdy kineta = preco/precotop → spocznikH zablokowany na 1/1
        if (def.key === 'spocznikH' && (well.kineta === 'preco' || well.kineta === 'precotop')) {
            isGreyedOut = true;
        }
        // Gdy wkładka osadnikowa aktywna — kineta i spocznik zablokowane na 'brak'
        if (well.wkladkaOsadnikPreco === 'tak') {
            if (def.key === 'kineta' || def.key === 'spocznik') {
                return; // ukryj — wymuszamy 'brak'
            }
        }
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.2rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
        html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">${def.label}</span>`;
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

        // Pola dodatkowe renderowane bezpośrednio pod odpowiadającym kafelkiem
        if (def.key === 'malowanieW' && well.malowanieW && well.malowanieW !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. wew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameW || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameW', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. wew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieWewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'malowanieZ' && well.malowanieZ && well.malowanieZ !== 'brak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Nazwa p. zew.</span>`;
            html += `<input type="text" value="${escapeHtml(well.powlokaNameZ || '')}" onclick="this.select()" onchange="updateWellParam('powlokaNameZ', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:260px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem;">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Koszt p. zew.</span>`;
            html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onclick="this.select()" onchange="updateWellParam('malowanieZewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:100px; height:36px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `</div>`;
        }

        if (def.key === 'wkladkaOsadnikPreco' && well.wkladkaOsadnikPreco === 'tak') {
            html += `<div style="display:flex; align-items:center; gap:0.2rem; min-height:32px; margin-top:0.3rem; ${isGreyedOut ? 'opacity: 0.5;' : ''}">`;
            html += `<span style="font-size:0.85rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:185px; text-align:left;">Wys. wkładki osadnik</span>`;
            html += `<div style="display:flex; align-items:center; gap:0.5rem;">`;
            html += `<input type="number" value="${well.wkladkaOsadnikH || ''}" onclick="this.select()" onchange="updateWellParam('wkladkaOsadnikH', parseFloat(this.value)||0)" placeholder="Wys. w mm" style="width:120px; height:34px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0 0.7rem; font-size:0.85rem; border-radius:6px;">`;
            html += `<span style="font-size:0.8rem; color:var(--text-muted);">mm</span>`;
            html += `</div></div>`;
        }
    });

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:1rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przywróć domyślne (Krok 2)</button>`;
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
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;"><i data-lucide="banknote" aria-hidden="true"></i> Rabaty i podsumowanie</div>`;

    activeDNs.forEach((dn) => {
        const groupWells = wells.filter((w) => w.dn === dn);
        // Mapowanie dn na klucz rabatów (styczna -> styczne)
        const discountDn = dn === 'styczna' ? 'styczne' : dn;
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

        const disc = wellDiscounts[discountDn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        grandDennica += dennicaBaseSum;
        grandNadbudowa += nadbudowaBaseSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        const dnLabel = dn === 'styczna' ? 'Studnia Styczna' : `DN${dn}`;
        const hasPrecoInGroup = groupWells.some(w => w.kineta === 'preco' || w.kineta === 'precotop');

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.82rem; font-weight:700; color:#a78bfa;">${dnLabel}</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">
            <span class="ui-text-mute" class="text-left">Dennica / Baza</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                id="disc-${discountDn}-dennica"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','dennica',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            <span class="ui-text-mute" class="text-left">Nadbudowa</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                id="disc-${discountDn}-nadbudowa"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:5px; color:#fff;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','nadbudowa',this.value)">
              <span class="ui-text-mute">%</span>
            </div>
            ${hasPrecoInGroup ? `<span class="ui-text-mute" style="text-align:left; color:#ef4444;">Wkładka PRECO</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.preco || 0}"
                id="disc-${discountDn}-preco"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:5px; color:#ef4444;"
                onclick="this.select()"
                onchange="updateDiscount('${discountDn}','preco',this.value)">
              <span class="ui-text-mute" style="color:#ef4444;">%</span>
            </div>` : ''}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.4rem; padding-top:0.35rem; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.78rem; color:var(--text-muted); text-align:left;">Po rabacie:</span>
            <span style="font-size:0.82rem; font-weight:700; color:${totalAfter < totalDN ? '#34d399' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
          </div>
        </div>`;
    });

    // Sekcja wkładki PEHD (globalna dla wszystkich studni)
    const anyPehd = wells.some(w => (w.wkladkaDennica && w.wkladkaDennica !== 'brak') || (w.wkladkaNadbudowa && w.wkladkaNadbudowa !== 'brak') || (w.wkladkaZwienczenie && w.wkladkaZwienczenie !== 'brak'));
    if (anyPehd) {
        const pehdDiscountValue = (wells[0] && wells[0].pehdDiscount) ? wells[0].pehdDiscount : 0;
        let currentPehdPrice = 0;
        for (const p of studnieProducts) {
            if (p.area > 0 && p.doplataPEHD > 0 && p.componentType !== 'przejscie' && p.componentType !== 'kineta') {
                currentPehdPrice = Math.round(p.doplataPEHD / p.area);
                break;
            }
        }
        const currentPehdPriceAfter = currentPehdPrice * (1 - pehdDiscountValue / 100);

        html += `<div style="background:rgba(14,165,233,0.06); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(14,165,233,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                <span style="font-size:0.82rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.3rem;"><i data-lucide="shield" style="width:14px; height:14px;"></i> Wkładka PEHD</span>
                <span style="font-size:0.65rem; color:var(--text-muted);">(Bazowo: ${currentPehdPrice} PLN/m²)</span>
            </div>
            <div style="text-align:right;">
                <span style="font-size:0.85rem; color:#38bdf8; font-weight:800; white-space:nowrap;" id="sidebar-pehd-price-after">${currentPehdPriceAfter.toFixed(2)} PLN/m²</span>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">
            <span class="ui-text-mute" class="text-left">Globalny Rabat</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="1" value="${pehdDiscountValue}"
                id="disc-global-pehd"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.3); border-radius:5px; color:#38bdf8;"
                onclick="this.select()"
                onchange="updateGlobalPehdDiscount(this.value)">
              <span class="ui-text-mute" style="color:#38bdf8;">%</span>
            </div>
          </div>
        </div>`;
    }

    // Sekcja kosztów malowania (globalna dla wszystkich studni)
    const anyMalowanieW = wells.some(w => w.malowanieW && w.malowanieW !== 'brak');
    const anyMalowanieZ = wells.some(w => w.malowanieZ && w.malowanieZ !== 'brak');

    if (anyMalowanieW || anyMalowanieZ) {
        const refWell = wells[0] || {};
        const malWCena = refWell.malowanieWewCena || '';
        const malZCena = refWell.malowanieZewCena || '';

        html += `<div style="background:rgba(168,85,247,0.06); border-radius:10px; padding:0.6rem 0.65rem; margin-bottom:0.4rem; border:1px solid rgba(168,85,247,0.15);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
            <span style="font-size:0.82rem; font-weight:700; color:#c084fc;"><i data-lucide="paintbrush" aria-hidden="true"></i> Koszt malowania</span>
            <span style="font-size:0.6rem; color:var(--text-muted);">PLN / m²</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto; gap:0.25rem 0.45rem; font-size:0.78rem; align-items:center;">`;

        if (anyMalowanieW) {
            html += `<span class="ui-text-mute" class="text-left">Wewnętrzne</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="0.01" value="${malWCena}"
                id="disc-mal-wew-cena"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:5px; color:#c084fc;"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieWewCena', this.value)">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        if (anyMalowanieZ) {
            html += `<span class="ui-text-mute" class="text-left">Zewnętrzne</span>
            <div style="display:flex; align-items:center; gap:0.2rem;">
              <input type="number" min="0" step="0.01" value="${malZCena}"
                id="disc-mal-zew-cena"
                style="width:90px; padding:3px 6px; font-size:0.78rem; text-align:center; background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.3); border-radius:5px; color:#c084fc;"
                onclick="this.select()"
                onchange="updateGlobalPaintingCost('malowanieZewCena', this.value)">
              <span class="ui-text-mute" style="color:#c084fc;">zł</span>
            </div>`;
        }

        html += `</div>
        </div>`;
    }

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
        const przejsciaContainer = document.getElementById('inline-przejscia-app-container');
        const przejsciaIcon = document.getElementById('przejscia-app-icon');
        if (przejsciaContainer && przejsciaContainer.style.display === 'none') {
            przejsciaContainer.style.display = 'block';
            if (przejsciaIcon) przejsciaIcon.innerHTML = '<span class="text-xs"><i data-lucide="chevron-up"></i></span>';
            if (window.lucide) window.lucide.createIcons({ root: przejsciaIcon });
        }
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
            if (stats.height - req > 20 || req - stats.height > 100) isError = true;
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

    // Oblicz mapę transportu dla wszystkich studni (proporcjonalnie do wagi)
    let transportMap = new Map();
    if (typeof calculateWellTransportMap === 'function') {
        const result = calculateWellTransportMap(wells);
        transportMap = result.map;
    }

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
                w.configStatus === 'LOADING'
                    ? '<span title="Trwa auto-dobór..." style="margin-left:0.3rem;"><span class="loading-spinner-inline"></span></span>'
                    : w.configStatus === 'ERROR'
                      ? '<span title="Błąd konfiguracji" style="margin-left:0.3rem;"><i data-lucide="x-circle"></i></span>'
                      : w.configStatus === 'WARNING'
                        ? '<span title="' +
                          (w.configErrors || []).map(e => escapeHtml(e)).join('; ') +
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
                errorsHtml = `<div style="font-size:0.65rem; color:${color}; padding:0.2rem 0; line-height:1.2;">${w.configErrors.map(e => escapeHtml(e)).join('<br>')}</div>`;
            }

            let wellLockBadge = '';
            if (isWellLocked(i)) {
                // Sprawdź, czy blokada pochodzi z zamówienia (pokaż numer zamówienia)
                const wellOrder = typeof getOrderForWellId === 'function'
                    ? getOrderForWellId(w.id, editingOfferIdStudnie)
                    : null;
                if (wellOrder && wellOrder.orderNumber) {
                    wellLockBadge = `<span title="Studnia na zamówieniu ${wellOrder.orderNumber} — kliknij aby otworzyć"
                        onclick="event.stopPropagation(); window.location.href='studnie.html?order=${wellOrder.id}'"
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
                doplataBadge = `<span title="${badgeLabel}: ${fmt(w.doplata)} PLN" style="font-size:0.6rem; background:${bgRgba}; color:${colorHex}; border:1px solid ${borderRgba}; padding:1px 4px; border-radius:3px; font-weight:800; margin-left:0.3rem; vertical-align:middle;">${badgeLabel}</span>`;
            }

            // Automatyczne sprawdzenie w locie dla wszystkich kart
            const hasErrors = validateAutomatedErrors(w);

            const errorStyling = hasErrors
                ? ' border:2px solid #ef4444 !important; background:rgba(239,68,68,0.15) !important;'
                : '';
            const errorNameStyle = hasErrors
                ? 'color:#ef4444 !important; font-weight:700 !important;'
                : '';
            
            const hasBadges = wellLockBadge || sourceBadge || statusBadge || changeBadge || doplataBadge;
            const badgesHtml = hasBadges ? `
              <div style="display:flex; align-items:center; gap:0.15rem; flex-wrap:wrap; margin-bottom:0.3rem; margin-top:-0.1rem;">
                 ${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}${doplataBadge}
              </div>` : '';

            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}${errorStyling}" onclick="selectWell(${i})">
              <div class="well-list-header" style="display:flex; align-items:center; gap:0.4rem; ${hasBadges ? 'margin-bottom:0.2rem;' : ''}">
                <div class="well-list-name" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${errorNameStyle}" title="${escapeHtml(w.name)}">${escapeHtml(w.name)}</div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Duplikuj" aria-label="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})"><i data-lucide="clipboard-list" aria-hidden="true"></i></button>
                  <button class="well-list-action del" title="Usuń" aria-label="Usuń" onclick="event.stopPropagation(); removeWell(${i})"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
              </div>
              ${badgesHtml}
              <div class="well-list-meta">
                <div style="display:flex; gap:0.6rem;">
                  <span>Elementy: <strong>${(w.config || []).length}</strong></span>
                  <span>Przejścia: <strong>${w.przejscia ? w.przejscia.length : 0}</strong></span>
                </div>
                <span class="well-list-price">${fmtInt(stats.price + (transportMap.get(w) || 0))} PLN</span>
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
        const el = (id) => document.getElementById(id);
        const sp = el('sum-price');
        const sw = el('sum-weight');
        const sh = el('sum-height');
        const sai = el('sum-area-int');
        const sae = el('sum-area-ext');
        if (sp) sp.textContent = '0 PLN';
        if (sw) sw.textContent = '0 kg';
        if (sh) sh.textContent = '0 mm';
        if (sai) sai.textContent = '0,00 m²';
        if (sae) sae.textContent = '0,00 m²';

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

    let wellTransportCost = 0;
    if (typeof calculateOfferTotals === 'function') {
        const totals = calculateOfferTotals();
        if (totals && totals.globalWeight > 0 && totals.totalTransportCost > 0) {
            wellTransportCost = totals.totalTransportCost * (stats.weight / totals.globalWeight);
        }
    }
    const finalPrice = stats.price + wellTransportCost;

    // Dolny pasek
    const priceEl = document.getElementById('sum-price');
    if (stats.error) {
        if (priceEl) {
            priceEl.textContent = 'BŁĄD';
            priceEl.style.color = 'var(--danger, #ef4444)';
        }
    } else {
        if (priceEl) {
            priceEl.textContent = fmt(finalPrice) + ' PLN';
            priceEl.style.color = '';
        }
    }

    const swEl = document.getElementById('sum-weight');
    const shEl = document.getElementById('sum-height');
    const saiEl = document.getElementById('sum-area-int');
    const saeEl = document.getElementById('sum-area-ext');
    if (swEl) swEl.textContent = fmtInt(stats.weight) + ' kg';
    if (shEl) shEl.textContent = fmtInt(stats.height) + ' mm';
    if (saiEl) saiEl.textContent = fmt(stats.areaInt) + ' m²';
    if (saeEl) saeEl.textContent = fmt(stats.areaExt) + ' m²';

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
    if (wsPrice) {
        if (stats.error) {
            wsPrice.textContent = 'BŁĄD';
            wsPrice.style.color = 'var(--danger, #ef4444)';
        } else {
            wsPrice.textContent = fmt(finalPrice);
            wsPrice.style.color = '';
        }
    }

    // Height indicator
    updateHeightIndicator();

    // Odśwież panel boczny z cenami studni (aby cena była zawsze aktualna)
    // Guard: pomijaj jeśli renderWellsList jest już w trakcie (np. z refreshAll)
    if (typeof renderWellsList === 'function' && !window._renderingWellsList) {
        window._renderingWellsList = true;
        renderWellsList();
        window._renderingWellsList = false;
    }
}
