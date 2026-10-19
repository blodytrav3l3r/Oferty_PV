import fs from 'fs';
import path from 'path';

// P3 audytu 2026-10-19: dostępność etykiet i stanów (aria-pressed / aria-label),
// dostępna nazwa logo SVG, dekoracyjna gwiazdka poza drzewem dostępności.
describe('frontend: P3 dostępność (etykiety, aria-pressed, logo)', () => {
    const render = fs.readFileSync(
        path.join(process.cwd(), 'public/js/rury/offerRendering.js'),
        'utf-8'
    );
    const clientManager = fs.readFileSync(
        path.join(process.cwd(), 'public/js/shared/clientManager.js'),
        'utf-8'
    );
    const logoSvg = fs.readFileSync(
        path.join(process.cwd(), 'public/images/logo-sok.svg'),
        'utf-8'
    );

    it('przyciski PEHD mają aria-pressed i aria-label', () => {
        expect(render).toMatch(
            /aria-pressed="\$\{item\.pehdType === 'PEHD-3MM'\}" aria-label="Wkładka PEHD 3mm"/
        );
        expect(render).toMatch(
            /aria-pressed="\$\{item\.pehdType === 'PEHD-4MM'\}" aria-label="Wkładka PEHD 4mm"/
        );
    });

    it('pola liczbowe oferty mają aria-label', () => {
        for (const label of [
            'aria-label="Metry bieżące"',
            'aria-label="Ilość [szt.]"',
            'aria-label="Rabat [%]"',
            'aria-label="Dopłata [PLN]"'
        ]) {
            expect(render).toContain(label);
        }
    });

    it('pole "ilość do zamówienia" ma aria-label zgodny z title', () => {
        expect(render).toMatch(/class="order-partial-qty"[^>]*aria-label="Ilość do zamówienia/);
    });

    it('dekoracyjna gwiazdka kontaktu jest aria-hidden', () => {
        expect(clientManager).toMatch(/starMark\.setAttribute\('aria-hidden', 'true'\)/);
    });

    it('logo SVG ma dostępną nazwę (title + desc + role)', () => {
        expect(logoSvg).toMatch(/role="img"/);
        expect(logoSvg).toMatch(/aria-labelledby="sok-logo-title sok-logo-desc"/);
        expect(logoSvg).toMatch(/<title id="sok-logo-title">[^<]+<\/title>/);
        expect(logoSvg).toMatch(/<desc id="sok-logo-desc">[^<]+<\/desc>/);
    });
});
