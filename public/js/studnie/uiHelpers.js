/* ===== WIZARD ===== */
function goToWizardStep(step) {
    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');
    updateWizardIndicator();
    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();

    const layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }
}

function wizardNext() {
    wizardNavStep(currentWizardStep + 1);
}

function wizardPrev() {
    wizardNavStep(currentWizardStep - 1);
}

function wizardNavStep(targetStep) {
    if (targetStep === currentWizardStep || targetStep < 1 || targetStep > 3) return;

    // Allow backward navigation freely
    if (targetStep < currentWizardStep) {
        goToWizardStep(targetStep);
        return;
    }

    // Forward navigation
    if (targetStep === 2) {
        goToWizardStep(2);
    } else if (targetStep === 3) {
        // Always validate before allowing navigation to step 3
        if (!validateWizardStep2()) {
            showToast('Wybierz opcję w każdej grupie parametrów przed przejściem do konfiguracji', 'error');
            // If user tried to jump from step 1 directly to 3, take them to step 2 instead
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    }
}

function getActiveTileValue(paramName) {
    const group = document.querySelector(`.param-group[data-param="${paramName}"]`);
    if (!group) return 'brak';
    const active = group.querySelector('.param-tile.active');
    return active ? active.getAttribute('data-val') : 'brak';
}

function validateWizardStep2() {
    const allConfirmed = WIZARD_REQUIRED_PARAMS.every(p => wizardConfirmedParams.has(p));

    // Read painting values from DOM tiles (works even without a well)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    let powlokaWValid = true;
    let malCenaWValid = true;
    if (malowanieWVal !== 'brak') {
        const pwW = document.getElementById('powloka-name-w');
        powlokaWValid = !!(pwW && pwW.value.trim() !== '');
        const mcW = document.getElementById('malowanie-wew-cena');
        malCenaWValid = !!(mcW && mcW.value.trim() !== '' && !isNaN(parseFloat(mcW.value)));
    }

    let powlokaZValid = true;
    let malCenaZValid = true;
    if (malowanieZVal !== 'brak') {
        const pwZ = document.getElementById('powloka-name-z');
        powlokaZValid = !!(pwZ && pwZ.value.trim() !== '');
        const mcZ = document.getElementById('malowanie-zew-cena');
        malCenaZValid = !!(mcZ && mcZ.value.trim() !== '' && !isNaN(parseFloat(mcZ.value)));
    }

    // Show/hide powłoka name fields based on current tile selection
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const malCenaWGroup = document.getElementById('malowanie-wew-cena-group');
    if (malCenaWGroup) malCenaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';

    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    const malCenaZGroup = document.getElementById('malowanie-zew-cena-group');
    if (malCenaZGroup) malCenaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Clear hidden fields
    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        const mcWInput = document.getElementById('malowanie-wew-cena');
        if (mcWInput) mcWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        const mcZInput = document.getElementById('malowanie-zew-cena');
        if (mcZInput) mcZInput.value = '';
    }

    const isFullyValid = allConfirmed && powlokaWValid && powlokaZValid && malCenaWValid && malCenaZValid;

    const nextBtn = document.getElementById('wizard-next-step2');
    if (nextBtn) nextBtn.disabled = !isFullyValid;

    // Update visual state of each param group wrapper
    document.querySelectorAll('.wizard-param-group').forEach(wrapper => {
        const param = wrapper.dataset.wizardParam;
        if (!param) return;
        const confirmed = wizardConfirmedParams.has(param);
        wrapper.classList.toggle('confirmed', confirmed);
        wrapper.classList.toggle('needs-selection', !confirmed);
        const icon = wrapper.querySelector('.status-icon');
        if (icon) icon.textContent = confirmed ? '✅' : '⚠️';
    });

    const msg = document.getElementById('wizard-validation-msg');
    if (msg) msg.classList.toggle('hidden', isFullyValid);

    return isFullyValid;
}

function updateWizardIndicator() {
    const dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach(dot => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (step === currentWizardStep) dot.classList.add('active');
        else if (step < currentWizardStep) dot.classList.add('completed');
    });
    const line1 = document.getElementById('wizard-line-1');
    const line2 = document.getElementById('wizard-line-2');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
}

function updateWizardSummaryBar() {
    const client = document.getElementById('client-name')?.value || '';
    const offer = document.getElementById('offer-number')?.value || '';
    const wsbClient = document.getElementById('wsb-client');
    const wsbOffer = document.getElementById('wsb-offer');
    const wsbParams = document.getElementById('wsb-params');
    if (wsbClient) wsbClient.textContent = client || '—';
    if (wsbOffer) wsbOffer.textContent = offer || '—';
    if (wsbParams) {
        const well = getCurrentWell();
        if (well) {
            const nadbudowa = well.nadbudowa === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const denMat = well.dennicaMaterial === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const wkl = well.wkladka === 'brak' ? '' : ` | PEHD ${well.wkladka}`;
            wsbParams.textContent = `Nadb: ${nadbudowa} | Den: ${denMat}${wkl}`;
        } else {
            wsbParams.textContent = '—';
        }
    }
}

function skipWizardToStep3() {
    wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
    goToWizardStep(3);
}

/* ===== STORAGE (REST API) ===== */
async function loadStudnieProducts() {
    function migrateProducts(arr) {
        arr.forEach(p => {
            if (p.formaStandardowa == null) p.formaStandardowa = 1;
            if (p.formaStandardowaKLB == null) p.formaStandardowaKLB = 1;
            
            // Fix corrupted categories from previous backend bug
            if (p.category === 'studnie' || !p.category) {
                const def = DEFAULT_PRODUCTS_STUDNIE.find(dp => dp.id === p.id);
                if (def) p.category = def.category;
            }

            renamePłyty(p);
        });
        return arr;
    }
    try {
        const res = await fetch('/api/products-studnie');
        const json = await res.json();
        let saved = json.data;
        if (!saved || saved.length === 0) {
            const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
            migrateProducts(data);
            await fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
            return data;
        }
        return migrateProducts(saved);
    } catch {
        const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
        return migrateProducts(data);
    }
}

function renamePłyty(p) {
    if (p && p.name) {
        p.name = p.name.replace(/Płyta Zamykająca/ig, 'Płyta Odciążająca')
            .replace(/Płyta Najazdowa/ig, 'Płyta Odciążająca');
    }
}

async function saveStudnieProducts(data) {
    try {
        await fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) { console.error('saveStudnieProducts error:', err); }
}



/* ===== BACKEND STATUS CHECKER ===== */
async function checkBackendStatus() {
    try {
        const response = await fetch('/api/ai/health', { method: 'GET' });
        const indicator = document.querySelector('#backend-status-indicator span');
        if (response.ok) {
            isBackendOnline = true;
            if (indicator) {
                indicator.style.background = '#4ade80'; // jasny zielony
                indicator.style.boxShadow = '0 0 8px #4ade80';
                indicator.parentElement.title = 'Serwer OR-Tools połączony';
            }
        } else {
            throw new Error("Backend response not ok");
        }
    } catch (e) {
        isBackendOnline = false;
        const indicator = document.querySelector('#backend-status-indicator span');
        if (indicator) {
            indicator.style.background = '#f87171'; // czerwony
            indicator.style.boxShadow = '0 0 8px #f87171';
            indicator.parentElement.title = 'Serwer obliczeniowy OFFLINE (działa tryb JS)';
        }
    }
}
setInterval(checkBackendStatus, 15000); // Check every 15 seconds

// DOMContentLoaded
