// @ts-check
/* ===== KREATOR ===== */
function goToWizardStep(step) {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (step <= 2) {
            // Kroki 1-2 dostępne w trybie zamówienia (podgląd danych)
            currentWizardStep = step;
            document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
            updateWizardIndicator();
            updateStudnieBottomNav();
            const target = document.getElementById('wizard-step-' + step);
            if (target) target.classList.add('active');
            const layout = document.querySelector('.well-app-layout');
            if (layout) layout.classList.toggle('intro-mode', step === 1 || step === 2);
            showSection('builder');
            if (step === 2) validateWizardStep2();
            return;
        }
        if (step === 3) {
            showToast('Krok 3 (Oferta) jest niedostępny w trybie zamówienia', 'info');
            return;
        }
    }

    if (typeof startStudnieViewTransition === 'function') {
        startStudnieViewTransition();
    }

    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
    updateWizardIndicator();
    updateStudnieBottomNav();

    const layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2 || step === 4) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }

    if (step === 4) {
        // Krok 4.1 (Karta budowy) — własny panel w builderze
        const builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        const target = document.getElementById('wizard-step-4');
        if (target) target.classList.add('active');

        // Załaduj dane tylko jeśli jesteśmy w trybie edycji zamówienia
        // (przy nowym zamówieniu funkcja jest już wywoływana z parametrem w orderManager.js)
        if (
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof initKartaBudowyStep4 === 'function'
        ) {
            initKartaBudowyStep4();
        }

        return;
    }

    if (step === 5) {
        // Krok 4.2 (Zamówienie) — wejdź w tryb edycji zamówienia w builderze
        enterWizardOrderMode();
        return;
    }

    // Dla kroków 1-3 upewnij się, że jesteśmy w sekcji builder
    const builderSection = document.getElementById('section-builder');
    if (builderSection && !builderSection.classList.contains('active')) {
        showSection('builder');
    }

    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');

    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();
}

/**
 * Wejście w tryb zamówienia z poziomu kreatora (krok 4).
 * Szuka zamówienia powiązanego z bieżącą ofertą i ładuje je do edycji.
 */
function enterWizardOrderMode() {
    // Jeśli już jesteśmy w trybie zamówienia — zostań w builderze
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        const builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        // Aktywuj wizard-step-3 (builder) bo krok 4.2 nie ma własnego panelu
        const target = document.getElementById('wizard-step-3');
        if (target) target.classList.add('active');
        return;
    }

    // W trybie oferty (edytujemy ofertę) blokuj przejście do zamówienia
    if (editingOfferIdStudnie) {
        showToast(
            'Przejdź do zamówienia przez przycisk "Utwórz zamówienie" w podsumowaniu',
            'info'
        );
        currentWizardStep = 3;
        updateWizardIndicator();
        return;
    }

    // Znajdź zamówienie dla bieżącej oferty
    if (!editingOfferIdStudnie) {
        showToast('Najpierw zapisz ofertę, aby móc przejść do zamówienia', 'error');
        currentWizardStep = 3;
        updateWizardIndicator();
        return;
    }

    const oId =
        typeof normalizeId === 'function'
            ? normalizeId(editingOfferIdStudnie)
            : editingOfferIdStudnie;
    const order =
        typeof ordersStudnie !== 'undefined' && ordersStudnie
            ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
            : null;

    if (order) {
        // Wczytaj zamówienie do edycji
        if (typeof enterOrderEditMode === 'function') {
            enterOrderEditMode(order.id);
        }
    } else {
        showToast(
            'Brak zamówienia dla tej oferty. Utwórz zamówienie z poziomu podsumowania oferty.',
            'info'
        );
        currentWizardStep = 3;
        updateWizardIndicator();
    }
}

/**
 * Wyjście z trybu zamówienia i powrót do trybu oferty.
 */
async function exitWizardOrderMode(targetStep = 3) {
    orderEditMode = null;
    if (typeof renderOrderModeBanner === 'function') renderOrderModeBanner();

    if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
        if (typeof loadSavedOfferStudnie === 'function') {
            await loadSavedOfferStudnie(editingOfferIdStudnie, null, 'builder', true);
        }
    }

    if (typeof refreshAll === 'function') refreshAll();

    // Teraz po załadowaniu przejdź do docelowego kroku
    if (targetStep) {
        goToWizardStep(targetStep);
    }

    showToast('<i data-lucide="bar-chart-2"></i> Powrót do edycji oferty', 'info');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function wizardNext() {
    wizardNavStep(currentWizardStep + 1);
}

function wizardPrev() {
    wizardNavStep(currentWizardStep - 1);
}

