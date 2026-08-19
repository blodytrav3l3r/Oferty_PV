// @ts-check
/**
 * modalCore.js — ES module (TASK-047, etap 2; rdzeń z TASK-027).
 * Wspólny system modalów: open/close, focus trap, focus restore, Escape, click-outside.
 * Eksport ESM + mostek `window.*` dla niezmigrowanych plików legacy.
 */

import { escapeHtml } from './escapeHtml.js';

/**
 * Zamyka modal (popup) po ID.
 * @param {string} [id] - ID elementu modala
 */
export function closeModal(id) {
    if (id) {
        const el = document.getElementById(id);
        if (el) {
            untrapFocus(el);
            el.style.display = 'none';
        }
    } else {
        document.querySelectorAll('.js-modal-overlay').forEach((m) => {
            untrapFocus(m);
            m.remove();
        });
    }
}

/**
 * Pułapka fokusa wewnątrz modala (Tab/Shift+Tab, Escape).
 * @param {Element} container
 */
export function trapFocus(container) {
    const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        if (e.key === 'Escape') closeModal();
    };
    container.addEventListener('keydown', handler);
    /** @type {any} */ (container)._trapFocusHandler = handler;
}

/**
 * Zwalnia pułapkę fokusa i przywraca poprzedni aktywny element.
 * @param {Element} container
 */
export function untrapFocus(container) {
    if (container && /** @type {any} */ (container)._trapFocusHandler) {
        container.removeEventListener('keydown', /** @type {any} */ (container)._trapFocusHandler);
        /** @type {any} */ (container)._trapFocusHandler = null;
    }
    const prev = /** @type {any} */ (container)._previousFocus;
    if (prev && typeof prev.focus === 'function' && prev.isConnected) prev.focus();
}

/**
 * Create and show a modal overlay with standard ARIA attributes.
 * @param {Object} opts
 * @param {string} opts.id - Overlay element ID
 * @param {string} opts.title - Modal title (for aria-labelledby)
 * @param {string} opts.titleId - Element ID for the title
 * @param {string} opts.html - Modal inner HTML
 * @param {Function} [opts.onOpen] - Called after modal is shown
 * @param {Function} [opts.onClose] - Called when modal is closed
 * @returns {HTMLDivElement} The overlay element
 */
export function showModal(opts) {
    const existing = document.getElementById(opts.id);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay js-modal-overlay';
    overlay.id = opts.id;
    overlay.role = 'dialog';
    overlay.ariaModal = 'true';
    if (opts.titleId) overlay.setAttribute('aria-labelledby', opts.titleId);

    overlay.innerHTML = opts.html;
    document.body.appendChild(overlay);
    /** @type {any} */ (overlay)._previousFocus = document.activeElement;

    function onOverlayClick(e) {
        if (e.target === overlay) {
            untrapFocus(overlay);
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    }
    overlay.addEventListener('click', onOverlayClick);

    function onOverlayKeydown(e) {
        if (e.key === 'Escape') {
            untrapFocus(overlay);
            overlay.remove();
            if (opts.onClose) opts.onClose();
        }
    }
    overlay.addEventListener('keydown', onOverlayKeydown);

    trapFocus(overlay);

    const firstBtn = overlay.querySelector('button');
    if (firstBtn)
        setTimeout(function () {
            firstBtn.focus();
        }, 50);

    if (opts.onOpen) opts.onOpen();
    return overlay;
}

/* Bridge dla legacy — usunąć po zmigrowaniu wszystkich callerów */
window.showModal = showModal;
window.closeModal = closeModal;
window.trapFocus = trapFocus;
window.untrapFocus = untrapFocus;
window.escapeHtml = escapeHtml;
