import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadParseDecimal() {
    const filePath = path.join(__dirname, '..', 'public', 'js', 'shared', 'parseDecimal.js');
    const source = fs.readFileSync(filePath, 'utf8');

    const sandbox: any = {
        console,
        window: {} as any
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'parseDecimal.js' });

    return sandbox.window.parseDecimal as (value: unknown) => number;
}

describe('parseDecimal', () => {
    let parseDecimal: (value: unknown) => number;

    beforeAll(() => {
        parseDecimal = loadParseDecimal();
    });

    it('powinien zwrócić liczbę dla stringa z kropką', () => {
        expect(parseDecimal('1.5')).toBe(1.5);
    });

    it('powinien obsłużyć przecinek jako separator dziesiętny', () => {
        expect(parseDecimal('1,5')).toBe(1.5);
    });

    it('powinien obsłużyć liczbę całkowitą', () => {
        expect(parseDecimal('42')).toBe(42);
    });

    it('powinien zwrócić 0 dla null', () => {
        expect(parseDecimal(null)).toBe(0);
    });

    it('powinien zwrócić 0 dla undefined', () => {
        expect(parseDecimal(undefined)).toBe(0);
    });

    it('powinien zwrócić 0 dla pustego stringa', () => {
        expect(parseDecimal('')).toBe(0);
    });

    it('powinien obsłużyć liczbę z spacją', () => {
        expect(parseDecimal(' 3.14 ')).toBe(3.14);
    });

    it('powinien obsłużyć wartość ujemną', () => {
        expect(parseDecimal('-2.5')).toBe(-2.5);
    });

    it('powinien zwrócić 0 dla NaN', () => {
        expect(parseDecimal(NaN)).toBe(0);
    });

    it('powinien zwrócić 0 dla Infinity', () => {
        expect(parseDecimal(Infinity)).toBe(0);
    });

    it('powinien obsłużyć polski format liczby (spacja jako separator tysięcy)', () => {
        expect(parseDecimal(' 1 234,56 ')).toBe(1234.56);
    });

    it('powinien zwrócić liczbę dla argumentu number', () => {
        expect(parseDecimal(3.14)).toBe(3.14);
    });
});
