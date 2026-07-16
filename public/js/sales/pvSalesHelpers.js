// @ts-check
/* ===== Funkcje pomocnicze dla PV Sales UI ===== */

/**
 * Inferuje, czy oferta jest rurą (vs studnią) na podstawie pola type
 * oraz fallbacków dla legacy danych.
 *  - 'rura_oferta' → rury (aktualny typ)
 *  - 'offer'       → rury (legacy typ używany przed rename)
 *  - id oferty zaczynające się od 'offer_rury_' → rury (heurystyka po ID)
 * Wszystkie pozostałe (w tym 'studnia_oferta' i brak danych) → studnie.
 */
function isRuryOfferFromTypeOrId(offerType, offerId) {
    if (offerType === 'rura_oferta' || offerType === 'offer') return true;
    if (offerId && /^offer_rury_/.test(offerId)) return true;
    return false;
}

/**
 * Wspólna funkcja otwierająca uniwersalny modal wydruku
 * (public/js/shared/printModal.js). Wywoływana ze wszystkich
 * przycisków wydruku w kartotece (główny wiersz, per-order
 * "Karta budowy", popup "Karta") — gwarantuje identyczny popup
 * niezależnie od ścieżki.
 *
 * @param {string|null} offerId   ID oferty (lub null jeśli niedostępne)
 * @param {string|null} orderId   ID zamówienia (lub '' jeśli brak)
 * @param {string|null} offerType 'rura_oferta' | 'offer' (legacy) | 'studnia_oferta' | null
 */
function openPrintModal(offerId, orderId, offerType, relatedOrders) {
    if (!offerId && !orderId) {
        if (typeof showToast === 'function') {
            showToast('Brak identyfikatora oferty/zamówienia do wydruku', 'error');
        }
        return;
    }
    const isRury = isRuryOfferFromTypeOrId(offerType, offerId);
    const safeOrderId = orderId || '';
    const safeRelatedOrders = Array.isArray(relatedOrders) ? relatedOrders : null;
    if (isRury && typeof window.showUniversalPrintModalRury === 'function') {
        window.showUniversalPrintModalRury(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof window.showUniversalPrintModal === 'function') {
        window.showUniversalPrintModal(offerId, safeOrderId, safeRelatedOrders);
    } else if (typeof showToast === 'function') {
        showToast('Funkcja wydruku nie jest dostępna w tym widoku.', 'info');
    }
}
