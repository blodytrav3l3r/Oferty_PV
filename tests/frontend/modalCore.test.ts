import fs from 'fs';
import path from 'path';

describe('frontend: modalCore', () => {
    const file = path.join(process.cwd(), 'public/js/shared/modalCore.js');
    const content = fs.readFileSync(file, 'utf-8');

    it('exportuje showModal/closeModal/trapFocus', () => {
        expect(content).toMatch(/export function showModal/);
        expect(content).toMatch(/export function closeModal/);
        expect(content).toMatch(/export function trapFocus/);
    });

    it('używa .modal-overlay.js-modal-overlay i aria-modal', () => {
        expect(content).toMatch(/modal-overlay js-modal-overlay/);
        expect(content).toMatch(/ariaModal/);
        expect(content).toMatch(/role.*dialog/);
    });

    it('nie zawiera inline z-index poza LAYERS', () => {
        // modalCore nie powinien hardkodować z-index
        expect(content).not.toMatch(/z-index:\s*\d{4,}/);
    });
});

describe('frontend: layers SSoT', () => {
    const file = path.join(process.cwd(), 'public/js/studnie/layers.js');
    const content = fs.readFileSync(file, 'utf-8');
    it('definiuje LAYERS i LAYERS_EXCEL', () => {
        expect(content).toMatch(/const LAYERS =/);
        expect(content).toMatch(/const LAYERS_EXCEL =/);
        expect(content).toMatch(/GENERIC_MODAL_BACKDROP:\s*2000/);
    });
});

describe('frontend: style.base.css --z-*', () => {
    const file = path.join(process.cwd(), 'public/css/style.base.css');
    const content = fs.readFileSync(file, 'utf-8');
    it('definiuje tokeny --z-*', () => {
        expect(content).toMatch(/--z-header:\s*100/);
        expect(content).toMatch(/--z-overlay:\s*2000/);
        expect(content).toMatch(/--z-toast:\s*5000/);
    });
    it('header używa var(--z-header)', () => {
        expect(content).toMatch(/z-index:\s*var\(--z-header\)/);
    });
});
