import fs from 'fs';
import path from 'path';

describe('zlecenia UI filters & delete button state', () => {
    const spaRender = fs.readFileSync(
        path.join(process.cwd(), 'public/js/spa/zleceniaRender.js'),
        'utf-8'
    );
    const zleceniaCss = fs.readFileSync(
        path.join(process.cwd(), 'public/css/zlecenia.css'),
        'utf-8'
    );
    const modalHtml = fs.readFileSync(
        path.join(process.cwd(), 'public/partials/studnie/modals.html'),
        'utf-8'
    );
    const orderZleceniaRender = fs.readFileSync(
        path.join(process.cwd(), 'public/js/studnie/orderZleceniaRender.js'),
        'utf-8'
    );
    const orderZleceniaForm = fs.readFileSync(
        path.join(process.cwd(), 'public/js/studnie/orderZleceniaForm.js'),
        'utf-8'
    );

    it('spa: ikona usun zlecenie renderuje sie zawsze, ale jest disabled gdy nie draft', () => {
        expect(spaRender).toContain(
            '\'<button class="action-btn action-btn-delete" aria-label="Usu\\u0144 zlecenie"\''
        );
        expect(spaRender).toContain('isDraft');
        expect(spaRender).toContain(
            'disabled title="Nie mo\\u017cna usun\\u0105\\u0107 zaakceptowanego zlecenia"'
        );
        expect(zleceniaCss).toContain('.action-btn-delete:disabled');
        expect(zleceniaCss).toContain('opacity: 0.35');
    });

    it('studnie modal: przelacznik ukryj zaakceptowane i zachowanie zakladek', () => {
        expect(modalHtml).toContain('id="zlecenia-hide-accepted"');
        expect(modalHtml).toContain('toggleZleceniaHideAccepted');
        expect(modalHtml).toContain('role="switch"');
        expect(orderZleceniaForm).toContain('function toggleZleceniaHideAccepted');
        expect(orderZleceniaForm).toContain('function setZleceniaHideAccepted');
        // Ukrywanie nie może opróżniać zakładki „Zaakceptowane”.
        expect(orderZleceniaRender).toContain("zleceniaActiveFilter !== 'accepted'");
        expect(orderZleceniaRender).not.toContain(
            "if (zleceniaHideAccepted && item.status === 'accepted') return;"
        );
        expect(orderZleceniaRender).toContain(
            "if (zleceniaActiveFilter === 'saved' && item.status !== 'saved') return;"
        );
        expect(orderZleceniaRender).toContain(
            "isDimmed = zleceniaActiveFilter === 'all' && (isSaved || isAccepted);"
        );
        expect(orderZleceniaRender).toContain('is-dimmed');
    });

    it('switch S.O.K.: jedna definicja CSS, tokeny, focus i reduced motion', () => {
        const modalCss = fs.readFileSync(
            path.join(process.cwd(), 'public/css/studnie/modal.css'),
            'utf-8'
        );
        const studnieCss = fs.readFileSync(
            path.join(process.cwd(), 'public/css/studnie.css'),
            'utf-8'
        );
        expect(modalCss).toContain(".zl-switch input[type='checkbox']");
        expect(modalCss).toContain('border-radius: var(--radius-pill)');
        expect(modalCss).toContain('outline: 2px solid var(--focus-ring)');
        expect(modalCss).toContain('@media (hover: hover) and (pointer: fine)');
        expect(modalCss).toContain('@media (prefers-reduced-motion: reduce)');
        const switchStart = modalCss.indexOf('.zl-switch-row');
        const switchEnd = modalCss.indexOf('.zlecenia-filter-btn {', switchStart);
        const switchCss = modalCss.slice(switchStart, switchEnd);
        expect(switchStart).toBeGreaterThan(-1);
        expect(switchCss).not.toContain('transition: all');
        // Brak duplikatu klasy między plikami CSS (UI_GUIDELINES §11).
        expect(studnieCss).not.toContain('.zl-switch');
        expect(studnieCss).not.toContain('.zl-toggle-');
    });
});
