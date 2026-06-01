/* ===== KREATOR OFERTY (RURY) — FAZY 1-5 ===== */
/* currentWizardStep zarządzany przez AppState (shared/appState.js) */

function goToPhase(step) {
    if (step < 1 || step > 5) return;

    currentWizardStep = step;

    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');

    // Obsługa wspólnego dolnego paska
    const prevBtn = document.getElementById('wizard-nav-prev');
    const nextBtn = document.getElementById('wizard-nav-next');
    const stepInfo = document.getElementById('wizard-nav-step-info');
    const bottomNav = document.getElementById('wizard-bottom-nav');

    if (prevBtn) prevBtn.style.display = (step === 1 || step === 5) ? 'none' : 'flex';
    if (stepInfo) stepInfo.textContent = 'Krok ' + step + ' z 5';

    // Ukryj dolny pasek w kroku 5
    if (bottomNav) bottomNav.style.display = step === 5 ? 'none' : 'flex';

    if (nextBtn) {
        nextBtn.disabled = false;
        if (step === 3) {
            nextBtn.innerHTML = '<i data-lucide="check"></i> Zakończ';
            nextBtn.onclick = async function () {
                if (!validatePhase(3)) return;
                await saveOffer();
                showToast('Oferta zapisana', 'success');
            };
        } else if (step === 4) {
            nextBtn.innerHTML = '<i data-lucide="arrow-right"></i> Przejdź do zamówienia';
            nextBtn.onclick = function () {
                if (typeof step4NextAction === 'function') {
                    step4NextAction();
                } else {
                    goToPhase(5);
                }
            };
        } else {
            nextBtn.innerHTML = '<i data-lucide="chevron-right"></i> Dalej';
            nextBtn.onclick = phaseNext;
        }
    }

    updateWizardIndicator();

    // Pokaż/ukryj fixed pasek podsumowania tylko w kroku 3
    const summaryBar = document.getElementById('rury-summary-bar');
    if (summaryBar) {
        summaryBar.style.display = (step === 3 || step === 5) ? 'block' : 'none';
    }

    // Inicjalizacja karty budowy przy wejściu w krok 4
    if (step === 4 && typeof initKartaBudowyStep4 === 'function') {
        initKartaBudowyStep4();
    }

    // Synchronizuj tabelę zamówienia przy wejściu w krok 5
    if (step === 5 && typeof updateRuryOrderSummary === 'function') {
        updateRuryOrderSummary();
    }
}

window.goToPhase = goToPhase;

function phaseNext() {
    const next = currentWizardStep + 1;
    if (next > 5) return;
    if (next === 5 && !validatePhase(4)) return;

    if (!validatePhase(currentWizardStep)) return;

    goToPhase(next);
}

window.phaseNext = phaseNext;

function phasePrev() {
    const prev = currentWizardStep - 1;
    if (prev < 1) return;
    goToPhase(prev);
}

window.phasePrev = phasePrev;

function validatePhase(step) {
    switch (step) {
        case 1: {
            const clientName = document.getElementById('client-name').value.trim();
            if (!clientName) {
                showToast('Wpisz nazwę klienta przed przejściem dalej', 'error');
                return false;
            }
            return true;
        }
        case 2:
            if (!currentOfferItems || currentOfferItems.length === 0) {
                showToast('Dodaj co najmniej jeden produkt przed przejściem dalej', 'error');
                return false;
            }
            return true;
        default:
            return true;
    }
}

function updateWizardIndicator() {
    for (let i = 1; i <= 5; i++) {
        const dot = document.querySelector(`.wizard-step-dot[data-step="${i}"]`);
        if (!dot) continue;
        dot.classList.remove('active', 'completed');
        if (i === currentWizardStep) dot.classList.add('active');
        else if (i < currentWizardStep) dot.classList.add('completed');
    }
    for (let i = 1; i <= 4; i++) {
        const line = document.getElementById('wizard-line-' + i);
        if (line) line.classList.toggle('completed', currentWizardStep > i);
    }
}

function initWizard() {
    goToPhase(1);

    if (editingOfferId) {
        goToPhase(3);
        renderOfferItems();
    }
}

window.initWizard = initWizard;
