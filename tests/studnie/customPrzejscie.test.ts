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
        customPrzejsciaTypes: [],
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

describe('typy niestandardowych przejść (nazwa + warianty DN)', () => {
    test('auto-waga: walec betonu DN × 15 cm × 2400 kg/m³', () => {
        const { context } = runContext();
        expect(context.computeCustomPrzejscieWeight('315')).toBeCloseTo(28.06, 2);
        expect(context.computeCustomPrzejscieWeight('')).toBe(0);
        expect(context.computeCustomPrzejscieWeight('abc')).toBe(0);
        const v = context.validateCustomPrzejscie({ name: 'P', dn: '315', price: 10 });
        expect(v.value.weight).toBeCloseTo(28.06, 2);
    });

    test('validateCustomPrzejscieType: nazwa, warianty, duplikaty DN, ceny', () => {
        const { context } = runContext();
        const validate = context.validateCustomPrzejscieType;
        expect(validate({ name: '', variants: [{}] }).errors.name).toContain('nazw');
        expect(validate({ name: 'T', variants: [] }).errors.variants).toContain('średnic');
        const dup = validate({
            name: 'T',
            variants: [
                { dn: '315', price: 100 },
                { dn: '315', price: 200 }
            ]
        });
        expect(dup.ok).toBe(false);
        expect(dup.errors['v1-dn']).toContain('już jest');
        const noPrice = validate({ name: 'T', variants: [{ dn: '315' }] });
        expect(noPrice.errors['v0-price']).toContain('cenę');
        const ok = validate({
            name: 'T',
            variants: [
                { dn: '315', price: 100 },
                { dn: '400', price: '123.456' }
            ]
        });
        expect(ok.ok).toBe(true);
        expect(ok.value.variants).toEqual([
            { dn: '315', weight: 28.06, price: 100 },
            { dn: '400', weight: 45.24, price: 123.46 }
        ]);
    });

    test('buildCustomPrzejscieType: tworzy i zachowuje id przy edycji', () => {
        const { context } = runContext();
        const values = { name: 'Spec', variants: [{ dn: '315', price: 100 }] };
        const created = context.buildCustomPrzejscieType(values, null);
        expect(created.ok).toBe(true);
        expect(typeof created.type.id).toBe('string');
        const edited = context.buildCustomPrzejscieType(
            { name: 'Spec 2', variants: [{ dn: '315', price: 200 }] },
            created.type
        );
        expect(edited.type.id).toBe(created.type.id);
        expect(edited.type.name).toBe('Spec 2');
        expect(edited.type.variants[0].price).toBe(200);
    });

    test('klucze typu i wariantu: custom:<id> / custom:<id>:<dn>', () => {
        const { context } = runContext();
        expect(context.customPrzejsciaTypeKey('t1')).toBe('custom:t1');
        const variantKey = context.getCustomPrzejsciaVariantKey('t1', '315');
        expect(variantKey).toBe('custom:t1:315');
        expect(context.parseCustomPrzejsciaVariantKey(variantKey)).toEqual({
            typeId: 't1',
            dn: '315'
        });
        expect(context.parseCustomPrzejsciaVariantKey('custom:t1')).toBeNull();
        expect(context.isCustomPrzejsciaTypeKey('custom:t1')).toBe(true);
        expect(context.isCustomPrzejsciaTypeKey('PVC')).toBe(false);
    });

    test('normalizeCustomPrzejsciaTypes: odrzuca puste/invalidne warianty i typy', () => {
        const { context } = runContext();
        const types = context.normalizeCustomPrzejsciaTypes([
            { id: 'a', name: 'A', variants: [{ dn: '315', price: 100 }] },
            { id: 'b', name: 'B', variants: [] },
            { id: 'c', name: 'C', variants: [{ dn: '', price: 10 }] },
            null
        ]);
        expect(types).toHaveLength(1);
        expect(types[0]).toMatchObject({ id: 'a', name: 'A' });
        expect(types[0].variants[0].weight).toBeCloseTo(28.06, 2);
    });

    test('hydrateCustomPrzejsciaTypes: scala zapisane typy z pozycjami isCustom', () => {
        const { context } = runContext();
        const wells = [
            {
                przejscia: [
                    { isCustom: true, customName: 'Zapisany', dn: '315', customPrice: 100 },
                    {
                        isCustom: true,
                        customName: 'Nowy',
                        dn: '400',
                        customPrice: 200,
                        customWeight: 99
                    },
                    { productId: 'p1' }
                ]
            }
        ];
        const types = context.hydrateCustomPrzejsciaTypes(
            [{ id: 't1', name: 'Zapisany', variants: [{ dn: '315', weight: 28.06, price: 100 }] }],
            wells
        );
        expect(types).toHaveLength(2);
        expect(types[0].id).toBe('t1');
        expect(wells[0].przejscia[0].customTypeId).toBe('t1');
        const created = types.find((t) => t.name === 'Nowy');
        expect(created).toBeTruthy();
        expect(wells[0].przejscia[1].customTypeId).toBe(created.id);
        expect(created.variants[0]).toEqual({ dn: '400', weight: 99, price: 200 });
        expect(wells[0].przejscia[2].customTypeId).toBeUndefined();
    });

    test('sortowanie średnic rosnąco: walidacja i normalizacja', () => {
        const { context } = runContext();
        const result = context.validateCustomPrzejscieType({
            name: 'T',
            variants: [
                { dn: '400', price: 300 },
                { dn: '160', price: 100 },
                { dn: '315', price: 200 }
            ]
        });
        expect(result.ok).toBe(true);
        expect(result.value.variants.map((v: any) => v.dn)).toEqual(['160', '315', '400']);
        const normalized = context.normalizeCustomPrzejsciaTypes([
            {
                id: 'a',
                name: 'A',
                variants: [
                    { dn: '400', price: 300 },
                    { dn: '160', price: 100 },
                    { dn: '315', price: 200 }
                ]
            }
        ]);
        expect(normalized[0].variants.map((v: any) => v.dn)).toEqual(['160', '315', '400']);
    });

    test('modal typu: wiersze średnic w kolejności rosnącej', () => {
        const { context, showModalCalls } = runContext();
        context.customPrzejsciaTypes = [
            {
                id: 't1',
                name: 'Spec',
                variants: [
                    { dn: '400', weight: 45.24, price: 300 },
                    { dn: '160', weight: 7.24, price: 100 },
                    { dn: '315', weight: 28.06, price: 200 }
                ]
            }
        ];
        context.openCustomPrzejscieTypeModal({ mode: 'edit', typeId: 't1' });
        const html = showModalCalls[0].html;
        const order = Array.from(html.matchAll(/data-cp-field="dn"[^>]*value="([^"]*)"/g)).map(
            (m: any) => m[1]
        );
        expect(order).toEqual(['160', '315', '400']);
    });

    test('modal typu: nazwa escapowana w HTML (XSS)', () => {
        const { context, showModalCalls } = runContext();
        context.customPrzejsciaTypes = [
            {
                id: 't1',
                name: '<img src=x onerror=alert(1)>',
                variants: [{ dn: '315', weight: 28.06, price: 100 }]
            }
        ];
        context.openCustomPrzejscieTypeModal({ mode: 'edit', typeId: 't1' });
        expect(showModalCalls).toHaveLength(1);
        const html = showModalCalls[0].html;
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
    });

    test('modal typu: blokada oferty nie otwiera formularza', () => {
        const { context, showModalCalls, toasts } = runContext();
        context.isOfferLocked = () => true;
        context.openCustomPrzejscieTypeModal({ mode: 'create' });
        expect(showModalCalls).toHaveLength(0);
        expect(toasts.at(-1).type).toBe('error');
    });
});
