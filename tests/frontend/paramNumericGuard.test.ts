// @ts-nocheck -- celowy brak typow dla public/js (delegacja CSP, jsdom)
import fs from 'fs';
import path from 'path';

/**
 * P2: invalid numeryczny nie wchodzi do modelu jako ciche 0.
 * - $updateWellParamF / $wellParamRefresh: śmieć → skip + toast, brak propagacji.
 * - '12,5' (przecinek) → 12.5; puste → 0 (legacy).
 * - orderPrzejscia: value dnOd/dnDo escapowane (XSS, atrybut).
 */

function loadCspActionsOnce() {
    const src = fs.readFileSync(
        path.join(__dirname, '../../public/js/shared/cspActions.js'),
        'utf8'
    );
    (0, eval)(src + '\n//# sourceURL=cspActions.js');
}

function change(el: HTMLElement) {
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

describe('cspActions: straznik finite na parametrach studni (P2)', () => {
    beforeAll(() => {
        loadCspActionsOnce();
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        (window as any).updateWellParam = jest.fn();
        (window as any)._excelUpdateWellParam = jest.fn();
        (window as any).excelRefreshParamsPopup = jest.fn();
        (window as any).showToast = jest.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete (window as any).updateWellParam;
        delete (window as any)._excelUpdateWellParam;
        delete (window as any).excelRefreshParamsPopup;
        delete (window as any).showToast;
    });

    test('$updateWellParamF: smiec nie propaguje, toast error', () => {
        document.body.innerHTML =
            '<input id="f" data-csp="$updateWellParamF" data-csp-on="change" data-csp-args=\'["rzednaDna"]\' value="abc">';
        change(document.getElementById('f')!);
        expect((window as any).updateWellParam).not.toHaveBeenCalled();
        expect((window as any).showToast).toHaveBeenCalledWith(
            expect.stringContaining('Nieprawidłowa'),
            'error'
        );
    });

    test('$updateWellParamF: przecinek parsuje, puste daje 0', () => {
        document.body.innerHTML =
            '<input id="f" data-csp="$updateWellParamF" data-csp-on="change" data-csp-args=\'["rzednaDna"]\' value="12,5">';
        change(document.getElementById('f')!);
        expect((window as any).updateWellParam).toHaveBeenCalledWith('rzednaDna', 12.5);

        (window as any).updateWellParam.mockClear();
        (document.getElementById('f') as HTMLInputElement).value = '';
        change(document.getElementById('f')!);
        expect((window as any).updateWellParam).toHaveBeenCalledWith('rzednaDna', 0);
    });

    test('$wellParamRefresh: smiec nie wywoluje update ani popupu', () => {
        document.body.innerHTML =
            '<input id="f" data-csp="$wellParamRefresh" data-csp-on="change" data-csp-args=\'["well-1", "rzednaDna", null, 1]\' value="xyz">';
        change(document.getElementById('f')!);
        expect((window as any)._excelUpdateWellParam).not.toHaveBeenCalled();
        expect((window as any).excelRefreshParamsPopup).not.toHaveBeenCalled();
    });

    test('orderPrzejscia: dnOd/dnDo w value escapowane atrybutowo', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderPrzejscia.js'),
            'utf8'
        );
        expect(src).toMatch(/\$\{escapeHtmlAttr\(row\.dnOd \|\| ''\)\}/);
        expect(src).toMatch(/\$\{escapeHtmlAttr\(row\.dnDo \|\| ''\)\}/);
        expect(src).not.toMatch(/\$\{row\.dnOd \|\| ''\}/);
        expect(src).not.toMatch(/\$\{row\.dnDo \|\| ''\}/);
    });
});
