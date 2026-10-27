import fs from 'fs';
import path from 'path';

/**
 * Modale sesji (sessionIdle.js) muszą używać wspólnego wzorca SOK:
 * `.modal-overlay` (modalCore.js) > `.modal` + `.modal-header`/`.modal-footer`,
 * przyciski `.btn`, bez inline styles i bez legacy `.app-confirm-*`
 * (te klasy są ostylowane tylko w modułach — w app.html wyglądały surowo).
 */

const read = (p: string): string => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

const src = read('public/js/shared/sessionIdle.js');
const css = read('public/css/style.responsive.css');

describe('modale sesji: wzorzec SOK', () => {
    it('używa .modal + nagałów/stopki zamiast legacy app-confirm', () => {
        expect(src).toContain('<div class="modal modal--session modal--session-warn">');
        expect(src).toContain('<div class="modal modal--session modal--session-danger">');
        expect(src).not.toContain('app-confirm');
        expect(src).toContain('modal-header');
        expect(src).toContain('modal-footer');
    });

    it('przyciski to klasy .btn (bez inline background)', () => {
        expect(src).toContain('class="btn btn-secondary" id="session-idle-logout"');
        expect(src).toContain('class="btn btn-warn" id="session-idle-extend"');
        expect(src).toContain('class="btn btn-primary" id="session-idle-login"');
        expect(src).not.toMatch(/style="[^"]*background/);
    });

    it('style są wspólne (style.responsive.css), nie tylko w modułach', () => {
        expect(css).toContain('.modal--session {');
        expect(css).toContain('.modal--session .session-modal-text');
        expect(css).toContain('.modal--session .session-modal-hint');
    });

    it('zachowuje id używane przez logikę (licznik, akcje)', () => {
        expect(src).toContain('id="session-idle-countdown"');
        expect(src).toContain('id="session-idle-warn-title"');
        expect(src).toContain('id="session-idle-expired-title"');
    });
});
