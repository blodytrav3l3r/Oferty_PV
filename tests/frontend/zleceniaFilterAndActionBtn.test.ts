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
        expect(orderZleceniaForm).toContain('function toggleZleceniaHideAccepted');
        expect(orderZleceniaForm).toContain('function setZleceniaHideAccepted');
        expect(orderZleceniaRender).toContain(
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
});
