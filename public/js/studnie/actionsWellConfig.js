// @ts-check
/* ===== actionsWellConfig.js — zakończenie, redukcja, psia buda, styczna, DN ===== */

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.zakonczenie = productId;

    if (well.dn === 'styczna') {
        const currentDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.zakonczenieByDn = well.zakonczenieByDn || {};
        well.zakonczenieByDn[currentDn] = productId;
    }

    closeModal();
    offerDefaultZakonczenie = productId;
    updateZakonczenieButton();

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        showToast(`Zakończenie: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie: Auto (Konus)', 'success');
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

async function toggleRedukcja() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (![1200, 1500, 2000, 2500].includes(well.dn) && well.dn !== 'styczna') {
        showToast('Redukcja dostępna tylko dla studni DN ≥ 1200', 'error');
        return;
    }

    if ([1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna') {
        if (typeof openRedukcjaChoicePopup === 'function') {
            openRedukcjaChoicePopup();
            return;
        }
    }

    well.redukcjaDN1000 = !well.redukcjaDN1000;
    well.redukcjaTargetDN = 1000;
    offerDefaultRedukcja = well.redukcjaDN1000;
    updateRedukcjaButton();

    if (well.redukcjaDN1000) {
        showToast('Redukcja DN1000 — WŁĄCZONA', 'success');
    } else {
        showToast('Redukcja — WYŁĄCZONA', 'info');

        well.zakonczenie = null;
        offerDefaultZakonczenie = null;
        well.redukcjaZakonczenie = null;
        offerDefaultRedukcjaZak = null;
        updateZakonczenieButton();
        if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

async function togglePsiaBuda() {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    well.psiaBuda = !well.psiaBuda;
    updatePsiaBudaButton();

    if (well.psiaBuda) {
        showToast('Tryb Psia buda — WŁĄCZONY', 'success');

        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };

        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        showToast('Tryb Psia buda — WYŁĄCZONY', 'info');

        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }

    if (typeof renderWellParams === 'function') renderWellParams();

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

async function toggleStyczna1200() {
    const well = getCurrentWell();
    if (!well || well.dn !== 'styczna') return;

    const oldDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    well.stycznaNadbudowa1200 = !well.stycznaNadbudowa1200;
    updateStyczna1200Button();

    const newDn = well.stycznaNadbudowa1200 ? 1200 : 1000;

    well.zakonczenieByDn = well.zakonczenieByDn || {};
    if (well.zakonczenie) well.zakonczenieByDn[oldDn] = well.zakonczenie;
    well.zakonczenie = well.zakonczenieByDn[newDn] || null;
    if (!well.zakonczenie && well.zakonczenieByDn[oldDn]) {
        well.zakonczenie = findClosureForDn(well.zakonczenieByDn[oldDn], newDn);
        if (well.zakonczenie) well.zakonczenieByDn[newDn] = well.zakonczenie;
    }
    if (typeof updateZakonczenieButton === 'function') updateZakonczenieButton();

    if (well.redukcjaDN1000) {
        well.redukcjaTargetDN = newDn;
        well.redukcjaZakonczenieByDn = well.redukcjaZakonczenieByDn || {};
        if (well.redukcjaZakonczenie)
            well.redukcjaZakonczenieByDn[oldDn] = well.redukcjaZakonczenie;
        well.redukcjaZakonczenie = well.redukcjaZakonczenieByDn[newDn] || null;
        if (!well.redukcjaZakonczenie && well.redukcjaZakonczenieByDn[oldDn]) {
            well.redukcjaZakonczenie = findClosureForDn(well.redukcjaZakonczenieByDn[oldDn], newDn);
            if (well.redukcjaZakonczenie)
                well.redukcjaZakonczenieByDn[newDn] = well.redukcjaZakonczenie;
        }
        if (typeof updateRedukcjaZakButton === 'function') updateRedukcjaZakButton();
    }

    if (well.stycznaNadbudowa1200) {
        showToast('Nadbudowa dla studni stycznej: DN1200', 'success');
    } else {
        showToast('Nadbudowa dla studni stycznej: DN1000', 'info');
    }

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

function updateStyczna1200Button() {
    const well = getCurrentWell();
    const btn = document.getElementById('btn-styczna-1200');
    if (!btn) return;

    if (well && well.dn === 'styczna') {
        btn.style.display = 'inline-block';
        if (well.stycznaNadbudowa1200) {
            btn.innerHTML = 'Nadbudowa DN1200';
            btn.classList.add('bg-accent-subtle', 'border-accent-subtle', 'color-accent');
        } else {
            btn.innerHTML = 'Nadbudowa DN1200';
            btn.classList.remove('bg-accent-subtle', 'border-accent-subtle', 'color-accent');
            btn.style.borderColor = 'var(--border-glass)';
        }
    } else {
        btn.style.display = 'none';
        if (well) well.stycznaNadbudowa1200 = false;
    }
}

async function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.redukcjaZakonczenie = productId;
    offerDefaultRedukcjaZak = productId;

    if (well.dn === 'styczna') {
        const currentDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.redukcjaZakonczenieByDn = well.redukcjaZakonczenieByDn || {};
        well.redukcjaZakonczenieByDn[currentDn] = productId;
    }

    closeModal();

    if (typeof updateRedukcjaZakButton === 'function') {
        updateRedukcjaZakButton();
    }

    if (productId) {
        const p = studnieProducts.find((pr) => pr.id === productId);
        const isRelief =
            p &&
            ['plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(
                p.componentType
            );

        if (isRelief) {
            showToast(`Zakończenie redukcji: Dodano komplet odciążający (${p.name})`, 'success');
        } else {
            showToast(`Zakończenie redukcji: ${p ? p.name : productId}`, 'success');
        }
    } else {
        showToast('Zakończenie redukcji: Auto', 'success');
    }

    if (typeof ensureReliefRingPair === 'function') {
        ensureReliefRingPair(well);
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }

    if (!well.autoLocked && well.redukcjaDN1000) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

function selectDN(dn) {
    if (dn === 'styczna') {
        const well = getCurrentWell();
        if (!well) {
            showToast('Najpierw dodaj studnię', 'error');
            return;
        }
        showStycznaPopup('select');
        return;
    }

    doSelectDN(dn);
}

function doSelectDN(dn) {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.dn !== dn) {
        well.dn = dn;
        if (
            !well.numer ||
            well.name.startsWith('Studnia DN') ||
            well.name.startsWith('Studnia Styczna')
        ) {
            well.name =
                well.numer ||
                (dn === 'styczna'
                    ? 'Studnia Styczna (#' + (currentWellIndex + 1) + ')'
                    : 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')');
        }

        if (well.zakonczenie && dn !== 'styczna') {
            const oldProd = studnieProducts.find((p) => p.id === well.zakonczenie);
            if (oldProd) {
                const newProd = studnieProducts.find(
                    (p) => p.componentType === oldProd.componentType && p.dn === dn
                );
                well.zakonczenie = newProd ? newProd.id : null;
            } else {
                well.zakonczenie = null;
            }
        }

        well.config = [];
        autoSelectComponents(true);
        refreshAll();
    }

    updateDNButtons();
    renderTiles();
    renderWellsList();
}

function updateDNButtons() {
    const well = getCurrentWell();
    document.querySelectorAll('.dn-btn').forEach((b) => {
        if (!well) {
            b.classList.remove('active');
            return;
        }

        let btnText = b.textContent.trim().toLowerCase();
        let wellDnStr = String(well.dn).toLowerCase();

        if (btnText === wellDnStr) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}
