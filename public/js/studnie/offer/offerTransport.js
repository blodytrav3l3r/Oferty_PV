/* ===== MODAL TRANSPORTU OFERTY ===== */

const initialTransportSnapshot = { km: 0, rate: 0 };
let currentTransportMode = 'full';

window.updateTransportCostSummary = function () {
    const input = document.getElementById('step4-wyliczony-transport');
    if (!input) return;
    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    const costPerTrip = transportKm * transportRate;
    let totalWeight = 0;
    if (typeof wells !== 'undefined' && typeof calcWellStats === 'function') {
        wells.forEach((w) => (totalWeight += calcWellStats(w).weight));
    }
    if (costPerTrip > 0 && totalWeight > 0) {
        const count =
            typeof calcTransportCount === 'function'
                ? calcTransportCount(totalWeight, currentTransportMode)
                : 0;
        if (count > 0) {
            const totalCost = count * costPerTrip;
            const fmt = (v) =>
                v
                    .toFixed(2)
                    .replace('.', ',')
                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            const countLabel =
                typeof formatTransportCount === 'function'
                    ? formatTransportCount(count, currentTransportMode)
                    : count;
            input.value = `${countLabel} x ${fmt(costPerTrip)} zł = ${fmt(totalCost)} zł`;
            return;
        }
    }
    input.value = 'Brak transportu';
};

window.toggleTransportMode = function () {
    currentTransportMode = currentTransportMode === 'full' ? 'fractional' : 'full';
    const label = document.getElementById('transport-mode-label');
    if (label) label.textContent = currentTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';
    if (typeof window.updateModalTransportDetails === 'function')
        window.updateModalTransportDetails();
};

window.updateModalTransportDetails = function () {
    const modalKm = parseFloat(document.getElementById('transport-modal-km')?.value) || 0;
    const modalRate = parseFloat(document.getElementById('transport-modal-rate')?.value) || 0;
    let globalWeight = 0;
    if (typeof wells !== 'undefined' && typeof calcWellStats === 'function') {
        wells.forEach((w) => (globalWeight += calcWellStats(w).weight));
    }
    const fmt = (v) => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    let costPerTrip = 0;
    let totalTransports = 0;
    let totalTransportCost = 0;
    if (modalKm > 0 && modalRate > 0) {
        costPerTrip = modalKm * modalRate;
        if (globalWeight > 0) {
            totalTransports =
                typeof calcTransportCount === 'function'
                    ? calcTransportCount(globalWeight, currentTransportMode)
                    : Math.ceil(globalWeight / MAX_TRANSPORT_WEIGHT);
            totalTransportCost = totalTransports * costPerTrip;
        }
    }
    const costPerTripEl = document.getElementById('transport-modal-cost-per-trip');
    const countEl = document.getElementById('transport-modal-count');
    const totalCostEl = document.getElementById('transport-modal-total-cost');
    if (costPerTripEl) costPerTripEl.textContent = fmt(costPerTrip) + ' PLN';
    if (countEl)
        countEl.textContent =
            typeof formatTransportCount === 'function'
                ? formatTransportCount(totalTransports, currentTransportMode)
                : totalTransports;
    if (totalCostEl) totalCostEl.textContent = fmt(totalTransportCost) + ' PLN';
    const tripsInfoEl = document.getElementById('transport-modal-trips-info');
    if (tripsInfoEl) {
        const countLabel =
            typeof formatTransportCount === 'function'
                ? formatTransportCount(totalTransports, currentTransportMode)
                : totalTransports;
        tripsInfoEl.innerHTML = `<span style="color: var(--text-secondary);">Łączny ciężar: <strong>${typeof fmtInt === 'function' ? escapeHtml(fmtInt(globalWeight)) : escapeHtml(globalWeight)} kg</strong> &bull; Ilość transportów: <strong style="color: #eab308;">${escapeHtml(countLabel)}</strong></span>`;
    }
    const totalValEl = document.getElementById('transport-modal-total-val');
    if (totalValEl) {
        let productsNetto = 0;
        if (typeof wells !== 'undefined' && typeof calcWellStats === 'function') {
            wells.forEach((w) => {
                productsNetto += calcWellStats(w).price;
            });
        }
        totalValEl.textContent =
            (typeof fmt === 'function' ? fmt : (v) => v)(productsNetto + totalTransportCost) +
            ' PLN';
    }
};

