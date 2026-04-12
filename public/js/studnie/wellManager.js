/* ===== ZARZĄDZANIE STUDNIAMI ===== */

/** Odczytuje parametry globalne z kroku 2 kreatora z kafelków UI */
function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladka: 'brak',
        klasaBetonu: 'C40/50',
        agresjaChemiczna: 'XA1',
        agresjaMrozowa: 'XF1',
        klasaNosnosci_korpus: 'D400',
        klasaNosnosci_zwienczenie: 'D400',
        malowanieW: 'brak',
        malowanieZ: 'brak',
        powlokaNameW: '',
        powlokaNameZ: '',
        kineta: 'brak',
        spocznik: 'brak',
        redukcjaKinety: 'nie',
        stopnie: 'brak',
        spocznikH: '1/2',
        usytuowanie: 'w_osi',
        uszczelka: 'GSG',
        magazyn: 'Kluczbork'
    };
    // Odczytaj potwierdzone wybory z kafelków parametrów kreatora
    document.querySelectorAll('#wizard-step-2 .param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        if (!paramName) return;
        const activeBtn = group.querySelector('.param-tile.active');
        if (activeBtn) {
            params[paramName] = activeBtn.getAttribute('data-val');
        }
    });
    // Odczytaj pola tekstowe
    const pwW = document.getElementById('powloka-name-w');
    if (pwW) params.powlokaNameW = pwW.value || '';
    const pwZ = document.getElementById('powloka-name-z');
    if (pwZ) params.powlokaNameZ = pwZ.value || '';
    const mccW = document.getElementById('malowanie-wew-cena');
    if (mccW) params.malowanieWewCena = parseFloat(mccW.value) || 0;
    const mccZ = document.getElementById('malowanie-zew-cena');
    if (mccZ) params.malowanieZewCena = parseFloat(mccZ.value) || 0;
    return params;
}

function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    const defaultName =
        dn === 'styczna'
            ? 'Studnia Styczna (#' + wellCounter + ')'
            : 'Studnia DN' + dn + ' (#' + wellCounter + ')';
    return {
        id: 'well-' + Date.now() + '-' + wellCounter,
        name: name || defaultName,
        dn: dn,
        config: [],
        przejscia: [],
        doplata: 0,
        rzednaWlazu: null,
        rzednaDna: null,
        numer: '',
        autoLocked: false,
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladka: gp.wkladka,
        klasaBetonu: gp.klasaBetonu,
        agresjaChemiczna: gp.agresjaChemiczna,
        agresjaMrozowa: gp.agresjaMrozowa,
        klasaNosnosci_korpus: gp.klasaNosnosci_korpus,
        klasaNosnosci_zwienczenie: gp.klasaNosnosci_zwienczenie,
        malowanieW: gp.malowanieW,
        malowanieZ: gp.malowanieZ,
        powlokaNameW: gp.powlokaNameW,
        powlokaNameZ: gp.powlokaNameZ,
        malowanieWewCena: gp.malowanieWewCena,
        malowanieZewCena: gp.malowanieZewCena,
        kineta: gp.kineta,
        spocznik: gp.spocznik,
        redukcjaKinety: gp.redukcjaKinety,
        stopnie: gp.stopnie,
        spocznikH: gp.spocznikH,
        usytuowanie: gp.usytuowanie,
        uszczelka: gp.uszczelka,
        magazyn: gp.magazyn
    };
}

/* ===== BLOKADA OFERTY (po utworzeniu zamówienia) ===== */
const OFFER_LOCKED_MSG =
    '🔒 Oferta zablokowana — posiada zamówienie. Edytuj zamówienie zamiast oferty.';
const WELL_LOCKED_MSG = '🔒 Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';
function isOfferLocked() {
    if (orderEditMode) return false; // Tryb edycji zamówienia jest zawsze dozwolony
    if (!editingOfferIdStudnie) return false;
    const offer = offersStudnie.find((o) => o.id === editingOfferIdStudnie);
    if (!offer) return false;
    return !!(
        offer.hasOrder ||
        (ordersStudnie && ordersStudnie.some((ord) => ord.offerId === offer.id))
    );
}

