import fs from 'fs';
import path from 'path';

const rury = fs.readFileSync(path.join(process.cwd(), 'public/js/rury/pricelistUi.js'), 'utf-8');
const studnie = fs.readFileSync(
    path.join(process.cwd(), 'public/js/studnie/pricelistManager.js'),
    'utf-8'
);

describe('frontend: kontrakt colspan nagłówków grup (błąd #7)', () => {
    it('studnie: nagłówek grupy to labelka (colspan - 1) plus komórka akcji', () => {
        expect(studnie).toMatch('colspan="${colCount - 1}"');
        expect(studnie).toContain('cat-header-actions-cell');
        expect(studnie).not.toMatch("colspan=\"${isPrzejscia ? '11'");
    });
    it('rury: colspan grupowy zgadza się z liczbą kolumn nagłówka', () => {
        const thCount = (rury.match(/<th scope="col"/g) || []).length;
        expect(rury).toContain('<td colspan="7"');
        expect(thCount).toBe(7);
    });
});

describe('frontend: unifikacja chrome cenników (Faza A/B)', () => {
    it('rury i studnie: ten sam toolbar i tytuł bez inline style', () => {
        const ruryPartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/rury/pricelist.html'),
            'utf-8'
        );
        const studniePartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/studnie/pricelist.html'),
            'utf-8'
        );
        for (const content of [ruryPartial, studniePartial]) {
            expect(content).toContain('<div class="toolbar">');
            expect(content).toContain('pricelist-toolbar-title');
            expect(content).not.toContain('rury-toolbar');
            expect(content).not.toContain('style="margin: 0; width: 100%');
            expect(content).not.toContain('padding-left: 2.2rem');
        }
        expect(ruryPartial).toContain('id="pricelist-search"');
        expect(studniePartial).toContain('id="studnie-pricelist-search"');
    });
    it('reset ma tę samą ikonę w obu cennikach', () => {
        const ruryPartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/rury/pricelist.html'),
            'utf-8'
        );
        const studniePartial = fs.readFileSync(
            path.join(process.cwd(), 'public/partials/studnie/pricelist.html'),
            'utf-8'
        );
        expect(ruryPartial).toContain('data-lucide="rotate-ccw"');
        expect(studniePartial).toContain('data-lucide="rotate-ccw"');
        expect(studniePartial).not.toContain('data-lucide="refresh-cw"');
    });
    it('studnie: nagłówek grupy używa wspólnego .cat-header', () => {
        expect(studnie).toContain('<div class="cat-header">');
        expect(studnie).toContain('cat-count');
        expect(studnie).not.toContain('rgba(var(--accent-rgb), 0.05)');
    });
});
