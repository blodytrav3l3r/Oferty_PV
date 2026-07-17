// @ts-check
/* ===== ZARZĄDZANIE STUDNIAMI (CRUD + LOCK) ===== */

function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladkaDennica: 'brak',
        wkladkaNadbudowa: 'brak',
        wkladkaZwienczenie: 'brak',
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
        uszczelka: 'GSG',
        magazyn: 'Kluczbork',
        precoFullHeight: 'nie'
    };
    document.querySelectorAll('#wizard-step-2 .param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        if (!paramName) return;
        const activeBtn = group.querySelector('.param-tile.active');
        if (activeBtn) {
            params[paramName] = activeBtn.getAttribute('data-val');
        }
    });

    const wkladkaGlobal = params.wkladka || 'brak';
    if (wkladkaGlobal !== 'brak') {
        const cbDennica = document.getElementById('pehd-dennica');
        const cbNadbudowa = document.getElementById('pehd-nadbudowa');
        const cbZwienczenie = document.getElementById('pehd-zwienczenie');
        params.wkladkaDennica = cbDennica && cbDennica.checked ? wkladkaGlobal : 'brak';
        params.wkladkaNadbudowa = cbNadbudowa && cbNadbudowa.checked ? wkladkaGlobal : 'brak';
        params.wkladkaZwienczenie = cbZwienczenie && cbZwienczenie.checked ? wkladkaGlobal : 'brak';
    } else {
        params.wkladkaDennica = 'brak';
        params.wkladkaNadbudowa = 'brak';
        params.wkladkaZwienczenie = 'brak';
    }

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

/**
 * @param {string} name
 * @param {string|number} [dn=1000]
 */
function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    const defaultName =
        dn === 'styczna'
            ? 'Studnia Styczna (#' + wellCounter + ')'
            : 'Studnia DN' + dn + ' (#' + wellCounter + ')';
    const well = {
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
        autoSelect: true,
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladkaDennica: gp.wkladkaDennica || 'brak',
        wkladkaNadbudowa: gp.wkladkaNadbudowa || 'brak',
        wkladkaZwienczenie: gp.wkladkaZwienczenie || 'brak',
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
        magazyn: gp.magazyn,
        precoFullHeight: gp.precoFullHeight
    };

    if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') {
        if (well.zakonczenie) {
            const p = studnieProducts.find((pr) => pr.id === well.zakonczenie);
            if (p && p.componentType === 'konus') {
                well.zakonczenie = null;
            }
        }
        if (well.redukcjaZakonczenie) {
            const p = studnieProducts.find((pr) => pr.id === well.redukcjaZakonczenie);
            if (p && p.componentType === 'konus') {
                well.redukcjaZakonczenie = null;
            }
        }
    }

    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(well, wellCounter - 1);
    }

    return well;
}

function isOfferLocked() {
    if (orderEditMode) return false;
    return isWellLocked();
}

function isWellLocked(wellIdx) {
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;

    const hasAcceptedPO = (
        typeof productionOrders !== 'undefined' && productionOrders ? productionOrders : []
    ).some((po) => po.wellId === well.id && po.status === 'accepted');
    if (hasAcceptedPO) return true;

    if (orderEditMode) return false;

    if (typeof isWellOrdered === 'function' && isWellOrdered(well)) return true;

    return false;
}

/**
 * @param {string|number} [dn=1000]
 */
function addNewWell(dn = 1000) {
    if (enforceGlobalKonusPehdRule()) {
        showToast(
            'Nie można dodać nowej studni, dopóki nie rozwiążesz konfliktu Konus+PEHD w poprzedniej.',
            'error'
        );
        return;
    }
    if (dn === 'styczna') {
        showStycznaPopup('add');
        return;
    }
    const well = createNewWell(null, dn);
    wells.push(well);
    currentWellIndex = wells.length - 1;
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
        switchBuilderTab('concrete');
    }
    refreshAll();
    showToast(`Dodano: ${well.name}`, 'success');
}

function duplicateWell(index) {
    if (enforceGlobalKonusPehdRule()) {
        showToast(
            'Nie można skopiować studni, dopóki nie rozwiążesz konfliktu Konus+PEHD.',
            'error'
        );
        return;
    }
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = structuredClone(src);
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
    refreshAll(true);
}

function renameWell(index) {
    if (isWellLocked(index)) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.numer = name.trim().replace(/ (PRE|UTH)$/, '');
        if (typeof autoUpdateWellName === 'function') {
            autoUpdateWellName(well, index);
        } else {
            well.name = name.trim();
        }
        renderWellsList();
        renderOfferSummary();
    }
}

function getCurrentWell() {
    if (wells.length === 0) return null;
    return wells[currentWellIndex] || wells[0];
}
