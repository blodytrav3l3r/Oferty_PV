// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- wzorzec vm (excelWellLock)
// @ts-nocheck
/* =============================================================
   Testy migracji modalów przejść na modalCore (Faza 1 planu
   dostosowania do wytycznych UI/UX). Wzorzec vm: excelWellLock.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

const FLOW_TYPES_MOCK = { WLOT: 'wlot', WYLOT: 'wylot', DOLOT: 'dolot' };

function runContext() {
    const well = {
        dn: '600',
        przejscia: [
            {
                productId: 'przejscie-160-0.5',
                rzednaWlaczenia: 1.2,
                flowType: 'wlot',
                flowTypeManual: false,
                frozenPrice: 10,
                frozenPriceBase: 9,
                frozenName: 'nazwa',
                frozenTransitionPrice: 1,
                frozenDrillingPrice: 2,
                frozenDrillingName: 'wiercenie',
                frozenDrillingDn: '200'
            }
        ],
        config: []
    };

    const showModalCalls = [];
    let closeCalls = 0;
    const renderWellPrzejscia = jest.fn();
    const refreshZleceniaModalIfActive = jest.fn();
    const showToast = jest.fn();
    const refreshAll = jest.fn();
    const autoSelectComponents = jest.fn();

    const docStub = {
        getElementById: () => null,
        createElement: () => ({
            style: {},
            setAttribute() {},
            appendChild() {},
            addEventListener() {},
            remove() {},
            innerHTML: ''
        }),
        body: { appendChild: () => {} },
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    };

    const studnieProducts = [
        {
            id: 'przejscie-160-0.5',
            name: 'Przejście 160',
            componentType: 'przejscie',
            dn: 160,
            height: 0,
            active: 1,
            category: 'Przejścia 160'
        },
        {
            id: 'przejscie-200-0.5',
            name: 'Przejście 200',
            componentType: 'przejscie',
            dn: 200,
            height: 0,
            active: 1,
            category: 'Przejścia 160'
        },
        {
            id: 'przejscie-250-0.5',
            name: 'Przejście 250',
            componentType: 'przejscie',
            dn: 250,
            height: 0,
            active: 1,
            category: 'Przejścia 160'
        },
        {
            id: 'przejscie-300-0.5',
            name: 'Przejście 300',
            componentType: 'przejscie',
            dn: 300,
            height: 0,
            active: 1,
            category: 'Przejścia 200'
        },
        {
            id: 'przejscie-xss-0.5',
            name: 'XSS',
            componentType: 'przejscie',
            dn: 400,
            height: 0,
            active: 1,
            category: 'Przejścia <b>XSS</b>'
        }
    ];

    const context = {
        window: {
            showModal: (opts) => {
                showModalCalls.push(opts);
                return { id: opts.id };
            },
            closeModal: () => {
                closeCalls++;
            },
            renderWellPrzejscia,
            refreshZleceniaModalIfActive
        },
        document: docStub,
        studnieProducts,
        getCurrentWell: () => well,
        isOfferLocked: () => false,
        isWellLocked: () => false,
        OFFER_LOCKED_MSG: 'Oferta zablokowana',
        WELL_LOCKED_MSG: 'Studnia zablokowana',
        showToast,
        renderWellPrzejscia,
        refreshZleceniaModalIfActive,
        refreshAll,
        autoSelectComponents,
        closeModal: () => {
            closeCalls++;
        },
        FLOW_TYPES: FLOW_TYPES_MOCK,
        LAYERS: { GENERIC_MODAL_BACKDROP: 2000, EXCEL_POPUP_BACKDROP: 2000 },
        escapeHtml: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        escapeHtmlAttr: (s) =>
            String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        escapeJsStr: (s) =>
            String(s)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
    };

    vm.createContext(context);
    vm.runInContext(readStudnie('wellTransitionsPopup.js'), context);
    return {
        context,
        well,
        showModalCalls,
        closeCalls: () => closeCalls,
        renderWellPrzejscia,
        refreshZleceniaModalIfActive,
        showToast,
        refreshAll,
        autoSelectComponents
    };
}

describe('Modale przejść → modalCore (Faza 1)', () => {
    test('TEST 1: openFlowTypePopup renderuje modal przez showModal (bez inline overlay)', () => {
        const { context, showModalCalls } = runContext();
        context.window.openFlowTypePopup(0);
        expect(showModalCalls).toHaveLength(1);
        const opts = showModalCalls[0];
        expect(opts.id).toBe('flow-type-modal');
        expect(opts.titleId).toBe('flow-type-title');
        expect(opts.html).toContain('WLOT');
        expect(opts.html).toContain('WYLOT');
        expect(opts.html).toContain('data-lucide="download"');
        expect(opts.html).toContain('data-lucide="upload"');
        expect(opts.html).toContain('modal modal--prz-flow');
        expect(opts.html).toContain('data-flow="wlot"');
        expect(opts.html).toContain('data-flow="wylot"');
        expect(opts.html).not.toContain('position:fixed');
        expect(opts.html).not.toContain('wtCloseModal');
        expect(opts.html).not.toContain('onmouseenter');
        expect(opts.html).not.toContain('onmouseleave');
    });

    test('TEST 2: zablokowana oferta blokuje modal i pokazuje toast', () => {
        const { context, showModalCalls, showToast } = runContext();
        context.isOfferLocked = () => true;
        context.window.openFlowTypePopup(0);
        expect(showToast).toHaveBeenCalled();
        expect(showModalCalls).toHaveLength(0);
    });

    test('TEST 3a: confirmPrzejscieFlow("wlot") ustawia flowType i zamyka modal', () => {
        const { context, well, closeCalls, renderWellPrzejscia, refreshZleceniaModalIfActive } =
            runContext();
        context.window.confirmPrzejscieFlow(0, 'wlot');
        expect(well.przejscia[0].flowType).toBe('wlot');
        expect(well.przejscia[0].flowTypeManual).toBe(true);
        expect(closeCalls()).toBe(1);
        expect(renderWellPrzejscia).toHaveBeenCalled();
        expect(refreshZleceniaModalIfActive).toHaveBeenCalled();
    });

    test('TEST 3b: confirmPrzejscieFlow("wylot") ustawia flowType i zamyka modal', () => {
        const { context, well, closeCalls } = runContext();
        context.window.confirmPrzejscieFlow(0, 'wylot');
        expect(well.przejscia[0].flowType).toBe('wylot');
        expect(well.przejscia[0].flowTypeManual).toBe(true);
        expect(closeCalls()).toBe(1);
    });

    test('TEST 3c: confirmPrzejscieFlow z niepoprawnym flow jest ignorowany', () => {
        const { context, well, closeCalls } = runContext();
        context.window.confirmPrzejscieFlow(0, 'bogus');
        expect(well.przejscia[0].flowType).toBe('wlot');
        expect(well.przejscia[0].flowTypeManual).toBe(false);
        expect(closeCalls()).toBe(0);
    });

    test('TEST 4: openChangePrzejscieTypePopup renderuje kategorie i escapuje XSS', () => {
        const { context, showModalCalls } = runContext();
        context.window.openChangePrzejscieTypePopup(0);
        expect(showModalCalls).toHaveLength(1);
        const opts = showModalCalls[0];
        expect(opts.id).toBe('change-prz-type-modal');
        expect(opts.titleId).toBe('change-prz-type-title');
        expect(opts.html).toContain('Przejścia 160');
        expect(opts.html).toContain('Przejścia 200');
        expect(opts.html).toContain('prz-grid-btn--active');
        expect(opts.html).toContain('&lt;b&gt;XSS&lt;/b&gt;');
        expect(opts.html).not.toContain('<b>XSS</b>');
        expect(opts.html).not.toContain('position:fixed');
        expect(opts.html).not.toContain('wtCloseModal');
    });

    test('TEST 5: confirmChangePrzejscieType wybiera produkt wg DN, czyści frozen, zamyka', () => {
        const { context, well, closeCalls, refreshAll, autoSelectComponents } = runContext();
        context.window.confirmChangePrzejscieType(0, 'Przejścia 200');
        expect(well.przejscia[0].productId).toBe('przejscie-300-0.5');
        expect(well.przejscia[0].frozenPrice).toBeUndefined();
        expect(well.przejscia[0].frozenPriceBase).toBeUndefined();
        expect(well.przejscia[0].frozenName).toBeUndefined();
        expect(well.przejscia[0].frozenTransitionPrice).toBeUndefined();
        expect(well.przejscia[0].frozenDrillingPrice).toBeUndefined();
        expect(well.przejscia[0].frozenDrillingName).toBeUndefined();
        expect(well.przejscia[0].frozenDrillingDn).toBeUndefined();
        expect(closeCalls()).toBe(1);
        expect(refreshAll).toHaveBeenCalled();
        expect(autoSelectComponents).toHaveBeenCalledWith(true);
    });

    test('TEST 6: openChangePrzejscieDnPopup + confirmChangePrzejscieDn', () => {
        const { context, well, closeCalls, showModalCalls } = runContext();
        context.window.openChangePrzejscieDnPopup(0);
        expect(showModalCalls).toHaveLength(1);
        const opts = showModalCalls[0];
        expect(opts.id).toBe('change-prz-dn-modal');
        expect(opts.titleId).toBe('change-prz-dn-title');
        expect(opts.html).toContain('DN 160');
        expect(opts.html).toContain('DN 200');
        expect(opts.html).toContain('DN 250');
        expect(opts.html).not.toContain('position:fixed');

        context.window.confirmChangePrzejscieDn(0, 'przejscie-250-0.5');
        expect(well.przejscia[0].productId).toBe('przejscie-250-0.5');
        expect(well.przejscia[0].frozenPrice).toBeUndefined();
        expect(well.przejscia[0].frozenDrillingDn).toBeUndefined();
        expect(closeCalls()).toBe(1);
    });
});