function isWellLocked(wellIdx) {
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;
    return (
        typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
    ).some((po) => po.wellId === well.id && po.status === 'accepted');
}

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

    if (!isOfferLocked()) {
        lockBanner.style.display = 'none';
        return;
    }

    const order = ordersStudnie
        ? ordersStudnie.find((o) => o.offerId === editingOfferIdStudnie)
        : null;
    const orderId = order ? order.id : '';

    lockBanner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-bottom:0.6rem; border-radius:10px;
        background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
        border: 2px solid rgba(239,68,68,0.3);
    `;

    lockBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;">🔒</span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                    OFERTA ZABLOKOWANA
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    Ta oferta posiada zamówienie — edycja jest zablokowana. Zmiany wprowadzaj na zamówieniu.
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
            ${
                orderId
                    ? `<button class="btn btn-sm" onclick="window.location.href='/studnie?order=${orderId}'" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                📦 Edytuj zamówienie
            </button>`
                    : ''
            }
        </div>
    `;
}

function addNewWell(dn = 1000) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (dn === 'styczna') {
        showStycznaPopup('add');
        return;
    }
    const well = createNewWell(null, dn);
    wells.push(well);
    currentWellIndex = wells.length - 1;
    // Automatycznie przełącz zakładkę kreatora
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
        switchBuilderTab('concrete');
    }
    refreshAll();
    showToast(`Dodano: ${well.name}`, 'success');
}

function duplicateWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'well-' + Date.now() + '-' + wellCounter;
    copy.name = src.name + ' (kopia)';
    wells.splice(index + 1, 0, copy);
    currentWellIndex = index + 1;
    refreshAll();
    showToast(`Skopiowano: ${copy.name}`, 'success');
}

async function removeWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked(index)) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    if (
        !(await appConfirm(`Usunąć "${wells[index].name}"?`, {
            title: 'Usuwanie studni',
            type: 'danger'
        }))
    )
        return;
    wells.splice(index, 1);
    if (currentWellIndex >= wells.length) currentWellIndex = Math.max(0, wells.length - 1);
    refreshAll();
    showToast('Studnia usunięta', 'info');
}

function selectWell(index) {
    if (index < 0 || index >= wells.length) return;
    currentWellIndex = index;
    refreshAll();
}

function renameWell(index) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.name = name.trim();
        renderWellsList();
        renderOfferSummary();
    }
}

function getCurrentWell() {
    if (wells.length === 0) return null;
    return wells[currentWellIndex] || wells[0];
}

function syncGaskets(well) {
    if (!well || !well.config) return;

    // Wyfiltruj istniejące uszczelki
    const newConfig = well.config.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'uszczelka');
    });

    if (well.uszczelka && well.uszczelka !== 'brak') {
        const uType = well.uszczelka;
        const requiredGaskets = {};

        // Znajdź indeks najniższej dennicy
        let bottomDennicaIndex = -1;
        for (let i = newConfig.length - 1; i >= 0; i--) {
            const p = studnieProducts.find((pr) => pr.id === newConfig[i].productId);
            if (p && p.componentType === 'dennica') {
                bottomDennicaIndex = i;
                break;
            }
        }

        // Znajdź elementy wymagające uszczelki
        newConfig.forEach((item, index) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (
                p &&
                ['krag', 'krag_ot', 'plyta_din', 'plyta_redukcyjna', 'konus'].includes(
                    p.componentType
                )
            ) {
                if (p.dn) {
                    requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                }
            } else if (p && p.componentType === 'dennica') {
                if (p.dn) {
                    if (index === bottomDennicaIndex) {
                        // Denica konstrukcyjne dno potrzebuje uszczelki tylko gdy ilość > 1
                        if (item.quantity > 1) {
                            requiredGaskets[p.dn] =
                                (requiredGaskets[p.dn] || 0) + (item.quantity - 1);
                        }
                    } else {
                        // Wszystkie pozostałe dennice potrzebują uszczelek dla siebie
                        requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                    }
                }
            }
        });

        // Dodaj odpowiednie uszczelki
        for (const dn in requiredGaskets) {
            const qty = requiredGaskets[dn];
            let gasketName = `Uszczelka GSG DN${dn}`;
            if (uType === 'GSG') gasketName = `Uszczelka GSG DN${dn}`;
            else if (uType === 'SDV') gasketName = `Uszczelka SDV DN${dn}`;
            else if (uType === 'SDV PO')
                gasketName = `Uszczelka SDV DN${dn} SDV z pierścieniem odciążającym`;
            else if (uType === 'NBR') gasketName = `Uszczelka GSG DN${dn} z NBR`;

            const gasketProd = studnieProducts.find(
                (p) => p.componentType === 'uszczelka' && p.name === gasketName
            );
            if (gasketProd) {
                newConfig.push({
                    productId: gasketProd.id,
                    quantity: qty,
                    autoAdded: true
                });
            }
        }
    }

    well.config = newConfig;
}

