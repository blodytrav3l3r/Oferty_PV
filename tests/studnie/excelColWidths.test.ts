// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadState() {
    const context: any = { window: {}, localStorage: { getItem: () => null, setItem: () => {} } };
    vm.createContext(context);
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelState.js'),
        'utf8'
    );
    vm.runInContext(code, context);
    return context;
}

describe('excelColWidths stabilne klucze', () => {
    test('roundtrip tab + colId z myslnikami', () => {
        const ctx = loadState();
        const key = vm.runInContext("_excelColWidthKey('1000', 'trz-0-kat')", ctx);
        expect(key).toBe('1000-trz-0-kat');
        const parsed = vm.runInContext("_excelParseColWidthKey('1000-trz-0-kat')", ctx);
        expect(parsed).toEqual({ tab: '1000', colId: 'trz-0-kat' });
    });

    test('rozroznia legacy klucz numeryczny od stabilnego', () => {
        const ctx = loadState();
        const legacy = vm.runInContext("_excelParseColWidthKey('1000-5')", ctx);
        expect(legacy).toEqual({ tab: '1000', colId: '5' });
        const stable = vm.runInContext("_excelParseColWidthKey('styczne-trz-2-srednica')", ctx);
        expect(stable).toEqual({ tab: 'styczne', colId: 'trz-2-srednica' });
    });

    test('odrzuca niepoprawne klucze', () => {
        const ctx = loadState();
        expect(vm.runInContext('_excelParseColWidthKey("")', ctx)).toBeNull();
        expect(vm.runInContext("_excelParseColWidthKey('1000-')", ctx)).toBeNull();
        expect(vm.runInContext('_excelParseColWidthKey(null)', ctx)).toBeNull();
    });
});
