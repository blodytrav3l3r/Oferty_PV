// @ts-check
/* ===== wellSelection.js — DN, zakonczenie, redukcja, styczna ===== */

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    well.zakonczenie = productId;

    // Zapisz do per-DN mapy dla stycznych (zapamiętaj wybór na potem)
    if (well.dn === 'styczna') {
        const currentDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
        well.zakonczenieByDn = well.zakonczenieByDn || {};
        well.zakonczenieByDn[currentDn] = productId;
    }

    closeModal();

    // Zapisz jako domyślne na poziomie oferty dla nowych studni
    offerDefaultZakonczenie = productId;

    // Aktualizuj etykietę przycisku, aby pokazać bieżący wybór
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

/* ===== REDUKCJA ===== */
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

    // Dla DN1500+ i Stycznej pokazujemy wybór
    if ([1500, 2000, 2500].includes(well.dn) || well.dn === 'styczna') {
        if (typeof openRedukcjaChoicePopup === 'function') {
            openRedukcjaChoicePopup();
            return;
        }
    }

    // Standardowa logika dla DN1200 (tylko DN1000)
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

/* ===== PSIA BUDA ===== */
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

        // Backup parametrów
        well._psiaBudaBackup = {
            kineta: well.kineta || 'beton',
            spocznik: well.spocznik || 'beton',
            spocznikH: well.spocznikH || '1/2'
        };

        // Automatyczne ustawienie na "brak"
        well.kineta = 'brak';
        well.spocznik = 'brak';
        well.spocznikH = 'brak';
    } else {
        showToast('Tryb Psia buda — WYŁĄCZONY', 'info');

        // Przywracanie parametrów, jeśli backup istnieje
        if (well._psiaBudaBackup) {
            well.kineta = well._psiaBudaBackup.kineta;
            well.spocznik = well._psiaBudaBackup.spocznik;
            well.spocznikH = well._psiaBudaBackup.spocznikH;
            delete well._psiaBudaBackup;
        }
    }

    // Odśwież UI parametrów (wellManager.js)
    if (typeof renderWellParams === 'function') renderWellParams();

    if (!well.autoLocked) {
        well.configSource = 'AUTO';
        well.config = [];
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== ZNAJDŹ ZAKOŃCZENIE TEGO SAMEGO TYPU DLA INNEJ ŚREDNICY ===== */
function findClosureForDn(productId, targetDn) {
    if (!productId) return null;
    const prod = studnieProducts.find((p) => p.id === productId);
    if (!prod || !prod.componentType) return null;
    const match = studnieProducts.find(
        (p) =>
            p.componentType === prod.componentType && (parseInt(p.dn) === targetDn || p.dn === null)
    );
    return match ? match.id : null;
}

/* ===== NADBUDOWA STYCZNA DN1200 ===== */
async function toggleStyczna1200() {
    const well = getCurrentWell();
    if (!well || well.dn !== 'styczna') return;

    const oldDn = well.stycznaNadbudowa1200 ? 1200 : 1000;
    well.stycznaNadbudowa1200 = !well.stycznaNadbudowa1200;
    updateStyczna1200Button();

    const newDn = well.stycznaNadbudowa1200 ? 1200 : 1000;

    // Zakończenie studni — zapamiętaj dla starego DN, przywróć dla nowego
    well.zakonczenieByDn = well.zakonczenieByDn || {};
    if (well.zakonczenie) well.zakonczenieByDn[oldDn] = well.zakonczenie;
    well.zakonczenie = well.zakonczenieByDn[newDn] || null;
    // Jeśli brak zapisanego dla nowego DN, znajdź ten sam typ co w starym
    if (!well.zakonczenie && well.zakonczenieByDn[oldDn]) {
        well.zakonczenie = findClosureForDn(well.zakonczenieByDn[oldDn], newDn);
        if (well.zakonczenie) well.zakonczenieByDn[newDn] = well.zakonczenie;
    }
    if (typeof updateZakonczenieButton === 'function') updateZakonczenieButton();

    // Redukcja
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

    // Zapisz do per-DN mapy dla stycznych
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

    // Wymuś parowanie elementów odciążających w konfiguracji
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

/* ===== WYBÓR DN ===== */
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

/**
 * Wewnętrzna logika zmiany DN (wywoływana bezpośrednio dla DN numerycznych
 * lub po wyborze wariantu stycznej z popupu).
 */
function doSelectDN(dn) {
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.dn !== dn) {
        well.dn = dn;
        // Aktualizuj nazwę, jeśli używa formatu domyślnego
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

        // Aktualizuj zakończenie, aby pasowało do nowego DN (jeśli jest standardowe)
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

        // Wyczyść stare elementy, które nie pasują do nowego DN i uruchom ponownie auto-dobór
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

        const btnText = b.textContent.trim().toLowerCase();
        const wellDnStr = String(well.dn).toLowerCase();

        if (btnText === wellDnStr) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}
