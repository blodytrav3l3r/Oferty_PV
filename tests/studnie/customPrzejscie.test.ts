// @ts-nocheck -- vm sandbox dla public/js (wzorzec transitionsModals.test.ts)
/* Testy przejść niestandardowych (poza cennikiem):
 * walidacja/limity (SSoT helperów), budowa pozycji, modal + escapowanie XSS,
 * blokady oferty/studni oraz czyszczenie starego zamrożenia. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readStudnie = (f) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

function runContext() {
    const showModalCalls: any[] = [];
    const toasts: any[] = [];
    const well = {
        dn: '1000',
        rzednaDna: 1.0,
        rzednaWlazu: 3.0,
        przejscia: []
    };
    const context: any = {
        window: {
            showModal: (opts: any) => {
                showModalCalls.push(opts);
                return { id: opts.id, addEventListener: () => {} };
            },
            closeModal: () => {}
        },
        document: { getElementById: () => null, addEventListener: () => {} },
        console,
        studnieProducts: [],
        getCurrentWell: () => well,
        isOfferLocked: () => false,
        isWellLocked: () => false,
        OFFER_LOCKED_MSG: 'Oferta zablokowana',
        WELL_LOCKED_MSG: 'Studnia zablokowana',
        showToast: (msg: string, type: string) => toasts.push({ msg, type }),
        escapeHtml: (s: any) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        escapeHtmlAttr: (s: any) =>
            String(s)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;'),
        escapeJsStr: (s: any) => String(s),
        FLOW_TYPES: { WLOT: 'wlot', WYLOT: 'wylot', DOLOT: 'dolot' },
        parseCalcExpression: (v: any) => {
            const n = Number(String(v).replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        },
        roundMoney: (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
        },
        refreshActiveWell: () => {},
        refreshAll: () => {},
        autoSelectComponents: () => {}
    };
    context.window.getCurrentWell = context.getCurrentWell;

    vm.createContext(context);
    vm.runInContext(readStudnie('wellTransitionsHelpers.js'), context);
    vm.runInContext(readStudnie('customPrzejscie.js'), context);
    return { context, well, showModalCalls, toasts };
}

describe('SSoT walidacji custom przejścia', () => {
    test('T3: nazwa wymagana, limity nazwy/DN/ceny', () => {
        const { context } = runContext();
        const validate = context.validateCustomPrzejscie;
        expect(validate({ name: '   ', price: 10 }).ok).toBe(false);
        expect(validate({ name: 'x'.repeat(121), price: 10 }).errors.name).toContain('120');
        expect(validate({ name: 'Przejście', price: -1 }).errors.price).toContain('ujemna');
        expect(validate({ name: 'Przejście', price: 10000001 }).ok).toBe(false);
        expect(
            context.validateCustomPrzejscie({ name: 'ok', dn: 'x'.repeat(13), price: 1 }).ok
        ).toBe(false);
        expect(validate({ name: 'Przejście', dn: '315', price: 250 }).ok).toBe(true);
    });

    test('T14: cena zaokrąglana do 2 miejsc (roundMoney)', () => {
        const { context } = runContext();
        const r = context.validateCustomPrzejscie({ name: 'P', price: 1234.567 });
        expect(r.value.price).toBe(1234.57);
        expect(context.validateCustomPrzejscie({ name: 'P', price: '0.005' }).value.price).toBe(
            0.01
        );
    });

    test('nazwa: znaki kontrolne i bidi usuwane', () => {
        const { context } = runContext();
        expect(context.sanitizeCustomPrzejscieName('a\u0000b\u202Ec')).toBe('a b c');
    });

    test('getPrzejscie* fallbacki dla custom bez produktu', () => {
        const { context } = runContext();
        const item = { isCustom: true, customName: 'Spec 315', customPrice: 500, dn: '315' };
        expect(context.getPrzejscieBasePrice(item, null)).toBe(500);
        expect(context.getPrzejscieName(item, null)).toBe('Spec 315');
        expect(context.getPrzejscieCategoryLabel(item, null)).toBe('Spec 315');
        expect(context.getPrzejscieDnLabel(item, null)).toBe('315');
        expect(context.isPricedPrzejscie(item, null)).toBe(true);
        expect(context.isPricedPrzejscie({}, null)).toBe(false);
    });
});

describe('buildCustomPrzejscieItem', () => {
    test('T1: tworzy pozycję z ceną netto, bez pól wiercenia', () => {
        const { context, well } = runContext();
        const res = context.buildCustomPrzejscieItem(
            { name: 'Specjalne 315', dn: '315', price: '1000', rzedna: '1,5', angle: 90 },
            well,
            null
        );
        expect(res.ok).toBe(true);
        expect(res.item).toMatchObject({
            isCustom: true,
            productId: '',
            customName: 'Specjalne 315',
            customPrice: 1000,
            dn: '315',
            angle: 90,
            angleExecution: 270,
            angleGony: '100.00'
        });
        expect(res.item.frozenPrice).toBeUndefined();
        expect(res.item.frozenDrillingPrice).toBeUndefined();
        expect(res.item.drillingBasePrice).toBeUndefined();
        expect(res.item.rzednaWlaczenia).toBe('1.500');
    });

    test('T18: edycja custom czyści stare frozen* i zachowuje id', () => {
        const { context, well } = runContext();
        const existing = {
            id: 'prz-1',
            isCustom: true,
            customName: 'Stara',
            customPrice: 100,
            frozenPrice: 90,
            frozenPriceBase: 100,
            frozenName: 'Stara',
            frozenTransitionPrice: 90
        };
        const res = context.buildCustomPrzejscieItem(
            { name: 'Nowa', price: 200, angle: 0 },
            well,
            existing
        );
        expect(res.ok).toBe(true);
        expect(res.item.id).toBe('prz-1');
        expect(res.item.customPrice).toBe(200);
        expect(res.item.frozenPrice).toBeUndefined();
        expect(res.item.frozenTransitionPrice).toBeUndefined();
        expect(res.item.frozenName).toBeUndefined();
    });

    test('niepoprawne dane nie tworzą pozycji', () => {
        const { context, well } = runContext();
        const res = context.buildCustomPrzejscieItem({ name: '', price: '' }, well, null);
        expect(res.ok).toBe(false);
        expect(res.item).toBeNull();
        expect(Object.keys(res.errors).sort()).toEqual(['name', 'price']);
    });
});

describe('modal custom przejścia', () => {
    test('T15: nazwa escapowana w HTML modala (XSS)', () => {
        const { context, well, showModalCalls } = runContext();
        well.przejscia = [
            {
                id: 'p1',
                isCustom: true,
                customName: '<img src=x onerror=alert(1)>',
                customPrice: 10,
                dn: '160'
            }
        ];
        context.openCustomPrzejscieModal({ mode: 'edit', index: 0 });
        expect(showModalCalls).toHaveLength(1);
        const html = showModalCalls[0].html;
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
    });

    test('zablokowana oferta/studnia blokuje otwarcie modala', () => {
        const { context, showModalCalls, toasts } = runContext();
        context.isOfferLocked = () => true;
        context.openCustomPrzejscieModal({ mode: 'create' });
        expect(showModalCalls).toHaveLength(0);
        expect(toasts.at(-1).type).toBe('error');
    });

    test('brak studni → toast, bez modala', () => {
        const { context, showModalCalls, toasts } = runContext();
        context.getCurrentWell = () => null;
        context.openCustomPrzejscieModal({ mode: 'create' });
        expect(showModalCalls).toHaveLength(0);
        expect(toasts.at(-1).msg).toContain('studnię');
    });
});
