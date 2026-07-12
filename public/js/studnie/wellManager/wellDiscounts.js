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
    const newValue = parseFloat(value) || 0;
    const oldDisc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    const oldValue = oldDisc[type] || 0;

    // Sprawdź, czy potrzebny jest popup (tylko dla bazy stycznej i jeśli wartość faktycznie zmieniła się na > 0)
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
                // Anuluj - zresetuj UI
                renderDiscountPanel();
            }
        );
        return;
    }

    applyDiscount(dn, type, newValue);
}

function applyDiscount(dn, type, value) {
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0, preco: 0, pehd: 0 };
    wellDiscounts[dn][type] = value;

    // W trybie zamówienia: zamrożone ceny blokują przeliczanie rabatu,
    // więc musimy je przeliczyć z nowym rabatem
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

/**
 * Aktualizuje cenę malowania globalnie we wszystkich studniach.
 * Wywoływane z panelu rabatów (sekcja "Koszt malowania").
 *
 * @param {string} field - 'malowanieWewCena' lub 'malowanieZewCena'
 * @param {string} value - nowa cena za m²
 */
function updateGlobalPaintingCost(field, value) {
    const numVal = parseFloat(value) || 0;
    wells.forEach((w) => {
        w[field] = numVal;

        // Jeśli zmieniamy wewnętrzną, a zewnętrzna nie była ręcznie modyfikowana, zaktualizuj też zewnętrzną
        if (field === 'malowanieWewCena' && !w.malowanieZewManual) {
            w.malowanieZewCena = numVal;
        }

        // Jeśli użytkownik zmienia zewnętrzną ręcznie, oznacz to by przestać automatycznie przepisywać
        if (field === 'malowanieZewCena') {
            w.malowanieZewManual = true;
        }
    });

    // Brak toasta podczas szybkiego wpisywania w modalu by nie spamować (chyba że zmiana z konfiguratora bocznego)
    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.style.display === 'flex';

    if (!isOfferModalOpen) {
        showToast(
            `Zaktualizowano cenę malowania (${numVal} PLN/m²) we wszystkich studniach`,
            'info'
        );
    }

    // W trybie zamówienia: zamrożone ceny blokują przeliczanie wyceny,
    // musimy zaktualizować "zamrożone" ceny o nowe koszty malowania
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

    // Odśwież też w "Zarządzanie Rabatami Oferty" jeśli okno jest otwarte (bez utraty focusa!)
    if (isOfferModalOpen) {
        if (typeof updateOfferDiscountsPopupPrices === 'function') {
            updateOfferDiscountsPopupPrices();
        }

        // Na żywo zaktualizuj też wizualnie pole zewnętrzne jeśli przypisywano automatycznie
        if (field === 'malowanieWewCena' && document.getElementById('offer-mal-zew-cena')) {
            const zewInput = document.getElementById('offer-mal-zew-cena');
            const refW = wells[0];
            if (refW && !refW.malowanieZewManual) {
                zewInput.value = String(numVal);
            }
        }
    }
}

/**
 * Aktualizuje globalny rabat na wkładkę PEHD we wszystkich studniach.
 * Wywoływane z panelu rabatów (sekcja "Wkładka PEHD").
 *
 * @param {string} value - nowa wartość procentowa rabatu
 */
function updateGlobalPehdDiscount(value) {
    const numVal = parseFloat(value) || 0;
    wells.forEach((w) => {
        w.pehdDiscount = numVal;
    });

    const offerModal = document.getElementById('offer-discounts-modal');
    const isOfferModalOpen = offerModal && offerModal.style.display === 'flex';

    if (!isOfferModalOpen) {
        showToast(`Zaktualizowano rabat PEHD (${numVal}%) we wszystkich studniach`, 'info');
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

        // Zaktualizuj pole z ceną po rabacie, jeśli istnieje
        const priceAfterDiscountSpan = document.getElementById('offer-pehd-price-after-discount');
        if (priceAfterDiscountSpan) {
            let currentPehdPrice = 0;
            for (const p of studnieProducts) {
                if (
                    p.area > 0 &&
                    p.doplataPEHD > 0 &&
                    p.componentType !== 'przejscie' &&
                    p.componentType !== 'kineta'
                ) {
                    currentPehdPrice = Math.round(p.doplataPEHD / p.area);
                    break;
                }
            }
            const priceAfterDiscount = currentPehdPrice * (1 - numVal / 100);
            priceAfterDiscountSpan.innerText = priceAfterDiscount.toFixed(2);
        }
    }
}

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach((w) => {
        const s = calcWellStats(w);
        grandTotal += s.price;
    });
    return grandTotal;
}

// renderDiscountPanel() przeniesiona do wellUI.js
