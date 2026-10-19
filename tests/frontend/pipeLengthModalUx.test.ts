import fs from 'fs';
import path from 'path';

// UX 2026-10-19: modal „Dostosuj długość rury" (szerszy + ikony Lucide zamiast
// znaków tekstowych „-"/„+") oraz usunięty baner kontekstu „Nowa oferta —
// Dodaj produkty w zakładce Konfiguracja" z zakładki Oferta (rury).

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

describe('frontend: modal długości rury + baner kontekstu (rury)', () => {
    const addItems = read('public/js/rury/offerAddItems.js');
    const css = read('public/css/rury.css');
    const offerPartial = read('public/partials/rury/offer.html');
    const navigation = read('public/js/rury/offerNavigation.js');

    it('stepper ma ikony Lucide, nie znaki tekstowe', () => {
        expect(addItems).toContain('data-lucide="minus"');
        expect(addItems).toContain('data-lucide="plus"');
        expect(addItems).not.toMatch(/aria-label="Zmniejsz">-<\/button>/);
        expect(addItems).not.toMatch(/aria-label="Zwiększ">\+<\/button>/);
    });

    it('modal jest szerszy (koniec zawijania nazwy produktu)', () => {
        expect(css).toMatch(/\.modal--pipe-length\s*\{[^}]*width:\s*min\(640px/);
        expect(css).not.toMatch(/\.modal--pipe-length\s*\{[^}]*max-width:\s*450px/);
    });

    it('przyciski +/- są 48px z ikoną 22px (nie bazowe 44/16)', () => {
        const stepperRule = css.match(
            /\.modal--pipe-length \.pipe-length-stepper \.btn-round-44\s*\{[^}]*\}/
        );
        expect(stepperRule).not.toBeNull();
        expect(stepperRule?.[0]).toMatch(/width:\s*48px/);
        const iconRule = css.match(
            /\.modal--pipe-length \.pipe-length-stepper \.btn-round-44 svg\s*\{[^}]*\}/
        );
        expect(iconRule).not.toBeNull();
        expect(iconRule?.[0]).toMatch(/width:\s*22px/);
    });

    it('baner kontekstu nowej oferty usunięty', () => {
        expect(offerPartial).not.toContain('offer-context-banner');
        expect(navigation).not.toContain('offer-context-');
        expect(navigation).not.toContain('Dodaj produkty w zakładce');
    });
});
