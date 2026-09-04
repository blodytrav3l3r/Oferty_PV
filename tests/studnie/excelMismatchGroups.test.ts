// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('excel mismatch — grupowanie weryfikacji (soft-cap, zero auto-accept)', () => {
    let ctx: any;

    beforeAll(() => {
        const base = path.join(__dirname, '../../public/js/studnie');
        const context: any = {
            wells: [],
            studnieProducts: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            document: { querySelectorAll: () => [], getElementById: () => null },
            window: {},
            LAYERS: { TOAST: 1000 },
            logger: { info: () => {}, warn: () => {}, error: () => {} },
            escapeHtml: (s: string) => String(s),
            escapeHtmlAttr: (s: string) => String(s),
            showToast: () => {},
            _excelCreatePrzejscie: () => ({
                productId: '',
                tempCategory: '',
                rzednaWlaczenia: null,
                angle: 0,
                angleExecution: 0,
                angleGony: 0,
                flowType: 'PRZELOT'
            })
        };
        context.window = context;
        vm.createContext(context);
        const code = fs.readFileSync(path.join(base, 'excelCopyPaste.js'), 'utf8');
        vm.runInContext(code, context);
        ctx = context;
    });

    beforeEach(() => {
        vm.runInContext('_excelResetMismatches()', ctx);
        ctx.wells = [];
        ctx.studnieProducts = [
            {
                id: 'pcv-200',
                componentType: 'przejscie',
                category: 'PVC',
                dn: '200',
                name: 'PVC DN200'
            },
            {
                id: 'pcv-250',
                componentType: 'przejscie',
                category: 'PVC',
                dn: '250',
                name: 'PVC DN250'
            },
            {
                id: 'grp-200',
                componentType: 'przejscie',
                category: 'GRP',
                dn: '200',
                name: 'GRP DN200'
            }
        ];
    });

    function rec(
        wIdx: number,
        colIdx: number,
        originalVal: string,
        matchedVal: string,
        kind = 'cats'
    ) {
        vm.runInContext(
            `_excelRecordMismatch({wIdx:${wIdx},colIdx:${colIdx},wellName:'S${wIdx}',originalVal:'${originalVal}',matchedVal:'${matchedVal}',matchedText:'${matchedVal}',optionsKind:'${kind}'})`,
            ctx
        );
    }

    test('1000 wpisów tej samej wartości → 1 grupa z 1000 targets (flat array bez zmian)', () => {
        for (let i = 0; i < 1000; i++) rec(i, 9, 'pcv', 'PVC');
        const flat = vm.runInContext('_excelPasteMismatches', ctx);
        expect(flat.length).toBe(1000);
        const groups = vm.runInContext('_excelGroupMismatches(_excelPasteMismatches)', ctx);
        expect(groups.length).toBe(1);
        expect(groups[0].targets.length).toBe(1000);
        expect(groups[0].count).toBe(1000);
    });

    test('ta sama wartość w różnych kategoriach → osobne grupy (matchedVal w kluczu)', () => {
        rec(0, 10, '200', 'pcv-200');
        rec(1, 10, '200', 'grp-200');
        const groups = vm.runInContext('_excelGroupMismatches(_excelPasteMismatches)', ctx);
        expect(groups.length).toBe(2);
    });

    test('rodzaj vs średnica o tym samym tekście → osobne grupy', () => {
        rec(0, 9, '200', 'PVC');
        rec(0, 10, '200', 'pcv-200');
        const groups = vm.runInContext('_excelGroupMismatches(_excelPasteMismatches)', ctx);
        expect(groups.length).toBe(2);
        expect(groups.map((g: any) => g.colKind).sort()).toEqual(['rodzaj', 'srednica']);
    });

    test('decyzja grupy aplikowana do wszystkich targets (confirm semantyka)', () => {
        ctx.wells = [
            { name: 'S1', dn: 1000, przejscia: [] },
            { name: 'S2', dn: 1000, przejscia: [] }
        ];
        vm.runInContext(
            `_excelApplyMismatchChoice({wIdx:0,colIdx:9}, 'PVC'); _excelApplyMismatchChoice({wIdx:1,colIdx:9}, 'PVC');`,
            ctx
        );
        expect(ctx.wells[0].przejscia[0].tempCategory).toBe('PVC');
        expect(ctx.wells[1].przejscia[0].tempCategory).toBe('PVC');
    });

    test('powtórny zapis tej samej komórki nadpisuje (O(1), bez wzrostu)', () => {
        rec(0, 9, 'pcv', 'PVC');
        rec(0, 9, 'pcv', 'PVC');
        const flat = vm.runInContext('_excelPasteMismatches', ctx);
        expect(flat.length).toBe(1);
    });

    test('wiersz zawiera <select> bezpośrednio obok wartości', () => {
        rec(0, 10, '200', 'pcv-200', 'products');
        rec(1, 10, '200', 'pcv-200', 'products');
        const html: string = vm.runInContext(
            '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
            ctx
        );
        expect(html).toContain('<select');
        expect(html).toContain('S0');
        expect(html).toContain('Przejście 1 (Średnica)');
    });

    test('resolver dokleja brakujący matched (select nie pokaże złej wartości)', () => {
        for (let i = 0; i < 400; i++)
            vm.runInContext(
                `studnieProducts.push({id:'x-${i}',componentType:'przejscie',category:'ZZZ',dn:'${i}',name:'ZZZ DN${i}'})`,
                ctx
            );
        rec(0, 10, '200', 'pcv-200', 'products');
        const opts: any[] = vm.runInContext(
            `_excelResolveMismatchOptions(_excelPasteMismatches[0])`,
            ctx
        );
        expect(opts.some((o) => o.value === 'pcv-200')).toBe(true);
    });

    describe('modal flat — pełna lista per wiersz + global per wartość', () => {
        test('label per przejście z colIdx', () => {
            expect(vm.runInContext('_excelMismatchRowLabel({colIdx:9})', ctx)).toBe(
                'Przejście 1 (Rodzaj)'
            );
            expect(vm.runInContext('_excelMismatchRowLabel({colIdx:10})', ctx)).toBe(
                'Przejście 1 (Średnica)'
            );
            expect(vm.runInContext('_excelMismatchRowLabel({colIdx:14})', ctx)).toBe(
                'Przejście 2 (Średnica)'
            );
        });

        test('flat-by-key: tylko wiersze z tą samą wartością', () => {
            rec(0, 10, '200', 'pcv-200', 'products');
            rec(1, 10, '200', 'pcv-200', 'products');
            rec(2, 10, '250', 'pcv-250', 'products');
            const idxs: number[] = vm.runInContext(
                `_excelMismatchFlatByKey(_excelPasteMismatches, _excelMismatchGroupKey(_excelPasteMismatches[0]))`,
                ctx
            );
            expect(idxs).toEqual([0, 1]);
        });

        test('filtr po nazwie studni (widok flat)', () => {
            rec(0, 10, '200', 'pcv-200', 'products');
            rec(1, 10, '200', 'pcv-200', 'products');
            vm.runInContext(
                `_excelMismatchView = {rows: _excelPasteMismatches, filter: 's1', shown: 0, visible: [], overrides: {}};`,
                ctx
            );
            const list: number[] = vm.runInContext('_excelMismatchFilteredRows()', ctx);
            expect(list).toEqual([1]);
            vm.runInContext('_excelMismatchView = null;', ctx);
        });

        test('confirm per wiersz respektuje overrides (bez DOM)', () => {
            ctx.wells = [
                { name: 'S1', dn: 1000, przejscia: [] },
                { name: 'S2', dn: 1000, przejscia: [] }
            ];
            rec(0, 10, '200', 'pcv-200', 'products');
            rec(1, 10, '200', 'pcv-200', 'products');
            vm.runInContext(
                `_excelMismatchView = {rows: _excelPasteMismatches, filter: '', shown: 0, visible: [0, 1], overrides: {1: {value: 'pcv-250', text: 'PVC DN250'}}};`,
                ctx
            );
            vm.runInContext(
                `studnieProducts.push({id:'pcv-250',componentType:'przejscie',category:'PVC',dn:'250',name:'PVC DN250'})`,
                ctx
            );
            vm.runInContext('excelConfirmPasteMismatches()', ctx);
            expect(ctx.wells[0].przejscia[0].productId).toBe('pcv-200');
            expect(ctx.wells[1].przejscia[0].productId).toBe('pcv-250');
            vm.runInContext('_excelMismatchView = null;', ctx);
        });
    });

    describe('Lp + mapowanie wklejona → dopasowana w wierszu modala', () => {
        test('Lp fallback wIdx+1, Dopasowanie bez powtórki Wklejonej', () => {
            rec(4, 9, 'pcv', 'PVC');
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).toContain('>5<');
            expect(html).not.toContain('→');
            expect(html).toContain('PVC');
        });

        test('identyczne wartości bez strzałki', () => {
            rec(0, 9, 'PVC', 'PVC');
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).not.toContain('→');
            expect(html).toContain('PVC');
        });

        test('brak dopasowania bez strzałki', () => {
            rec(0, 9, 'incor', '');
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).not.toContain('→');
            expect(html).toContain('nie dopasowano');
        });

        test('średnica pokazuje dobrany DN, nazwa w tooltipie', () => {
            vm.runInContext(
                `_excelRecordMismatch({wIdx:2,colIdx:10,wellName:'S2',originalVal:'200',matchedVal:'pcv-200',matchedText:'PVC DN200',optionsKind:'products'})`,
                ctx
            );
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).toContain('>3<');
            expect(html).not.toContain('→');
            expect(html).toContain('>DN200<');
            expect(html).toContain('title="PVC DN200"');
        });

        test('override użytkownika wygrywa w labelce (DN + tooltip)', () => {
            rec(0, 10, '200', 'pcv-200', 'products');
            vm.runInContext(
                `_excelMismatchView = {rows: _excelPasteMismatches, filter: '', shown: 0, visible: [0], overrides: {0: {value: 'grp-200', text: 'GRP DN200'}}};`,
                ctx
            );
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).toContain('>DN200<');
            expect(html).toContain('title="GRP DN200"');
            vm.runInContext('_excelMismatchView = null;', ctx);
        });

        test('średnica bez DN w nazwie → sam DN, nazwa w tooltipie', () => {
            vm.runInContext(
                `_excelRecordMismatch({wIdx:0,colIdx:10,wellName:'S0',originalVal:'200',matchedVal:'pcv-200',matchedText:'Rura PVC',optionsKind:'products'})`,
                ctx
            );
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).not.toContain('→');
            expect(html).toContain('>DN200<');
            expect(html).toContain('title="Rura PVC"');
            expect(html).not.toContain('DN200 — Rura PVC');
        });

        test('średnica: labelka to DN + tooltip z nazwą', () => {
            const lab: any = vm.runInContext(
                `_excelMismatchDiameterLabel({value:'pcv-200',text:'PVC DN200'})`,
                ctx
            );
            expect(lab.text).toBe('DN200');
            expect(lab.title).toBe('PVC DN200');
        });

        test('średnica bez produktów → nazwa bez zmian (brak DN)', () => {
            vm.runInContext('studnieProducts = [];', ctx);
            const lab: any = vm.runInContext(
                `_excelMismatchDiameterLabel({value:'',text:'Kolano X'})`,
                ctx
            );
            expect(lab.text).toBe('Kolano X');
            expect(lab.title).toBe('');
        });

        test('średnica: select oferuje DN, nie materiały', () => {
            vm.runInContext(
                `_excelRecordMismatch({wIdx:0,colIdx:10,wellName:'S0',originalVal:'516',matchedVal:'pcv-250',matchedText:'PVC DN250',optionsKind:'products',optionsLimit:0,optionsCat:'PVC'})`,
                ctx
            );
            const opts: any[] = vm.runInContext(
                '_excelResolveMismatchOptions(_excelPasteMismatches[0])',
                ctx
            );
            expect(opts.map((o) => o.text)).toEqual(['DN200', 'DN250']);
            expect(opts.map((o) => o.value)).toEqual(['pcv-200', 'pcv-250']);
        });

        test('średnica: reprezentant DN to auto-dopasowany produkt', () => {
            vm.runInContext(
                `studnieProducts.push({id:'pcv-200-b',componentType:'przejscie',category:'PVC',dn:'200',name:'PVC DN200 B'})`,
                ctx
            );
            vm.runInContext(
                `_excelRecordMismatch({wIdx:0,colIdx:10,wellName:'S0',originalVal:'201',matchedVal:'pcv-200-b',matchedText:'PVC DN200 B',optionsKind:'products',optionsLimit:0,optionsCat:'PVC'})`,
                ctx
            );
            const opts: any[] = vm.runInContext(
                '_excelResolveMismatchOptions(_excelPasteMismatches[0])',
                ctx
            );
            const dn200 = opts.find((o) => o.text === 'DN200');
            expect(dn200.value).toBe('pcv-200-b');
        });

        test('średnica: sort numeryczny DN', () => {
            vm.runInContext(
                `studnieProducts.push({id:'pcv-110',componentType:'przejscie',category:'PVC',dn:'110',name:'PVC DN110'},{id:'pcv-500',componentType:'przejscie',category:'PVC',dn:'500',name:'PVC DN500'},{id:'pcv-160',componentType:'przejscie',category:'PVC',dn:'160',name:'PVC DN160'})`,
                ctx
            );
            vm.runInContext(
                `_excelRecordMismatch({wIdx:0,colIdx:10,wellName:'S0',originalVal:'161',matchedVal:'pcv-160',matchedText:'PVC DN160',optionsKind:'products',optionsLimit:0,optionsCat:'PVC'})`,
                ctx
            );
            const opts: any[] = vm.runInContext(
                '_excelResolveMismatchOptions(_excelPasteMismatches[0])',
                ctx
            );
            expect(opts.map((o) => o.text)).toEqual(['DN110', 'DN160', 'DN200', 'DN250', 'DN500']);
        });

        test('średnica: matched DN spoza limitu dopisany', () => {
            vm.runInContext(
                `_excelRecordMismatch({wIdx:0,colIdx:10,wellName:'S0',originalVal:'251',matchedVal:'pcv-250',matchedText:'PVC DN250',optionsKind:'products',optionsLimit:1,optionsCat:'PVC'})`,
                ctx
            );
            const opts: any[] = vm.runInContext(
                '_excelResolveMismatchOptions(_excelPasteMismatches[0])',
                ctx
            );
            expect(opts.length).toBe(2);
            expect(opts.some((o) => o.text === 'DN250' && o.value === 'pcv-250')).toBe(true);
        });

        test('układ poziomy: select i przycisk obok wartości w jednym wierszu (flex-wrap:nowrap)', () => {
            rec(0, 10, '123', 'pcv-200', 'products');
            const html: string = vm.runInContext(
                '_excelMismatchRowHtml(_excelPasteMismatches[0], 0, 0)',
                ctx
            );
            expect(html).toContain('display:flex');
            expect(html).toContain('excel-mismatch-select');
            expect(html).toContain('flex-wrap:nowrap');
        });

        test('infinite scroll — doładowywanie przy przewijaniu kontenera do dołu', () => {
            for (let i = 0; i < 120; i++) rec(i, 9, 'pcv', 'PVC');
            vm.runInContext(
                `_excelMismatchView = {rows: _excelPasteMismatches, filter: '', shown: 50, visible: Array.from({length:120},(_,i)=>i), overrides: {}};`,
                ctx
            );
            const scrollContainer = { scrollHeight: 2000, scrollTop: 1600, clientHeight: 350 };
            vm.runInContext(`_excelMismatchOnScroll(${JSON.stringify(scrollContainer)})`, ctx);
            const shown: number = vm.runInContext('_excelMismatchView.shown', ctx);
            expect(shown).toBe(90);
            vm.runInContext('_excelMismatchView = null;', ctx);
        });

        test('filtr po Lp', () => {
            rec(4, 9, 'pcv', 'PVC');
            vm.runInContext(
                `_excelMismatchView = {rows: _excelPasteMismatches, filter: '5', shown: 0, visible: [], overrides: {}};`,
                ctx
            );
            const list: number[] = vm.runInContext('_excelMismatchFilteredRows()', ctx);
            expect(list).toEqual([0]);
            vm.runInContext('_excelMismatchView = null;', ctx);
        });
    });

    describe('model-only paste (wiersze bez DOM, duże wklejki) — k2kan vs GRP', () => {
        // Kolejność jak w seed: GRP przed K2KAN — stary kod brał "pierwszy z seeda".
        const MODEL_PRODUCTS = [
            {
                id: 'GRP-200',
                componentType: 'przejscie',
                category: 'GRP',
                dn: '200',
                name: 'GRP DN200'
            },
            {
                id: 'GRP-400',
                componentType: 'przejscie',
                category: 'GRP',
                dn: '400',
                name: 'GRP DN400'
            },
            {
                id: 'K2KAN-ID-200',
                componentType: 'przejscie',
                category: 'K2KAN ID',
                dn: '200',
                name: 'K2KAN DN200'
            },
            {
                id: 'K2KAN-ID-400',
                componentType: 'przejscie',
                category: 'K2KAN ID',
                dn: '400',
                name: 'K2KAN DN400'
            }
        ];

        function modelSetup() {
            ctx.studnieProducts = MODEL_PRODUCTS.map((p) => ({ ...p }));
            ctx.wells = [{ name: 'S1', dn: 1000, przejscia: [] }];
            vm.runInContext('_excelResetMismatches()', ctx);
            return ctx._excelBuildPasteCache();
        }

        test('k2kan + 400 → K2KAN-ID-400, nie GRP (kanoniczny Rodzaj + zakres)', () => {
            const cache = modelSetup();
            ctx._excelSetModelCellValue(0, 9, 'k2kan', cache, null);
            expect(ctx.wells[0].przejscia[0].tempCategory).toBe('K2KAN ID');
            ctx._excelSetModelCellValue(0, 10, '400', cache, null);
            expect(ctx.wells[0].przejscia[0].productId).toBe('K2KAN-ID-400');
            expect(ctx.wells[0].przejscia[0].tempCategory).toBe('K2KAN ID');
        });

        test('id z obcej kategorii przy ustawionym Rodzaju → odrzut + mismatch', () => {
            const cache = modelSetup();
            ctx._excelSetModelCellValue(0, 9, 'K2KAN ID', cache, null);
            ctx._excelSetModelCellValue(0, 10, 'GRP-400', cache, null);
            expect(ctx.wells[0].przejscia[0].productId).not.toBe('GRP-400');
            expect(ctx.wells[0].przejscia[0].tempCategory).toBe('K2KAN ID');
            const flat = vm.runInContext('_excelPasteMismatches', ctx);
            expect(flat.some((m: any) => m.originalVal === 'GRP-400')).toBe(true);
        });

        test('sama średnica bez kategorii przy wielu kategoriach → pusto + mismatch (zero zgadywania)', () => {
            const cache = modelSetup();
            ctx._excelSetModelCellValue(0, 10, '400', cache, null);
            expect(ctx.wells[0].przejscia[0].productId).toBe('');
            const flat = vm.runInContext('_excelPasteMismatches', ctx);
            expect(flat.length).toBe(1);
            expect(flat[0].matchedVal).toBe('');
        });

        test('exact + exact w modelu → cicho, zero mismatchy', () => {
            const cache = modelSetup();
            ctx._excelSetModelCellValue(0, 9, 'K2KAN ID', cache, null);
            ctx._excelSetModelCellValue(0, 10, '400', cache, null);
            expect(ctx.wells[0].przejscia[0].productId).toBe('K2KAN-ID-400');
            const flat = vm.runInContext('_excelPasteMismatches', ctx);
            expect(flat.length).toBe(0);
        });
    });
});
