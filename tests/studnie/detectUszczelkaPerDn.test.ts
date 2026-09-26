// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('detectUszczelkaPerDn (karta budowy, F1)', () => {
    function runCtx(opts: any = {}) {
        const context: any = {
            window: {},
            document: { getElementById: () => null },
            GASKET_TYPES: ['GSG', 'SDV', 'SDV PO', 'NBR'],
            inferUszczelkaType: opts.inferStub || null
        };
        if (!opts.inferStub) delete context.inferUszczelkaType;
        if (opts.noGasketTypes) delete context.GASKET_TYPES;
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderKartaBudowy.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        return context;
    }

    test('jeden DN z well.uszczelka', () => {
        const ctx = runCtx();
        expect(ctx.detectUszczelkaPerDn([{ dn: '1000', uszczelka: 'GSG' }])).toBe('DN1000: GSG');
    });

    test('mieszane DN sortowane numerycznie', () => {
        const ctx = runCtx();
        const wells = [
            { dn: '1000', uszczelka: 'SDV' },
            { dn: '800', uszczelka: 'GSG' }
        ];
        expect(ctx.detectUszczelkaPerDn(wells)).toBe('DN800: GSG, DN1000: SDV');
    });

    test('ten sam DN z roznymi typami laczy przez /', () => {
        const ctx = runCtx();
        const wells = [
            { dn: '1000', uszczelka: 'GSG' },
            { dn: '1000', uszczelka: 'SDV' }
        ];
        expect(ctx.detectUszczelkaPerDn(wells)).toBe('DN1000: GSG/SDV');
    });

    test('jawny brak we wszystkich studniach daje Brak', () => {
        const ctx = runCtx();
        expect(
            ctx.detectUszczelkaPerDn([
                { dn: '1000', uszczelka: 'brak' },
                { dn: '800', uszczelka: 'brak' }
            ])
        ).toBe('Brak');
    });

    test('brak w jednym DN nie blokuje typu z innej studni tego DN', () => {
        const ctx = runCtx();
        const wells = [
            { dn: '1000', uszczelka: 'brak' },
            { dn: '1000', uszczelka: 'NBR' }
        ];
        expect(ctx.detectUszczelkaPerDn(wells)).toBe('DN1000: NBR');
    });

    test('styczna na koncu', () => {
        const ctx = runCtx();
        const wells = [
            { dn: 'styczna', uszczelka: 'GSG' },
            { dn: '800', uszczelka: 'SDV' }
        ];
        expect(ctx.detectUszczelkaPerDn(wells)).toBe('DN800: SDV, DNstyczna: GSG');
    });

    test('puste wejscie daje Brak', () => {
        const ctx = runCtx();
        expect(ctx.detectUszczelkaPerDn([])).toBe('Brak');
        expect(ctx.detectUszczelkaPerDn(null)).toBe('Brak');
    });

    test('legacy bez well.uszczelka: fallback inferUszczelkaType', () => {
        const ctx = runCtx({ inferStub: () => 'SDV PO' });
        expect(ctx.detectUszczelkaPerDn([{ dn: '1200', config: [] }])).toBe('DN1200: SDV PO');
    });

    test('legacy bez infera daje Brak (hands-off, nie GSG)', () => {
        const ctx = runCtx();
        expect(ctx.detectUszczelkaPerDn([{ dn: '1200', config: [] }])).toBe('Brak');
    });

    test('dziala bez zaladowanego GASKET_TYPES (wbudowany fallback)', () => {
        const ctx = runCtx({ noGasketTypes: true });
        expect(ctx.detectUszczelkaPerDn([{ dn: '1000', uszczelka: 'GSG' }])).toBe('DN1000: GSG');
    });
});

describe('przelacznik Auto/Recznie uszczelki (karta budowy)', () => {
    const OPTION_VALUES = ['Nie dotyczy', 'Brak', 'GSG', 'SDV', 'SDV PO', 'NBR', 'Inne'];

    function makeDoc() {
        const radios = [
            { value: 'auto', checked: true },
            { value: 'manual', checked: false }
        ];
        const els: any = {
            'step4-uszczelka-studni-auto': { value: '', style: { display: '' } },
            'step4-uszczelka-studni': {
                value: 'Brak',
                style: { display: 'none' },
                options: OPTION_VALUES.map((v) => ({ value: v }))
            },
            'step4-uszczelka-studni-inne': { value: '' },
            'step4-uszczelka-studni-inne-wrap': { style: { display: '' } }
        };
        return {
            getElementById: (id: string) => els[id] || null,
            querySelector: (sel: string) =>
                sel === 'input[name="step4-uszczelka-mode"]:checked'
                    ? radios.find((r) => r.checked) || null
                    : null,
            querySelectorAll: (sel: string) =>
                sel === 'input[name="step4-uszczelka-mode"]' ? radios : [],
            _radios: radios,
            _els: els
        };
    }

    function runModeCtx(autoText: string) {
        const context: any = {
            window: {},
            document: makeDoc(),
            GASKET_TYPES: ['GSG', 'SDV', 'SDV PO', 'NBR']
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderKartaBudowy.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        context.document._els['step4-uszczelka-studni-auto'].value = autoText;
        return context;
    }

    test('wartosc rowna auto-detekcji daje tryb auto', () => {
        const ctx = runModeCtx('DN1000: GSG');
        ctx._applyUszczelkaValueWithMode('DN1000: GSG');
        expect(ctx.getUszczelkaMode()).toBe('auto');
    });

    test('wartosc z listy opcji daje tryb manual z selectem', () => {
        const ctx = runModeCtx('DN1000: GSG');
        ctx._applyUszczelkaValueWithMode('SDV');
        expect(ctx.getUszczelkaMode()).toBe('manual');
        expect(ctx.document._els['step4-uszczelka-studni'].value).toBe('SDV');
        expect(ctx.document._els['step4-uszczelka-studni'].style.display).toBe('');
        expect(ctx.document._els['step4-uszczelka-studni-auto'].style.display).toBe('none');
    });

    test('wartosc spoza listy laduje w polu Inne (tryb manual)', () => {
        const ctx = runModeCtx('DN1000: GSG');
        ctx._applyUszczelkaValueWithMode('DN800: GSG, DN1000: SDV');
        expect(ctx.getUszczelkaMode()).toBe('manual');
        expect(ctx.document._els['step4-uszczelka-studni'].value).toBe('Inne');
        expect(ctx.document._els['step4-uszczelka-studni-inne'].value).toBe(
            'DN800: GSG, DN1000: SDV'
        );
        expect(ctx.document._els['step4-uszczelka-studni-inne-wrap'].style.display).toBe('block');
    });

    test('setUszczelkaMode pokazuje tylko jedno pole naraz', () => {
        const ctx = runModeCtx('Brak');
        ctx.setUszczelkaMode('manual');
        expect(ctx.document._els['step4-uszczelka-studni'].style.display).toBe('');
        expect(ctx.document._els['step4-uszczelka-studni-auto'].style.display).toBe('none');
        ctx.setUszczelkaMode('auto');
        expect(ctx.getUszczelkaMode()).toBe('auto');
        expect(ctx.document._els['step4-uszczelka-studni'].style.display).toBe('none');
        expect(ctx.document._els['step4-uszczelka-studni-auto'].style.display).toBe('');
    });

    test('pusta wartosc nie rusza trybu', () => {
        const ctx = runModeCtx('DN1000: GSG');
        ctx._applyUszczelkaValueWithMode('');
        expect(ctx.getUszczelkaMode()).toBe('auto');
    });
});
