/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- runtime public/js w jsdom, celowy brak typow
/* ===== LOCALSTORAGE GUARDS (A3) =====
 * Wzorzec displayUnits.js/theme.js/excelState.js: try/catch + walidacja typu.
 * Moduly: kartotekaInit.js (compact-mode), mlDualRanking.js (wells_ai_influence),
 * shape-guard dla excelVirtual.js / orderBulk.js / wellVirtual.js.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const KARTOTEKA_JS = fs.readFileSync(
    path.join(ROOT, 'public/js/kartoteka/kartotekaInit.js'),
    'utf8'
);
const ML_JS = fs.readFileSync(path.join(ROOT, 'public/js/studnie/mlDualRanking.js'), 'utf8');

function throwingError(name) {
    const e = new Error(name + ' (test)');
    e.name = name;
    return e;
}

/** kartotekaInit.js: `let` na top-level -> eval przez new Function (re-runnable). */
function loadKartoteka() {
    const fn = new Function(KARTOTEKA_JS);
    fn();
}

function loadMlFresh() {
    delete window.getAiInfluencePct;
    window.eval(ML_JS);
}

describe('localStorage guards (A3)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.body.innerHTML = '';
        global.fetch = jest.fn().mockRejectedValue(new Error('offline-test'));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('kartotekaInit: getItem rzuca SecurityError przy load -> brak throw', () => {
        const spy = jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
            throw throwingError('SecurityError');
        });
        expect(() => loadKartoteka()).not.toThrow();
        expect(typeof window.toggleCompactMode).toBe('function');
        spy.mockRestore();
    });

    test('kartotekaInit: setItem rzuca QuotaExceededError -> toggle nie rzuca', () => {
        loadKartoteka();
        const spy = jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
            throw throwingError('QuotaExceededError');
        });
        expect(() => window.toggleCompactMode()).not.toThrow();
        expect(() => window.toggleCompactMode()).not.toThrow();
        spy.mockRestore();
    });

    test('kartotekaInit: zly typ wartosci (JSON/tekst) -> default false, brak throw', () => {
        window.localStorage.setItem('kartoteka-compact-mode', '["tak"]');
        loadKartoteka();
        document.body.innerHTML = '<div id="ka-offers-list"></div>';
        expect(() =>
            document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }))
        ).not.toThrow();
        expect(document.getElementById('ka-offers-list').classList.contains('compact-mode')).toBe(
            false
        );
    });

    test('mlDualRanking: getItem rzuca SecurityError -> resolve 0, brak reject', async () => {
        loadMlFresh();
        const spy = jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
            throw throwingError('SecurityError');
        });
        await expect(window.getAiInfluencePct()).resolves.toBe(0);
        spy.mockRestore();
    });

    test('mlDualRanking: setItem rzuca nie wplywa; zla wartosc "abc" -> fallback 0', async () => {
        loadMlFresh();
        window.localStorage.setItem('wells_ai_influence', 'abc');
        await expect(window.getAiInfluencePct()).resolves.toBe(0);
    });

    test('mlDualRanking: wartosc spoza zakresu "150" -> fallback 0', async () => {
        loadMlFresh();
        window.localStorage.setItem('wells_ai_influence', '150');
        await expect(window.getAiInfluencePct()).resolves.toBe(0);
    });

    test('mlDualRanking: poprawne "42" -> 42 (semantyka zachowana)', async () => {
        loadMlFresh();
        window.localStorage.setItem('wells_ai_influence', '42');
        await expect(window.getAiInfluencePct()).resolves.toBe(42);
    });

    test.each([
        ['public/js/studnie/excelVirtual.js', 'sok_excel_virtual'],
        ['public/js/studnie/orderBulk.js', 'sok_bulk_virtual'],
        ['public/js/studnie/wellVirtual.js', 'sok_well_virtual']
    ])('%s: getItem(%s) w bloku try/catch', (rel, key) => {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const lines = src.split('\n');
        const hitIdx = lines.findIndex((l) => l.includes('getItem') && l.includes(key));
        expect(hitIdx).toBeGreaterThan(-1);
        const back = lines.slice(Math.max(0, hitIdx - 12), hitIdx + 1).join('\n');
        const fwd = lines.slice(hitIdx, hitIdx + 8).join('\n');
        expect(back).toMatch(/try\s*\{/);
        expect(fwd).toMatch(/catch/);
    });
});
