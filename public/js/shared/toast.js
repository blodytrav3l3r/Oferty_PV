// @ts-check
/**
 * toast.js — ES module (TASK-047, etap 3).
 * Wspólne powiadomienia toast (showToast).
 * Eksport ESM + mostek `window.*` dla niezmigrowanych plików legacy.
 */

import { escapeHtml } from './escapeHtml.js';

/**
 * Wyświetla powiadomienie toast.
 * @param {string} msg - treść powiadomienia
 * @param {'success'|'error'|'info'|'warning'} type - typ powiadomienia
 */
export function showToast(msg, type = 'info') {
    const container =
        document.getElementById('toast-container') || document.querySelector('.toast-container');
    if (!container) {
        logger.warn('ui', 'showToast: brak #toast-container w HTML');
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const text = document.createElement('span');
    // Bezpieczne: wyciągnij nazwę ikony Lucide przed eskejpowaniem HTML,
    // a tag odtwórz od zera (surowy <i> mógł nieść dowolne atrybuty, np. onclick)
    const iconRegex = /<i\s+[^>]*data-lucide="([^"]*)"[^>]*><\/i>/gi;
    const icons = [];
    const safe = msg.replace(iconRegex, (_, name) => {
        icons.push(name);
        return `\x00ICON${icons.length - 1}\x00`;
    });
    text.innerHTML = escapeHtml(safe).replace(
        /* eslint-disable-next-line no-control-regex */
        /\x00ICON(\d+)\x00/g,
        (_, i) => `<i data-lucide="${escapeHtml(icons[parseInt(i)] || '')}" aria-hidden="true"></i>`
    );
    if (window.lucide) lucide.createIcons();
    text.style.flex = '1';
    toast.appendChild(text);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    if (window.lucide) lucide.createIcons();
    closeBtn.style.cssText =
        'background:none;border:none;color:inherit;cursor:pointer;font-size: var(--fs-2xl);padding:0 0 0 .5rem;opacity:.7;';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/* Bridge dla legacy — usunąć po zmigrowaniu wszystkich callerów */
window.showToast = showToast;
