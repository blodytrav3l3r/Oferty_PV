import fs from 'fs';
import path from 'path';

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

describe('frontend: inline style -> klasy (A2, baza #5)', () => {
    it('actionsConfigDrag: opacity/borderTop przez klasy', () => {
        const js = read('public/js/studnie/actionsConfigDrag.js');
        expect(js).toContain("classList.add('is-dragging')");
        expect(js).toContain("classList.remove('is-dragging')");
        expect(js).toContain('is-drop-target');
        expect(js).not.toContain('style.opacity');
        expect(js).not.toContain('style.borderTop');
    });
    it('offerRendering: widoczność przycisku przez .hidden', () => {
        const js = read('public/js/studnie/offerRendering.js');
        expect(js).toContain("classList.add('hidden')");
        expect(js).toContain("classList.remove('hidden')");
        expect(js).not.toContain('style.display');
    });
    it('wellUIHelpers + pricelistManager: bez inline opacity', () => {
        const helpers = read('public/js/studnie/wellUIHelpers.js');
        expect(helpers).toContain('discount-empty-icon');
        expect(helpers).not.toContain('opacity:0.5;display:block');
        const pricelist = read('public/js/studnie/pricelistManager.js');
        expect(pricelist).toContain('pill-sm');
        expect(pricelist).not.toContain('opacity:0.5; cursor:not-allowed');
    });
    it('studnie.css definiuje nowe klasy', () => {
        const css = read('public/css/studnie.css');
        expect(css).toContain('.config-tile.is-dragging');
        expect(css).toContain('.config-tile.is-drop-target');
        expect(css).toContain('.discount-empty-icon');
    });
});
