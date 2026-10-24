/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Regresja: ukryte (display:none) overlaye .js-modal-overlay nie mogą blokować
 * odblokowania scrolla strony (baza: „czasem paski się nie pojawiają").
 * Scenariusze: statyczny transport-modal w DOM, closeModal(id) chowający
 * zamiast usuwać, stos modali (ukryty + widoczny).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('frontend: restoreBodyScroll ignoruje ukryte overlaye', () => {
    let ctx: any;

    beforeAll(() => {
        const file = path.join(process.cwd(), 'public/js/shared/modalCore.js');
        const code = fs
            .readFileSync(file, 'utf-8')
            .replace(/import\s+.*from\s+['"].*['"];?/, '')
            .replace(/export function/g, 'function');
        const context: any = {
            document,
            window: {
                getComputedStyle: (el: Element) => global.window.getComputedStyle(el)
            },
            setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
            escapeHtml: (s: any) => String(s ?? '')
        };
        vm.createContext(context);
        vm.runInContext(code, context, { filename: 'modalCore.js' });
        ctx = context;
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.style.overflow = 'hidden';
    });

    afterEach(() => {
        document.querySelectorAll('.js-modal-overlay').forEach((el) => el.remove());
        document.body.style.overflow = '';
    });

    function addOverlay(id: string, visible: boolean) {
        const el = document.createElement('div');
        el.className = 'modal-overlay js-modal-overlay';
        el.id = id;
        if (!visible) el.style.display = 'none';
        el.innerHTML = '<div class="modal"><button>OK</button></div>';
        document.body.appendChild(el);
        return el;
    }

    it('brak overlayów → odblokowuje body', () => {
        ctx.window.restoreBodyScroll();
        expect(document.body.style.overflow).toBe('');
    });

    it('tylko ukryty overlay (scenariusz transport-modal) → odblokowuje body', () => {
        addOverlay('rury-transport-modal', false);
        ctx.window.restoreBodyScroll();
        expect(document.body.style.overflow).toBe('');
    });

    it('widoczny overlay → body zostaje zablokowane', () => {
        addOverlay('share-modal', true);
        ctx.window.restoreBodyScroll();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('ukryty + widoczny (stos modali) → body zostaje zablokowane', () => {
        addOverlay('rury-transport-modal', false);
        addOverlay('share-modal', true);
        expect(ctx.window.hasVisibleModalOverlay()).toBe(true);
        ctx.window.restoreBodyScroll();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('pełny cykl showModal → closeModal(id) → body odblokowane', () => {
        addOverlay('rury-transport-modal', false);
        ctx.window.showModal({
            id: 'share-modal',
            title: 'Share',
            titleId: 'share-title',
            html: '<div class="modal"><button>OK</button></div>'
        });
        expect(document.body.style.overflow).toBe('hidden');
        ctx.window.closeModal('share-modal');
        // Ukryty węzeł wisi w DOM, ale scroll wraca.
        expect(document.getElementById('share-modal')).not.toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('closeModal() bez id usuwa overlaye i odblokowuje body', () => {
        ctx.window.showModal({
            id: 'a-modal',
            title: 'A',
            titleId: 'a-title',
            html: '<div class="modal"><button>OK</button></div>'
        });
        ctx.window.closeModal();
        expect(document.querySelector('.js-modal-overlay')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('closeModal() bez id nie usuwa ukrytego statycznego overlaya (transport-modal)', () => {
        const staticOverlay = addOverlay('rury-transport-modal', false);
        ctx.window.showModal({
            id: 'b-modal',
            title: 'B',
            titleId: 'b-title',
            html: '<div class="modal"><button>OK</button></div>'
        });
        ctx.window.closeModal();
        expect(document.getElementById('rury-transport-modal')).toBe(staticOverlay);
        expect(document.getElementById('b-modal')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('closeModal() bez id zamyka tylko wierzchni overlay (LIFO wg DOM)', () => {
        addOverlay('lower-modal', true);
        addOverlay('top-modal', true);
        ctx.window.closeModal();
        expect(document.getElementById('top-modal')).toBeNull();
        expect(document.getElementById('lower-modal')).not.toBeNull();
        // Nadal widoczny modal → scroll zostaje zablokowany.
        expect(document.body.style.overflow).toBe('hidden');
        ctx.window.closeModal();
        expect(document.getElementById('lower-modal')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('closeModal() bez id przy braku widocznych overlayów nic nie usuwa', () => {
        const hidden = addOverlay('rury-transport-modal', false);
        ctx.window.closeModal();
        expect(document.getElementById('rury-transport-modal')).toBe(hidden);
        expect(document.body.style.overflow).toBe('');
        ctx.window.closeModal();
        expect(document.getElementById('rury-transport-modal')).toBe(hidden);
    });

    function pressEscape(el: Element) {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }

    it('Escape (trapFocus) zamyka dokładnie jeden modal — wierzchni', () => {
        const lower = addOverlay('lower-modal', true);
        const top = addOverlay('top-modal', true);
        ctx.window.trapFocus(lower);
        ctx.window.trapFocus(top);
        pressEscape(top);
        expect(document.getElementById('top-modal')).toBeNull();
        expect(document.getElementById('lower-modal')).not.toBeNull();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('Escape zamyka własny kontener, gdy dwa modale są widoczne', () => {
        const lower = addOverlay('lower-modal', true);
        addOverlay('top-modal', true);
        ctx.window.trapFocus(lower);
        pressEscape(lower);
        expect(document.getElementById('lower-modal')).toBeNull();
        expect(document.getElementById('top-modal')).not.toBeNull();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('Escape w showModal respektuje onClose === false', () => {
        const overlay = ctx.window.showModal({
            id: 'guarded-modal',
            title: 'Guarded',
            titleId: 'guarded-title',
            html: '<div class="modal"><button>OK</button></div>',
            onClose: () => false
        });
        pressEscape(overlay);
        expect(document.getElementById('guarded-modal')).not.toBeNull();
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('Escape w showModal zamyka modal i odblokowuje body', () => {
        const overlay = ctx.window.showModal({
            id: 'esc-modal',
            title: 'Esc',
            titleId: 'esc-title',
            html: '<div class="modal"><button>OK</button></div>'
        });
        pressEscape(overlay);
        expect(document.getElementById('esc-modal')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });
});
