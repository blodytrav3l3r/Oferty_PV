// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/* Baza #47: Wlaz (select) nie ma TD w sekcji komponentow (siedzi w prefiksie),
   wiec vis musi liczyc tylko renderowane kolumny. Kazdy wpis post-Wlaz
   wczesniej ladowal o 1 TD za daleko (fantom w Krag H=250). */
describe('excel vis->TD mapping pomija select/auto (baza #47)', () => {
    const products: any[] = [
        { id: 'W1', componentType: 'wlaz', dn: '1000', height: 150, name: 'Wlaz DN1000' },
        {
            id: 'PZE-16-10',
            componentType: 'plyta_zamykajaca',
            dn: '1000',
            height: 150,
            name: 'Plyta zamykajaca DN1000 H=150'
        },
        {
            id: 'PO-16-10',
            componentType: 'pierscien_odciazajacy',
            dn: '1000',
            height: 150,
            name: 'Pierscien odciazajacy DN1000 H=150'
        },
        { id: 'K1', componentType: 'krag', dn: '1000', height: 250, name: 'Krag DN1000 H=250' }
    ];

    function loadCtx() {
        const context: any = {
            window: {},
            console,
            studnieProducts: products,
            wells: [],
            _excelActiveTab: '1000',
            _excelMaxTransitions: { '1000': 1 },
            _excelHiddenColumnIds: [],
            filterByWellParams: () => true,
            DN_COLORS: { '1000': { border: 'x' } },
            LAYERS_EXCEL: {},
            getAvailableProducts: () => products,
            logger: { warn: () => {} }
        };
        vm.createContext(context);
        for (const f of [
            'excelColumns.js',
            'excelReductionColumns.js',
            'excelHelpers.js',
            'excelCopyPaste.js'
        ]) {
            vm.runInContext(
                fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
                context
            );
        }
        return context;
    }

    test('Wlaz nie dostaje vis, krag_250 vis=16 (prefix 14 + 2 renderowane)', () => {
        const ctx = loadCtx();
        const seq = ctx._excelBuildVisibleSeq();
        const byId: any = {};
        for (const s of seq) byId[s.id] = s;
        expect(byId['wlaz']).toBeUndefined();
        expect(byId['plyta_zamykajaca_150'].vis).toBe(14);
        expect(byId['pierscien_odciazajacy_150'].vis).toBe(15);
        expect(byId['krag_250'].vis).toBe(16);
        // logical bez zmian — po all[] (z wlazem)
        expect(byId['krag_250'].logical).toBe(17);
    });

    test('vis sa ciagle od prefixLen (brak dziur po select)', () => {
        const ctx = loadCtx();
        const seq = ctx._excelBuildVisibleSeq();
        const visVals = seq.map((s: any) => s.vis).sort((a: number, b: number) => a - b);
        for (let i = 1; i < visVals.length; i++) {
            expect(visVals[i] - visVals[i - 1]).toBe(1);
        }
    });

    test('_excelGetCellByLogical: krag trafia we wlasciwe TD, wlaz -> null', () => {
        const ctx = loadCtx();
        const children: any[] = [];
        for (let i = 0; i < 40; i++) children.push({ idx: i });
        const row = { children };
        const kragCell = ctx._excelGetCellByLogical(row, 17);
        expect(kragCell.idx).toBe(16);
        expect(ctx._excelGetCellByLogical(row, 14)).toBeNull();
    });
});