function syncKineta(well) {
    if (!well || !well.config) return;

    // Wyfiltruj istniejącą kinetę
    const newConfig = well.config.filter((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return !(p && p.componentType === 'kineta');
    });

    const hasDennica = (well.config || []).some((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        return p && p.componentType === 'dennica';
    });

    if (hasDennica && well.spocznikH && well.spocznikH !== 'brak') {
        const kinetaProd = studnieProducts.find(
            (p) =>
                p.componentType === 'kineta' &&
                parseInt(p.dn) === parseInt(well.dn) &&
                p.spocznikH === well.spocznikH
        );
        if (kinetaProd) {
            newConfig.push({
                productId: kinetaProd.id,
                quantity: 1,
                autoAdded: true
            });
        }
    }

    well.config = newConfig;
}

function refreshAll() {
    const well = getCurrentWell();
    if (well) {
        syncGaskets(well);
        syncKineta(well);
    }

    renderWellsList();
    renderTiles();
    renderWellConfig();
    renderWellPrzejscia();
    renderWellDiagram();
    updateSummary();
    updateDNButtons();
    syncElevationInputs();
    updateAutoLockUI();
    updateZakonczenieButton();
    updateRedukcjaButton();
    updateParamTilesUI();
    renderWellParams();
    renderOfferSummary();
    if (orderEditMode) renderOrderModeBanner();
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
            ['C40/50(HSR!!!!)', 'C40/50(HSR)'],
            ['C45/55', 'C45/55'],
            ['C45/55(HSR!!!!)', 'C45/55(HSR)'],
            ['C70/85', 'C70/85'],
            ['C70/80(HSR!!!!)', 'C70/80(HSR)']
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
        label: 'Kl. nośn. Den+Nadb',
        options: [
            ['D400', 'D400'],
            ['E600', 'E600'],
            ['F900', 'F900']
        ]
    },
    {
        key: 'klasaNosnosci_zwienczenie',
        label: 'Kl. nośn. Zwieńcz.',
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
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.8rem; padding:0.4rem 0.8rem; border-radius:8px;">🔄 Przywróć domyślne (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

async function updateWellParam(paramKey, value) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    well[paramKey] = value;
    
    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramKey === 'malowanieWewCena' || paramKey === 'malowanieZewCena') {
        wells.forEach(w => {
            w[paramKey] = value;
        });
        showToast('Zaktualizowano cenę malowania we wszystkich studniach', 'info');
    }

    enforceLoadClassRules(well, paramKey);
    renderWellParams();
    updateParamTilesUI();
    updateAutoLockUI();

    if (typeof updateConfigToMatchParams === 'function') {
        updateConfigToMatchParams(well);
    } else {
        await autoSelectComponents(true);
    }

    refreshAll();
}

function resetWellParamsToDefaults() {
    const well = getCurrentWell();
    if (!well) return;
    const gp = getWizardGlobalParams();
    WELL_PARAM_DEFS.forEach((def) => {
        if (gp[def.key] !== undefined) well[def.key] = gp[def.key];
    });
    // Zresetuj również nazwy powłok
    well.powlokaNameW = gp.powlokaNameW || '';
    well.powlokaNameZ = gp.powlokaNameZ || '';
    renderWellParams();
    updateParamTilesUI();
    showToast('Parametry studni zresetowane do domyślnych z Kroku 2', 'success');
}

window.updateWellParam = updateWellParam;
window.resetWellParamsToDefaults = resetWellParamsToDefaults;

/**
 * Wymuś zasady klas obciążenia na obiekcie studni:
 * - E600 lub F900 dla korpusu (Dennica + Nadbudowa) → dennica musi być żelbetowa
 */
