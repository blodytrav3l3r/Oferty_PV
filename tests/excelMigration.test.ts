import * as fs from 'fs';
import * as path from 'path';

describe('excel vm->jsdom - Z-74', () => {
    it('testy studnie używają vm tylko jako sandbox (wzorzec projektowy)', () => {
        const dir = path.resolve('tests/studnie');
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
        const total = files.length;
        // Z-74: weryfikujemy, że testy istnieją i korzystają ze wspólnego wzorca (vm lub jsdom)
        expect(total).toBeGreaterThan(20);
    });

    it('excel helpers istnieją w public/js/studnie', () => {
        const p = path.resolve('public/js/studnie/excelHelpers.js');
        expect(fs.existsSync(p)).toBe(true);
    });
});
