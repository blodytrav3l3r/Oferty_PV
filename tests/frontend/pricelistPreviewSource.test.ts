// @ts-nocheck
/**
 * Podgląd cennika w module oferty = cennik, z którego oferta liczy: wersja
 * pieczątki oferty, a bez pieczątki — obowiązujący (ACTIVE). Dane edytora
 * (szkic/LIVE) tylko w hubie #/cennik. Kontrakt pilnuje, żeby wejście w
 * „Cennik" nie podmieniało listy produktów oferty na szkic i żeby pasek nie
 * kłamał o źródle siatki.
 */
import fs from 'fs';
import path from 'path';

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

const globals = read('public/js/studnie/globals.js');
const refresh = read('public/js/studnie/pricelistSaveReset.js');
const ruryNav = read('public/js/rury/offerNavigation.js');
const panel = read('public/js/shared/pricelistVersions.js');
const editBadgeTest = read('tests/frontend/pricelistEditModeBadge.test.ts');

describe('cennik w ofercie: podgląd z cennika oferty', () => {
    it('studnie: pieczątka oferty → jej wersja, bez pieczątki → ACTIVE', () => {
        expect(globals).toContain("typeof pvStudnie.offerStamp === 'function'");
        expect(globals).toMatch(/pvStudnie\.applyOfferPricelist\('studnie', studnieOfferStamp\)/);
        // Brak pieczątki / błąd pobrania wersji → obowiązujący.
        expect(globals).toContain("loadStudnieProducts({ source: 'active' })");
        expect(globals).toMatch(
            /if \(axisEditing\('studnie'\)\) \{\s*window\.studnieProducts = await loadStudnieProducts\(\);/
        );
        // Powrót z cennika nie nadpisuje katalogu oferty wersją ACTIVE.
        expect(globals).toMatch(/!studnieOfferStamp &&/);
    });

    it('rury: to samo wejście, bez dotykania danych edytora', () => {
        expect(ruryNav).toContain("pv.isPricelistEditing('rury')");
        expect(ruryNav).toMatch(/pv\.applyOfferPricelist\('rury', ruryOfferStamp\)/);
        expect(ruryNav).toContain("products = await loadProducts({ source: 'active' });");
        expect(ruryNav).toMatch(/!ruryOfferStamp &&/);
    });

    it('refreshStudnieData: kafelki i Excel dostają to samo źródło co siatka', () => {
        expect(refresh).toMatch(/pv\.applyOfferPricelist\('studnie', stamp\)/);
        expect(refresh).toContain(
            "loadStudnieProducts(editing ? undefined : { source: 'active' })"
        );
        expect(refresh).not.toContain("fetch('/api/products-studnie', { headers: authHeaders() })");
    });

    it('pasek: helper osi + baner szkicu tylko w edycji', () => {
        expect(panel).toContain('function isPricelistEditing(type)');
        expect(panel).toContain('return isEditing(type) || isCennikHost();');
        expect(panel).toContain('isPricelistEditing: isPricelistEditing');
        expect(panel).toContain('var editingGrid = isPricelistEditing(stripType);');
        expect(panel).toMatch(/if \(data\.draft && editingGrid\) \{/);
        expect(panel).toContain('Podgląd cennika oferty');
        // Pasek mówi, że siatka pokazuje cennik oferty (wersja pieczątki).
        expect(panel).toContain('Cennik oferty ');
        expect(panel).toContain('offerStamp(stripType)');
    });

    it('PRECO po wyjściu z edycji wraca do ACTIVE', () => {
        expect(panel).toContain("{ source: isPricelistEditing('preco') ? 'draft' : 'active' }");
    });

    it('„Edytuj" w module prowadzi do huba cenników', () => {
        expect(panel).toContain('function cennikEditorHash(type)');
        expect(panel).toContain("'#/cennik?tab=rury&panel=versions'");
        expect(panel).toContain("'#/cennik?tab=studnie&panel=versions'");
        expect(panel).toContain("'#/cennik?tab=preco&panel=versions'");
        expect(panel).toContain('var hash = cennikEditorHash(type);');
        // Stara trasa (moduł jako edytor) znika — tam edycja nie działała.
        expect(panel).not.toContain('var hash = editorHash(type);');
    });
});

describe('pricelistVersions: isPricelistEditing w jsdom', () => {
    it('fałsz w module, prawda po setEditing (edycja szkicu)', () => {
        document.body.innerHTML = '<div id="pricelist-status-strip" class="pv-status-strip"></div>';
        window.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ types: { rury: { active: null, draft: null } } })
        }));
        window.authHeaders = () => ({});
        window.showToast = jest.fn();
        window.escapeHtml = (s) => String(s ?? '');
        window.escapeHtmlAttr = (s) => String(s ?? '');
        window.escapeJsStr = (s) => String(s ?? '');
        window.lucide = { createIcons: jest.fn() };
        new Function('window', 'document', panel)(window, document);

        const pv = window.pricelistVersions;
        expect(typeof pv.isPricelistEditing).toBe('function');
        expect(pv.isPricelistEditing('rury')).toBe(false);
        pv.setEditing('rury', true);
        expect(pv.isPricelistEditing('rury')).toBe(true);
        pv.setEditing('rury', false);
    });

    it('kontrakt podglądu jest pokryty testem paska (bez szkicu w podglądzie)', () => {
        expect(editBadgeTest).toContain("expect(host.textContent).not.toContain('Rv4-20261028')");
        expect(editBadgeTest).toContain(
            "expect(host.textContent).toContain('Podgląd cennika oferty')"
        );
    });
});
