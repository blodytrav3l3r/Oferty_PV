// @ts-nocheck
/**
 * Oferta odtwarza własny cennik z wersji pieczątki (`pricelistVersionId`):
 * - wejście w ofertę podstawia dane osi z tej wersji (studnie + PRECO, rury),
 * - „Przelicz do aktywnego" przeładowuje ACTIVE przed przeliczeniem,
 * - brak pieczątki / błąd pobrania = ACTIVE z jawnym ostrzeżeniem (bez cichej podmiany),
 * - podgląd cennika w module pokazuje wersję oferty, więc nie kłamie.
 */
import fs from 'fs';
import path from 'path';

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

const route = read('src/routes/pricelistVersions.ts');
const xlsx = read('public/js/shared/pricelistXlsx.js');
const panel = read('public/js/shared/pricelistVersions.js');
const studnieMgr = read('public/js/studnie/offerManager.js');
const ruryCrud = read('public/js/rury/offerCrud.js');
const banner = read('public/js/shared/offerPricelistBanner.js');

describe('backend: GET /api/pricelist-versions/:id/rows', () => {
    it('czyta każdy zalogowany użytkownik (bez requireAdmin)', () => {
        const at = route.indexOf("router.get('/:id/rows'");
        expect(at).toBeGreaterThan(-1);
        const end = route.indexOf("router.get('/:id/export'", at);
        const chunk = route.slice(at, end);
        expect(chunk).toContain('requireAuth');
        expect(chunk).not.toContain('requireAdmin');
        expect(chunk).toContain('getVersionExportSheets');
        expect(chunk).toContain('Cache-Control');
    });

    it('tylko wersja zatwierdzona i już obowiązująca (szkic/przyszłość = 409)', () => {
        const at = route.indexOf("router.get('/:id/rows'");
        const end = route.indexOf("router.get('/:id/export'", at);
        const chunk = route.slice(at, end);
        expect(chunk).toContain("version.status !== 'APPROVED'");
        expect(chunk).toContain('VERSION_NOT_EFFECTIVE');
        expect(chunk).toContain('effectiveFrom > Date.now()');
    });

    it('eksport XLSX zostaje admin-only (nie poszerzamy uprawnień)', () => {
        expect(route).toContain(
            "router.get('/:id/export', requireAuth, requireAdmin, READ_LIMITER"
        );
    });
});

