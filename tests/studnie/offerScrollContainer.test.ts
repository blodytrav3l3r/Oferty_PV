import * as fs from 'fs';
import * as path from 'path';

/**
 * Regresja: #section-offer siedzi w #partial-offer (partial, nie bezpośrednio
 * w .main). Wrapper musi być `display: contents` — gdy dostanie `flex: 1`,
 * ukryta sekcja oferty zabiera połowę wysokości aktywnej zakładce
 * (#section-builder). Sekcja oferty ma przewijać się sama (pasek elementu
 * jest zawsze widoczny; pasek viewportu bywa overlay i chowa się sam).
 */
describe('studnie: kontener przewijania sekcji oferty', () => {
    const css = fs.readFileSync(path.join('public/css/studnie.css'), 'utf-8');

    it('#partial-offer nie jest elementem layoutu (display: contents)', () => {
        const block = css.match(/body\.studnie-page > \.main > #partial-offer \{([^}]*)\}/);
        expect(block).not.toBeNull();
        expect(block![1]).toContain('display: contents');
        expect(block![1]).not.toMatch(/flex:\s*1/);
    });

    it('#section-offer w partialu jest kontenerem przewijania', () => {
        const block = css.match(
            /body\.studnie-page > \.main > #partial-offer > \.section\.active \{([^}]*)\}/
        );
        expect(block).not.toBeNull();
        expect(block![1]).toContain('overflow-y: auto');
        expect(block![1]).toContain('min-height: 0');
    });
});