function wizardNavStep(targetStep) {
    if (targetStep === currentWizardStep || targetStep < 1 || targetStep > 5) return;

    // Pozwól na dowolną nawigację wstecz
    if (targetStep < currentWizardStep) {
        goToWizardStep(targetStep);
        return;
    }

    // Nawigacja w przód
    if (targetStep === 2) {
        goToWizardStep(2);
    } else if (targetStep === 3) {
        // Zawsze waliduj przed zezwoleniem na nawigację do kroku 3
        if (!validateWizardStep2()) {
            showToast(
                'Wybierz opcję w każdej grupie parametrów przed przejściem do oferty',
                'error'
            );
            // Jeśli użytkownik próbował przeskoczyć z kroku 1 bezpośrednio do 3, zabierz go zamiast tego do kroku 2
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    } else if (targetStep === 4) {
        // Krok 4.1 — Karta budowy
        goToWizardStep(4);
    } else if (targetStep === 5) {
        // Krok 4.2 — Zamówienie (przełącza na widok podsumowania oferty/zamówienia)
        goToWizardStep(5);
    }
}

function getActiveTileValue(paramName) {
    const group = document.querySelector(`.param-group[data-param="${paramName}"]`);
    if (!group) return 'brak';
    const active = group.querySelector('.param-tile.active');
    return active ? active.getAttribute('data-val') : 'brak';
}

function validateWizardStep2() {
    const allConfirmed = WIZARD_REQUIRED_PARAMS.every((p) => wizardConfirmedParams.has(p));

    // Odczytaj wartości malowania z kafelków DOM (działa nawet bez studni)
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

    // Pokaż/ukryj pola nazwy powłoki na podstawie aktualnego wyboru kafelka
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const malCenaWGroup = document.getElementById('malowanie-wew-cena-group');
    if (malCenaWGroup) malCenaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';

    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    const malCenaZGroup = document.getElementById('malowanie-zew-cena-group');
    if (malCenaZGroup) malCenaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Wyczyść ukryte pola
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

    const isFullyValid =
        allConfirmed && powlokaWValid && powlokaZValid && malCenaWValid && malCenaZValid;

    const bottomNextBtn = document.getElementById('studnie-nav-next');
    const inlineNextBtn = document.getElementById('wizard-next-step2');
    if (bottomNextBtn) bottomNextBtn.disabled = !isFullyValid;
    if (inlineNextBtn) inlineNextBtn.disabled = !isFullyValid;

    // Zaktualizuj stan wizualny owijki każdej grupy parametrów
    let iconsChanged = false;
    document.querySelectorAll('.wizard-param-group').forEach((wrapper) => {
        const param = wrapper.dataset.wizardParam;
        if (!param) return;
        const confirmed = wizardConfirmedParams.has(param);
        const wasConfirmed = wrapper.classList.contains('confirmed');

        // Przełącz klasy tylko gdy stan się zmienił
        if (confirmed !== wasConfirmed) {
            wrapper.classList.toggle('confirmed', confirmed);
            wrapper.classList.toggle('needs-selection', !confirmed);
            const icon = wrapper.querySelector('.status-icon');
            if (icon) {
                icon.innerHTML = confirmed
                    ? '<i data-lucide="check-circle-2"></i>'
                    : '<i data-lucide="alert-triangle"></i>';
                iconsChanged = true;
            }
        }
    });

    // Przerenderuj ikony Lucide tylko gdy faktycznie zmieniono HTML
    if (iconsChanged && window.lucide) {
        window.lucide.createIcons();
    }

    const msg = document.getElementById('wizard-validation-msg');
    if (msg) msg.classList.toggle('hidden', isFullyValid);

    return isFullyValid;
}

function updateStudnieBottomNav() {
    const nav = document.getElementById('studnie-wizard-bottom-nav');
    const prevBtn = document.getElementById('studnie-nav-prev');
    const stepInfo = document.getElementById('studnie-nav-step-info');
    const nextBtn = document.getElementById('studnie-nav-next');

    if (!nav) return;

    const step = currentWizardStep;

    // Pasek nawigacji widoczny zawsze (w kroku 5 bez przycisków — sama etykieta "Zamówienie")
    nav.style.display = 'flex';
    nav.classList.toggle('no-buttons', step === 5);

    if (step === 5) return;

    if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'flex';
    if (stepInfo) stepInfo.textContent = 'Krok ' + step + ' z 5';

    if (nextBtn) {
        // Reset disabled state (może być ustawiony przez validateWizardStep2 z kroku 2)
        nextBtn.disabled = false;

        if (step === 4) {
            nextBtn.innerHTML = '<i data-lucide="arrow-right"></i> Przejdź do zamówienia';
            nextBtn.onclick = function () {
                step4NextAction();
            };
        } else if (step === 3) {
            nextBtn.innerHTML = '<i data-lucide="check"></i> Zakończ';
            nextBtn.onclick = async function () {
                if (!validateWizardStep2()) {
                    showToast('Najpierw uzupełnij wszystkie parametry w kroku 2', 'error');
                    return;
                }
                const saved = await saveOfferStudnie();
                if (saved) {
                    showSection('offer');
                    showToast('Oferta zapisana pomyślnie', 'success');
                }
            };
        } else {
            nextBtn.innerHTML = '<i data-lucide="chevron-right"></i> Dalej';
            nextBtn.onclick = wizardNext;
        }
    }
}

function updateWizardIndicator() {
    const dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach((dot) => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed', 'disabled');
        if (step === currentWizardStep) dot.classList.add('active');
        else if (step < currentWizardStep) dot.classList.add('completed');

        // Zablokuj kropkę kroku 5 w trybie oferty, kroku 3 w trybie zamówienia
        if (step === 5 && editingOfferIdStudnie && !orderEditMode) {
            dot.classList.add('disabled');
        }
        if (step === 3 && orderEditMode) {
            dot.classList.add('disabled');
        }
    });
    const line1 = document.getElementById('wizard-line-1');
    const line2 = document.getElementById('wizard-line-2');
    const line3 = document.getElementById('wizard-line-3');
    const line4 = document.getElementById('wizard-line-4');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
    if (line3) line3.classList.toggle('completed', currentWizardStep > 3);
    if (line4) line4.classList.toggle('completed', currentWizardStep > 4);
}

