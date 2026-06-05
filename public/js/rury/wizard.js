/* ===== KREATOR OFERTY (RURY) — FAZY 1-5 ===== */
/* currentWizardStep zarządzany przez AppState (shared/appState.js) */

function goToPhase(step) {
    if (step < 1 || step > 5) return;

    if (step === 1 && !window.orderEditMode && typeof pendingOrderCreationData !== 'undefined' && pendingOrderCreationData) {
        pendingOrderCreationData = null;
    }

    if (step === 5 && !window.orderEditMode) {
        if (typeof showToast === 'function') {
            showToast('Zamówienie dostępne z karty Oferta (Zestawienie ofertowe)', 'info');
        }
        goToPhase(3);
        return;
    }

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
                if (window.orderEditMode) {
                    showToast('Edycja oferty zablokowana w trybie edycji zamówienia', 'warning');
                    return;
                }
                if (!validatePhase(3)) return;
                await saveOffer();
                showToast('Oferta zapisana', 'success');
            };
        } else if (step === 4) {
            nextBtn.innerHTML = '<i data-lucide="arrow-right"></i> Dalej';
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

    // Pokaż/ukryj fixed pasek podsumowania
    const summaryBar = document.getElementById('rury-summary-bar');
    if (summaryBar) {
        summaryBar.style.display = (step === 3 || step === 5) ? 'block' : 'none';
    }

    // Aktualizuj etykietę przycisku zapisu w pasku podsumowania
    if (step === 3 || step === 5) {
        const saveBtn = document.getElementById('btn-save-offer-order');
        if (saveBtn) {
            const isOrderMode = window.orderEditMode && window.editingRuryOrderId;
            saveBtn.innerHTML = isOrderMode
                ? '<i data-lucide="save"></i> Zapisz zamówienie'
                : '<i data-lucide="save"></i> Zapisz ofertę';
        }
        if (window.lucide) lucide.createIcons();
    }

    // Inicjalizacja karty budowy przy wejściu w krok 4
    if (step === 4 && typeof initKartaBudowyStep4 === 'function') {
        initKartaBudowyStep4();
    }

    // Wizualna blokada kropka 5 w trybie edycji oferty
    const step5Dot = document.querySelector('.wizard-step-dot[data-step="5"]');
    if (step5Dot) {
        if (window.orderEditMode) {
            step5Dot.classList.remove('wizard-step-locked');
            step5Dot.style.opacity = '';
            step5Dot.style.cursor = '';
            step5Dot.removeAttribute('title');
        } else {
            step5Dot.classList.add('wizard-step-locked');
            step5Dot.title = 'Otwórz zamówienie z karty Oferta';
        }
    }

    // Odśwież tabelę zamówienia przy wejściu w krok 5 (tryb zamówienia)
    if (step === 5 && window.orderEditMode) {
        if (typeof renderOfferItems === 'function') renderOfferItems();
        if (typeof updateRuryOrderSummary === 'function') {
            const order = typeof getCurrentRuryOrder === 'function' ? getCurrentRuryOrder() : null;
            if (order) updateRuryOrderSummary(order);
        }
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
        case 2: {
            const active = (typeof getActiveItemsArray === 'function') ? getActiveItemsArray() : (window.orderEditMode ? orderCurrentItems : currentOfferItems);
            if (!active || active.length === 0) {
                showToast('Dodaj co najmniej jeden produkt przed przejściem dalej', 'error');
                return false;
            }
            return true;
        }
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
