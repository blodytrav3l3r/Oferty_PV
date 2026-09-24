/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- runtime collapseState.js w jsdom, celowy brak typow
/* ===== COLLAPSE STATE =====
 * Persystencja zwinięć sekcji (public/js/shared/collapseState.js):
 * defaulty bez zapisu, zapis/odczyt roundtrip, izolacja per-user
 * (suffix jak theme.js), uszkodzony JSON/shape → defaulty,
 * collapseApply na DOM (display + chevron), brak throw przy
 * niedostępnym localStorage (tryb prywatny).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const COLLAPSE_JS = fs.readFileSync(path.join(ROOT, 'public/js/shared/collapseState.js'), 'utf8');

function loadCollapseOnce() {
    if (!window.collapseGet) window.eval(COLLAPSE_JS);
    return { get: window.collapseGet, set: window.collapseSet, apply: window.collapseApply };
}

describe('collapseState', () => {
    let collapse;

    beforeAll(() => {
        collapse = loadCollapseOnce();
    });

    beforeEach(() => {
        window.localStorage.clear();
        window.currentUser = undefined;
        document.body.innerHTML = '';
    });

    test('brak zapisu → defaultOpen (default true)', () => {
        expect(collapse.get('zl-dane-zlecenia')).toBe(true);
        expect(collapse.get('well-params-content', false)).toBe(false);
        expect(collapse.get('tiles-content', true)).toBe(true);
    });

    test('set(false) → get(false); set(true) → get(true) (roundtrip)', () => {
        collapse.set('zl-dane-zlecenia', false);
        expect(collapse.get('zl-dane-zlecenia')).toBe(false);
        collapse.set('zl-dane-zlecenia', true);
        expect(collapse.get('zl-dane-zlecenia')).toBe(true);
    });

    test('wiele sekcji niezależnie', () => {
        collapse.set('a', false);
        collapse.set('b', true);
        expect(collapse.get('a')).toBe(false);
        expect(collapse.get('b')).toBe(true);
        expect(collapse.get('c')).toBe(true);
    });

    test('izolacja per-user (suffix jak theme.js)', () => {
        window.currentUser = { id: 'u1' };
        collapse.set('zl-dane-elementu', false);
        expect(collapse.get('zl-dane-elementu')).toBe(false);
        window.currentUser = { id: 'u2' };
        expect(collapse.get('zl-dane-elementu')).toBe(true);
        collapse.set('zl-dane-elementu', false);
        window.currentUser = { id: 'u1' };
        expect(collapse.get('zl-dane-elementu')).toBe(false);
    });

    test('uszkodzony JSON → defaulty, nie throw', () => {
        window.localStorage.setItem('sok-collapse', 'nie-json{{{');
        expect(collapse.get('x')).toBe(true);
        collapse.set('x', false);
        expect(collapse.get('x')).toBe(false);
    });

    test('nie-boolean wartości ignorowane', () => {
        window.localStorage.setItem('sok-collapse', JSON.stringify({ x: 'tak', y: 1, z: false }));
        expect(collapse.get('x')).toBe(true);
        expect(collapse.get('y')).toBe(true);
        expect(collapse.get('z')).toBe(false);
    });

    test('pusty id → default, set z pustym id nie zapisuje', () => {
        expect(collapse.get('', false)).toBe(false);
        collapse.set('', false);
        expect(window.localStorage.getItem('sok-collapse')).toBeNull();
    });

    test('collapseApply zamyka: display none + chevron-down, zwraca false', () => {
        document.body.innerHTML =
            '<div id="tiles-content" style="display:block;"></div><span id="tiles-icon"></span>';
        collapse.set('tiles-content', false);
        const isOpen = collapse.apply('tiles-content', 'tiles-icon', true);
        expect(isOpen).toBe(false);
        expect(document.getElementById('tiles-content').style.display).toBe('none');
        expect(document.getElementById('tiles-icon').innerHTML).toContain('chevron-down');
    });

    test('collapseApply otwiera z custom display (grid)', () => {
        document.body.innerHTML = '<div id="zl-dane-zlecenia-container"></div>';
        const isOpen = collapse.apply('zl-dane-zlecenia-container', null, false, 'grid');
        expect(isOpen).toBe(false);
        expect(document.getElementById('zl-dane-zlecenia-container').style.display).toBe('none');
        collapse.set('zl-dane-zlecenia-container', true);
        expect(collapse.apply('zl-dane-zlecenia-container', null, false, 'grid')).toBe(true);
        expect(document.getElementById('zl-dane-zlecenia-container').style.display).toBe('grid');
    });

    test('collapseApply bez DOM nie rzuca, zwraca stan', () => {
        expect(collapse.apply('nie-istnieje', 'tez-nie', true)).toBe(true);
    });

    test('niedostępny localStorage (tryb prywatny) → brak throw', () => {
        const getSpy = jest.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        const setSpy = jest.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(() => collapse.get('a')).not.toThrow();
        expect(() => collapse.set('a', false)).not.toThrow();
        expect(collapse.get('a')).toBe(true);
        getSpy.mockRestore();
        setSpy.mockRestore();
    });
});
