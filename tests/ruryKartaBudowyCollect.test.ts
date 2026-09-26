// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('rury karta budowy: offerNumbers jako tablica (F2)', () => {
    function makeDocument(values: Record<string, string>) {
        const els: Record<string, any> = {};
        return {
            getElementById: (id: string) => {
                if (!els[id]) {
                    els[id] = {
                        value: values[id] ?? '',
                        style: { display: '' },
                        dataset: {},
                        dispatchEvent: () => {},
                        addEventListener: () => {}
                    };
                }
                return els[id];
            },
            _els: els
        };
    }

    function makeDocumentWithQuery(values: Record<string, string>) {
        const doc: any = makeDocument(values);
        doc.querySelectorAll = () => [];
        doc.querySelector = () => null;
        return doc;
    }

    function runCtx(values: Record<string, string>) {
        const context: any = {
            window: {},
            document: makeDocumentWithQuery(values),
            getActiveItemsArray: () => [],
            collectPrzejsciaDetailsFromTable: () => [],
            renderPrzejsciaDetailsTable: () => {},
            showToast: () => {},
            Event: class {
                constructor(
                    public type: string,
                    public opts?: any
                ) {}
            }
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../public/js/rury/orderKartaBudowy.js'),
            'utf8'
        );
        const codePrzejscia = fs.readFileSync(
            path.join(__dirname, '../public/js/rury/orderPrzejscia.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        vm.runInContext(codePrzejscia, context);
        return context;
    }

    test('collect zwraca offerNumbers jako string[]', () => {
        const ctx = runCtx({ 'step4-offer-nr-input': 'OF/2026/001, OF/2026/002' });
        const kb = ctx.collectKartaBudowyDataStep4();
        expect(Array.isArray(kb.offerNumbers)).toBe(true);
        expect(kb.offerNumbers).toEqual(['OF/2026/001', 'OF/2026/002']);
    });

    test('puste pole daje pusta tablice', () => {
        const ctx = runCtx({});
        const kb = ctx.collectKartaBudowyDataStep4();
        expect(kb.offerNumbers).toEqual([]);
    });

    test('kontakt prefill: Zamawiajacy + Budowa z przedrostkami', () => {
        const ctx = runCtx({});
        expect(ctx._buildKontaktPrefill('Jan 123', 'Firma X')).toBe(
            'Zamawiający: Jan 123, Budowa: Firma X'
        );
        expect(ctx._buildKontaktPrefill('Jan 123', '')).toBe('Zamawiający: Jan 123');
        expect(ctx._buildKontaktPrefill('', 'Firma X')).toBe('Budowa: Firma X');
        expect(ctx._buildKontaktPrefill('', '')).toBe('');
        expect(ctx._buildKontaktPrefill(null, undefined)).toBe('');
    });

    test('copy odtwarza tablice jako tekst rozdzielony przecinkiem', () => {
        const ctx = runCtx({});
        ctx.applyCopiedKartaBudowyData({ offerNumbers: ['OF/1', 'OF/2'] });
        const doc = ctx.document;
        expect(doc._els['step4-offer-nr-input'].value).toBe('OF/1, OF/2');
    });

    test('przelacznik Czy przejscie toggluje TAK/NIE z kolorem i zapisem', () => {
        const ctx = runCtx({});
        ctx.window._customPrzejscieRows = [{ rodzaj: 'A', czyPrzejscie: 'TAK' }];
        const btn: any = {
            value: 'TAK',
            textContent: 'TAK',
            style: {},
            dataset: { field: 'czyPrzejscie', source: 'custom', idx: '0' }
        };
        ctx._toggleCzyPrzejscie(btn);
        expect(btn.value).toBe('NIE');
        expect(btn.textContent).toBe('NIE');
        expect(btn.style.color).toBe('var(--danger-hover)');
        expect(ctx.window._customPrzejscieRows[0].czyPrzejscie).toBe('NIE');
        ctx._toggleCzyPrzejscie(btn);
        expect(btn.value).toBe('TAK');
        expect(btn.style.color).toBe('var(--success-hover)');
        expect(ctx.window._customPrzejscieRows[0].czyPrzejscie).toBe('TAK');
    });
});
