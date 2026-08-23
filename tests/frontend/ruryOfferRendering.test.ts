import fs from 'fs';
import path from 'path';

describe('frontend: rury offerRendering a11y', () => {
    const file = path.join(process.cwd(), 'public/js/rury/offerRendering.js');
    const content = fs.readFileSync(file, 'utf-8');
    it('checkboxy mają aria-label', () => {
        expect(content).toMatch(/aria-label="Wybierz pozycję do zamówienia"/);
        expect(content).toMatch(/aria-label="Wybierz pozycję automatyczną"/);
        expect(content).toMatch(/aria-label="Wszystkie sztuki zamówione"/);
    });
    it('nie ma gołych z-index poza LAYERS w offerRendering', () => {
        expect(content).not.toMatch(/z-index:\s*10000/);
    });
});
