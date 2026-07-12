// @ts-check
/* ===== wellActions.js — barrel ===== */
/* Re-eksportuje funkcje z modułów wellActions/ */

// Debounce dla ciężkich operacji renderowania (definiowane przed modułami używającymi)
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