window.openTransportPopup = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('transport-modal-km');
    const modalRate = document.getElementById('transport-modal-rate');

    if (typeof orderEditMode !== 'undefined' && orderEditMode && orderEditMode.order) {
        currentTransportMode = orderEditMode.order.transportMode || 'fractional';
    } else if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
        const offer =
            typeof offersStudnie !== 'undefined'
                ? offersStudnie.find((o) => o.id === editingOfferIdStudnie)
                : null;
        currentTransportMode = (offer && offer.transportMode) || 'full';
    }
    const modeLabel = document.getElementById('transport-mode-label');
    if (modeLabel)
        modeLabel.textContent = currentTransportMode === 'full' ? 'Pełne' : 'Rzeczywiste';

    initialTransportSnapshot.km = parseFloat(kmInput?.value) || 0;
    initialTransportSnapshot.rate = parseFloat(rateInput?.value) || 0;

    if (kmInput && modalKm) modalKm.value = kmInput.value || '0';
    if (rateInput && modalRate) modalRate.value = rateInput.value || '0';

    if (typeof window.updateModalTransportDetails === 'function')
        window.updateModalTransportDetails();

    const modal = document.getElementById('offer-transport-modal');
    if (modal) modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.handleOfferTransportCancel = async function () {
    const hideModal = () => {
        const m = document.getElementById('offer-transport-modal');
        if (m) m.style.display = 'none';
    };
    const modalKm = parseFloat(document.getElementById('transport-modal-km')?.value) || 0;
    const modalRate = parseFloat(document.getElementById('transport-modal-rate')?.value) || 0;

    if (modalKm !== initialTransportSnapshot.km || modalRate !== initialTransportSnapshot.rate) {
        if (typeof window.appConfirm === 'function') {
            const confirmed = await window.appConfirm(
                `<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">Wyjdź bez zapisywania</div>
                 <div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">Wprowadzono nowe współrzędne transportu. Czy wyjść z okna i odrzucić zmiany w formularzu?</div>`,
                { allowHtml: true, okText: 'Odrzuć zmiany', cancelText: 'Zostań' }
            );

            if (confirmed) {
                const kmInput = document.getElementById('transport-km');
                const rateInput = document.getElementById('transport-rate');
                if (kmInput) kmInput.value = String(initialTransportSnapshot.km);
                if (rateInput) rateInput.value = String(initialTransportSnapshot.rate);

                const inOrderMode = typeof orderEditMode !== 'undefined' && orderEditMode;
                if (inOrderMode) {
                    if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
                } else {
                    if (typeof renderOfferSummary === 'function') renderOfferSummary();
                }
                if (typeof updateSummary === 'function') updateSummary();

                hideModal();
            }
        } else {
            hideModal();
        }
    } else {
        hideModal();
    }
};

window.handleOfferTransportSave = async function () {
    const hideModal = () => {
        const m = document.getElementById('offer-transport-modal');
        if (m) m.style.display = 'none';
    };
    if (typeof window.appConfirm === 'function') {
        const inOrderMode = typeof orderEditMode !== 'undefined' && orderEditMode;
        const confirmed = await window.appConfirm(
            `<div style="font-size: 1.1rem; font-weight: 800; text-transform: none; letter-spacing: normal;">Zapisz nową konfigurację transportu</div>
             <div style="font-size: 0.9rem; line-height: 1.4; padding: 1rem 0;">Czy na pewno chcesz zapisać parametry przewozu do ${inOrderMode ? 'zamówienia' : 'oferty'}?</div>`,
            {
                allowHtml: true,
                okText: inOrderMode ? 'Zapisz Zamówienie' : 'Zapisz Ofertę',
                cancelText: 'Anuluj'
            }
        );

        if (confirmed) {
            const kmInput = document.getElementById('transport-km');
            const rateInput = document.getElementById('transport-rate');
            const modalKm = document.getElementById('transport-modal-km');
            const modalRate = document.getElementById('transport-modal-rate');
            if (kmInput && modalKm) kmInput.value = modalKm.value || '0';
            if (rateInput && modalRate) rateInput.value = modalRate.value || '0';
            hideModal();

            if (inOrderMode) {
                if (typeof saveCurrentOrder === 'function') saveCurrentOrder();
            } else {
                if (typeof renderOfferSummary === 'function') renderOfferSummary();
                if (typeof saveOfferStudnie === 'function') saveOfferStudnie();
            }
        }
    } else {
        hideModal();
        if (typeof saveOfferStudnie === 'function') saveOfferStudnie();
    }
};

window.syncTransportFromModal = function () {
    const kmInput = document.getElementById('transport-km');
    const rateInput = document.getElementById('transport-rate');
    const modalKm = document.getElementById('transport-modal-km');
    const modalRate = document.getElementById('transport-modal-rate');

    if (kmInput && modalKm) kmInput.value = modalKm.value || '0';
    if (rateInput && modalRate) rateInput.value = modalRate.value || '0';

    if (typeof renderOfferSummary === 'function') renderOfferSummary();
    if (typeof window.updateTransportCostSummary === 'function')
        window.updateTransportCostSummary();

    if (typeof window.updateModalTransportDetails === 'function')
        window.updateModalTransportDetails();
};

function normalizeValidityValue(val) {
    if (!val) return '7 dni';
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) return trimmed + ' dni';
    return trimmed;
}