function enforceLoadClassRules(well, changedParam) {
    if (!well) return;
    if (changedParam === 'klasaNosnosci_korpus') {
        const korpus = well.klasaNosnosci_korpus;
        if (korpus === 'E600' || korpus === 'F900') {
            let changed = false;
            if (well.dennicaMaterial !== 'zelbetowa') {
                well.dennicaMaterial = 'zelbetowa';
                changed = true;
            }
            if (well.nadbudowa !== 'zelbetowa') {
                well.nadbudowa = 'zelbetowa';
                changed = true;
            }
            if (changed) {
                showToast(`Klasa ${korpus}: Dennica i Nadbudowa ustawione na Żelbet`, 'info');
            }
        }
    }
    // Gdy użytkownik próbuje zmienić dennicę lub nadbudowę na beton przy aktywnej ciężkiej klasie obciążenia
    if (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') {
        const korpus = well.klasaNosnosci_korpus;
        if ((korpus === 'E600' || korpus === 'F900') && well[changedParam] !== 'zelbetowa') {
            well[changedParam] = 'zelbetowa';
            const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
            showToast(`Klasa ${korpus}: ${name} musi być Żelbet!`, 'error');
        }
    }
}

/**
 * Wymuś zasady klas obciążenia w trybie kreatora (brak studni, tylko kafelki DOM).
 */
function enforceLoadClassRulesWizard(changedParam, value) {
    if (changedParam === 'klasaNosnosci_korpus') {
        if (value === 'E600' || value === 'F900') {
            let changed = false;
            const setZelbet = (param) => {
                const group = document.querySelector(`.param-group[data-param="${param}"]`);
                if (group) {
                    const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                    if (zelbetBtn && !zelbetBtn.classList.contains('active')) {
                        group
                            .querySelectorAll('.param-tile')
                            .forEach((b) => b.classList.remove('active'));
                        zelbetBtn.classList.add('active');
                        wizardConfirmedParams.add(param);
                        changed = true;
                    }
                }
            };
            setZelbet('dennicaMaterial');
            setZelbet('nadbudowa');
            if (changed) {
                showToast(
                    `Klasa ${value}: Dennica i Nadbudowa ustawione na Żelbet (wymagane)`,
                    'info'
                );
            }
        }
    }
    if (
        (changedParam === 'dennicaMaterial' || changedParam === 'nadbudowa') &&
        value !== 'zelbetowa'
    ) {
        const korpusVal = getActiveTileValue('klasaNosnosci_korpus');
        if (korpusVal === 'E600' || korpusVal === 'F900') {
            const group = document.querySelector(`.param-group[data-param="${changedParam}"]`);
            if (group) {
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                const zelbetBtn = group.querySelector('[data-val="zelbetowa"]');
                if (zelbetBtn) zelbetBtn.classList.add('active');
                const name = changedParam === 'dennicaMaterial' ? 'Dennica' : 'Nadbudowa';
                showToast(`Klasa ${korpusVal}: ${name} musi być Żelbet!`, 'error');
            }
        }
    }
}

async function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;
    
    // Zastosuj cenę malowania dla wszystkich studni w ofercie
    if (paramName === 'malowanieWewCena' || paramName === 'malowanieZewCena') {
        wells.forEach(w => {
            w[paramName] = value;
        });
    }

    updateAutoLockUI();
    await autoSelectComponents(true);
    refreshAll();
}

/* ===== AUTO-BLOKADA (TRYB RĘCZNY) ===== */
function toggleAutoLock() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    well.autoLocked = !well.autoLocked;
    updateAutoLockUI();
}

function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '🔓 Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '🔒 Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // bursztynowy/czerwony
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '🔓 Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}

/* ===== PANEL RABATÓW ===== */
let appConfirmCallback = null;

function handleAppConfirm(result) {
    const overlay = document.getElementById('app-confirm-overlay');
    if (overlay) overlay.style.display = 'none';
    if (result && appConfirmCallback) {
        appConfirmCallback();
    }
    appConfirmCallback = null;
}

async function confirmApp(message, callback, cancelCallback) {
    const result = await appConfirm(message, { title: 'Potwierdzenie', type: 'warning' });
    if (result) {
        if (callback) callback();
    } else {
        if (cancelCallback) cancelCallback();
    }
}

function updateDiscount(dn, type, value) {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }

    const newValue = parseFloat(value) || 0;
    const oldDisc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
    const oldValue = oldDisc[type] || 0;

    // Sprawdź, czy potrzebny jest popup (tylko dla bazy stycznej i jeśli wartość faktycznie zmieniła się na > 0)
    if (dn === 'styczna' && type === 'dennica' && newValue > 0 && newValue !== oldValue) {
        confirmApp(
            'Uwaga rabat na studnie styczną',
            () => {
                applyDiscount(dn, type, newValue);
            },
            () => {
                // Anuluj - zresetuj UI
                renderDiscountPanel();
            }
        );
        return;
    }

    applyDiscount(dn, type, newValue);
}

