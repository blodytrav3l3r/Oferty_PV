import fs from 'fs';
import path from 'path';

/**
 * Ręczna korekta etykiety wersji cennika (labelOverride) — UI:
 * etykieta efektywna w tabeli i badge, przycisk admina, ostrzeżenie,
 * PATCH /:id/label, odświeżenie cache etykiet po zapisie.
 */

const panel = fs.readFileSync(
    path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
    'utf-8'
);

describe('frontend: etykieta efektywna (override nad pochodną)', () => {
    it('helper labelOf preferuje labelOverride', () => {
        expect(panel).toContain('function labelOf(v)');
        expect(panel).toContain("typeof v.labelOverride === 'string'");
        expect(panel).toContain("return manual !== '' ? manual : (v && v.version) || '';");
    });
    it('tabela wersji pokazuje etykietę efektywną + znacznik ręcznej korekty', () => {
        expect(panel).toContain("esc(labelOf(v) || '—')");
        expect(panel).toContain('(ręczna)');
        expect(panel).toContain('kanoniczna: ');
    });
    it('badge cennika w ofertach używa etykiety efektywnej', () => {
        expect(panel).toContain("el.textContent = 'cennik ' + labelOf(v)");
    });
});

describe('frontend: korekta tylko z ostrzeżeniem i tylko dla admina', () => {
    it('przycisk Etykieta w akcjach wiersza (panel manageable)', () => {
        expect(panel).toContain('data-pv-act="label"');
        expect(panel).toContain('Ręczna korekta etykiety wersji');
    });
    it('modal ostrzega, że zmienia się to, co widzą użytkownicy', () => {
        expect(panel).toContain('jest widoczna w ofertach, historii i eksportach');
        expect(panel).toContain('nie zmienia cen, daty obowiązywania ani pieczątek ofert');
        expect(panel).toContain('Każda zmiana trafia do audytu');
    });
    it('puste pole przywraca etykietę automatyczną', () => {
        expect(panel).toContain('puste = automatyczna');
        expect(panel).toContain('Przywrócono etykietę automatyczną');
    });
    it('zapis przez PATCH /:id/label i odświeżenie cache etykiet', () => {
        expect(panel).toContain("'/label'");
        expect(panel).toContain("authed('PATCH', { label: label })");
        expect(panel).toContain('labelCache = {};');
    });
    it('bez inline handlerów (CSP-E): przyciski mają id/data-csp', () => {
        expect(panel).not.toMatch(/onclick=/);
        expect(panel).toContain('id="pv-label-ok"');
        expect(panel).toContain('data-csp="closeModal"');
    });
});
