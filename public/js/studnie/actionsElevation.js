// @ts-check
/* ===== actionsElevation.js — rzędne, dopłaty, numer studni, wskaźnik wysokości ===== */

let elevationDebounceTimer = null;

function updateElevations() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    if (isWellLocked()) {
        showToast(WELL_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');

    const wlazVal = wlazInput.value !== '' ? parseCalcExpression(wlazInput.value) : null;
    const dnaVal = dnaInput.value !== '' ? parseCalcExpression(dnaInput.value) : 0;

    if (wlazVal !== null && wlazInput.value.trim().startsWith('='))
        wlazInput.value = String(wlazVal);
    if (dnaVal !== null && dnaInput.value.trim().startsWith('=')) dnaInput.value = String(dnaVal);

    if (
        wlazVal !== null &&
        dnaVal !== null &&
        wlazInput.value.trim() !== '' &&
        dnaInput.value.trim() !== '' &&
        dnaVal >= wlazVal
    ) {
        showToast('Rzędna dna nie może być większa lub równa rzędnej włazu', 'error');
        return;
    }

    well.rzednaWlazu = wlazVal;
    well.rzednaDna = dnaVal;

    updateHeightIndicator();
    _debouncedRefreshWells();

    if (elevationDebounceTimer) clearTimeout(elevationDebounceTimer);
    elevationDebounceTimer = setTimeout(() => {
        elevationDebounceTimer = null;
        autoSelectComponents(true);
    }, 300);
}

function syncElevationInputs() {
    const well = getCurrentWell();
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');
    const numerInput = document.getElementById('input-well-numer');
    const doplataInput = document.getElementById('input-doplata');
    if (!well) {
        if (wlazInput) wlazInput.value = '';
        if (dnaInput) dnaInput.value = '';
        if (doplataInput) doplataInput.value = '';
        if (numerInput) {
            numerInput.value = '';
            checkWellNumerDuplicate('', numerInput);
        }
        updateHeightIndicator();
        return;
    }
    if (wlazInput && document.activeElement !== wlazInput)
        wlazInput.value = well.rzednaWlazu != null ? well.rzednaWlazu : '';
    if (dnaInput && document.activeElement !== dnaInput)
        dnaInput.value = well.rzednaDna != null ? well.rzednaDna : '0';
    if (doplataInput) {
        const dVal = well.doplata != null ? well.doplata : 0;
        doplataInput.value = dVal;

        if (dVal > 0) {
            doplataInput.classList.add('color-success', 'fw-700');
            doplataInput.classList.remove('color-danger', 'color-accent');
        } else if (dVal < 0) {
            doplataInput.classList.add('color-danger', 'fw-700');
            doplataInput.classList.remove('color-success', 'color-accent');
        } else {
            doplataInput.classList.add('color-accent');
            doplataInput.classList.remove('color-success', 'color-danger', 'fw-700');
        }
    }
    if (numerInput) {
        numerInput.value = well.numer || '';
        checkWellNumerDuplicate(numerInput.value.trim(), numerInput);
    }
    updateHeightIndicator();
}

function updateHeightIndicator() {
    const well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
    const reqEl = document.getElementById('well-required-height');
    const confEl = document.getElementById('well-configured-height');
    const diffEl = document.getElementById('height-diff-indicator');

    if (!reqEl || !confEl || !diffEl) return;
    if (!well) {
        confEl.innerHTML = '0 m';
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
        renderWellConfigErrors(null);
        return;
    }

    // Banner błędów renderowany przez renderWellConfigErrors (solverValidation.js)
    renderWellConfigErrors(well);

    const stats = calcWellStats(well);
    const confM = (stats.height / 1000).toFixed(3).replace('.', ',');
    confEl.textContent = confM + ' m';

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu != null && well.rzednaWlazu > rzDna) {
        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        const reqM = (requiredMm / 1000).toFixed(3).replace('.', ',');
        reqEl.textContent = reqM + ' m';

        const diff = stats.height - requiredMm;
        if (Math.abs(diff) <= 50) {
            diffEl.innerHTML =
                '<span class="color-success"><i data-lucide="check-circle-2"></i> Wysokość OK</span>';
        } else if (diff > 0) {
            const diffM = (diff / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span class="color-warn"><i data-lucide="alert-triangle"></i> +${diffM} m za dużo</span>`;
        } else {
            const diffM = (Math.abs(diff) / 1000).toFixed(3).replace('.', ',');
            diffEl.innerHTML = `<span class="color-danger"><i data-lucide="alert-triangle"></i> Brakuje ${diffM} m</span>`;
        }
    } else {
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
    }
}

function updateWellNumer() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) return;
    const numerInput = document.getElementById('input-well-numer');
    if (!numerInput) return;

    const newNumer = numerInput.value.trim();
    checkWellNumerDuplicate(newNumer, numerInput);

    well.numer = newNumer;
    if (typeof autoUpdateWellName === 'function') {
        autoUpdateWellName(well, currentWellIndex);
    } else {
        well.name = well.numer || 'Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')';
    }
    _debouncedRefreshWells();
    updateSummary();
}

window.autoUpdateWellName = function (well, index) {
    if (!well) return;

    let baseName =
        well.numer ||
        'Studnia ' +
            (well.dn === 'styczna' ? 'Styczna' : 'DN' + well.dn) +
            ' (#' +
            (index + 1) +
            ')';

    baseName = baseName.replace(/ (PRE|UTH)$/, '');

    let suffix = '';
    if (well.kineta === 'preco' || well.kineta === 'precotop') {
        suffix = ' PRE';
    } else if (well.kineta === 'unolith') {
        suffix = ' UTH';
    }

    well.name = baseName + suffix;
};

function checkWellNumerDuplicate(newNumer, inputEl) {
    if (!inputEl) return false;
    const trimmed = String(newNumer || '')
        .trim()
        .replace(/ (PRE|UTH)$/i, '')
        .trim();
    if (trimmed !== '') {
        const currentWell = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
        const normNew = trimmed.toLowerCase();
        const isDuplicate = wells.some((w) => {
            if (!w || !w.numer) return false;
            const wNorm = String(w.numer)
                .trim()
                .replace(/ (PRE|UTH)$/i, '')
                .trim()
                .toLowerCase();
            if (wNorm !== normNew) return false;
            if (currentWell && w.id != null && currentWell.id != null)
                return w.id !== currentWell.id;
            return w !== currentWell;
        });
        if (isDuplicate) {
            inputEl.classList.add('border-danger-subtle', 'color-danger');
            inputEl.style.boxShadow = '0 0 10px rgba(var(--danger-rgb), 0.2)';
            const inBulk = typeof _excelPasteInProgress !== 'undefined' && _excelPasteInProgress;
            if (!inBulk)
                showToast(
                    `<i data-lucide="alert-triangle"></i> Numer studni "${trimmed}" już istnieje! Zmień numer, aby uniknąć duplikatów.`,
                    'error'
                );
            return true;
        }
    }
    inputEl.classList.remove('border-danger-subtle', 'color-danger');
    inputEl.classList.add('color-accent');
    inputEl.style.borderColor = 'var(--border-glass)';
    inputEl.style.boxShadow = 'none';
    return false;
}

function updateDoplata() {
    if (isOfferLocked()) {
        showToast(OFFER_LOCKED_MSG, 'error');
        return;
    }
    const well = getCurrentWell();
    if (!well) {
        showToast('Najpierw dodaj studnię', 'error');
        return;
    }
    const domEl = document.getElementById('input-doplata');
    if (!domEl) return;
    const dVal = domEl.value !== '' ? parseCalcExpression(domEl.value) : 0;
    if (dVal !== null && domEl.value.trim().startsWith('=')) domEl.value = String(dVal);
    well.doplata = dVal;

    if (dVal > 0) {
        domEl.classList.add('color-success', 'fw-700');
        domEl.classList.remove('color-danger', 'color-accent');
    } else if (dVal < 0) {
        domEl.classList.add('color-danger', 'fw-700');
        domEl.classList.remove('color-success', 'color-accent');
    } else {
        domEl.classList.add('color-accent');
        domEl.classList.remove('color-success', 'color-danger', 'fw-700');
    }

    _debouncedRefreshFull();
}

// Debounce dla ciężkich operacji renderowania
const _debouncedRefreshWells = window.debounce
    ? window.debounce(() => renderWellsList(), 250)
    : () => renderWellsList();
const _debouncedRefreshFull = window.debounce
    ? window.debounce(() => {
          renderWellsList();
          updateSummary();
          renderOfferSummary();
      }, 250)
    : () => {
          renderWellsList();
          updateSummary();
          renderOfferSummary();
      };

/* ===== Rejestracja globali ===== */
window.updateElevations = updateElevations;
window.syncElevationInputs = syncElevationInputs;
window.updateWellNumer = updateWellNumer;
window.updateDoplata = updateDoplata;
