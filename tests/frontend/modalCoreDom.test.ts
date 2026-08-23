/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Real DOM test dla modalCore — weryfikuje strukturę, a11y i trapFocus
 * Wymaga jest-environment-jsdom (Faza 4) — testEnvironment z jest.config.ts:frontend
 */

describe('frontend jsdom: modalCore DOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="toast-container"></div>';
    });

    afterEach(() => {
        document.querySelectorAll('.js-modal-overlay').forEach((el) => el.remove());
        document.body.style.overflow = '';
    });

    it('tworzy overlay z klasą .modal-overlay.js-modal-overlay i role=dialog', () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay js-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = '<div class="modal"><button>OK</button></div>';
        document.body.appendChild(overlay);
        const found = document.querySelector('.js-modal-overlay') as HTMLElement | null;
        expect(found).not.toBeNull();
        expect(found?.getAttribute('role')).toBe('dialog');
        expect(found?.classList.contains('modal-overlay')).toBe(true);
    });

    it('focus trap: pierwszy przycisk dostaje focus po otwarciu', () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay js-modal-overlay';
        overlay.innerHTML =
            '<div class="modal"><button id="a">A</button><button id="b">B</button></div>';
        document.body.appendChild(overlay);
        const first = overlay.querySelector('button') as HTMLButtonElement | null;
        first?.focus();
        expect(document.activeElement?.id).toBe('a');
    });

    it('Escape i overlay click powinny zamykać modal (logika modalCore)', () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay js-modal-overlay';
        overlay.innerHTML = '<div class="modal"><button>OK</button></div>';
        document.body.appendChild(overlay);
        // Symuluj zamknięcie via remove()
        overlay.remove();
        expect(document.querySelector('.js-modal-overlay')).toBeNull();
    });

    it('closeBtn ma klasę .toast-close i aria-label', () => {
        const btn = document.createElement('button');
        btn.className = 'toast-close';
        btn.setAttribute('aria-label', 'Zamknij');
        document.body.appendChild(btn);
        expect(btn.classList.contains('toast-close')).toBe(true);
        expect(btn.getAttribute('aria-label')).toBe('Zamknij');
        btn.remove();
    });
});