function applyDiscount(dn, type, value) {
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0 };
    wellDiscounts[dn][type] = value;
    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    renderWellConfig();
}

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

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
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;">💰 Rabaty i podsumowanie</div>`;

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

/* ===== STATYSTYKI STUDNI ===== */

function getItemAssessedPrice(well, p, applyDiscount = true) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - discountPct / 100;

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find((c) => {
            const pr = studnieProducts.find((x) => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight =
                studnieProducts.find((x) => x.id === dennicaItem.productId)?.height || 0;
        }

        const h1m = parseFloat(p.hMin1);
        const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2);
        const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3);
        const h3x = parseFloat(p.hMax3);

        let kinetaBase = itemPrice;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        itemPrice = kinetaBase * mult;

        // Dodaj malowanie do kinety przed wczesnym wyjściem
        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (well.malowanieW === 'kineta' || well.malowanieW === 'cale') {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
        } else if (
            well.malowanieZ === 'zewnatrz' &&
            p.malowanieZewnetrzne &&
            !well.malowanieZewCena
        ) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        return itemPrice;
    }

    itemPrice = itemPrice * mult;

    // Wkładka PEHD
    if (well.wkladka && well.wkladka !== 'brak' && p.doplataPEHD) {
        itemPrice += parseFloat(p.doplataPEHD);
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        } else if (well.malowanieW === 'cale') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (well.malowanieW === 'cale' || p.componentType === 'dennica') {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy)
    if (
        (well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') &&
        p.componentType === 'dennica' &&
        p.doplataZelbet
    ) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna
    if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
        itemPrice += parseFloat(p.doplataDrabNierdzewna);
    }

    return itemPrice;
}

function calcWellStats(well) {
    let price = 0,
        weight = 0,
        height = 0,
        areaInt = 0,
        areaExt = 0;
    let priceDennica = 0,
        priceNadbudowa = 0;

    // Ceny bazowe (bez rabatu)
    let priceBase = 0,
        priceDennicaBase = 0,
        priceNadbudowaBase = 0;

    let dennicaCount = 0;

    (well.config || []).forEach((item) => {
        const p = studnieProducts.find((pr) => pr.id === item.productId);
        if (!p) return;

        // Użyj zamrożonej ceny jeśli dostępna (tryb zamówienia), w przeciwnym razie oblicz z cennika
        let itemPriceDisc, itemPriceBaseVal;
        if (item.frozenPrice != null) {
            itemPriceDisc = item.frozenPrice;
            itemPriceBaseVal =
                item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
        } else {
            itemPriceDisc = getItemAssessedPrice(well, p, true);
            itemPriceBaseVal = getItemAssessedPrice(well, p, false);
        }

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        // Podział na dennicę i nadbudowę
        if (
            p.componentType === 'dennica' ||
            p.componentType === 'kineta' ||
            p.componentType === 'styczna'
        ) {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        if (p.componentType === 'dennica') {
            for (let q = 0; q < item.quantity; q++) {
                dennicaCount++;
                height += (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            }
        } else {
            height += (p.height || 0) * item.quantity;
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        if (well.dn && wellDiscounts[well.dn]) {
            discNadbudowa = wellDiscounts[well.dn].nadbudowa || 0;
        }
        const mult = 1 - discNadbudowa / 100;

        well.przejscia.forEach((item) => {
            const p = studnieProducts.find((pr) => pr.id === item.productId);
            if (!p) return;

            // Użyj zamrożonej ceny, jeśli jest dostępna (tryb zamówienia)
            let bP, dP;
            if (item.frozenPrice != null) {
                dP = item.frozenPrice;
                bP = item.frozenPriceBase != null ? item.frozenPriceBase : item.frozenPrice;
            } else {
                bP = p.price || 0;
                dP = bP * mult;
            }

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;

            weight += p.weight || 0;
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    // Dopłata wliczona do dennicy / studni stycznej — NIE podlega rabatowi
    // Nie dodajemy do priceBase/priceDennicaBase, aby nie zawyżać podstawy rabatu
    if (well.doplata) {
        price += well.doplata;
        priceDennica += well.doplata;
    }

    return {
        price,
        priceBase,
        priceDennica,
        priceDennicaBase,
        priceNadbudowa,
        priceNadbudowaBase,
        weight,
        height,
        areaInt,
        areaExt,
        malowanieZewTotal
    };
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

window.switchSidebarTab = switchSidebarTab;
