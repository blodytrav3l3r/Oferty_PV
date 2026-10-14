import fs from 'fs';
import path from 'path';
import vm from 'vm';

const PARSE_NUM_PATH = path.join(__dirname, '../../public/js/shared/parseNum.js');
const CALC_INPUT_PATH = path.join(__dirname, '../../public/js/shared/calcInput.js');
const STUDNIE_HTML_PATH = path.join(__dirname, '../../public/studnie.html');

function loadParseNum() {
    const src = fs.readFileSync(PARSE_NUM_PATH, 'utf8');
    // Plik jest modulem ESM - do vm wycinamy prefiksy export (wzorzec fetchJson/authCookieHttpOnly).
    const code = src.replace(/^export /gm, '');
    const sandbox: any = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'parseNum.js' });
    return { sandbox, src };
}

describe('SSoT parseNum (shared/parseNum.js)', () => {
    it('parseNum: pusto/null/NaN -> null; przecinek -> kropka', () => {
        const { sandbox } = loadParseNum();
        const parseNum = sandbox.parseNum as (v: unknown) => number | null;
        expect(parseNum(null)).toBeNull();
        expect(parseNum(undefined)).toBeNull();
        expect(parseNum('')).toBeNull();
        expect(parseNum('   ')).toBeNull();
        expect(parseNum('abc')).toBeNull();
        expect(parseNum(Number.NaN)).toBeNull();
        expect(parseNum('12,5')).toBe(12.5);
        expect(parseNum('12.5')).toBe(12.5);
        expect(parseNum('  7 ')).toBe(7);
        expect(parseNum(3)).toBe(3);
        expect(parseNum(0)).toBe(0);
    });

    it('parseIntStrict: calkowite OK; ulamki/smieci -> null; pusty -> 0 (kontrakt excel)', () => {
        const { sandbox } = loadParseNum();
        const parseIntStrict = sandbox.parseIntStrict as (v: unknown) => number | null;
        expect(parseIntStrict(null)).toBeNull();
        expect(parseIntStrict('')).toBe(0);
        expect(parseIntStrict('3')).toBe(3);
        expect(parseIntStrict('  5 ')).toBe(5);
        expect(parseIntStrict('-2')).toBe(-2);
        expect(parseIntStrict('3.7')).toBeNull();
        expect(parseIntStrict('12abc')).toBeNull();
        expect(parseIntStrict(4)).toBe(4);
        expect(parseIntStrict(4.5)).toBeNull();
    });

    it('parseDn: DN1000/dn 1200/1000 -> liczba; styczna/pusto -> null', () => {
        const { sandbox } = loadParseNum();
        const parseDn = sandbox.parseDn as (v: unknown) => number | null;
        expect(parseDn('DN1000')).toBe(1000);
        expect(parseDn('dn 1200')).toBe(1200);
        expect(parseDn('1000')).toBe(1000);
        expect(parseDn('Krag DN2000/750')).toBe(2000);
        expect(parseDn(160)).toBe(160);
        expect(parseDn('styczna')).toBeNull();
        expect(parseDn('')).toBeNull();
        expect(parseDn(null)).toBeNull();
    });

    it('clamp: domyka do [min, max]; nie-liczba -> min', () => {
        const { sandbox } = loadParseNum();
        const clamp = sandbox.clamp as (v: unknown, min: number, max: number) => number;
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-2, 0, 10)).toBe(0);
        expect(clamp(99, 0, 10)).toBe(10);
        expect(clamp('3,5', 0, 10)).toBe(3.5);
        expect(clamp('x', 2, 9)).toBe(2);
        expect(clamp(null, 2, 9)).toBe(2);
    });

    it('normalizeHeader: trim + UPPER (kontrakt XlsxImportShared)', () => {
        const { sandbox } = loadParseNum();
        const normalizeHeader = sandbox.normalizeHeader as (v: unknown) => string;
        expect(normalizeHeader(' numer_oferty ')).toBe('NUMER_OFERTY');
        expect(normalizeHeader('Ilosc')).toBe('ILOSC');
        expect(normalizeHeader(null)).toBe('');
        expect(normalizeHeader(undefined)).toBe('');
    });

    it('emitExcelMutated: bez DOM -> false; z document -> true + event sok:excel-mutated', () => {
        const { sandbox } = loadParseNum();
        const emit = sandbox.emitExcelMutated as (d?: unknown) => boolean;
        expect(emit({})).toBe(false);
        let captured: any = null;
        sandbox.CustomEvent = function (type: string, opts: any) {
            this.type = type;
            this.detail = opts && opts.detail;
            this.bubbles = opts && opts.bubbles;
        };
        sandbox.document = {
            dispatchEvent: (e: any) => {
                captured = e;
                return true;
            }
        };
        expect(emit({ wIdx: 1 })).toBe(true);
        expect(captured && captured.type).toBe('sok:excel-mutated');
        expect(captured && captured.detail).toEqual({ wIdx: 1 });
    });

    it('bridge: dokladnie jeden nowy global window.SokParse z 6 funkcjami', () => {
        const { sandbox, src } = loadParseNum();
        const bridge = sandbox.window.SokParse;
        expect(typeof bridge).toBe('object');
        for (const name of [
            'parseNum',
            'parseIntStrict',
            'parseDn',
            'clamp',
            'normalizeHeader',
            'emitExcelMutated'
        ]) {
            expect(typeof bridge[name]).toBe('function');
        }
        // Ten sam wzorzec co scripts/check-global-collisions.mjs (=== nie liczy sie).
        const assigns = src.match(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?![=])/g) || [];
        expect(assigns).toHaveLength(1);
        expect(assigns[0]).toMatch(/window\.SokParse\s*=/);
    });

    it('calcInput.js:92 uzywa SSoT parseNum zamiast surowego parseFloat', () => {
        const src = fs.readFileSync(CALC_INPUT_PATH, 'utf8');
        expect(src).toMatch(/SokParse/);
        expect(src).not.toMatch(/return parseFloat\(str\)/);
    });

    it('studnie.html laduje shared/parseNum.js', () => {
        const html = fs.readFileSync(STUDNIE_HTML_PATH, 'utf8');
        expect(html).toMatch(/js\/shared\/parseNum\.js\?v=/);
    });
});
