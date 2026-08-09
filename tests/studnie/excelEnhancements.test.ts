// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('Excel — sortowanie, suma zaznaczenia (pure helpers)', () => {
    let ctx: any;

    beforeAll(() => {
        const context: any = {
            studnieProducts: [],
            wells: [],
            window: {},
            logger: { info: () => {}, warn: () => {}, error: () => {} }
        };
        const base = path.join(__dirname, '../../public/js/studnie');
        vm.createContext(context);
        for (const file of [
            'excelState.js',
            'excelCopyPaste.js',
            'excelCellSelection.js',
            'excelSort.js'
        ]) {
            const code = fs.readFileSync(path.join(base, file), 'utf8');
            vm.runInContext(code, context);
        }
        ctx = context;
    });

    describe('_excelCompareCellValues', () => {
        test('liczby numerycznie (także z przecinkiem)', () => {
            expect(ctx._excelCompareCellValues('10', '2')).toBeGreaterThan(0);
            expect(ctx._excelCompareCellValues('2,5', '10')).toBeLessThan(0);
            expect(ctx._excelCompareCellValues('7', '7')).toBe(0);
        });
        test('tekst po polsku (localeCompare pl)', () => {
            expect(ctx._excelCompareCellValues('ą', 'z')).toBeLessThan(0);
        });
        test('liczby przed tekstem, puste na końcu', () => {
            expect(ctx._excelCompareCellValues('5', 'abc')).toBeLessThan(0);
            expect(ctx._excelCompareCellValues('', 'abc')).toBeGreaterThan(0);
            expect(ctx._excelCompareCellValues('abc', '')).toBeLessThan(0);
        });
    });

    describe('_excelNextSortState — cykl sortowania', () => {
        test('null → asc, asc → desc, desc → null (dla tej samej kolumny)', () => {
            const s1 = ctx._excelNextSortState(5, null);
            expect(s1).toEqual({ colIdx: 5, dir: 'asc' });
            const s2 = ctx._excelNextSortState(5, s1);
            expect(s2).toEqual({ colIdx: 5, dir: 'desc' });
            expect(ctx._excelNextSortState(5, s2)).toBeNull();
        });
        test('zmiana kolumny startuje od asc', () => {
            const s = ctx._excelNextSortState(5, { colIdx: 3, dir: 'desc' });
            expect(s).toEqual({ colIdx: 5, dir: 'asc' });
        });
    });

    describe('_excelSumNumericValues', () => {
        test('suma liczb z przecinkiem i pominięcie nie-numerycznych', () => {
            const res = ctx._excelSumNumericValues(['10', '2,5', 'abc', '', null, 3]);
            expect(res.sum).toBeCloseTo(15.5);
            expect(res.count).toBe(3);
        });
        test('brak liczb — suma 0, count 0', () => {
            expect(ctx._excelSumNumericValues(['abc', '', null])).toEqual({ sum: 0, count: 0 });
        });
    });
});