function updateWizardSummaryBar() {
    const client = document.getElementById('client-name')?.value || '';
    const offer = document.getElementById('offer-number')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';

    const wsbClient = document.getElementById('wsb-client');
    const wsbOffer = document.getElementById('wsb-offer');
    const wsbInvest = document.getElementById('wsb-invest');
    const wsbAddress = document.getElementById('wsb-address');
    const wsbParams = document.getElementById('wsb-params');

    if (wsbClient) wsbClient.textContent = client || '—';
    if (wsbOffer) wsbOffer.textContent = offer || '—';
    if (wsbInvest) wsbInvest.textContent = investName || '—';
    if (wsbAddress) wsbAddress.textContent = investAddress || '—';

    if (wsbParams) {
        const well = getCurrentWell();
        if (well) {
            const nadbudowa = well.nadbudowa === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const denMat = well.dennicaMaterial === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const wklArr = [];
            if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
                wklArr.push(`D:${well.wkladkaDennica}`);
            if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
                wklArr.push(`N:${well.wkladkaNadbudowa}`);
            if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
                wklArr.push(`Z:${well.wkladkaZwienczenie}`);
            const wkl = wklArr.length > 0 ? ` | PEHD [${wklArr.join(', ')}]` : '';
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

/* ===== PRZECHOWYWANIE (REST API) ===== */

async function loadStudnieProducts() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetchWithTimeout('/api/products-studnie', { silent: true }, 1000);
            if (res.ok) {
                const json = await res.json();
                if (json && Array.isArray(json.data)) {
                    var saved = json.data;
                    break;
                }
            }
        } catch (_) {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
        }
    }
    if (!saved) {
        logger.error('uiHelpers', '[Studnie] Błąd loadStudnieProducts: brak danych po 3 próbach');
        showToast('Nie udało się załadować cennika studni z serwera', 'error');
        return [];
    }

    // Napraw uszczelki DN2500 dla kompatybilności z istniejącymi danymi
    const hadDn2500Bug = saved.some(
        (p) => p.componentType === 'uszczelka' && p.id && p.id.includes('2500') && p.dn === 2000
    );
    saved.forEach((p) => {
        if (p.componentType === 'uszczelka' && p.id && p.id.includes('2500') && p.dn === 2000) {
            p.dn = 2500;
        }
    });
    if (hadDn2500Bug) {
        saveStudnieProducts(saved).catch(() => {});
    }

    return saved;
}

function renamePłyty(p) {
    // Funkcja wyłączona - pozwala użytkownikowi na swobodne nazywanie Płyt
}

async function saveStudnieProducts(data) {
    try {
        const res = await fetch('/api/products-studnie', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ data })
        });
        return res.ok;
    } catch {
        return false;
    }
}

/* ===== CENNIK PRECO — load / save / defaults ===== */

/**
 * Ładuje cennik PRECO z backendu.
 */
async function loadPrecoPricing() {
    try {
        const res = await fetchWithTimeout('/api/preco-pricing');
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            precoPricing = json.data[0];
            logger.info('uiHelpers', '[PRECO] Załadowano cennik z bazy');
            return;
        }
    } catch (e) {
        logger.warn('uiHelpers', '[PRECO] Błąd pobierania cennika z API:', e);
    }
    precoPricing = {};
    logger.warn('uiHelpers', '[PRECO] Brak cennika w bazie');
}

/**
 * Zapisuje cennik PRECO do backendu.
 */
async function savePrecoPricing(data) {
    try {
        const res = await fetch('/api/preco-pricing', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            logger.error('uiHelpers', '[PRECO] Błąd zapisu:', res.status, err);
            showToast('Błąd zapisu cennika PRECO: ' + (err.error || res.status), 'error');
            return false;
        }
        showToast('Cennik PRECO zapisany', 'success');
        return true;
    } catch (err) {
        logger.error('uiHelpers', '[PRECO] Błąd sieci:', err);
        showToast('Błąd sieci przy zapisie cennika PRECO', 'error');
        return false;
    }
}

// DOMContentLoaded