describe('frontend: dane wersji → osie cennika', () => {
    it('pricelistXlsx ma precoSheetsToMap (reuse collectPrecoRows)', () => {
        expect(xlsx).toContain('function precoSheetsToMap(sheets)');
        expect(xlsx).toContain("if (name.indexOf('PRECO_') !== 0) return;");
        expect(xlsx).toContain('collectPrecoRows(map, name, rows)');
        expect(xlsx).toContain('window.pricelistXlsx.precoSheetsToMap = precoSheetsToMap;');
    });

    it('applyOfferPricelist zapisuje właściwe osie i pieczątkę', () => {
        expect(panel).toContain('async function applyOfferPricelist(type, versionId)');
        expect(panel).toContain('GRID_STATE.rury.write(data.rows || []);');
        expect(panel).toContain('GRID_STATE.preco.write(data.precoMap || {});');
        expect(panel).toContain('GRID_STATE.studnie.write(data.rows || []);');
        expect(panel).toContain('setOfferStamp(type, versionId, data.label);');
        expect(panel).toContain('applyOfferPricelist: applyOfferPricelist,');
        expect(panel).toContain('offerStamp: offerStamp,');
        expect(panel).toContain('setOfferStamp: setOfferStamp,');
    });

    it('studnie dostają PRECO z tej samej wersji (eksport dokleja PRECO)', () => {
        expect(panel).toContain("if (type !== 'rury' && window.pricelistXlsx");
        expect(panel).toMatch(
            /if \(data\.precoMap && Object\.keys\(data\.precoMap\)\.length > 0\) \{/
        );
    });

    it('wersja → normalizeRows z opcjami importu (te same co siatka)', () => {
        expect(panel).toContain(
            "type === 'rury' ? window.ruryImportOptions([]) : window.studnieImportOptions([])"
        );
        expect(panel).toContain('window.pricelistXlsx.normalizeRows(raw, opts)');
    });
});

describe('oferta: ceny z wersji pieczątki', () => {
    it('studnie: cennik oferty wczytany PRZED mrożeniem cen', () => {
        const applyAt = studnieMgr.indexOf(
            'await applyStudnieOfferPricelist(normalized.pricelistVersionId);'
        );
        const freezeAt = studnieMgr.indexOf('freezeWellPrices(wells)');
        expect(applyAt).toBeGreaterThan(-1);
        expect(freezeAt).toBeGreaterThan(applyAt);
        expect(studnieMgr).toContain('async function applyStudnieOfferPricelist(stampId)');
        expect(studnieMgr).toContain("pv.applyOfferPricelist('studnie', stampId)");
    });

    it('studnie: brak pieczątki / błąd = ACTIVE + ostrzeżenie', () => {
        expect(studnieMgr).toContain('— liczę z obowiązującego');
        expect(studnieMgr).toContain("pv.setOfferStamp('studnie', null)");
        expect(studnieMgr).toContain("loadStudnieProducts({ source: 'active' })");
        expect(studnieMgr).toContain("loadPrecoPricing({ source: 'active' })");
    });

    it('rury: katalog z wersji pieczątki przy wejściu w ofertę', () => {
        const applyAt = ruryCrud.indexOf(
            'await applyRuryOfferPricelist(normalized.pricelistVersionId);'
        );
        const renderAt = ruryCrud.indexOf('renderOfferItems();', applyAt);
        expect(applyAt).toBeGreaterThan(-1);
        expect(renderAt).toBeGreaterThan(applyAt);
        expect(ruryCrud).toContain("pv.applyOfferPricelist('rury', stampId)");
        expect(ruryCrud).toContain('— liczę z obowiązującego');
    });

    it('„Przelicz do aktywnego" ładuje ACTIVE przed przeliczeniem', () => {
        expect(studnieMgr).toMatch(
            /async function recalcStudnieToActive\(activeId\)[\s\S]*?await applyStudnieOfferPricelist\(null\);/
        );
        expect(ruryCrud).toMatch(
            /async function recalcRuryToActive\(activeId\)[\s\S]*?await applyRuryOfferPricelist\(null\);/
        );
    });

    it('nowa oferta czyści pieczątkę i wraca do ACTIVE', () => {
        expect(studnieMgr).toContain('applyStudnieOfferPricelist(null).catch(() => {});');
        expect(ruryCrud).toContain('applyRuryOfferPricelist(null).catch(() => {});');
    });

    it('banner mówi prawdę: ceny z wersji oferty', () => {
        expect(banner).toContain('Ceny z wersji oferty.');
        expect(banner).not.toContain('Ceny zamrożone.');
    });
});

describe('pricelistVersions: applyOfferPricelist w jsdom', () => {
    function mount(fetchImpl) {
        document.body.innerHTML = '<div id="pricelist-status-strip"></div>';
        const window = global.window;
        window.studnieProducts = [];
        window.products = [];
        window.precoPricing = {};
        window.fetch = fetchImpl;
        window.authHeaders = () => ({});
        window.showToast = jest.fn();
        window.escapeHtml = (s) => String(s ?? '');
        window.escapeHtmlAttr = (s) => String(s ?? '');
        window.escapeJsStr = (s) => String(s ?? '');
        window.lucide = { createIcons: jest.fn() };
        window.pricelistXlsx = {
            normalizeRows: (rows) => rows.map((r) => ({ ...r })),
            precoSheetsToMap: (sheets) =>
                sheets.PRECO_Kinety ? { DN1000: { kinety: sheets.PRECO_Kinety } } : {}
        };
        window.ruryImportOptions = () => ({});
        window.studnieImportOptions = () => ({});
        new Function('window', 'document', panel)(window, document);
        return window.pricelistVersions;
    }

    const okPayload = {
        version: { id: 'v1', type: 'studnie', version: 'Sv3-20260928', status: 'APPROVED' },
        sheets: {
            'Studnie DN1000': [{ Indeks: 'K-1', 'Cena (PLN)': 100 }],
            PRECO_Kinety: [{ 'DN Studni': 1000 }]
        }
    };

    it('studnie: zapisuje produkty + PRECO i pieczątkę z etykietą', async () => {
        const pv = mount(async () => ({ ok: true, status: 200, json: async () => okPayload }));
        const ok = await pv.applyOfferPricelist('studnie', 'v1');
        expect(ok).toBe(true);
        expect(window.studnieProducts).toHaveLength(1);
        expect(window.precoPricing).toEqual({ DN1000: { kinety: [{ 'DN Studni': 1000 }] } });
        expect(pv.offerStamp('studnie')).toBe('v1');
        expect(pv.offerStampLabel('studnie')).toBe('Sv3-20260928');
    });

    it('rury: tylko katalog rur, bez PRECO', async () => {
        const pv = mount(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                version: { id: 'r1', type: 'rury', version: 'Rv3-20260928', status: 'APPROVED' },
                sheets: { Rury: [{ Indeks: 'PEHD-3MM', 'Cena (PLN)': 290 }] }
            })
        }));
        await pv.applyOfferPricelist('rury', 'r1');
        expect(window.products).toHaveLength(1);
        expect(window.precoPricing).toEqual({});
        expect(pv.offerStamp('rury')).toBe('r1');
    });

    it('błąd serwera → wyjątek (moduł pokazuje ostrzeżenie i wraca do ACTIVE)', async () => {
        const pv = mount(async () => ({
            ok: false,
            status: 409,
            json: async () => ({ error: 'Wersja nie obowiązuje', code: 'VERSION_NOT_EFFECTIVE' })
        }));
        await expect(pv.applyOfferPricelist('studnie', 'v9')).rejects.toThrow(
            'Wersja nie obowiązuje'
        );
        expect(pv.offerStamp('studnie')).toBeNull();
    });

    it('brak id czyści pieczątkę bez fetchem', async () => {
        const fetchSpy = jest.fn();
        const pv = mount(fetchSpy);
        const ok = await pv.applyOfferPricelist('studnie', null);
        expect(ok).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(pv.offerStamp('studnie')).toBeNull();
    });
});
