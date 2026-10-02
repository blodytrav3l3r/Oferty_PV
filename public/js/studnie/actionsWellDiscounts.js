// @ts-check
/* ===== PANEL RABATĂ“W ===== */

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
    // Granica UI: input DOM daje string. Numeryczny string parsuj, resztę
    // waliduje applyDiscount (throw, brak zapisu). '' = pusty input → 0
    // (czyszczenie rabatu, konwencja UI — nie clamp wartości).
    const newValue = typeof value === 'number' ? value : Number(String(value));
    const oldDisc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    const oldValue = oldDisc[type] || 0;

    if (
        (dn === 'styczna' || dn === 'styczne') &&
        type === 'dennica' &&
        newValue > 0 &&
        newValue !== oldValue
    ) {
        confirmApp(
            'Uwaga rabat na studnie styczną',
            () => {
                applyDiscount(dn, type, newValue);
            },
            () => {
                renderDiscountPanel();
            }
        );
        return;
    }

    applyDiscount(dn, type, newValue);
}

function applyDiscount(dn, type, value) {
    // Kontrakt: discountPct ∈ [0,100] finite number, inaczej throw RangeError.
    // Nigdy nie zapisuj invalid do wellDiscounts (typeof check odrzuca też
    // numeryczne stringi — przez UI przechodź updateDiscount, nie tutaj).
    if (typeof assertDiscountPct === 'function') {
        assertDiscountPct(value, dn + '.' + type);
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        throw new RangeError('Invalid discountPct: ' + String(value));
    }
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    wellDiscounts[dn][type] = value;

    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    renderWellConfig();
}

function updateGlobalPaintingCost(field, value) {
    // P2: śmieć nie zeruje cen wszystkich studni — toast + brak zapisu.
    // Puste = 0 (legacy czyszczenie pola).
    const raw = value !== undefined && value !== null ? String(value) : '';
    if (raw.trim() !== '') {
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n)) {
            if (typeof window !== 'undefined' && typeof window.showToast === 'function')
                window.showToast('Nieprawidłowa cena malowania — pominięto', 'error');
            return;
        }
    }
    const numVal = raw.trim() === '' ? 0 : parseFloat(raw.replace(',', '.'));
    wells.forEach((w) => {
        w[field] = numVal;

        if (field === 'malowanieWewCena' && !w.malowanieZewManual) {
            w.malowanieZewCena = numVal;
        }

        if (field === 'malowanieZewCena') {
            w.malowanieZewManual = true;
        }
    });

    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.classList.contains('active');

    if (!isOfferModalOpen) {
        if (typeof window.showToast === 'function')
            window.showToast(
                `Zaktualizowano cenę malowania (${numVal} PLN/mÂ˛) we wszystkich studniach`,
                'info'
            );
    }

    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    if (typeof renderWellParams === 'function') renderWellParams();

    if (isOfferModalOpen) {
        if (typeof updateOfferDiscountsPopupPrices === 'function') {
            updateOfferDiscountsPopupPrices();
        }

        if (field === 'malowanieWewCena' && document.getElementById('offer-mal-zew-cena')) {
            const zewInput = document.getElementById('offer-mal-zew-cena');
            const refW = wells[0];
            if (refW && !refW.malowanieZewManual) {
                zewInput.value = String(numVal);
            }
        }
    }
}

function updateGlobalPehdDiscount(value) {
    // P2: jak wyżej — śmieć nie zeruje rabatu PEHD we wszystkich studniach.
    const raw = value !== undefined && value !== null ? String(value) : '';
    if (raw.trim() !== '') {
        const n = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(n)) {
            if (typeof window !== 'undefined' && typeof window.showToast === 'function')
                window.showToast('Nieprawidłowy rabat — pominięto', 'error');
            return;
        }
    }
    const numVal = raw.trim() === '' ? 0 : parseFloat(raw.replace(',', '.'));
    wells.forEach((w) => {
        w.pehdDiscount = numVal;
    });

    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.classList.contains('active');

    if (!isOfferModalOpen) {
        if (typeof window.showToast === 'function')
            window.showToast(
                `Zaktualizowano rabat PEHD (${numVal}%) we wszystkich studniach`,
                'info'
            );
    }

    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (typeof freezeWellPrices === 'function') {
            freezeWellPrices(wells);
        }
    }

    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
    if (typeof renderWellConfig === 'function') renderWellConfig();
    if (typeof renderWellParams === 'function') renderWellParams();

    if (isOfferModalOpen) {
        if (typeof updateOfferDiscountsPopupPrices === 'function') {
            updateOfferDiscountsPopupPrices();
        }

        const priceAfterDiscountSpan = document.getElementById('offer-pehd-price-after-discount');
        if (priceAfterDiscountSpan) {
            let currentPehdPrice = 0;
            for (const p of studnieProducts) {
                if (
                    p.area > 0 &&
                    p.doplataPEHD > 0 &&
                    p.componentType !== 'przejscie' &&
                    p.componentType !== 'kineta' &&
                    p.componentType !== 'konus'
                ) {
                    currentPehdPrice = Math.round(p.doplataPEHD / getPehdEffectiveArea(p));
                    break;
                }
            }
            const priceAfterDiscount = currentPehdPrice * (1 - numVal / 100);
            priceAfterDiscountSpan.innerText = priceAfterDiscount.toFixed(2);
        }
    }
}

function getDiscountedTotal() {
    // Render/podsumowanie: corrupt stored → fallback 0% (kontrakt throw nietknięty).
    const _cs = typeof safeCalcWellStats === 'function' ? safeCalcWellStats : calcWellStats;
    let grandTotal = 0;
    wells.forEach((w) => {
        const s = _cs(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

/* ===== Rejestracja globali ===== */
window.handleAppConfirm = handleAppConfirm;
window.updateDiscount = updateDiscount;
window.updateGlobalPaintingCost = updateGlobalPaintingCost;
window.updateGlobalPehdDiscount = updateGlobalPehdDiscount;
window.getDiscountedTotal = getDiscountedTotal;
