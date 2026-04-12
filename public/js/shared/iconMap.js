/**
 * iconMap.js — Centralna mapa ikon i mechanizm automatycznej hydracji Lucide.
 *
 * Zamiast MutationObserver (który powodował nieskończone pętle mutacji DOM),
 * stosujemy bezpieczny setInterval sprawdzający czy istnieją niezrenderowane
 * tagi <i data-lucide="...">.
 */

/**
 * Hydracja ikon Lucide — wywołuje lucide.createIcons() tylko gdy
 * na stronie istnieją jeszcze niezrenderowane tagi <i data-lucide>.
 * Bezpieczna do wielokrotnego wywołania (idempotentna).
 */
function hydrateLucideIcons() {
    if (!window.lucide) return;
    const pending = document.querySelectorAll('i[data-lucide]');
    if (pending.length > 0) {
        lucide.createIcons();
    }
}

// Początkowa hydracja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    hydrateLucideIcons();
});

// Cykliczna hydracja co 800ms — łapie dynamicznie wstawiane ikony
// bez ryzyka nieskończonej pętli jak MutationObserver
setInterval(hydrateLucideIcons, 800);
