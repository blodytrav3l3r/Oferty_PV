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
});
